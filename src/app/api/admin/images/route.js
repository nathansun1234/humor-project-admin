import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const IMAGE_SELECT_COLUMNS = '*';
const IMAGE_METADATA_SELECT_COLUMNS = '*';

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function getAuthorizedSupabaseClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase: null, profileId: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.is_superadmin !== true) {
    return { supabase: null, profileId: null, errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, profileId: profile.id, errorResponse: null };
}

export async function GET(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const imageId = toDisplayText(searchParams.get('id'));

  if (!imageId) {
    return NextResponse.json({ error: 'Image id is required.' }, { status: 400 });
  }

  const { data: image, error } = await supabase
    .from('images')
    .select(IMAGE_METADATA_SELECT_COLUMNS)
    .eq('id', imageId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!image) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }

  return NextResponse.json({ image });
}

export async function POST(request) {
  const { supabase, profileId, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const url = toDisplayText(payload?.url);
  if (!url) {
    return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });
  }

  const insertRow = {
    id: crypto.randomUUID(),
    url,
    is_common_use: parseBoolean(payload?.is_common_use),
    profile_id: profileId,
    created_by_user_id: profileId,
    modified_by_user_id: profileId,
    additional_context: toDisplayText(payload?.additional_context),
    is_public: parseBoolean(payload?.is_public),
    image_description: toDisplayText(payload?.image_description),
    celebrity_recognition: {},
    embedding: null,
  };

  const { data: insertedImage, error: insertError } = await supabase
    .from('images')
    .insert(insertRow)
    .select(IMAGE_SELECT_COLUMNS)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ image: insertedImage });
}

export async function PATCH(request) {
  const { supabase, profileId, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const imageId = toDisplayText(payload?.id);
  if (!imageId) {
    return NextResponse.json({ error: 'Image id is required.' }, { status: 400 });
  }

  const hasPublicFlag = payload?.is_public !== undefined;
  const hasCommonUseFlag = payload?.is_common_use !== undefined;
  const hasImageDescription = payload?.image_description !== undefined;
  const hasAdditionalContext = payload?.additional_context !== undefined;

  if (!hasPublicFlag && !hasCommonUseFlag && !hasImageDescription && !hasAdditionalContext) {
    return NextResponse.json(
      {
        error:
          'At least one updatable field is required (`is_public`, `is_common_use`, `image_description`, or `additional_context`).',
      },
      { status: 400 }
    );
  }

  const updateRow = {
    modified_by_user_id: profileId,
  };

  if (hasPublicFlag) {
    updateRow.is_public = parseBoolean(payload?.is_public);
  }

  if (hasCommonUseFlag) {
    updateRow.is_common_use = parseBoolean(payload?.is_common_use);
  }

  if (hasImageDescription) {
    updateRow.image_description = toDisplayText(payload?.image_description);
  }

  if (hasAdditionalContext) {
    updateRow.additional_context = toDisplayText(payload?.additional_context);
  }

  const { data: updatedImage, error: updateError } = await supabase
    .from('images')
    .update(updateRow)
    .eq('id', imageId)
    .select(IMAGE_SELECT_COLUMNS)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ image: updatedImage });
}

export async function DELETE(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const imageId = toDisplayText(searchParams.get('id'));

  if (!imageId) {
    return NextResponse.json({ error: 'Image id is required.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('images')
    .delete()
    .eq('id', imageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: imageId });
}
