'use client';

import { createClient } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import styles from './AdminDataPanels.module.css';

const DEFAULT_DISPLAY_COUNT = 100;
const DEFAULT_IMAGE_COUNT = 30;
const MIN_SEARCH_LENGTH = 3;
const PIPELINE_BASE_URL = 'https://api.almostcrackd.ai';
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const FILE_ACCEPT_VALUE = SUPPORTED_IMAGE_TYPES.join(',');
const CAPTION_TEXT_KEYS = ['content', 'caption', 'text', 'title', 'generated_caption', 'caption_text'];
const IMAGE_FORM_DEFAULTS = {
  imageDescription: '',
  additionalContext: '',
  isPublic: false,
  isCommonUse: false,
};
const READ_ONLY_TABLE_CONFIG = {
  captionRequests: {
    title: 'Captions Requests',
    columns: ['id', 'created_datetime_utc', 'profile_id', 'image_id'],
  },
  captionExamples: {
    title: 'Captions Examples',
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
  },
  terms: {
    title: 'Terms',
    columns: ['id', 'created_datetime_utc', 'modified_datetime_utc', 'term', 'definition', 'example', 'priority', 'term_type_id'],
  },
  signupDomains: {
    title: 'Signup Domains',
    columns: ['id', 'created_datetime_utc', 'apex_domain'],
  },
  whitelistedEmails: {
    title: 'Whitelisted Emails',
    columns: ['id', 'created_datetime_utc', 'modified_datetime_utc', 'email_address'],
  },
  humorFlavors: {
    title: 'Humor Flavors',
    columns: ['id', 'created_datetime_utc', 'description', 'slug'],
  },
  humorFlavorSteps: {
    title: 'Humor Flavor Steps',
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
  },
  humorFlavorMix: {
    title: 'Humor Mix',
    columns: ['id', 'created_datetime_utc', 'humor_flavor_id', 'caption_count'],
  },
  llmModels: {
    title: 'LLM Models',
    columns: ['id', 'created_datetime_utc', 'name', 'llm_provider_id', 'provider_model_id', 'is_temperature_supported'],
  },
  llmProviders: {
    title: 'LLM Providers',
    columns: ['id', 'created_datetime_utc', 'name'],
  },
  llmPromptChains: {
    title: 'LLM Prompt Chains',
    columns: ['id', 'created_datetime_utc', 'caption_request_id'],
  },
  llmResponses: {
    title: 'LLM Responses',
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
  },
};
const SINGULAR_TABLE_LABEL_BY_VIEW = {
  users: 'User',
  captions: 'Caption',
  images: 'Image',
  captionRequests: 'Caption Request',
  captionExamples: 'Caption Example',
  terms: 'Term',
  signupDomains: 'Signup Domain',
  whitelistedEmails: 'Whitelisted Email',
  humorFlavors: 'Humor Flavor',
  humorFlavorSteps: 'Humor Flavor Step',
  humorFlavorMix: 'Humor Mix',
  llmModels: 'LLM Model',
  llmProviders: 'LLM Provider',
  llmPromptChains: 'LLM Prompt Chain',
  llmResponses: 'LLM Response',
};
const MUTABLE_READ_ONLY_TABLE_CONFIG = {
  humorFlavorMix: {
    canCreate: false,
    canDelete: false,
    fields: [
      { key: 'humor_flavor_id', label: 'Humor flavor id', type: 'text' },
      { key: 'caption_count', label: 'Caption count', type: 'number' },
    ],
  },
  terms: {
    canCreate: true,
    canDelete: true,
    fields: [
      { key: 'term', label: 'Term', type: 'text' },
      { key: 'definition', label: 'Definition', type: 'textarea' },
      { key: 'example', label: 'Example', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'term_type_id', label: 'Term type id', type: 'number' },
    ],
  },
  captionExamples: {
    canCreate: true,
    canDelete: true,
    fields: [
      { key: 'image_description', label: 'Image description', type: 'textarea' },
      { key: 'caption', label: 'Caption', type: 'textarea' },
      { key: 'explanation', label: 'Explanation', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'image_id', label: 'Image id', type: 'text' },
    ],
  },
  llmModels: {
    canCreate: true,
    canDelete: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'llm_provider_id', label: 'LLM provider id', type: 'number' },
      { key: 'provider_model_id', label: 'Provider model id', type: 'text' },
      { key: 'is_temperature_supported', label: 'Temperature supported', type: 'boolean' },
    ],
  },
  llmProviders: {
    canCreate: true,
    canDelete: true,
    fields: [{ key: 'name', label: 'Name', type: 'text' }],
  },
  signupDomains: {
    canCreate: true,
    canDelete: true,
    fields: [{ key: 'apex_domain', label: 'Apex domain', type: 'text' }],
  },
  whitelistedEmails: {
    canCreate: true,
    canDelete: true,
    fields: [{ key: 'email_address', label: 'Email address', type: 'text' }],
  },
};
const READ_ACCESS_LABEL = 'READ';
const READ_UPDATE_ACCESS_LABEL = 'READ/UPDATE';
const CRUD_ACCESS_LABEL = 'CREATE/READ/UPDATE/DELETE';

function createInitialImageFormValues() {
  return { ...IMAGE_FORM_DEFAULTS };
}

function createInitialEditImageFormValues(image = null) {
  return {
    id: toDisplayText(image?.id) ?? '',
    url: toDisplayText(image?.url) ?? '',
    imageDescription: toDisplayText(image?.image_description) ?? '',
    additionalContext: toDisplayText(image?.additional_context) ?? '',
    isPublic: image?.is_public === true || image?.is_public === 'true',
    isCommonUse: image?.is_common_use === true || image?.is_common_use === 'true',
  };
}

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

async function fetchDashboardSearchRows(viewKey, query, fallbackErrorMessage) {
  const searchParams = new URLSearchParams({ view: viewKey, q: query });
  const response = await fetch(`/api/admin/dashboard?${searchParams.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? fallbackErrorMessage);
  }

  return Array.isArray(payload?.rows) ? payload.rows : [];
}

function formatColumnLabel(column) {
  return column
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateText(value, maxLength = 140) {
  const normalizedValue = toDisplayText(value);
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 3)}...`;
}

function formatDetailFieldValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value, null, 2);
      if (!serialized) {
        return '—';
      }

      return serialized.length > 5000 ? `${serialized.slice(0, 4997)}...` : serialized;
    } catch {
      return '—';
    }
  }

  const textValue = String(value);
  if (textValue.trim().length === 0) {
    return '—';
  }

  return textValue.length > 5000 ? `${textValue.slice(0, 4997)}...` : textValue;
}

function buildDetailEntries(row, prioritizedKeys = []) {
  const nextEntries = [];
  const seenKeys = new Set();
  const sourceRow = typeof row === 'object' && row !== null ? row : {};

  for (const key of prioritizedKeys) {
    if (!key || seenKeys.has(key) || !(key in sourceRow)) {
      continue;
    }

    seenKeys.add(key);
    nextEntries.push({
      key,
      label: formatColumnLabel(key),
      value: formatDetailFieldValue(sourceRow[key]),
    });
  }

  const remainingKeys = Object.keys(sourceRow)
    .filter((key) => !seenKeys.has(key))
    .sort((first, second) => first.localeCompare(second));

  for (const key of remainingKeys) {
    nextEntries.push({
      key,
      label: formatColumnLabel(key),
      value: formatDetailFieldValue(sourceRow[key]),
    });
  }

  return nextEntries;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function singularizeTitle(title) {
  const normalizedTitle = toDisplayText(title);
  if (!normalizedTitle) {
    return 'Row';
  }

  if (normalizedTitle.endsWith('ies')) {
    return `${normalizedTitle.slice(0, -3)}y`;
  }

  if (normalizedTitle.endsWith('s')) {
    return normalizedTitle.slice(0, -1);
  }

  return normalizedTitle;
}

function getSingularTableLabel(viewKey, fallbackTitle = null) {
  const explicitLabel = SINGULAR_TABLE_LABEL_BY_VIEW[viewKey];
  if (explicitLabel) {
    return explicitLabel;
  }

  return singularizeTitle(fallbackTitle);
}

function getMutableReadOnlyConfig(viewKey) {
  return MUTABLE_READ_ONLY_TABLE_CONFIG[viewKey] ?? null;
}

function getReadOnlyViewAccessLabel(viewKey) {
  const mutableConfig = getMutableReadOnlyConfig(viewKey);

  if (!mutableConfig) {
    return READ_ACCESS_LABEL;
  }

  if (mutableConfig.canCreate && mutableConfig.canDelete) {
    return CRUD_ACCESS_LABEL;
  }

  return READ_UPDATE_ACCESS_LABEL;
}

function createReadOnlyCrudFormValues(viewKey, row = null) {
  const config = getMutableReadOnlyConfig(viewKey);

  if (!config) {
    return {};
  }

  const nextValues = {};

  for (const field of config.fields) {
    if (field.type === 'boolean') {
      nextValues[field.key] = toBoolean(row?.[field.key]);
      continue;
    }

    nextValues[field.key] = toDisplayText(row?.[field.key]) ?? '';
  }

  return nextValues;
}

function formatUserFullName(user) {
  const firstName = toDisplayText(user.first_name) ?? '';
  const lastName = toDisplayText(user.last_name) ?? '';
  return `${firstName} ${lastName}`.trim();
}

function getUserDisplayModel(user) {
  const fullName = formatUserFullName(user);
  const email = toDisplayText(user.email);
  const userId = toDisplayText(user.id);

  if (!email) {
    return {
      mainText: 'No email',
      leftSubText: userId,
      rightSubText: null,
    };
  }

  if (fullName && email && userId) {
    return {
      mainText: fullName,
      leftSubText: email,
      rightSubText: userId,
    };
  }

  if (email && userId) {
    return {
      mainText: email,
      leftSubText: userId,
      rightSubText: null,
    };
  }

  if (userId) {
    return {
      mainText: userId,
      leftSubText: null,
      rightSubText: null,
    };
  }

  if (fullName && email) {
    return {
      mainText: fullName,
      leftSubText: email,
      rightSubText: null,
    };
  }

  if (fullName) {
    return {
      mainText: fullName,
      leftSubText: null,
      rightSubText: null,
    };
  }

  if (email) {
    return {
      mainText: email,
      leftSubText: null,
      rightSubText: null,
    };
  }

  return {
    mainText: '[unknown user]',
    leftSubText: null,
    rightSubText: null,
  };
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

function isPublicCaption(caption) {
  return caption?.is_public === true || caption?.is_public === 'true';
}

function getImageDescription(image) {
  return toDisplayText(image?.image_description) ?? toDisplayText(image?.additional_context);
}

function getCaptionThumbnailUrl(caption, imageUrlById) {
  const explicitImageUrl = toDisplayText(caption?.image_url);
  if (explicitImageUrl) {
    return explicitImageUrl;
  }

  const imageId = toDisplayText(caption?.image_id);
  if (!imageId) {
    return null;
  }

  return imageUrlById.get(imageId) ?? null;
}

async function getResponseErrorMessage(response, fallbackErrorMessage) {
  const rawBody = await response.text();
  if (!rawBody) {
    return `${fallbackErrorMessage} (HTTP ${response.status})`;
  }

  try {
    const parsedBody = JSON.parse(rawBody);
    if (typeof parsedBody?.message === 'string' && parsedBody.message.trim()) {
      return parsedBody.message;
    }
    if (typeof parsedBody?.error === 'string' && parsedBody.error.trim()) {
      return parsedBody.error;
    }
  } catch {
    return `${fallbackErrorMessage} (HTTP ${response.status})`;
  }

  return `${fallbackErrorMessage} (HTTP ${response.status})`;
}

async function postJson(path, token, body, fallbackErrorMessage) {
  const response = await fetch(`${PIPELINE_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, fallbackErrorMessage));
  }

  return response.json();
}

export default function AdminDataPanels({
  users = [],
  captions = [],
  images = [],
  isDataLoading = false,
  onImageAdded = null,
  onImageUpdated = null,
  onImageDeleted = null,
  panelMode = 'overview',
  activeUsersSubMode = 'users',
  activeCaptionsSubMode = 'captions',
  activeHumorSubMode = 'humorFlavors',
  activeLlmsSubMode = 'llmModels',
}) {
  const supabase = useMemo(() => createClient(), []);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [captionSearchInput, setCaptionSearchInput] = useState('');
  const [imageSearchInput, setImageSearchInput] = useState('');

  const [appliedUserSearch, setAppliedUserSearch] = useState('');
  const [appliedCaptionSearch, setAppliedCaptionSearch] = useState('');
  const [appliedImageSearch, setAppliedImageSearch] = useState('');
  const [searchedUsers, setSearchedUsers] = useState([]);
  const [searchedCaptions, setSearchedCaptions] = useState([]);
  const [searchedImages, setSearchedImages] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSearchingCaptions, setIsSearchingCaptions] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [captionSearchError, setCaptionSearchError] = useState('');
  const [imageSearchError, setImageSearchError] = useState('');

  const [defaultUsers, setDefaultUsers] = useState([]);
  const [defaultCaptions, setDefaultCaptions] = useState([]);
  const [defaultImages, setDefaultImages] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [isAddImageModalOpen, setIsAddImageModalOpen] = useState(false);
  const [addImageSelectedFile, setAddImageSelectedFile] = useState(null);
  const [addImageLocalPreviewUrl, setAddImageLocalPreviewUrl] = useState(null);
  const [isSubmittingImage, setIsSubmittingImage] = useState(false);
  const [addImageError, setAddImageError] = useState('');
  const [addImageFormValues, setAddImageFormValues] = useState(createInitialImageFormValues);
  const [isEditImageModalOpen, setIsEditImageModalOpen] = useState(false);
  const [isSavingImageEdit, setIsSavingImageEdit] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [isLoadingEditImageDetails, setIsLoadingEditImageDetails] = useState(false);
  const [editImageError, setEditImageError] = useState('');
  const [editImageFormValues, setEditImageFormValues] = useState(createInitialEditImageFormValues);
  const [activeEditImageRow, setActiveEditImageRow] = useState(null);
  const [readOnlyRowsByView, setReadOnlyRowsByView] = useState({});
  const [isReadOnlyLoadingByView, setIsReadOnlyLoadingByView] = useState({});
  const [readOnlyErrorsByView, setReadOnlyErrorsByView] = useState({});
  const [readOnlyRefreshTokenByView, setReadOnlyRefreshTokenByView] = useState({});
  const [readOnlySearchInputByView, setReadOnlySearchInputByView] = useState({});
  const [appliedReadOnlySearchByView, setAppliedReadOnlySearchByView] = useState({});
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudModalMode, setCrudModalMode] = useState('edit');
  const [crudModalViewKey, setCrudModalViewKey] = useState('');
  const [crudModalRowId, setCrudModalRowId] = useState('');
  const [crudModalRowData, setCrudModalRowData] = useState(null);
  const [crudFormValues, setCrudFormValues] = useState({});
  const [crudFormError, setCrudFormError] = useState('');
  const [isSubmittingCrudForm, setIsSubmittingCrudForm] = useState(false);
  const [isDeletingCrudRow, setIsDeletingCrudRow] = useState(false);
  const [detailModalState, setDetailModalState] = useState(null);
  const isEditActionInProgress = isSavingImageEdit || isDeletingImage;
  const isCrudActionInProgress = isSubmittingCrudForm || isDeletingCrudRow;

  const hasUserSearch = appliedUserSearch.trim().length >= MIN_SEARCH_LENGTH;
  const hasCaptionSearch = appliedCaptionSearch.trim().length >= MIN_SEARCH_LENGTH;
  const hasImageSearch = appliedImageSearch.trim().length >= MIN_SEARCH_LENGTH;

  const imageUrlById = useMemo(() => {
    const map = new Map();

    for (const image of images) {
      const imageId = toDisplayText(image?.id);
      const imageUrl = toDisplayText(image?.url);

      if (!imageId || !imageUrl) {
        continue;
      }

      map.set(imageId, imageUrl);
    }

    return map;
  }, [images]);

  const userById = useMemo(() => {
    const map = new Map();

    for (const user of users) {
      const userId = toDisplayText(user?.id);
      if (!userId) {
        continue;
      }

      map.set(userId, user);
    }

    return map;
  }, [users]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const usersWithNames = users.filter((user) => Boolean(formatUserFullName(user)));
      const usersWithoutNames = users.filter((user) => !Boolean(formatUserFullName(user)));
      const captionsWithText = captions.filter((caption) => Boolean(resolveCaptionText(caption)));
      const captionsWithoutText = captions.filter((caption) => !Boolean(resolveCaptionText(caption)));
      const imagesWithDescriptions = images.filter((image) => Boolean(getImageDescription(image)));
      const imagesWithoutDescriptions = images.filter((image) => !Boolean(getImageDescription(image)));

      setDefaultUsers([...usersWithNames, ...usersWithoutNames].slice(0, DEFAULT_DISPLAY_COUNT));
      setDefaultCaptions([...captionsWithText, ...captionsWithoutText].slice(0, DEFAULT_DISPLAY_COUNT));
      setDefaultImages([...imagesWithDescriptions, ...imagesWithoutDescriptions].slice(0, DEFAULT_IMAGE_COUNT));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [users, captions, images]);

  const visibleUsers = hasUserSearch ? searchedUsers : defaultUsers;
  const visibleCaptions = hasCaptionSearch ? searchedCaptions : defaultCaptions;
  const visibleImages = hasImageSearch ? searchedImages : defaultImages;

  const showUsersIndexing = !hasUserSearch && (isDataLoading || (users.length > 0 && defaultUsers.length === 0));
  const showCaptionsIndexing =
    !hasCaptionSearch && (isDataLoading || (captions.length > 0 && defaultCaptions.length === 0));
  const showImagesIndexing =
    !hasImageSearch && (isDataLoading || (images.length > 0 && defaultImages.length === 0));
  const activeReadOnlyViewKey = useMemo(() => {
    if (panelMode === 'users' && activeUsersSubMode !== 'users') {
      return activeUsersSubMode;
    }

    if (panelMode === 'captions' && activeCaptionsSubMode !== 'captions') {
      return activeCaptionsSubMode;
    }

    if (panelMode === 'humorFlavors') {
      return activeHumorSubMode;
    }

    if (panelMode === 'llms') {
      return activeLlmsSubMode;
    }

    return null;
  }, [activeCaptionsSubMode, activeHumorSubMode, activeLlmsSubMode, activeUsersSubMode, panelMode]);
  const activeReadOnlySearch = useMemo(() => {
    if (!activeReadOnlyViewKey) {
      return '';
    }

    const appliedQuery = toDisplayText(appliedReadOnlySearchByView[activeReadOnlyViewKey]) ?? '';
    return appliedQuery.length >= MIN_SEARCH_LENGTH ? appliedQuery : '';
  }, [activeReadOnlyViewKey, appliedReadOnlySearchByView]);
  const activeReadOnlyRefreshToken = useMemo(() => {
    if (!activeReadOnlyViewKey) {
      return 0;
    }

    return readOnlyRefreshTokenByView[activeReadOnlyViewKey] ?? 0;
  }, [activeReadOnlyViewKey, readOnlyRefreshTokenByView]);

  useEffect(() => {
    setIsClient(true);
    return () => {
      setIsClient(false);
    };
  }, []);

  useEffect(() => {
    if (!activeReadOnlyViewKey || !READ_ONLY_TABLE_CONFIG[activeReadOnlyViewKey]) {
      return undefined;
    }

    let isCancelled = false;

    async function fetchReadOnlyRows() {
      setIsReadOnlyLoadingByView((currentLoading) => ({
        ...currentLoading,
        [activeReadOnlyViewKey]: true,
      }));
      setReadOnlyErrorsByView((currentErrors) => ({
        ...currentErrors,
        [activeReadOnlyViewKey]: '',
      }));

      try {
        const requestUrl = new URL('/api/admin/table-data', window.location.origin);
        requestUrl.searchParams.set('view', activeReadOnlyViewKey);

        if (activeReadOnlySearch.length >= MIN_SEARCH_LENGTH) {
          requestUrl.searchParams.set('q', activeReadOnlySearch);
        }

        const response = await fetch(requestUrl.pathname + requestUrl.search, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Could not load table data.');
        }

        if (isCancelled) {
          return;
        }

        const rows = Array.isArray(payload?.rows) ? payload.rows : [];
        setReadOnlyRowsByView((currentRows) => ({
          ...currentRows,
          [activeReadOnlyViewKey]: rows,
        }));
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setReadOnlyErrorsByView((currentErrors) => ({
          ...currentErrors,
          [activeReadOnlyViewKey]: error?.message ?? 'Could not load table data.',
        }));
      } finally {
        if (isCancelled) {
          return;
        }

        setIsReadOnlyLoadingByView((currentLoading) => ({
          ...currentLoading,
          [activeReadOnlyViewKey]: false,
        }));
      }
    }

    void fetchReadOnlyRows();

    return () => {
      isCancelled = true;
    };
  }, [activeReadOnlySearch, activeReadOnlyRefreshToken, activeReadOnlyViewKey]);

  useEffect(() => {
    if (!addImageSelectedFile) {
      setAddImageLocalPreviewUrl(null);
      return undefined;
    }

    const nextPreviewUrl = window.URL.createObjectURL(addImageSelectedFile);
    setAddImageLocalPreviewUrl(nextPreviewUrl);

    return () => {
      window.URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [addImageSelectedFile]);

  useEffect(() => {
    if (!isAddImageModalOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key !== 'Escape' || isSubmittingImage) {
        return;
      }

      setIsAddImageModalOpen(false);
      setAddImageError('');
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAddImageModalOpen, isSubmittingImage]);

  useEffect(() => {
    if (!isEditImageModalOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key !== 'Escape' || isEditActionInProgress) {
        return;
      }

      setIsEditImageModalOpen(false);
      setEditImageError('');
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isEditActionInProgress, isEditImageModalOpen]);

  useEffect(() => {
    if (!isEditImageModalOpen) {
      return undefined;
    }

    const imageId = toDisplayText(editImageFormValues.id);
    if (!imageId) {
      return undefined;
    }

    let isCancelled = false;

    async function fetchFullImageRow() {
      setIsLoadingEditImageDetails(true);

      try {
        const response = await fetch(`/api/admin/images?id=${encodeURIComponent(imageId)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Could not load full image details.');
        }

        if (isCancelled) {
          return;
        }

        const fullImageRow = payload?.image;
        if (fullImageRow) {
          setActiveEditImageRow(fullImageRow);
          setEditImageFormValues(createInitialEditImageFormValues(fullImageRow));
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setEditImageError((currentError) => currentError || error?.message || 'Could not load full image details.');
      } finally {
        if (!isCancelled) {
          setIsLoadingEditImageDetails(false);
        }
      }
    }

    void fetchFullImageRow();

    return () => {
      isCancelled = true;
    };
  }, [editImageFormValues.id, isEditImageModalOpen]);

  useEffect(() => {
    if (!isCrudModalOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key !== 'Escape' || isCrudActionInProgress) {
        return;
      }

      closeCrudModal();
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCrudActionInProgress, isCrudModalOpen]);

  useEffect(() => {
    if (!detailModalState) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') {
        return;
      }

      setDetailModalState(null);
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [detailModalState]);

  async function submitUserSearch(event) {
    event.preventDefault();
    const query = userSearchInput.trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      setAppliedUserSearch('');
      setSearchedUsers([]);
      setUserSearchError('');
      setIsSearchingUsers(false);
      return;
    }

    setAppliedUserSearch(query);
    setIsSearchingUsers(true);
    setUserSearchError('');

    try {
      const rows = await fetchDashboardSearchRows('users', query, 'Could not search users.');
      setSearchedUsers(rows);
    } catch (error) {
      setSearchedUsers([]);
      setUserSearchError(error?.message ?? 'Could not search users.');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function submitCaptionSearch(event) {
    event.preventDefault();
    const query = captionSearchInput.trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      setAppliedCaptionSearch('');
      setSearchedCaptions([]);
      setCaptionSearchError('');
      setIsSearchingCaptions(false);
      return;
    }

    setAppliedCaptionSearch(query);
    setIsSearchingCaptions(true);
    setCaptionSearchError('');

    try {
      const rows = await fetchDashboardSearchRows('captions', query, 'Could not search captions.');
      setSearchedCaptions(rows);
    } catch (error) {
      setSearchedCaptions([]);
      setCaptionSearchError(error?.message ?? 'Could not search captions.');
    } finally {
      setIsSearchingCaptions(false);
    }
  }

  async function submitImageSearch(event) {
    event.preventDefault();
    const query = imageSearchInput.trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      setAppliedImageSearch('');
      setSearchedImages([]);
      setImageSearchError('');
      setIsSearchingImages(false);
      return;
    }

    setAppliedImageSearch(query);
    setIsSearchingImages(true);
    setImageSearchError('');

    try {
      const rows = await fetchDashboardSearchRows('images', query, 'Could not search images.');
      setSearchedImages(rows);
    } catch (error) {
      setSearchedImages([]);
      setImageSearchError(error?.message ?? 'Could not search images.');
    } finally {
      setIsSearchingImages(false);
    }
  }

  function handleReadOnlySearchInputChange(viewKey, nextValue) {
    setReadOnlySearchInputByView((currentSearchInputs) => ({
      ...currentSearchInputs,
      [viewKey]: nextValue,
    }));
  }

  function submitReadOnlySearch(event, viewKey) {
    event.preventDefault();

    const nextQuery = toDisplayText(readOnlySearchInputByView[viewKey]) ?? '';
    setAppliedReadOnlySearchByView((currentAppliedSearch) => ({
      ...currentAppliedSearch,
      [viewKey]: nextQuery.length >= MIN_SEARCH_LENGTH ? nextQuery : '',
    }));
  }

  function clearReadOnlySearch(viewKey) {
    setReadOnlySearchInputByView((currentSearchInputs) => ({
      ...currentSearchInputs,
      [viewKey]: '',
    }));
    setAppliedReadOnlySearchByView((currentAppliedSearch) => ({
      ...currentAppliedSearch,
      [viewKey]: '',
    }));
  }

  function clearUserSearch() {
    setUserSearchInput('');
    setAppliedUserSearch('');
    setSearchedUsers([]);
    setUserSearchError('');
    setIsSearchingUsers(false);
  }

  function clearCaptionSearch() {
    setCaptionSearchInput('');
    setAppliedCaptionSearch('');
    setSearchedCaptions([]);
    setCaptionSearchError('');
    setIsSearchingCaptions(false);
  }

  function clearImageSearch() {
    setImageSearchInput('');
    setAppliedImageSearch('');
    setSearchedImages([]);
    setImageSearchError('');
    setIsSearchingImages(false);
  }

  function refreshReadOnlyView(viewKey) {
    if (!viewKey) {
      return;
    }

    setReadOnlyRefreshTokenByView((currentTokens) => ({
      ...currentTokens,
      [viewKey]: (currentTokens[viewKey] ?? 0) + 1,
    }));
  }

  function getProfileLabel(profileId, row = null) {
    const rowFirstName = toDisplayText(row?.profile_first_name) ?? '';
    const rowLastName = toDisplayText(row?.profile_last_name) ?? '';
    const rowFullName = `${rowFirstName} ${rowLastName}`.trim();
    if (rowFullName) {
      return rowFullName;
    }

    const rowEmail = toDisplayText(row?.profile_email);
    if (rowEmail) {
      return rowEmail;
    }

    const normalizedProfileId = toDisplayText(profileId);
    if (!normalizedProfileId) {
      return '[unknown profile]';
    }

    const mappedProfile = userById.get(normalizedProfileId);
    if (mappedProfile) {
      const mappedFullName = formatUserFullName(mappedProfile);
      if (mappedFullName) {
        return mappedFullName;
      }

      const mappedEmail = toDisplayText(mappedProfile?.email);
      if (mappedEmail) {
        return mappedEmail;
      }
    }

    return normalizedProfileId;
  }

  function getRowImageUrl(viewKey, row) {
    if (!row || typeof row !== 'object') {
      return null;
    }

    if (viewKey === 'images') {
      return toDisplayText(row?.url);
    }

    if (viewKey === 'captions') {
      return getCaptionThumbnailUrl(row, imageUrlById);
    }

    const explicitImageUrl = toDisplayText(row?.image_url);
    if (explicitImageUrl) {
      return explicitImageUrl;
    }

    const imageId = toDisplayText(row?.image_id);
    if (!imageId) {
      return null;
    }

    return imageUrlById.get(imageId) ?? null;
  }

  function getReadOnlyCardModel(viewKey, row) {
    const rowId = toDisplayText(row?.id) ?? '[unknown id]';
    const imageUrl = getRowImageUrl(viewKey, row);

    if (viewKey === 'signupDomains') {
      return {
        primaryText: toDisplayText(row?.apex_domain) ?? '[no apex domain]',
        secondaryLines: [`id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'whitelistedEmails') {
      return {
        primaryText: toDisplayText(row?.email_address) ?? '[no email address]',
        secondaryLines: [`id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'captionRequests') {
      const profileId = toDisplayText(row?.profile_id) ?? '—';

      return {
        primaryText: getProfileLabel(profileId, row),
        secondaryLines: [`profile id: ${profileId}`],
        imageUrl,
      };
    }

    if (viewKey === 'captionExamples') {
      return {
        primaryText: truncateText(row?.caption, 180) ?? '[no caption]',
        secondaryLines: [`id: ${rowId}`, `image id: ${toDisplayText(row?.image_id) ?? '—'}`],
        imageUrl,
      };
    }

    if (viewKey === 'terms') {
      return {
        primaryText: toDisplayText(row?.term) ?? '[no term]',
        secondaryLines: [truncateText(row?.definition, 180) ?? 'No definition', `id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'humorFlavors') {
      return {
        primaryText: toDisplayText(row?.description) ?? '[no description]',
        secondaryLines: [`slug: ${toDisplayText(row?.slug) ?? '—'}`, `id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'humorFlavorSteps') {
      return {
        primaryText: truncateText(row?.description, 180) ?? `Step ${rowId}`,
        secondaryLines: [
          `flavor id: ${toDisplayText(row?.humor_flavor_id) ?? '—'}`,
          `order: ${toDisplayText(row?.order_by) ?? '—'}`,
        ],
        imageUrl: null,
      };
    }

    if (viewKey === 'humorFlavorMix') {
      return {
        primaryText: `Humor flavor ${toDisplayText(row?.humor_flavor_id) ?? '—'}`,
        secondaryLines: [`caption count: ${toDisplayText(row?.caption_count) ?? '0'}`, `id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'llmModels') {
      return {
        primaryText: toDisplayText(row?.name) ?? '[unnamed model]',
        secondaryLines: [
          `provider model id: ${toDisplayText(row?.provider_model_id) ?? '—'}`,
          `id: ${rowId}`,
        ],
        imageUrl: null,
      };
    }

    if (viewKey === 'llmProviders') {
      return {
        primaryText: toDisplayText(row?.name) ?? '[unnamed provider]',
        secondaryLines: [`id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'llmPromptChains') {
      return {
        primaryText: `Caption request ${toDisplayText(row?.caption_request_id) ?? '—'}`,
        secondaryLines: [`id: ${rowId}`],
        imageUrl: null,
      };
    }

    if (viewKey === 'llmResponses') {
      return {
        primaryText: truncateText(row?.llm_model_response, 180) ?? '[no response]',
        secondaryLines: [
          `model id: ${toDisplayText(row?.llm_model_id) ?? '—'}`,
          `profile id: ${toDisplayText(row?.profile_id) ?? '—'}`,
        ],
        imageUrl: null,
      };
    }

    const primaryFromColumns =
      toDisplayText(row?.name) ??
      toDisplayText(row?.description) ??
      toDisplayText(row?.term) ??
      toDisplayText(row?.id) ??
      '[row]';

    return {
      primaryText: truncateText(primaryFromColumns, 180) ?? '[row]',
      secondaryLines: [`id: ${rowId}`],
      imageUrl,
    };
  }

  function openDetailModal({ title, row, prioritizedKeys = [], imageUrl = null, imageAlt = 'Row image', isWide = true }) {
    setDetailModalState({
      title,
      entries: buildDetailEntries(row, prioritizedKeys),
      imageUrl,
      imageAlt,
      isWide,
    });
  }

  function closeDetailModal() {
    setDetailModalState(null);
  }

  function handleDetailModalBackdropClick(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeDetailModal();
  }

  function openCreateCrudModal(viewKey) {
    const mutableConfig = getMutableReadOnlyConfig(viewKey);
    if (!mutableConfig?.canCreate) {
      return;
    }

    setCrudModalMode('create');
    setCrudModalViewKey(viewKey);
    setCrudModalRowId('');
    setCrudModalRowData(null);
    setCrudFormValues(createReadOnlyCrudFormValues(viewKey));
    setCrudFormError('');
    setIsCrudModalOpen(true);
  }

  function openEditCrudModal(viewKey, row) {
    const mutableConfig = getMutableReadOnlyConfig(viewKey);
    if (!mutableConfig) {
      return;
    }

    const rowId = toDisplayText(row?.id);
    if (!rowId) {
      return;
    }

    setCrudModalMode('edit');
    setCrudModalViewKey(viewKey);
    setCrudModalRowId(rowId);
    setCrudModalRowData(row);
    setCrudFormValues(createReadOnlyCrudFormValues(viewKey, row));
    setCrudFormError('');
    setIsCrudModalOpen(true);
  }

  function closeCrudModal(force = false) {
    if (!force && isCrudActionInProgress) {
      return;
    }

    setIsCrudModalOpen(false);
    setCrudModalMode('edit');
    setCrudModalViewKey('');
    setCrudModalRowId('');
    setCrudModalRowData(null);
    setCrudFormValues({});
    setCrudFormError('');
  }

  function handleCrudModalBackdropClick(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeCrudModal();
  }

  function handleCrudInputChange(event) {
    const { name, type, checked, value } = event.target;
    setCrudFormValues((currentValues) => ({
      ...currentValues,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function submitCrudForm(event) {
    event.preventDefault();

    if (isCrudActionInProgress) {
      return;
    }

    const mutableConfig = getMutableReadOnlyConfig(crudModalViewKey);
    if (!mutableConfig) {
      setCrudFormError('This table does not support editing.');
      return;
    }

    if (crudModalMode === 'create' && !mutableConfig.canCreate) {
      setCrudFormError('This table does not support creating rows.');
      return;
    }

    if (crudModalMode === 'edit' && !toDisplayText(crudModalRowId)) {
      setCrudFormError('Row id is missing.');
      return;
    }

    setIsSubmittingCrudForm(true);
    setCrudFormError('');

    try {
      const requestBody = {
        view: crudModalViewKey,
        values: crudFormValues,
      };

      if (crudModalMode === 'edit') {
        requestBody.id = crudModalRowId;
      }

      const response = await fetch('/api/admin/table-data', {
        method: crudModalMode === 'create' ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not save row.');
      }

      closeCrudModal(true);
      refreshReadOnlyView(crudModalViewKey);
    } catch (error) {
      setCrudFormError(error?.message ?? 'Could not save row.');
    } finally {
      setIsSubmittingCrudForm(false);
    }
  }

  async function deleteCrudRow() {
    if (isCrudActionInProgress) {
      return;
    }

    const mutableConfig = getMutableReadOnlyConfig(crudModalViewKey);
    if (!mutableConfig?.canDelete) {
      setCrudFormError('This table does not support deleting rows.');
      return;
    }

    const rowId = toDisplayText(crudModalRowId);
    if (!rowId) {
      setCrudFormError('Row id is missing.');
      return;
    }

    const isConfirmed = window.confirm('Delete this row? This cannot be undone.');
    if (!isConfirmed) {
      return;
    }

    setIsDeletingCrudRow(true);
    setCrudFormError('');

    try {
      const response = await fetch(
        `/api/admin/table-data?view=${encodeURIComponent(crudModalViewKey)}&id=${encodeURIComponent(rowId)}`,
        {
          method: 'DELETE',
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not delete row.');
      }

      closeCrudModal(true);
      refreshReadOnlyView(crudModalViewKey);
    } catch (error) {
      setCrudFormError(error?.message ?? 'Could not delete row.');
    } finally {
      setIsDeletingCrudRow(false);
    }
  }

  function handleOpenAddImageModal() {
    setIsAddImageModalOpen(true);
    setAddImageError('');
    setAddImageSelectedFile(null);
    setAddImageFormValues(createInitialImageFormValues());
  }

  function handleCloseAddImageModal() {
    if (isSubmittingImage) {
      return;
    }

    setIsAddImageModalOpen(false);
    setAddImageError('');
    setAddImageSelectedFile(null);
    setAddImageFormValues(createInitialImageFormValues());
  }

  function handleAddImageModalBackdropClick(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    handleCloseAddImageModal();
  }

  function handleAddImageInputChange(event) {
    const { name, value, type, checked } = event.target;
    setAddImageFormValues((currentValues) => ({
      ...currentValues,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleAddImageFileChange(event) {
    const nextFile = event.target.files?.[0] ?? null;
    setAddImageSelectedFile(nextFile);
    setAddImageError('');
  }

  function handleOpenEditImageModal(image) {
    setActiveEditImageRow(image);
    setIsLoadingEditImageDetails(false);
    setEditImageFormValues(createInitialEditImageFormValues(image));
    setEditImageError('');
    setIsEditImageModalOpen(true);
  }

  function handleCloseEditImageModal() {
    if (isEditActionInProgress) {
      return;
    }

    setIsEditImageModalOpen(false);
    setActiveEditImageRow(null);
    setIsLoadingEditImageDetails(false);
    setEditImageError('');
  }

  function handleEditImageModalBackdropClick(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    handleCloseEditImageModal();
  }

  function handleEditImageInputChange(event) {
    const { name, value, type, checked } = event.target;
    setEditImageFormValues((currentValues) => ({
      ...currentValues,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function submitAddImage(event) {
    event.preventDefault();

    if (isSubmittingImage) {
      return;
    }

    if (!addImageSelectedFile) {
      setAddImageError('Select an image file first.');
      return;
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(addImageSelectedFile.type)) {
      setAddImageError('Unsupported image type. Use JPEG, JPG, PNG, WEBP, GIF, or HEIC.');
      return;
    }

    setIsSubmittingImage(true);
    setAddImageError('');

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw new Error(`Could not read current session: ${error.message}`);
      }

      const token = data?.session?.access_token;
      if (!token) {
        throw new Error('No JWT access token found. Please sign in again.');
      }

      const presignedData = await postJson(
        '/pipeline/generate-presigned-url',
        token,
        { contentType: addImageSelectedFile.type },
        'Could not generate upload URL.'
      );

      const uploadResponse = await fetch(presignedData.presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': addImageSelectedFile.type,
        },
        body: addImageSelectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(await getResponseErrorMessage(uploadResponse, 'Could not upload the image bytes.'));
      }

      const createResponse = await fetch('/api/admin/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: presignedData.cdnUrl,
          is_public: addImageFormValues.isPublic,
          is_common_use: addImageFormValues.isCommonUse,
          image_description: addImageFormValues.imageDescription,
          additional_context: addImageFormValues.additionalContext,
        }),
      });

      const createPayload = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        throw new Error(createPayload?.error ?? 'Could not create image row.');
      }

      const nextImage =
        createPayload?.image ?? {
          id: crypto.randomUUID(),
          url: presignedData.cdnUrl,
          image_description: toDisplayText(addImageFormValues.imageDescription),
          additional_context: toDisplayText(addImageFormValues.additionalContext),
          celebrity_recognition: null,
          created_datetime_utc: new Date().toISOString(),
        };

      if (typeof onImageAdded === 'function') {
        onImageAdded(nextImage);
      }

      setAddImageSelectedFile(null);
      setAddImageFormValues(createInitialImageFormValues());
      setIsAddImageModalOpen(false);
    } catch (error) {
      setAddImageError(error?.message ?? 'Unable to add image.');
    } finally {
      setIsSubmittingImage(false);
    }
  }

  async function submitEditImage(event) {
    event.preventDefault();

    if (isEditActionInProgress) {
      return;
    }

    const imageId = toDisplayText(editImageFormValues.id);
    if (!imageId) {
      setEditImageError('Image id is missing. Close and reopen this panel.');
      return;
    }

    setIsSavingImageEdit(true);
    setEditImageError('');

    try {
      const response = await fetch('/api/admin/images', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: imageId,
          image_description: editImageFormValues.imageDescription,
          additional_context: editImageFormValues.additionalContext,
          is_public: editImageFormValues.isPublic,
          is_common_use: editImageFormValues.isCommonUse,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not update image details.');
      }

      const updatedImage = payload?.image;
      if (updatedImage) {
        setActiveEditImageRow(updatedImage);
        setEditImageFormValues(createInitialEditImageFormValues(updatedImage));
      }

      if (typeof onImageUpdated === 'function' && updatedImage) {
        onImageUpdated(updatedImage);
      }
    } catch (error) {
      setEditImageError(error?.message ?? 'Unable to update image details.');
    } finally {
      setIsSavingImageEdit(false);
    }
  }

  async function deleteImage() {
    if (isEditActionInProgress) {
      return;
    }

    const imageId = toDisplayText(editImageFormValues.id);
    if (!imageId) {
      setEditImageError('Image id is missing. Close and reopen this panel.');
      return;
    }

    const isConfirmed = window.confirm('Delete this image? This cannot be undone.');
    if (!isConfirmed) {
      return;
    }

    setIsDeletingImage(true);
    setEditImageError('');

    try {
      const response = await fetch(`/api/admin/images?id=${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not delete image.');
      }

      if (typeof onImageDeleted === 'function') {
        onImageDeleted(imageId);
      }

      setIsEditImageModalOpen(false);
      setActiveEditImageRow(null);
      setIsLoadingEditImageDetails(false);
    } catch (error) {
      setEditImageError(error?.message ?? 'Unable to delete image.');
    } finally {
      setIsDeletingImage(false);
    }
  }

  const activeCrudModalConfig = getMutableReadOnlyConfig(crudModalViewKey);
  const crudPreviewImageUrl =
    crudModalMode === 'edit' && crudModalRowData ? getRowImageUrl(crudModalViewKey, crudModalRowData) : null;
  const imageReadOnlyEntries =
    activeEditImageRow === null
      ? []
      : buildDetailEntries(activeEditImageRow, [
          'id',
          'created_datetime_utc',
          'modified_datetime_utc',
          'created_by_user_id',
          'modified_by_user_id',
          'profile_id',
          'url',
          'celebrity_recognition',
          'embedding',
        ]).filter(
          (entry) =>
            ![
              'image_description',
              'additional_context',
              'is_public',
              'is_common_use',
            ].includes(entry.key)
        );
  const crudEditableFieldKeys = new Set((activeCrudModalConfig?.fields ?? []).map((field) => field.key));
  const activeCrudColumns = READ_ONLY_TABLE_CONFIG[crudModalViewKey]?.columns ?? [];
  const crudReadOnlyEntries =
    crudModalMode === 'edit' && crudModalRowData
      ? buildDetailEntries(crudModalRowData, activeCrudColumns).filter(
          (entry) => !crudEditableFieldKeys.has(entry.key)
        )
      : [];

  const addImageModal = isAddImageModalOpen ? (
    <div className={styles.modalBackdrop} onClick={handleAddImageModalBackdropClick}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="add-image-title">
        <div className={styles.modalHeader}>
          <h3 id="add-image-title" className={styles.modalTitle}>
            Add Image
          </h3>
        </div>

        <form className={styles.modalForm} onSubmit={submitAddImage}>
          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Image file</span>
            <input
              type="file"
              accept={FILE_ACCEPT_VALUE}
              onChange={handleAddImageFileChange}
              required
              className={styles.formInput}
            />
          </label>

          {addImageSelectedFile ? <p className={styles.fileMeta}>{addImageSelectedFile.name}</p> : null}

          <div className={styles.uploadPreviewFrame}>
            {addImageLocalPreviewUrl ? (
              <img src={addImageLocalPreviewUrl} alt="Upload preview" className={styles.uploadPreviewImage} />
            ) : (
              <p className={styles.uploadPreviewEmpty}>
                Upload an image to preview it here. Supported: JPEG, JPG, PNG, WEBP, GIF, HEIC.
              </p>
            )}
          </div>

          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Image caption</span>
            <textarea
              name="imageDescription"
              value={addImageFormValues.imageDescription}
              onChange={handleAddImageInputChange}
              rows={4}
              required
              className={styles.formTextarea}
            />
          </label>

          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Additional context (optional)</span>
            <textarea
              name="additionalContext"
              value={addImageFormValues.additionalContext}
              onChange={handleAddImageInputChange}
              rows={4}
              className={styles.formTextarea}
            />
          </label>

          <div className={styles.checkboxRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isPublic"
                checked={addImageFormValues.isPublic}
                onChange={handleAddImageInputChange}
                className={styles.checkboxInput}
              />
              <span>Public</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isCommonUse"
                checked={addImageFormValues.isCommonUse}
                onChange={handleAddImageInputChange}
                className={styles.checkboxInput}
              />
              <span>Common use</span>
            </label>
          </div>

          {addImageError ? <p className={styles.formError}>{addImageError}</p> : null}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.modalSecondaryButton}
              onClick={handleCloseAddImageModal}
              disabled={isSubmittingImage}
            >
              Cancel
            </button>
            <button type="submit" className={styles.modalPrimaryButton} disabled={isSubmittingImage}>
              {isSubmittingImage ? 'Adding...' : 'Add image'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const editImageModal = isEditImageModalOpen ? (
    <div className={styles.modalBackdrop} onClick={handleEditImageModalBackdropClick}>
      <div className={`${styles.modalCard} ${styles.editModalCard}`} role="dialog" aria-modal="true" aria-labelledby="edit-image-title">
        <div className={styles.modalHeader}>
          <h3 id="edit-image-title" className={styles.modalTitle}>
            Read/Modify Image
          </h3>
        </div>

        <form className={styles.modalForm} onSubmit={submitEditImage}>
          <div
            className={`${styles.modalInlineLayout} ${
              editImageFormValues.url ? styles.modalInlineLayoutWithImage : ''
            }`}
          >
            <div className={styles.editPreviewFrame}>
              {editImageFormValues.url ? (
                <img src={editImageFormValues.url} alt="Image preview" className={styles.editPreviewImage} />
              ) : (
                <p className={styles.editPreviewEmpty}>No image URL available.</p>
              )}
            </div>

            <div className={styles.modalInlineFields}>
              <label className={styles.formField}>
                <span className={styles.fieldLabel}>Image description</span>
                <textarea
                  name="imageDescription"
                  value={editImageFormValues.imageDescription}
                  onChange={handleEditImageInputChange}
                  rows={4}
                  className={styles.formTextarea}
                  placeholder="Enter image description"
                />
              </label>

              <label className={styles.formField}>
                <span className={styles.fieldLabel}>Additional context</span>
                <textarea
                  name="additionalContext"
                  value={editImageFormValues.additionalContext}
                  onChange={handleEditImageInputChange}
                  rows={4}
                  className={styles.formTextarea}
                  placeholder="Optional additional context"
                />
              </label>

              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={editImageFormValues.isPublic}
                    onChange={handleEditImageInputChange}
                    className={styles.checkboxInput}
                  />
                  <span>Public</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="isCommonUse"
                    checked={editImageFormValues.isCommonUse}
                    onChange={handleEditImageInputChange}
                    className={styles.checkboxInput}
                  />
                  <span>Common use</span>
                </label>
              </div>
            </div>
          </div>

          {isLoadingEditImageDetails ? <p className={styles.emptyText}>Loading full row...</p> : null}

          {imageReadOnlyEntries.length > 0 ? (
            <div className={styles.formField}>
              <span className={styles.fieldLabel}>Generated Fields</span>
              <div className={styles.detailList}>
                {imageReadOnlyEntries.map((entry) => (
                  <div key={`image-readonly-${entry.key}`} className={styles.detailListItem}>
                    <p className={styles.detailLabel}>{entry.label}</p>
                    <p className={styles.detailValue}>{entry.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {editImageError ? <p className={styles.formError}>{editImageError}</p> : null}

          <div className={`${styles.modalActions} ${styles.modalActionsSticky}`}>
            <button
              type="button"
              className={styles.modalSecondaryButton}
              onClick={handleCloseEditImageModal}
              disabled={isEditActionInProgress}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.modalDeleteButton}
              onClick={deleteImage}
              disabled={isEditActionInProgress}
            >
              {isDeletingImage ? 'Deleting...' : 'Delete image'}
            </button>
            <button type="submit" className={styles.modalSuccessButton} disabled={isEditActionInProgress}>
              {isSavingImageEdit ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;
  const crudModalEntityLabel = getSingularTableLabel(
    crudModalViewKey,
    READ_ONLY_TABLE_CONFIG[crudModalViewKey]?.title
  );
  const isCaptionExampleModal = crudModalViewKey === 'captionExamples';
  const isCrudModalWide = ['captionExamples', 'humorFlavorMix'].includes(crudModalViewKey);
  const crudModal = isCrudModalOpen && activeCrudModalConfig ? (
    <div className={styles.modalBackdrop} onClick={handleCrudModalBackdropClick}>
      <div
        className={`${styles.modalCard} ${isCrudModalWide ? styles.editModalCard : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 id="crud-modal-title" className={styles.modalTitle}>
            {crudModalMode === 'create'
              ? `Create ${crudModalEntityLabel}`
              : `Read/Modify ${crudModalEntityLabel}`}
          </h3>
        </div>

        <form className={styles.modalForm} onSubmit={submitCrudForm}>
          <div
            className={`${styles.modalInlineLayout} ${
              crudPreviewImageUrl || isCaptionExampleModal ? styles.modalInlineLayoutWithImage : ''
            }`}
          >
            {crudPreviewImageUrl || isCaptionExampleModal ? (
              <div className={styles.editPreviewFrame}>
                {crudPreviewImageUrl ? (
                  <img src={crudPreviewImageUrl} alt="Row image preview" className={styles.editPreviewImage} />
                ) : (
                  <p className={styles.editPreviewEmpty}>No image available.</p>
                )}
              </div>
            ) : null}

            <div className={styles.modalInlineFields}>
              {activeCrudModalConfig.fields.map((field) => {
                const fieldValue = crudFormValues[field.key];

                if (field.type === 'boolean') {
                  return (
                    <label key={field.key} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name={field.key}
                        checked={fieldValue === true}
                        onChange={handleCrudInputChange}
                        className={styles.checkboxInput}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <label key={field.key} className={styles.formField}>
                      <span className={styles.fieldLabel}>{field.label}</span>
                      <textarea
                        name={field.key}
                        value={fieldValue ?? ''}
                        onChange={handleCrudInputChange}
                        rows={3}
                        className={styles.formTextarea}
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.key} className={styles.formField}>
                    <span className={styles.fieldLabel}>{field.label}</span>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      name={field.key}
                      value={fieldValue ?? ''}
                      onChange={handleCrudInputChange}
                      className={styles.formInput}
                    />
                  </label>
                );
              })}

              {!isCaptionExampleModal && crudReadOnlyEntries.length > 0 ? (
                <div className={styles.formField}>
                  <span className={styles.fieldLabel}>Generated Fields</span>
                  <div className={styles.detailList}>
                    {crudReadOnlyEntries.map((entry) => (
                      <div key={`crud-readonly-${entry.key}`} className={styles.detailListItem}>
                        <p className={styles.detailLabel}>{entry.label}</p>
                        <p className={styles.detailValue}>{entry.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {isCaptionExampleModal && crudReadOnlyEntries.length > 0 ? (
            <div className={styles.formField}>
              <span className={styles.fieldLabel}>Generated Fields</span>
              <div className={styles.detailList}>
                {crudReadOnlyEntries.map((entry) => (
                  <div key={`crud-readonly-${entry.key}`} className={styles.detailListItem}>
                    <p className={styles.detailLabel}>{entry.label}</p>
                    <p className={styles.detailValue}>{entry.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {crudFormError ? <p className={styles.formError}>{crudFormError}</p> : null}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.modalSecondaryButton}
              onClick={closeCrudModal}
              disabled={isCrudActionInProgress}
            >
              Cancel
            </button>
            {crudModalMode === 'edit' && activeCrudModalConfig.canDelete ? (
              <button
                type="button"
                className={styles.modalDeleteButton}
                onClick={deleteCrudRow}
                disabled={isCrudActionInProgress}
              >
                {isDeletingCrudRow ? 'Deleting...' : 'Delete row'}
              </button>
            ) : null}
            <button type="submit" className={styles.modalSuccessButton} disabled={isCrudActionInProgress}>
              {isSubmittingCrudForm
                ? crudModalMode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : crudModalMode === 'create'
                  ? 'Create row'
                  : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;
  const detailModal = detailModalState ? (
    <div className={styles.modalBackdrop} onClick={handleDetailModalBackdropClick}>
      <div
        className={`${styles.modalCard} ${detailModalState.isWide ? styles.editModalCard : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 id="detail-modal-title" className={styles.modalTitle}>
            {detailModalState.title}
          </h3>
        </div>

        <div className={styles.modalForm}>
          <div
            className={`${styles.modalInlineLayout} ${
              detailModalState.imageUrl ? styles.modalInlineLayoutWithImage : ''
            }`}
          >
            {detailModalState.imageUrl ? (
              <div className={styles.editPreviewFrame}>
                <img src={detailModalState.imageUrl} alt={detailModalState.imageAlt} className={styles.editPreviewImage} />
              </div>
            ) : null}

            <div className={styles.modalInlineFields}>
              <div className={styles.detailList}>
                {detailModalState.entries.map((entry) => (
                  <div key={`detail-${entry.key}`} className={styles.detailListItem}>
                    <p className={styles.detailLabel}>{entry.label}</p>
                    <p className={styles.detailValue}>{entry.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.modalSecondaryButton} onClick={closeDetailModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  function renderReadOnlyTable(viewKey) {
    const config = READ_ONLY_TABLE_CONFIG[viewKey];

    if (!config) {
      return <p className={styles.emptyText}>No table configuration found.</p>;
    }

    const rows = Array.isArray(readOnlyRowsByView[viewKey]) ? readOnlyRowsByView[viewKey] : [];
    const isLoading = isReadOnlyLoadingByView[viewKey] === true;
    const loadError = toDisplayText(readOnlyErrorsByView[viewKey]);
    const searchInputValue = readOnlySearchInputByView[viewKey] ?? '';
    const appliedSearchValue = toDisplayText(appliedReadOnlySearchByView[viewKey]) ?? '';
    const hasAppliedSearch = appliedSearchValue.length >= MIN_SEARCH_LENGTH;
    const mutableConfig = getMutableReadOnlyConfig(viewKey);
    const canEditRows = Boolean(mutableConfig);
    const canCreateRows = mutableConfig?.canCreate === true;
    const accessLabel = getReadOnlyViewAccessLabel(viewKey);
    const countLabel = hasAppliedSearch ? String(rows.length) : `Displaying ${DEFAULT_DISPLAY_COUNT}`;
    const hasSearchInputValue = searchInputValue.trim().length > 0;
    const canResetSearch = hasAppliedSearch;
    const canSubmitSearch = searchInputValue.trim().length >= MIN_SEARCH_LENGTH;

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 className={styles.title}>{config.title}</h2>
            <p className={styles.accessText}>{accessLabel}</p>
            <p className={styles.imagesHint}>{canEditRows ? 'Click row to read/modify' : 'Click row to read'}</p>
          </div>
          {canCreateRows ? (
            <button type="button" className={styles.addButton} onClick={() => openCreateCrudModal(viewKey)}>
              Add row
            </button>
          ) : null}
        </div>

        <form className={styles.searchRow} onSubmit={(event) => submitReadOnlySearch(event, viewKey)}>
          <div className={styles.searchInputWrap}>
            <input
              type="search"
              value={searchInputValue}
              onChange={(event) => handleReadOnlySearchInputChange(viewKey, event.target.value)}
              placeholder={`Search ${config.title.toLowerCase()} (3 characters minimum)`}
              className={`${styles.searchInput} ${styles.searchInputWithCount} ${
                hasSearchInputValue ? styles.searchInputWithClear : ''
              }`}
            />
            <div className={styles.searchMetaOverlay}>
              <p className={`${styles.searchCountLabel} ${hasSearchInputValue ? styles.searchCountLabelWithClear : ''}`}>
                {countLabel}
              </p>
              {hasSearchInputValue ? (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  aria-label={`Clear ${config.title} search`}
                  onClick={() => clearReadOnlySearch(viewKey)}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <button type="submit" className={styles.searchButton} disabled={!canSubmitSearch}>
            Search
          </button>
          <button
            type="button"
            className={styles.defaultButton}
            onClick={() => clearReadOnlySearch(viewKey)}
            disabled={!canResetSearch}
          >
            Show Default
          </button>
        </form>

        {isLoading ? (
          <p className={styles.emptyText}>indexing...</p>
        ) : loadError ? (
          <p className={styles.emptyText}>{loadError}</p>
        ) : rows.length > 0 ? (
          <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
            {rows.map((row, rowIndex) => {
              const rowKey = toDisplayText(row?.id) ?? `${viewKey}-${rowIndex}`;
              const cardModel = getReadOnlyCardModel(viewKey, row);
              const hasThumbnailSlot =
                Boolean(cardModel.imageUrl) || viewKey === 'captionRequests' || viewKey === 'captionExamples';
              const openRow = () => {
                if (canEditRows) {
                  openEditCrudModal(viewKey, row);
                  return;
                }

                openDetailModal({
                  title: `Read ${getSingularTableLabel(viewKey, config.title)}`,
                  row,
                  prioritizedKeys: config.columns,
                  imageUrl: cardModel.imageUrl,
                  imageAlt: `${config.title} image`,
                  isWide: viewKey !== 'llmPromptChains',
                });
              };

              return (
                <button
                  key={rowKey}
                  type="button"
                  className={`${styles.listItem} ${styles.listItemButton} ${styles.readOnlyCardButton} ${
                    hasThumbnailSlot ? styles.captionListItem : ''
                  }`}
                  onClick={openRow}
                >
                  {hasThumbnailSlot ? (
                    cardModel.imageUrl ? (
                      <img src={cardModel.imageUrl} alt={`${config.title} image`} loading="lazy" className={styles.captionThumb} />
                    ) : (
                      <div className={styles.captionThumbPlaceholder}>No image</div>
                    )
                  ) : null}
                  <div className={styles.captionBody}>
                    <p className={styles.primaryText}>{cardModel.primaryText}</p>
                    {cardModel.secondaryLines.map((line, lineIndex) => (
                      <p key={`${rowKey}-secondary-${lineIndex}`} className={styles.secondaryText}>
                        {line}
                      </p>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyText}>No rows found.</p>
        )}
      </div>
    );
  }

  function renderUsersListContent() {
    const countLabel = hasUserSearch ? String(visibleUsers.length) : `Displaying ${DEFAULT_DISPLAY_COUNT}`;
    const hasSearchInputValue = userSearchInput.trim().length > 0;
    const canResetSearch = hasUserSearch;
    const canSubmitSearch = userSearchInput.trim().length >= MIN_SEARCH_LENGTH;

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 className={styles.title}>Users</h2>
            <p className={styles.accessText}>{READ_ACCESS_LABEL}</p>
            <p className={styles.imagesHint}>Click row to read</p>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitUserSearch}>
          <div className={styles.searchInputWrap}>
            <input
              type="search"
              value={userSearchInput}
              onChange={(event) => setUserSearchInput(event.target.value)}
              placeholder="Search users (3 characters minimum)"
              className={`${styles.searchInput} ${styles.searchInputWithCount} ${
                hasSearchInputValue ? styles.searchInputWithClear : ''
              }`}
            />
            <div className={styles.searchMetaOverlay}>
              <p className={`${styles.searchCountLabel} ${hasSearchInputValue ? styles.searchCountLabelWithClear : ''}`}>
                {countLabel}
              </p>
              {hasSearchInputValue ? (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  aria-label="Clear users search"
                  onClick={clearUserSearch}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <button type="submit" className={styles.searchButton} disabled={!canSubmitSearch}>
            Search
          </button>
          <button type="button" className={styles.defaultButton} onClick={clearUserSearch} disabled={!canResetSearch}>
            Show Default
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {hasUserSearch && isSearchingUsers ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : hasUserSearch && userSearchError ? (
            <p className={styles.emptyText}>{userSearchError}</p>
          ) : showUsersIndexing ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : visibleUsers.length > 0 ? (
            visibleUsers.map((user, userIndex) => {
              const { mainText, leftSubText, rightSubText } = getUserDisplayModel(user);
              const userKey = toDisplayText(user?.id) ?? `user-${userIndex}`;

              return (
                <button
                  key={userKey}
                  type="button"
                  className={`${styles.listItem} ${styles.listItemButton}`}
                  onClick={() =>
                    openDetailModal({
                      title: `Read ${getSingularTableLabel('users')}`,
                      row: user,
                      prioritizedKeys: ['id', 'first_name', 'last_name', 'email', 'is_superadmin', 'created_datetime_utc'],
                      isWide: false,
                    })
                  }
                >
                  <div className={styles.userHeadingRow}>
                    <p className={styles.primaryText}>{mainText}</p>
                    {user.is_superadmin ? <span className={styles.userInlineBadge}>superadmin</span> : null}
                  </div>
                  {rightSubText ? (
                    <div className={styles.userMetaRow}>
                      <p className={styles.secondaryText}>{leftSubText}</p>
                      <p className={styles.userIdText} title={rightSubText}>
                        {rightSubText}
                      </p>
                    </div>
                  ) : null}
                  {!rightSubText && leftSubText ? <p className={styles.secondaryText}>{leftSubText}</p> : null}
                </button>
              );
            })
          ) : (
            <p className={styles.emptyText}>No users found.</p>
          )}
        </div>
      </div>
    );
  }

  function renderCaptionsListContent() {
    const countLabel = hasCaptionSearch ? String(visibleCaptions.length) : `Displaying ${DEFAULT_DISPLAY_COUNT}`;
    const hasSearchInputValue = captionSearchInput.trim().length > 0;
    const canResetSearch = hasCaptionSearch;
    const canSubmitSearch = captionSearchInput.trim().length >= MIN_SEARCH_LENGTH;

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 className={styles.title}>Captions</h2>
            <p className={styles.accessText}>{READ_ACCESS_LABEL}</p>
            <p className={styles.imagesHint}>Click row to read</p>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitCaptionSearch}>
          <div className={styles.searchInputWrap}>
            <input
              type="search"
              value={captionSearchInput}
              onChange={(event) => setCaptionSearchInput(event.target.value)}
              placeholder="Search captions (3 characters minimum)"
              className={`${styles.searchInput} ${styles.searchInputWithCount} ${
                hasSearchInputValue ? styles.searchInputWithClear : ''
              }`}
            />
            <div className={styles.searchMetaOverlay}>
              <p className={`${styles.searchCountLabel} ${hasSearchInputValue ? styles.searchCountLabelWithClear : ''}`}>
                {countLabel}
              </p>
              {hasSearchInputValue ? (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  aria-label="Clear captions search"
                  onClick={clearCaptionSearch}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <button type="submit" className={styles.searchButton} disabled={!canSubmitSearch}>
            Search
          </button>
          <button
            type="button"
            className={styles.defaultButton}
            onClick={clearCaptionSearch}
            disabled={!canResetSearch}
          >
            Show Default
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {hasCaptionSearch && isSearchingCaptions ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : hasCaptionSearch && captionSearchError ? (
            <p className={styles.emptyText}>{captionSearchError}</p>
          ) : showCaptionsIndexing ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : visibleCaptions.length > 0 ? (
            visibleCaptions.map((caption) => {
              const captionText = resolveCaptionText(caption);
              const captionThumbnailUrl = getCaptionThumbnailUrl(caption, imageUrlById);

              return (
                <button
                  key={caption.id}
                  type="button"
                  className={`${styles.listItem} ${styles.listItemButton} ${styles.captionListItem}`}
                  onClick={() =>
                    openDetailModal({
                      title: `Read ${getSingularTableLabel('captions')}`,
                      row: caption,
                      prioritizedKeys: ['id', 'created_datetime_utc', 'profile_id', 'image_id', 'is_public', 'content'],
                      imageUrl: captionThumbnailUrl,
                      imageAlt: 'Caption image',
                    })
                  }
                >
                  {captionThumbnailUrl ? (
                    <img src={captionThumbnailUrl} alt="Caption image" loading="lazy" className={styles.captionThumb} />
                  ) : (
                    <div className={styles.captionThumbPlaceholder}>No image</div>
                  )}
                  <div className={styles.captionBody}>
                    <p className={styles.primaryText}>{captionText ?? '[no caption content]'}</p>
                    <p className={styles.secondaryText}>id: {caption.id}</p>
                    <p className={styles.secondaryText}>user: {caption.profile_id}</p>
                    {isPublicCaption(caption) ? <span className={`${styles.badge} ${styles.publicBadge}`}>public</span> : null}
                  </div>
                </button>
              );
            })
          ) : (
            <p className={styles.emptyText}>No captions found.</p>
          )}
        </div>
      </div>
    );
  }

  function renderImagesPanel() {
    const countLabel = hasImageSearch ? String(visibleImages.length) : `Displaying ${DEFAULT_IMAGE_COUNT}`;
    const hasSearchInputValue = imageSearchInput.trim().length > 0;
    const canResetSearch = hasImageSearch;
    const canSubmitSearch = imageSearchInput.trim().length >= MIN_SEARCH_LENGTH;

    return (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h2 className={styles.title}>Images</h2>
            <p className={styles.accessText}>{CRUD_ACCESS_LABEL}</p>
            <p className={styles.imagesHint}>Click on card to read/modify</p>
          </div>
          <button type="button" className={styles.addButton} onClick={handleOpenAddImageModal}>
            Add image
          </button>
        </div>

        <form className={styles.searchRow} onSubmit={submitImageSearch}>
          <div className={styles.searchInputWrap}>
            <input
              type="search"
              value={imageSearchInput}
              onChange={(event) => setImageSearchInput(event.target.value)}
              placeholder="Search images (3 characters minimum)"
              className={`${styles.searchInput} ${styles.searchInputWithCount} ${
                hasSearchInputValue ? styles.searchInputWithClear : ''
              }`}
            />
            <div className={styles.searchMetaOverlay}>
              <p className={`${styles.searchCountLabel} ${hasSearchInputValue ? styles.searchCountLabelWithClear : ''}`}>
                {countLabel}
              </p>
              {hasSearchInputValue ? (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  aria-label="Clear images search"
                  onClick={clearImageSearch}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <button type="submit" className={styles.searchButton} disabled={!canSubmitSearch}>
            Search
          </button>
          <button type="button" className={styles.defaultButton} onClick={clearImageSearch} disabled={!canResetSearch}>
            Show Default
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {hasImageSearch && isSearchingImages ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : hasImageSearch && imageSearchError ? (
            <p className={styles.emptyText}>{imageSearchError}</p>
          ) : showImagesIndexing ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : visibleImages.length > 0 ? (
            <div className={styles.imageGrid}>
              {visibleImages.map((image) => {
                const imageDescription = getImageDescription(image) ?? '[no image description]';

                return (
                  <button
                    key={image.id ?? image.url}
                    type="button"
                    className={`${styles.listItem} ${styles.imageCard} ${styles.imageCardButton}`}
                    onClick={() => handleOpenEditImageModal(image)}
                  >
                    {image.url ? (
                      <img src={image.url} alt={imageDescription} loading="lazy" className={styles.imagePreview} />
                    ) : (
                      <div className={styles.imagePlaceholder}>No image URL</div>
                    )}
                    <p className={`${styles.primaryText} ${styles.imageDescription}`}>{imageDescription}</p>
                    <p className={styles.secondaryText}>id: {image.id ?? '[unknown id]'}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyText}>No images found.</p>
          )}
        </div>
      </article>
    );
  }

  let modeBody = null;

  if (panelMode === 'users') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {activeUsersSubMode === 'users' ? renderUsersListContent() : renderReadOnlyTable(activeUsersSubMode)}
      </article>
    );
  } else if (panelMode === 'captions') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {activeCaptionsSubMode === 'captions' ? renderCaptionsListContent() : renderReadOnlyTable(activeCaptionsSubMode)}
      </article>
    );
  } else if (panelMode === 'humorFlavors') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {renderReadOnlyTable(activeHumorSubMode)}
      </article>
    );
  } else if (panelMode === 'llms') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {renderReadOnlyTable(activeLlmsSubMode)}
      </article>
    );
  } else if (panelMode === 'images') {
    modeBody = renderImagesPanel();
  }

  return (
    <section className={styles.wrapper}>
      {modeBody}
      {isClient && addImageModal ? createPortal(addImageModal, document.body) : null}
      {isClient && editImageModal ? createPortal(editImageModal, document.body) : null}
      {isClient && crudModal ? createPortal(crudModal, document.body) : null}
      {isClient && detailModal ? createPortal(detailModal, document.body) : null}
    </section>
  );
}
