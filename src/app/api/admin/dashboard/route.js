import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TOP_COUNT = 5;
const DEFAULT_USER_LIMIT = 100;
const DEFAULT_CAPTION_LIMIT = 100;
const DEFAULT_IMAGE_LIMIT = 30;
const MIN_SEARCH_LENGTH = 3;
const SEARCH_PAGE_SIZE = 1000;
const SEARCH_MAX_SCAN_ROWS = 60000;
const SEARCH_RESULT_LIMIT = 1000;
const TOP_CAPTION_SCAN_LIMIT = 5000;
const CAPTION_VOTE_SCAN_PAGE_SIZE = 2000;
const CAPTION_LOOKUP_BATCH_SIZE = 100;
const CAPTION_TEXT_KEYS = ['content', 'caption', 'text', 'title', 'generated_caption', 'caption_text'];
const SEARCH_VIEW_CONFIG = {
  users: {
    tableName: 'profiles',
    columns: '*',
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    searchableColumns: ['id', 'first_name', 'last_name', 'email'],
  },
  captions: {
    tableName: 'captions',
    columns: '*',
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    searchableColumns: ['id', 'profile_id', 'image_id', 'content'],
  },
  images: {
    tableName: 'images',
    columns:
      'id,url,image_description,additional_context,is_public,is_common_use,celebrity_recognition,created_datetime_utc,modified_datetime_utc',
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    searchableColumns: ['id', 'url', 'image_description', 'additional_context'],
  },
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseSearchLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return SEARCH_RESULT_LIMIT;
  }

  return Math.min(Math.floor(parsedLimit), SEARCH_RESULT_LIMIT);
}

function toSearchableText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value) ?? '';
  }

  return String(value);
}

function resolveCaptionText(caption) {
  for (const key of CAPTION_TEXT_KEYS) {
    const value = caption?.[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getCaptionImageUrl(caption, imageUrlById) {
  const imageId = toDisplayText(caption?.image_id);
  if (!imageId) {
    return null;
  }

  return imageUrlById.get(imageId) ?? null;
}

function formatUserLabel(user, userId) {
  const firstName = toDisplayText(user?.first_name) ?? '';
  const lastName = toDisplayText(user?.last_name) ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return userId;
}

function joinErrors(messages) {
  return messages.filter((message) => Boolean(message)).join(' ');
}

function isFetchFailedMessage(message) {
  return typeof message === 'string' && message.toLowerCase().includes('fetch failed');
}

async function runSupabaseQueryWithRetry(executeQuery, maxRetries = 2) {
  let lastResult = { data: null, error: null };

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let result;
    try {
      result = await executeQuery();
    } catch (error) {
      result = {
        data: null,
        error: {
          message: error?.message ?? 'Unknown fetch error.',
        },
      };
    }

    const errorMessage = result?.error?.message;

    if (!result?.error) {
      return result;
    }

    lastResult = result;

    if (!isFetchFailedMessage(errorMessage) || attempt === maxRetries) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }

  return lastResult;
}

function buildOrderedQuery(supabase, config) {
  let query = supabase
    .from(config.tableName)
    .select(config.columns)
    .order(config.orderColumn, { ascending: false });

  if (toDisplayText(config.tieBreakerColumn)) {
    query = query.order(config.tieBreakerColumn, { ascending: false });
  }

  return query;
}

async function fetchRecentRows(supabase, tableName, columns, rowLimit, options = {}) {
  const orderColumn = options.orderColumn ?? 'created_datetime_utc';
  const tieBreakerColumn = options.tieBreakerColumn ?? 'id';
  let query = supabase.from(tableName).select(columns).order(orderColumn, { ascending: false });

  if (tieBreakerColumn) {
    query = query.order(tieBreakerColumn, { ascending: false });
  }

  if (typeof options.applyFilters === 'function') {
    query = options.applyFilters(query);
  }

  const { data, error } = await runSupabaseQueryWithRetry(() => query.range(0, rowLimit - 1));

  return {
    rows: Array.isArray(data) ? data : [],
    error,
  };
}

async function enrichRowsWithProfileData(supabase, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Array.isArray(rows) ? rows : [];
  }

  const profileIds = [...new Set(rows.map((row) => toDisplayText(row?.profile_id)).filter(Boolean))];
  if (profileIds.length === 0) {
    return rows;
  }

  const { data: profileRows, error: profileError } = await runSupabaseQueryWithRetry(() =>
    supabase.from('profiles').select('id,first_name,last_name,email').in('id', profileIds)
  );

  if (profileError) {
    return rows;
  }

  const profileById = new Map();

  for (const profile of profileRows ?? []) {
    const profileId = toDisplayText(profile?.id);
    if (!profileId) {
      continue;
    }

    profileById.set(profileId, profile);
  }

  return rows.map((row) => {
    const profileId = toDisplayText(row?.profile_id);
    const profile = profileId ? profileById.get(profileId) : null;

    return {
      ...row,
      profile_first_name: toDisplayText(profile?.first_name),
      profile_last_name: toDisplayText(profile?.last_name),
      profile_email: toDisplayText(profile?.email),
    };
  });
}

async function searchRowsWithRecentScan(supabase, viewKey, rawSearchQuery, rowLimit) {
  const config = SEARCH_VIEW_CONFIG[viewKey];
  if (!config) {
    return { rows: [], error: new Error('Invalid search view.') };
  }

  const normalizedQuery = String(rawSearchQuery ?? '').trim().toLowerCase();
  if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
    return { rows: [], error: null };
  }

  const matchedRows = [];
  let scannedRows = 0;
  let offset = 0;

  while (scannedRows < SEARCH_MAX_SCAN_ROWS && matchedRows.length < rowLimit) {
    const remainingRowsToScan = SEARCH_MAX_SCAN_ROWS - scannedRows;
    const batchSize = Math.min(SEARCH_PAGE_SIZE, remainingRowsToScan);

    const { data, error } = await runSupabaseQueryWithRetry(() =>
      buildOrderedQuery(supabase, config).range(offset, offset + batchSize - 1)
    );

    if (error) {
      return { rows: matchedRows, error };
    }

    const batchRows = Array.isArray(data) ? data : [];
    if (batchRows.length === 0) {
      break;
    }

    for (const row of batchRows) {
      const searchableText = config.searchableColumns
        .map((column) => toSearchableText(row?.[column]).toLowerCase())
        .join(' ');

      if (!searchableText.includes(normalizedQuery)) {
        continue;
      }

      matchedRows.push(row);

      if (matchedRows.length >= rowLimit) {
        break;
      }
    }

    scannedRows += batchRows.length;
    offset += batchRows.length;

    if (batchRows.length < batchSize) {
      break;
    }
  }

  return { rows: matchedRows, error: null };
}

function chunkValues(values, chunkSize) {
  if (!Array.isArray(values) || values.length === 0 || chunkSize <= 0) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

async function getTopImagesByNetLikes(supabase) {
  const voteCountsByCaptionId = new Map();
  let offset = 0;

  while (true) {
    const { data: captionVoteRows, error: captionVoteError } = await runSupabaseQueryWithRetry(() =>
      supabase
        .from('caption_votes')
        .select('id,caption_id,vote_value')
        .order('id', { ascending: true })
        .range(offset, offset + CAPTION_VOTE_SCAN_PAGE_SIZE - 1)
    );

    if (captionVoteError) {
      return { topImages: [], error: captionVoteError.message };
    }

    const rows = Array.isArray(captionVoteRows) ? captionVoteRows : [];

    if (rows.length === 0) {
      break;
    }

    for (const voteRow of rows) {
      const captionId = toDisplayText(voteRow?.caption_id);
      if (!captionId) {
        continue;
      }

      const direction = getVoteDirection(voteRow?.vote_value);
      if (direction === 0) {
        continue;
      }

      const voteCounts = voteCountsByCaptionId.get(captionId) ?? { upvotes: 0, downvotes: 0 };
      if (direction > 0) {
        voteCounts.upvotes += 1;
      } else {
        voteCounts.downvotes += 1;
      }

      voteCountsByCaptionId.set(captionId, voteCounts);
    }

    offset += rows.length;

    if (rows.length < CAPTION_VOTE_SCAN_PAGE_SIZE) {
      break;
    }
  }

  if (voteCountsByCaptionId.size === 0) {
    return { topImages: [], error: null };
  }

  const captionImageIdByCaptionId = new Map();
  const captionIds = [...voteCountsByCaptionId.keys()];
  const captionIdChunks = chunkValues(captionIds, CAPTION_LOOKUP_BATCH_SIZE);

  for (const chunk of captionIdChunks) {
    const { data: captionRows, error: captionsError } = await runSupabaseQueryWithRetry(() =>
      supabase.from('captions').select('id,image_id').in('id', chunk)
    );

    if (captionsError) {
      return { topImages: [], error: captionsError.message };
    }

    for (const caption of captionRows ?? []) {
      const captionId = toDisplayText(caption?.id);
      const imageId = toDisplayText(caption?.image_id);
      if (!captionId || !imageId) {
        continue;
      }

      captionImageIdByCaptionId.set(captionId, imageId);
    }
  }

  const likeTotalsByImageId = new Map();

  for (const [captionId, voteCounts] of voteCountsByCaptionId.entries()) {
    const imageId = captionImageIdByCaptionId.get(captionId);
    if (!imageId) {
      continue;
    }

    const likes = voteCounts.upvotes - voteCounts.downvotes;
    const currentImageTotals = likeTotalsByImageId.get(imageId) ?? { likes: 0, upvotes: 0, downvotes: 0 };

    currentImageTotals.likes += likes;
    currentImageTotals.upvotes += voteCounts.upvotes;
    currentImageTotals.downvotes += voteCounts.downvotes;

    likeTotalsByImageId.set(imageId, currentImageTotals);
  }

  const topImageEntries = [...likeTotalsByImageId.entries()]
    .map(([imageId, totals]) => ({
      imageId,
      likes: toNumber(totals.likes),
      upvotes: Math.max(0, toNumber(totals.upvotes)),
      downvotes: Math.max(0, toNumber(totals.downvotes)),
    }))
    .sort(
      (first, second) =>
        second.likes - first.likes || second.upvotes - first.upvotes || String(first.imageId).localeCompare(String(second.imageId))
    )
    .slice(0, TOP_COUNT);

  if (topImageEntries.length === 0) {
    return { topImages: [], error: null };
  }

  const topImageIds = topImageEntries.map((entry) => entry.imageId);
  const { data: imageRows, error: imagesError } = await runSupabaseQueryWithRetry(() =>
    supabase.from('images').select('id,url,image_description').in('id', topImageIds)
  );

  if (imagesError) {
    return { topImages: [], error: imagesError.message };
  }

  const imageById = new Map();

  for (const image of imageRows ?? []) {
    const imageId = toDisplayText(image?.id);
    if (!imageId) {
      continue;
    }

    imageById.set(imageId, image);
  }

  const topImages = topImageEntries.map((entry) => {
    const image = imageById.get(entry.imageId);

    return {
      imageId: entry.imageId,
      likes: entry.likes,
      upvotes: entry.upvotes,
      downvotes: entry.downvotes,
      label: toDisplayText(image?.image_description) ?? entry.imageId,
      imageUrl: toDisplayText(image?.url),
    };
  });

  return { topImages, error: null };
}

async function getTopUpvoteStats(supabase) {
  const [{ data: captionRows, error: captionsError }, topImageStats] = await Promise.all([
    runSupabaseQueryWithRetry(() =>
      supabase
        .from('captions')
        .select('id,profile_id,image_id,content,like_count,created_datetime_utc')
        .gt('like_count', 0)
        .order('like_count', { ascending: false })
        .order('created_datetime_utc', { ascending: false })
        .order('id', { ascending: false })
        .range(0, TOP_CAPTION_SCAN_LIMIT - 1)
    ),
    getTopImagesByNetLikes(supabase),
  ]);

  if (captionsError) {
    return {
      topCaptions: [],
      topUsers: [],
      topImages: topImageStats.topImages,
      error: joinErrors([captionsError.message, topImageStats.error]),
    };
  }

  const positiveCaptionRows = Array.isArray(captionRows)
    ? captionRows.filter((caption) => toNumber(caption?.like_count) > 0 && toDisplayText(caption?.id))
    : [];

  if (positiveCaptionRows.length === 0) {
    return {
      topCaptions: [],
      topUsers: [],
      topImages: topImageStats.topImages,
      error: topImageStats.error,
    };
  }

  const topCaptionRows = positiveCaptionRows.slice(0, TOP_COUNT);
  const topCaptionIds = topCaptionRows.map((caption) => toDisplayText(caption?.id)).filter(Boolean);

  const imageIds = [...new Set(topCaptionRows.map((caption) => toDisplayText(caption?.image_id)).filter(Boolean))];
  const captionVoteCountsByCaptionId = new Map();
  let topCaptionVotesErrorMessage = null;

  if (topCaptionIds.length > 0) {
    const { data: captionVoteRows, error: captionVotesError } = await runSupabaseQueryWithRetry(() =>
      supabase.from('caption_votes').select('caption_id,vote_value').in('caption_id', topCaptionIds)
    );

    if (captionVotesError) {
      topCaptionVotesErrorMessage = captionVotesError.message;
    } else {
      for (const voteRow of captionVoteRows ?? []) {
        const captionId = toDisplayText(voteRow?.caption_id);
        if (!captionId) {
          continue;
        }

        const direction = getVoteDirection(voteRow?.vote_value);
        if (direction === 0) {
          continue;
        }

        const counts = captionVoteCountsByCaptionId.get(captionId) ?? { upvotes: 0, downvotes: 0 };

        if (direction > 0) {
          counts.upvotes += 1;
        } else {
          counts.downvotes += 1;
        }

        captionVoteCountsByCaptionId.set(captionId, counts);
      }
    }
  }

  const imageUrlById = new Map();

  if (imageIds.length > 0) {
    const { data: imageRows, error: imageError } = await runSupabaseQueryWithRetry(() =>
      supabase.from('images').select('id,url').in('id', imageIds)
    );

    if (imageError) {
      return {
        topCaptions: [],
        topUsers: [],
        topImages: topImageStats.topImages,
        error: joinErrors([imageError.message, topImageStats.error, topCaptionVotesErrorMessage]),
      };
    }

    for (const image of imageRows ?? []) {
      const imageId = toDisplayText(image?.id);
      const imageUrl = toDisplayText(image?.url);

      if (!imageId || !imageUrl) {
        continue;
      }

      imageUrlById.set(imageId, imageUrl);
    }
  }

  const topCaptions = topCaptionRows
    .map((caption) => {
      const captionId = toDisplayText(caption?.id);
      if (!captionId) {
        return null;
      }

      const likes = Math.max(0, toNumber(caption?.like_count));
      const captionVoteCounts = captionVoteCountsByCaptionId.get(captionId);
      const upvotes = captionVoteCounts?.upvotes ?? likes;
      const downvotes = captionVoteCounts?.downvotes ?? 0;

      return {
        captionId,
        likes,
        upvotes,
        downvotes,
        label: resolveCaptionText(caption) ?? captionId,
        imageUrl: getCaptionImageUrl(caption, imageUrlById),
      };
    })
    .filter(Boolean);

  const userUpvoteCounts = new Map();

  for (const caption of positiveCaptionRows) {
    const ownerUserId = toDisplayText(caption?.profile_id);
    const captionLikeCount = Math.max(0, toNumber(caption?.like_count));

    if (!ownerUserId) {
      continue;
    }

    userUpvoteCounts.set(ownerUserId, (userUpvoteCounts.get(ownerUserId) ?? 0) + captionLikeCount);
  }

  const topUserEntries = [...userUpvoteCounts.entries()]
    .sort((first, second) => second[1] - first[1] || String(first[0]).localeCompare(String(second[0])))
    .slice(0, TOP_COUNT);

  const topUserIds = topUserEntries.map(([userId]) => userId);
  const userById = new Map();

  if (topUserIds.length > 0) {
    const { data: userRows, error: usersError } = await runSupabaseQueryWithRetry(() =>
      supabase.from('profiles').select('id,first_name,last_name,email').in('id', topUserIds)
    );

    if (usersError) {
      return {
        topCaptions: [],
        topUsers: [],
        topImages: topImageStats.topImages,
        error: joinErrors([usersError.message, topImageStats.error, topCaptionVotesErrorMessage]),
      };
    }

    for (const user of userRows ?? []) {
      const userId = toDisplayText(user?.id);

      if (!userId) {
        continue;
      }

      userById.set(userId, user);
    }
  }

  const topUsers = topUserEntries.map(([userId, upvotes]) => {
    const user = userById.get(userId);

    return {
      userId,
      upvotes,
      label: formatUserLabel(user, userId),
      email: toDisplayText(user?.email),
    };
  });

  return {
    topCaptions,
    topUsers,
    topImages: topImageStats.topImages,
    error: joinErrors([topImageStats.error, topCaptionVotesErrorMessage]),
  };
}

async function getCreatedCountSince(supabase, tableName, sinceIsoString, options = {}) {
  const { timestampColumn = 'created_datetime_utc', applyFilters } = options;
  const { count, error } = await runSupabaseQueryWithRetry(() => {
    let query = supabase.from(tableName).select('id', { count: 'exact', head: true }).gte(timestampColumn, sinceIsoString);

    if (typeof applyFilters === 'function') {
      query = applyFilters(query);
    }

    return query;
  });

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

async function getTableCount(supabase, tableName) {
  const { count, error } = await runSupabaseQueryWithRetry(() =>
    supabase.from(tableName).select('id', { count: 'exact', head: true })
  );

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

function buildEmptyCaptionAnalytics(totalCaptions = 0) {
  const safeTotalCaptions = Math.max(0, toNumber(totalCaptions));

  return {
    totalCaptions: safeTotalCaptions,
    captionsWithVotes: 0,
    captionsWithoutVotes: safeTotalCaptions,
    coveragePercent: 0,
    upvotesTotal: 0,
    downvotesTotal: 0,
    totalVotes: 0,
    upvoteToDownvoteRatio: null,
    hasDownvoteData: true,
    distribution: {
      positive: 0,
      neutral: 0,
      negative: 0,
      noVotes: safeTotalCaptions,
    },
    error: null,
  };
}

function getVoteDirection(voteValue) {
  const parsedVoteValue = toNumber(voteValue);

  if (parsedVoteValue > 0) {
    return 1;
  }

  if (parsedVoteValue < 0) {
    return -1;
  }

  return 0;
}

async function getCaptionRatingAnalytics(supabase, totalCaptionsHint = null) {
  const analytics = buildEmptyCaptionAnalytics(totalCaptionsHint ?? 0);
  const totalCaptions = toNumber(totalCaptionsHint);

  if (totalCaptions <= 0) {
    return analytics;
  }

  analytics.totalCaptions = totalCaptions;
  analytics.captionsWithoutVotes = totalCaptions;
  analytics.distribution.noVotes = totalCaptions;

  let offset = 0;
  let upvoteTotal = 0;
  let downvoteTotal = 0;
  const votesByCaptionId = new Map();
  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;
  while (true) {
    const { data: captionVoteRows, error: captionVoteError } = await runSupabaseQueryWithRetry(() =>
      supabase
        .from('caption_votes')
        .select('id,caption_id,vote_value')
        .order('id', { ascending: true })
        .range(offset, offset + CAPTION_VOTE_SCAN_PAGE_SIZE - 1)
    );

    if (captionVoteError) {
      return {
        ...analytics,
        error: captionVoteError.message,
      };
    }

    const rows = Array.isArray(captionVoteRows) ? captionVoteRows : [];

    if (rows.length === 0) {
      break;
    }

    for (const voteRow of rows) {
      const captionId = toDisplayText(voteRow?.caption_id);
      if (!captionId) {
        continue;
      }

      const direction = getVoteDirection(voteRow?.vote_value);
      if (direction === 0) {
        continue;
      }

      const currentVoteCounts = votesByCaptionId.get(captionId) ?? { upvotes: 0, downvotes: 0 };

      if (direction > 0) {
        currentVoteCounts.upvotes += 1;
        upvoteTotal += 1;
      } else {
        currentVoteCounts.downvotes += 1;
        downvoteTotal += 1;
      }

      votesByCaptionId.set(captionId, currentVoteCounts);
    }

    offset += rows.length;

    if (rows.length < CAPTION_VOTE_SCAN_PAGE_SIZE) {
      break;
    }
  }

  const captionsWithVotes = votesByCaptionId.size;

  for (const { upvotes, downvotes } of votesByCaptionId.values()) {
    if (upvotes > downvotes) {
      positiveCount += 1;
    } else if (downvotes > upvotes) {
      negativeCount += 1;
    } else {
      neutralCount += 1;
    }
  }

  const safeCaptionsWithVotes = Math.min(totalCaptions, Math.max(0, captionsWithVotes));
  const safeCaptionsWithoutVotes = Math.max(0, totalCaptions - safeCaptionsWithVotes);
  const safeUpvoteTotal = Math.max(0, upvoteTotal);
  const safeDownvoteTotal = Math.max(0, downvoteTotal);
  const safeTotalVotes = safeUpvoteTotal + safeDownvoteTotal;

  return {
    totalCaptions,
    captionsWithVotes: safeCaptionsWithVotes,
    captionsWithoutVotes: safeCaptionsWithoutVotes,
    coveragePercent: totalCaptions > 0 ? (safeCaptionsWithVotes / totalCaptions) * 100 : 0,
    upvotesTotal: safeUpvoteTotal,
    downvotesTotal: safeDownvoteTotal,
    totalVotes: safeTotalVotes,
    upvoteToDownvoteRatio: safeDownvoteTotal > 0 ? safeUpvoteTotal / safeDownvoteTotal : null,
    hasDownvoteData: true,
    distribution: {
      positive: Math.max(0, positiveCount),
      neutral: Math.max(0, neutralCount),
      negative: Math.max(0, negativeCount),
      noVotes: safeCaptionsWithoutVotes,
    },
    error: null,
  };
}

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.is_superadmin !== true) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const viewKey = toDisplayText(searchParams.get('view'));
  const rawSearchQuery = toDisplayText(searchParams.get('q')) ?? '';

  if (viewKey) {
    if (!SEARCH_VIEW_CONFIG[viewKey]) {
      return NextResponse.json({ error: 'Invalid search view.' }, { status: 400 });
    }

    const rowLimit = parseSearchLimit(searchParams.get('limit'));
    const { rows, error } = await searchRowsWithRecentScan(supabase, viewKey, rawSearchQuery, rowLimit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const nextRows = viewKey === 'captions' ? await enrichRowsWithProfileData(supabase, rows) : rows;

    return NextResponse.json({
      view: viewKey,
      rows: nextRows,
    });
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [dayUsers, weekUsers, monthUsers, dayCaptions, weekCaptions, monthCaptions] = await Promise.all([
    getCreatedCountSince(supabase, 'profiles', dayAgo),
    getCreatedCountSince(supabase, 'profiles', weekAgo),
    getCreatedCountSince(supabase, 'profiles', monthAgo),
    getCreatedCountSince(supabase, 'captions', dayAgo, {
      applyFilters: (query) => query.not('content', 'is', null).neq('content', ''),
    }),
    getCreatedCountSince(supabase, 'captions', weekAgo, {
      applyFilters: (query) => query.not('content', 'is', null).neq('content', ''),
    }),
    getCreatedCountSince(supabase, 'captions', monthAgo, {
      applyFilters: (query) => query.not('content', 'is', null).neq('content', ''),
    }),
  ]);

  const [totalUsers, totalCaptions, totalImages] = await Promise.all([
    getTableCount(supabase, 'profiles'),
    getTableCount(supabase, 'captions'),
    getTableCount(supabase, 'images'),
  ]);

  const [usersResult, captionsResult, imagesResult, topStats, captionAnalytics] = await Promise.all([
    fetchRecentRows(
      supabase,
      'profiles',
      '*',
      DEFAULT_USER_LIMIT,
      { orderColumn: 'created_datetime_utc', tieBreakerColumn: 'id' }
    ),
    fetchRecentRows(
      supabase,
      'captions',
      '*',
      DEFAULT_CAPTION_LIMIT,
      {
        orderColumn: 'created_datetime_utc',
        tieBreakerColumn: 'id',
        applyFilters: (query) => query.not('content', 'is', null).neq('content', ''),
      }
    ),
    fetchRecentRows(
      supabase,
      'images',
      'id,url,image_description,additional_context,is_public,is_common_use,celebrity_recognition,created_datetime_utc,modified_datetime_utc',
      DEFAULT_IMAGE_LIMIT,
      { orderColumn: 'created_datetime_utc', tieBreakerColumn: 'id' }
    ),
    getTopUpvoteStats(supabase),
    getCaptionRatingAnalytics(supabase, totalCaptions.count),
  ]);

  const enrichedCaptions = await enrichRowsWithProfileData(supabase, captionsResult.rows);

  return NextResponse.json({
    newUsers: {
      day: dayUsers.count,
      week: weekUsers.count,
      month: monthUsers.count,
    },
    newCaptions: {
      day: dayCaptions.count,
      week: weekCaptions.count,
      month: monthCaptions.count,
    },
    totals: {
      users: totalUsers.count,
      captions: totalCaptions.count,
      images: totalImages.count,
    },
    topCaptions: topStats.topCaptions,
    topUsers: topStats.topUsers,
    topImages: topStats.topImages,
    captionAnalytics,
    users: usersResult.rows,
    captions: enrichedCaptions,
    images: imagesResult.rows,
    errors: {
      stats: joinErrors([
        dayUsers.error,
        weekUsers.error,
        monthUsers.error,
        dayCaptions.error,
        weekCaptions.error,
        monthCaptions.error,
      ]),
      totals: joinErrors([totalUsers.error, totalCaptions.error, totalImages.error]),
      data: joinErrors([
        usersResult.error?.message,
        captionsResult.error?.message,
        imagesResult.error?.message,
        topStats.error,
        captionAnalytics.error,
      ]),
    },
  });
}
