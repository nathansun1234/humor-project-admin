import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TOP_COUNT = 10;
const DEFAULT_USER_LIMIT = 100;
const DEFAULT_CAPTION_LIMIT = 100;
const DEFAULT_IMAGE_LIMIT = 30;
const MIN_SEARCH_LENGTH = 3;
const SEARCH_PAGE_SIZE = 1000;
const SEARCH_MAX_SCAN_ROWS = 60000;
const SEARCH_RESULT_LIMIT = 1000;
const TOP_CAPTION_SCAN_LIMIT = 5000;
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

async function getTopUpvoteStats(supabase) {
  const { data: captionRows, error: captionsError } = await runSupabaseQueryWithRetry(() =>
    supabase
      .from('captions')
      .select('id,profile_id,image_id,content,like_count,created_datetime_utc')
      .gt('like_count', 0)
      .order('like_count', { ascending: false })
      .order('created_datetime_utc', { ascending: false })
      .order('id', { ascending: false })
      .range(0, TOP_CAPTION_SCAN_LIMIT - 1)
  );

  if (captionsError) {
    return {
      topCaptions: [],
      topUsers: [],
      error: captionsError.message,
    };
  }

  const positiveCaptionRows = Array.isArray(captionRows)
    ? captionRows.filter((caption) => toNumber(caption?.like_count) > 0 && toDisplayText(caption?.id))
    : [];

  if (positiveCaptionRows.length === 0) {
    return {
      topCaptions: [],
      topUsers: [],
      error: null,
    };
  }

  const topCaptionRows = positiveCaptionRows.slice(0, TOP_COUNT);

  const imageIds = [...new Set(topCaptionRows.map((caption) => toDisplayText(caption?.image_id)).filter(Boolean))];

  const imageUrlById = new Map();

  if (imageIds.length > 0) {
    const { data: imageRows, error: imageError } = await runSupabaseQueryWithRetry(() =>
      supabase.from('images').select('id,url').in('id', imageIds)
    );

    if (imageError) {
      return {
        topCaptions: [],
        topUsers: [],
        error: imageError.message,
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

      return {
        captionId,
        upvotes: Math.max(0, toNumber(caption?.like_count)),
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
        error: usersError.message,
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
    error: null,
  };
}

async function getVoteCountSince(supabase, sinceIsoString) {
  const { count, error } = await runSupabaseQueryWithRetry(() =>
    supabase.from('caption_votes').select('id', { count: 'exact', head: true }).gte('created_datetime_utc', sinceIsoString)
  );

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

    return NextResponse.json({
      view: viewKey,
      rows,
    });
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [dayVotes, weekVotes, monthVotes] = await Promise.all([
    getVoteCountSince(supabase, dayAgo),
    getVoteCountSince(supabase, weekAgo),
    getVoteCountSince(supabase, monthAgo),
  ]);

  const [totalUsers, totalCaptions, totalImages] = await Promise.all([
    getTableCount(supabase, 'profiles'),
    getTableCount(supabase, 'captions'),
    getTableCount(supabase, 'images'),
  ]);

  const [usersResult, captionsResult, imagesResult, topStats] = await Promise.all([
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
  ]);

  return NextResponse.json({
    votes: {
      day: dayVotes.count,
      week: weekVotes.count,
      month: monthVotes.count,
    },
    totals: {
      users: totalUsers.count,
      captions: totalCaptions.count,
      images: totalImages.count,
    },
    topCaptions: topStats.topCaptions,
    topUsers: topStats.topUsers,
    users: usersResult.rows,
    captions: captionsResult.rows,
    images: imagesResult.rows,
    errors: {
      stats: joinErrors([dayVotes.error, weekVotes.error, monthVotes.error]),
      totals: joinErrors([totalUsers.error, totalCaptions.error, totalImages.error]),
      data: joinErrors([
        usersResult.error?.message,
        captionsResult.error?.message,
        imagesResult.error?.message,
        topStats.error,
      ]),
    },
  });
}
