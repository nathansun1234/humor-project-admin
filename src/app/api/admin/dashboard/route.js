import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 1000;
const TOP_COUNT = 10;
const CAPTION_TEXT_KEYS = ['content', 'caption', 'text', 'title', 'generated_caption', 'caption_text'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
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

async function getVoteCountSince(supabase, sinceIsoString) {
  const { count, error } = await supabase
    .from('caption_votes')
    .select('id', { count: 'exact', head: true })
    .gte('created_datetime_utc', sinceIsoString);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

async function getTableCount(supabase, tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true });

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

async function getAllRows(supabase, tableName, columns, orderColumn, options = {}) {
  const tieBreakerColumn = options?.tieBreakerColumn ?? null;
  const uniqueColumn = options?.uniqueColumn ?? null;
  const allRows = [];
  const seenUniqueValues = uniqueColumn ? new Set() : null;
  let from = 0;

  while (true) {
    let query = supabase
      .from(tableName)
      .select(columns)
      .order(orderColumn, { ascending: false });

    if (tieBreakerColumn) {
      query = query.order(tieBreakerColumn, { ascending: false });
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { data: allRows, error };
    }

    const rows = data ?? [];

    if (!seenUniqueValues) {
      allRows.push(...rows);
    } else {
      for (const row of rows) {
        const uniqueValue = toDisplayText(row?.[uniqueColumn]);

        if (!uniqueValue) {
          allRows.push(row);
          continue;
        }

        if (seenUniqueValues.has(uniqueValue)) {
          continue;
        }

        seenUniqueValues.add(uniqueValue);
        allRows.push(row);
      }
    }

    if (rows.length < PAGE_SIZE) {
      return { data: allRows, error: null };
    }

    from += PAGE_SIZE;
  }
}

function getTopUpvoteStats(captions, users, votes, images) {
  const captionById = new Map();
  const userById = new Map();
  const imageUrlById = new Map();
  const captionUpvoteCounts = new Map();
  const userUpvoteCounts = new Map();

  for (const caption of captions) {
    if (caption?.id) {
      captionById.set(caption.id, caption);
    }
  }

  for (const user of users) {
    if (user?.id) {
      userById.set(user.id, user);
    }
  }

  for (const image of images) {
    const imageId = toDisplayText(image?.id);
    const imageUrl = toDisplayText(image?.url);

    if (!imageId || !imageUrl) {
      continue;
    }

    imageUrlById.set(imageId, imageUrl);
  }

  for (const vote of votes) {
    if (toNumber(vote?.vote_value) <= 0) {
      continue;
    }

    const captionId = vote?.caption_id;
    if (!captionId) {
      continue;
    }

    captionUpvoteCounts.set(captionId, (captionUpvoteCounts.get(captionId) ?? 0) + 1);

    const ownerUserId = captionById.get(captionId)?.profile_id;
    if (ownerUserId) {
      userUpvoteCounts.set(ownerUserId, (userUpvoteCounts.get(ownerUserId) ?? 0) + 1);
    }
  }

  const topCaptions = [...captionUpvoteCounts.entries()]
    .sort((first, second) => second[1] - first[1] || String(first[0]).localeCompare(String(second[0])))
    .slice(0, TOP_COUNT)
    .map(([captionId, upvotes]) => {
      const caption = captionById.get(captionId);
      return {
        captionId,
        upvotes,
        label: resolveCaptionText(caption) ?? captionId,
        imageUrl: getCaptionImageUrl(caption, imageUrlById),
      };
    });

  const topUsers = [...userUpvoteCounts.entries()]
    .sort((first, second) => second[1] - first[1] || String(first[0]).localeCompare(String(second[0])))
    .slice(0, TOP_COUNT)
    .map(([userId, upvotes]) => {
      const user = userById.get(userId);
      return {
        userId,
        upvotes,
        label: formatUserLabel(user, userId),
        email: toDisplayText(user?.email),
      };
    });

  return { topCaptions, topUsers };
}

function joinErrors(messages) {
  return messages.filter((message) => Boolean(message)).join(' ');
}

export async function GET() {
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

  const [usersResult, captionsResult, votesResult, imagesResult] = await Promise.all([
    getAllRows(
      supabase,
      'profiles',
      'id,first_name,last_name,email,is_superadmin,created_datetime_utc',
      'created_datetime_utc',
      { tieBreakerColumn: 'id', uniqueColumn: 'id' }
    ),
    getAllRows(
      supabase,
      'captions',
      'id,profile_id,image_id,is_public,content,created_datetime_utc',
      'created_datetime_utc',
      { tieBreakerColumn: 'id', uniqueColumn: 'id' }
    ),
    getAllRows(supabase, 'caption_votes', 'caption_id,vote_value,created_datetime_utc', 'created_datetime_utc'),
    getAllRows(
      supabase,
      'images',
      'id,url,image_description,additional_context,is_public,is_common_use,celebrity_recognition,created_datetime_utc,modified_datetime_utc',
      'created_datetime_utc',
      { tieBreakerColumn: 'id', uniqueColumn: 'id' }
    ),
  ]);

  const users = usersResult.data ?? [];
  const captions = captionsResult.data ?? [];
  const votes = votesResult.data ?? [];
  const images = imagesResult.data ?? [];
  const { topCaptions, topUsers } = getTopUpvoteStats(captions, users, votes, images);

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
    topCaptions,
    topUsers,
    users,
    captions,
    images,
    errors: {
      stats: joinErrors([dayVotes.error, weekVotes.error, monthVotes.error]),
      totals: joinErrors([totalUsers.error, totalCaptions.error, totalImages.error]),
      data: joinErrors([
        usersResult.error?.message,
        captionsResult.error?.message,
        votesResult.error?.message,
        imagesResult.error?.message,
      ]),
    },
  });
}
