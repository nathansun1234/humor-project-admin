import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_TABLE_ROW_LIMIT = 1000;
const SEARCH_SCAN_PAGE_SIZE = 250;
const MAX_SEARCH_SCAN_ROWS = 5000;
const TABLE_VIEW_CONFIG = {
  captionRequests: {
    tableName: 'caption_requests',
    columns: ['id', 'created_datetime_utc', 'profile_id', 'image_id'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  captionExamples: {
    tableName: 'caption_examples',
    columns: [
      'id',
      'created_datetime_utc',
      'modified_datetime_utc',
      'image_description',
      'caption',
      'explanation',
      'priority',
      'image_id',
    ],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  terms: {
    tableName: 'terms',
    columns: ['id', 'created_datetime_utc', 'modified_datetime_utc', 'term', 'definition', 'example', 'priority', 'term_type_id'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  signupDomains: {
    tableName: 'allowed_signup_domains',
    columns: ['id', 'created_datetime_utc', 'apex_domain'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  whitelistedEmails: {
    tableName: 'whitelist_email_addresses',
    columns: ['id', 'created_datetime_utc', 'modified_datetime_utc', 'email_address'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  humorFlavors: {
    tableName: 'humor_flavors',
    columns: ['id', 'created_datetime_utc', 'description', 'slug'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  humorFlavorSteps: {
    tableName: 'humor_flavor_steps',
    columns: [
      'id',
      'created_datetime_utc',
      'humor_flavor_id',
      'llm_temperature',
      'order_by',
      'llm_input_type_id',
      'llm_output_type_id',
      'llm_model_id',
      'humor_flavor_step_type_id',
      'llm_system_prompt',
      'llm_user_prompt',
      'description',
    ],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  humorFlavorMix: {
    tableName: 'humor_flavor_mix',
    columns: ['id', 'created_datetime_utc', 'humor_flavor_id', 'caption_count'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  llmModels: {
    tableName: 'llm_models',
    columns: ['id', 'created_datetime_utc', 'name', 'llm_provider_id', 'provider_model_id', 'is_temperature_supported'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  llmProviders: {
    tableName: 'llm_providers',
    columns: ['id', 'created_datetime_utc', 'name'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  llmPromptChains: {
    tableName: 'llm_prompt_chains',
    columns: ['id', 'created_datetime_utc', 'caption_request_id'],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
  llmResponses: {
    tableName: 'llm_model_responses',
    columns: [
      'id',
      'created_datetime_utc',
      'llm_model_response',
      'processing_time_seconds',
      'llm_model_id',
      'profile_id',
      'caption_request_id',
      'llm_system_prompt',
      'llm_user_prompt',
      'llm_temperature',
      'humor_flavor_id',
      'llm_prompt_chain_id',
      'humor_flavor_step_id',
    ],
    orderColumn: 'created_datetime_utc',
    tieBreakerColumn: 'id',
    defaultLimit: 100,
  },
};
const MUTATION_VIEW_CONFIG = {
  humorFlavorMix: {
    tableName: 'humor_flavor_mix',
    idColumn: 'id',
    fields: {
      humor_flavor_id: 'text',
      caption_count: 'number',
    },
    canCreate: false,
    canDelete: false,
  },
  terms: {
    tableName: 'terms',
    idColumn: 'id',
    fields: {
      term: 'text',
      definition: 'text',
      example: 'text',
      priority: 'number',
      term_type_id: 'number',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
    modifiedAtColumn: 'modified_datetime_utc',
  },
  captionExamples: {
    tableName: 'caption_examples',
    idColumn: 'id',
    fields: {
      image_description: 'text',
      caption: 'text',
      explanation: 'text',
      priority: 'number',
      image_id: 'text',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
    modifiedAtColumn: 'modified_datetime_utc',
  },
  llmModels: {
    tableName: 'llm_models',
    idColumn: 'id',
    fields: {
      name: 'text',
      llm_provider_id: 'number',
      provider_model_id: 'text',
      is_temperature_supported: 'boolean',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
  },
  llmProviders: {
    tableName: 'llm_providers',
    idColumn: 'id',
    fields: {
      name: 'text',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
  },
  signupDomains: {
    tableName: 'allowed_signup_domains',
    idColumn: 'id',
    fields: {
      apex_domain: 'text',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
  },
  whitelistedEmails: {
    tableName: 'whitelist_email_addresses',
    idColumn: 'id',
    fields: {
      email_address: 'text',
    },
    canCreate: true,
    canDelete: true,
    createdAtColumn: 'created_datetime_utc',
    modifiedAtColumn: 'modified_datetime_utc',
  },
};

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseRowLimit(value, fallbackLimit) {
  const parsedLimit = Number(value);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return fallbackLimit;
  }

  return Math.min(Math.floor(parsedLimit), MAX_TABLE_ROW_LIMIT);
}

function parseMutationFieldValue(fieldType, rawValue) {
  if (fieldType === 'boolean') {
    return rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1';
  }

  if (fieldType === 'number') {
    const normalizedValue = toDisplayText(rawValue);
    if (!normalizedValue) {
      return null;
    }

    const parsedNumber = Number(normalizedValue);
    if (!Number.isFinite(parsedNumber)) {
      throw new Error(`Invalid numeric value: ${normalizedValue}`);
    }

    return parsedNumber;
  }

  return toDisplayText(rawValue);
}

function buildMutationValues(config, rawValues) {
  const values = {};
  const candidateValues = typeof rawValues === 'object' && rawValues !== null ? rawValues : {};

  for (const [fieldName, fieldType] of Object.entries(config.fields)) {
    if (!(fieldName in candidateValues)) {
      continue;
    }

    values[fieldName] = parseMutationFieldValue(fieldType, candidateValues[fieldName]);
  }

  return values;
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

function buildBaseQuery(supabase, config) {
  let query = supabase
    .from(config.tableName)
    .select(config.columns.join(','))
    .order(config.orderColumn, { ascending: false });

  if (toDisplayText(config.tieBreakerColumn)) {
    query = query.order(config.tieBreakerColumn, { ascending: false });
  }

  return query;
}

async function fetchRecentRows(supabase, config, rowLimit) {
  const { data, error } = await buildBaseQuery(supabase, config).range(0, rowLimit - 1);
  return {
    rows: Array.isArray(data) ? data : [],
    error,
  };
}

async function searchRows(supabase, config, normalizedQuery, rowLimit) {
  const matchedRows = [];
  let offset = 0;
  let scannedRows = 0;

  while (scannedRows < MAX_SEARCH_SCAN_ROWS && matchedRows.length < rowLimit) {
    const remainingRowsToScan = MAX_SEARCH_SCAN_ROWS - scannedRows;
    const batchSize = Math.min(SEARCH_SCAN_PAGE_SIZE, remainingRowsToScan);

    const { data, error } = await buildBaseQuery(supabase, config).range(offset, offset + batchSize - 1);
    if (error) {
      return { rows: matchedRows, error };
    }

    const batchRows = Array.isArray(data) ? data : [];
    if (batchRows.length === 0) {
      break;
    }

    for (const row of batchRows) {
      const searchableText = config.columns
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

async function getAuthorizedSupabaseClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.is_superadmin !== true) {
    return { supabase: null, errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, errorResponse: null };
}

export async function GET(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const viewKey = toDisplayText(searchParams.get('view'));

  if (!viewKey) {
    return NextResponse.json({ error: 'A table view is required.' }, { status: 400 });
  }

  const config = TABLE_VIEW_CONFIG[viewKey];
  if (!config) {
    return NextResponse.json({ error: 'Invalid table view.' }, { status: 400 });
  }

  const rawSearchQuery = toDisplayText(searchParams.get('q')) ?? '';
  const normalizedSearchQuery = rawSearchQuery.toLowerCase();
  const hasSearchQuery = normalizedSearchQuery.length >= 3;
  const defaultLimit = hasSearchQuery ? MAX_TABLE_ROW_LIMIT : config.defaultLimit;
  const rowLimit = parseRowLimit(searchParams.get('limit'), defaultLimit);

  const { rows, error } = hasSearchQuery
    ? await searchRows(supabase, config, normalizedSearchQuery, rowLimit)
    : await fetchRecentRows(supabase, config, rowLimit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    view: viewKey,
    rows,
  });
}

export async function POST(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const viewKey = toDisplayText(payload?.view);
  if (!viewKey) {
    return NextResponse.json({ error: 'A table view is required.' }, { status: 400 });
  }

  const tableConfig = TABLE_VIEW_CONFIG[viewKey];
  const mutationConfig = MUTATION_VIEW_CONFIG[viewKey];
  if (!tableConfig || !mutationConfig?.canCreate) {
    return NextResponse.json({ error: 'This table does not support creating rows.' }, { status: 400 });
  }

  let values;

  try {
    values = buildMutationValues(mutationConfig, payload?.values);
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Invalid row values.' }, { status: 400 });
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: 'At least one field value is required.' }, { status: 400 });
  }

  if (toDisplayText(mutationConfig.createdAtColumn)) {
    values[mutationConfig.createdAtColumn] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(mutationConfig.tableName)
    .insert(values)
    .select(tableConfig.columns.join(','))
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ row: data });
}

export async function PATCH(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const viewKey = toDisplayText(payload?.view);
  if (!viewKey) {
    return NextResponse.json({ error: 'A table view is required.' }, { status: 400 });
  }

  const tableConfig = TABLE_VIEW_CONFIG[viewKey];
  const mutationConfig = MUTATION_VIEW_CONFIG[viewKey];
  if (!tableConfig || !mutationConfig) {
    return NextResponse.json({ error: 'This table does not support editing rows.' }, { status: 400 });
  }

  const rowId = toDisplayText(payload?.id);
  if (!rowId) {
    return NextResponse.json({ error: 'Row id is required.' }, { status: 400 });
  }

  let values;

  try {
    values = buildMutationValues(mutationConfig, payload?.values);
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Invalid row values.' }, { status: 400 });
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: 'At least one field value is required.' }, { status: 400 });
  }

  if (toDisplayText(mutationConfig.modifiedAtColumn)) {
    values[mutationConfig.modifiedAtColumn] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(mutationConfig.tableName)
    .update(values)
    .eq(mutationConfig.idColumn, rowId)
    .select(tableConfig.columns.join(','))
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ row: data });
}

export async function DELETE(request) {
  const { supabase, errorResponse } = await getAuthorizedSupabaseClient();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const viewKey = toDisplayText(searchParams.get('view'));
  const rowId = toDisplayText(searchParams.get('id'));

  if (!viewKey) {
    return NextResponse.json({ error: 'A table view is required.' }, { status: 400 });
  }

  if (!rowId) {
    return NextResponse.json({ error: 'Row id is required.' }, { status: 400 });
  }

  const mutationConfig = MUTATION_VIEW_CONFIG[viewKey];
  if (!mutationConfig?.canDelete) {
    return NextResponse.json({ error: 'This table does not support deleting rows.' }, { status: 400 });
  }

  const { error } = await supabase
    .from(mutationConfig.tableName)
    .delete()
    .eq(mutationConfig.idColumn, rowId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: rowId });
}
