'use client';

import { createClient } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AdminDataPanels.module.css';

const DEFAULT_DISPLAY_COUNT = 100;
const DEFAULT_IMAGE_COUNT = 30;
const MIN_SEARCH_LENGTH = 3;
const PIPELINE_BASE_URL = 'https://api.almostcrackd.ai';
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
const FILE_ACCEPT_VALUE = SUPPORTED_IMAGE_TYPES.join(',');
const CAPTION_TEXT_KEYS = ['content', 'caption', 'text', 'title', 'generated_caption', 'caption_text'];
const IMAGE_FORM_DEFAULTS = {
  isPublic: false,
  isCommonUse: false,
};
const USERS_SUB_MODE_OPTIONS = [
  { id: 'users', label: 'Users' },
  { id: 'signupDomains', label: 'Signup Domains' },
  { id: 'whitelistedEmails', label: 'Whitelisted Emails' },
];
const CAPTIONS_SUB_MODE_OPTIONS = [
  { id: 'captions', label: 'Captions' },
  { id: 'captionRequests', label: 'Captions Requests' },
  { id: 'captionExamples', label: 'Captions Examples' },
  { id: 'terms', label: 'Terms' },
];
const HUMOR_FLAVORS_SUB_MODE_OPTIONS = [
  { id: 'humorFlavors', label: 'Humor Flavors' },
  { id: 'humorFlavorSteps', label: 'Humor Flavor Steps' },
  { id: 'humorFlavorMix', label: 'Humor Mix' },
];
const LLMS_SUB_MODE_OPTIONS = [
  { id: 'llmModels', label: 'LLM Models' },
  { id: 'llmProviders', label: 'LLM Providers' },
  { id: 'llmPromptChains', label: 'LLM Prompt Chains' },
  { id: 'llmResponses', label: 'LLM Responses' },
];
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

function asLower(value) {
  return String(value ?? '').toLowerCase();
}

function toDisplayText(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function autoSizeTextarea(element) {
  if (!element) {
    return;
  }

  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function formatColumnLabel(column) {
  return column
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatReadOnlyCellValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return '—';
    }

    return serialized.length > 300 ? `${serialized.slice(0, 297)}...` : serialized;
  }

  const textValue = String(value);
  if (textValue.trim().length === 0) {
    return '—';
  }

  return textValue.length > 300 ? `${textValue.slice(0, 297)}...` : textValue;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
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

function extractRegisteredImageId(payload) {
  const directImageId = toDisplayText(payload?.imageId);
  if (directImageId) {
    return directImageId;
  }

  const nestedImageId = toDisplayText(payload?.image?.id);
  if (nestedImageId) {
    return nestedImageId;
  }

  return toDisplayText(payload?.id);
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
}) {
  const supabase = useMemo(() => createClient(), []);
  const imageDescriptionTextareaRef = useRef(null);
  const additionalContextTextareaRef = useRef(null);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [captionSearchInput, setCaptionSearchInput] = useState('');
  const [imageSearchInput, setImageSearchInput] = useState('');

  const [appliedUserSearch, setAppliedUserSearch] = useState('');
  const [appliedCaptionSearch, setAppliedCaptionSearch] = useState('');
  const [appliedImageSearch, setAppliedImageSearch] = useState('');

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
  const [editImageError, setEditImageError] = useState('');
  const [editImageFormValues, setEditImageFormValues] = useState(createInitialEditImageFormValues);
  const [activeUsersSubMode, setActiveUsersSubMode] = useState('users');
  const [activeCaptionsSubMode, setActiveCaptionsSubMode] = useState('captions');
  const [activeHumorSubMode, setActiveHumorSubMode] = useState('humorFlavors');
  const [activeLlmsSubMode, setActiveLlmsSubMode] = useState('llmModels');
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
  const [crudFormValues, setCrudFormValues] = useState({});
  const [crudFormError, setCrudFormError] = useState('');
  const [isSubmittingCrudForm, setIsSubmittingCrudForm] = useState(false);
  const [isDeletingCrudRow, setIsDeletingCrudRow] = useState(false);
  const isEditActionInProgress = isSavingImageEdit || isDeletingImage;
  const isCrudActionInProgress = isSubmittingCrudForm || isDeletingCrudRow;

  const hasUserSearch = appliedUserSearch.trim().length >= MIN_SEARCH_LENGTH;
  const hasCaptionSearch = appliedCaptionSearch.trim().length >= MIN_SEARCH_LENGTH;
  const hasImageSearch = appliedImageSearch.trim().length >= MIN_SEARCH_LENGTH;

  const filteredUsers = useMemo(() => {
    const query = asLower(appliedUserSearch).trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [
        user.id,
        user.first_name,
        user.last_name,
        user.email,
        user.is_superadmin ? 'superadmin' : 'user',
      ]
        .map(asLower)
        .join(' ');

      return haystack.includes(query);
    });
  }, [appliedUserSearch, users]);

  const filteredCaptions = useMemo(() => {
    const query = asLower(appliedCaptionSearch).trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      return captions;
    }

    return captions.filter((caption) => {
      const captionText = resolveCaptionText(caption);
      const visibility = isPublicCaption(caption) ? 'public is_public' : 'private';
      const haystack = [caption.id, caption.profile_id, captionText, visibility]
        .map(asLower)
        .join(' ');
      return haystack.includes(query);
    });
  }, [appliedCaptionSearch, captions]);

  const filteredImages = useMemo(() => {
    const query = asLower(appliedImageSearch).trim();

    if (query.length < MIN_SEARCH_LENGTH) {
      return images;
    }

    return images.filter((image) => {
      const imageDescription = getImageDescription(image);
      const haystack = [image.id, image.url, imageDescription, image.additional_context]
        .map(asLower)
        .join(' ');

      return haystack.includes(query);
    });
  }, [appliedImageSearch, images]);

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

  const visibleUsers = hasUserSearch ? filteredUsers : defaultUsers;
  const visibleCaptions = hasCaptionSearch ? filteredCaptions : defaultCaptions;
  const visibleImages = hasImageSearch ? filteredImages : defaultImages;

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
    if (!isEditImageModalOpen) {
      return;
    }

    autoSizeTextarea(imageDescriptionTextareaRef.current);
    autoSizeTextarea(additionalContextTextareaRef.current);
  }, [editImageFormValues.additionalContext, editImageFormValues.imageDescription, isEditImageModalOpen]);

  function submitUserSearch(event) {
    event.preventDefault();
    const query = userSearchInput.trim();
    setAppliedUserSearch(query.length >= MIN_SEARCH_LENGTH ? query : '');
  }

  function submitCaptionSearch(event) {
    event.preventDefault();
    const query = captionSearchInput.trim();
    setAppliedCaptionSearch(query.length >= MIN_SEARCH_LENGTH ? query : '');
  }

  function submitImageSearch(event) {
    event.preventDefault();
    const query = imageSearchInput.trim();
    setAppliedImageSearch(query.length >= MIN_SEARCH_LENGTH ? query : '');
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

  function refreshReadOnlyView(viewKey) {
    if (!viewKey) {
      return;
    }

    setReadOnlyRefreshTokenByView((currentTokens) => ({
      ...currentTokens,
      [viewKey]: (currentTokens[viewKey] ?? 0) + 1,
    }));
  }

  function openCreateCrudModal(viewKey) {
    const mutableConfig = getMutableReadOnlyConfig(viewKey);
    if (!mutableConfig?.canCreate) {
      return;
    }

    setCrudModalMode('create');
    setCrudModalViewKey(viewKey);
    setCrudModalRowId('');
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
    setEditImageFormValues(createInitialEditImageFormValues(image));
    setEditImageError('');
    setIsEditImageModalOpen(true);
  }

  function handleCloseEditImageModal() {
    if (isEditActionInProgress) {
      return;
    }

    setIsEditImageModalOpen(false);
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
    if (event.target?.tagName === 'TEXTAREA') {
      autoSizeTextarea(event.target);
    }

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

      const registrationData = await postJson(
        '/pipeline/upload-image-from-url',
        token,
        {
          imageUrl: presignedData.cdnUrl,
          isCommonUse: addImageFormValues.isCommonUse,
        },
        'Could not register uploaded image URL.'
      );

      const imageId = extractRegisteredImageId(registrationData);
      if (!imageId) {
        throw new Error('Image upload succeeded, but no image id was returned.');
      }

      const finalizeResponse = await fetch('/api/admin/images', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: imageId,
          is_public: addImageFormValues.isPublic,
          is_common_use: addImageFormValues.isCommonUse,
        }),
      });

      const finalizePayload = await finalizeResponse.json().catch(() => null);
      if (!finalizeResponse.ok) {
        throw new Error(finalizePayload?.error ?? 'Could not finalize image settings.');
      }

      const nextImage =
        finalizePayload?.image ?? {
          id: imageId,
          url: presignedData.cdnUrl,
          image_description: null,
          additional_context: null,
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
    } catch (error) {
      setEditImageError(error?.message ?? 'Unable to delete image.');
    } finally {
      setIsDeletingImage(false);
    }
  }

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
            Edit Image
          </h3>
        </div>

        <form className={styles.modalForm} onSubmit={submitEditImage}>
          <div className={styles.editPreviewFrame}>
            {editImageFormValues.url ? (
              <img src={editImageFormValues.url} alt="Image preview" className={styles.editPreviewImage} />
            ) : (
              <p className={styles.editPreviewEmpty}>No image URL available.</p>
            )}
          </div>

          <div className={styles.editMetaGrid}>
            <p className={`${styles.editMetaText} ${styles.editMetaTextCentered}`}>
              id: {editImageFormValues.id || '[unknown id]'}
            </p>
          </div>

          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Image description</span>
            <textarea
              ref={imageDescriptionTextareaRef}
              name="imageDescription"
              value={editImageFormValues.imageDescription}
              onChange={handleEditImageInputChange}
              rows={1}
              className={`${styles.formTextarea} ${styles.autoExpandTextarea}`}
              placeholder="Enter image description"
            />
          </label>

          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Additional context</span>
            <textarea
              ref={additionalContextTextareaRef}
              name="additionalContext"
              value={editImageFormValues.additionalContext}
              onChange={handleEditImageInputChange}
              rows={1}
              className={`${styles.formTextarea} ${styles.autoExpandTextarea}`}
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
  const activeCrudModalConfig = getMutableReadOnlyConfig(crudModalViewKey);
  const crudModal = isCrudModalOpen && activeCrudModalConfig ? (
    <div className={styles.modalBackdrop} onClick={handleCrudModalBackdropClick}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="crud-modal-title">
        <div className={styles.modalHeader}>
          <h3 id="crud-modal-title" className={styles.modalTitle}>
            {crudModalMode === 'create' ? `Create ${READ_ONLY_TABLE_CONFIG[crudModalViewKey]?.title ?? 'Row'}` : `Edit ${READ_ONLY_TABLE_CONFIG[crudModalViewKey]?.title ?? 'Row'}`}
          </h3>
        </div>

        <form className={styles.modalForm} onSubmit={submitCrudForm}>
          {crudModalMode === 'edit' ? (
            <p className={`${styles.editMetaText} ${styles.editMetaTextCentered}`}>id: {crudModalRowId}</p>
          ) : null}

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

  function renderSubModeSwitcher(options, activeMode, setActiveMode, ariaLabel) {
    const activeIndex = options.findIndex((option) => option.id === activeMode);

    return (
      <div className={styles.subModeRoot}>
        <div
          className={styles.subModeTrack}
          role="tablist"
          aria-label={ariaLabel}
          style={{ '--sub-mode-option-count': options.length }}
        >
          <div className={styles.subModeGrid}>
            <span
              aria-hidden
              className={styles.subModeThumb}
              style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
            />
            {options.map((option) => {
              const isActive = option.id === activeMode;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.subModeButton} ${isActive ? styles.subModeButtonActive : ''}`}
                  onClick={() => setActiveMode(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

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

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <h2 className={styles.title}>{config.title}</h2>
          <div className={styles.readOnlyMetaBlock}>
            {canCreateRows ? (
              <button type="button" className={styles.addButton} onClick={() => openCreateCrudModal(viewKey)}>
                Add row
              </button>
            ) : null}
            {!isLoading ? (
              <div className={styles.countAccessRow}>
                <p className={styles.count}>{countLabel}</p>
                <p className={styles.accessText}>{accessLabel}</p>
              </div>
            ) : null}
            {canEditRows ? <p className={styles.imagesHint}>Click row to modify</p> : null}
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={(event) => submitReadOnlySearch(event, viewKey)}>
          <input
            type="search"
            value={searchInputValue}
            onChange={(event) => handleReadOnlySearchInputChange(viewKey, event.target.value)}
            placeholder={`Search ${config.title.toLowerCase()} (3 characters minimum)`}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        {isLoading ? (
          <p className={styles.emptyText}>indexing...</p>
        ) : loadError ? (
          <p className={styles.emptyText}>{loadError}</p>
        ) : rows.length > 0 ? (
          <div className={styles.tableScrollWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column} className={styles.dataTableHeaderCell}>
                      {formatColumnLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const rowKey = toDisplayText(row?.id) ?? `${viewKey}-${rowIndex}`;

                  return (
                    <tr
                      key={rowKey}
                      className={canEditRows ? styles.dataTableRowEditable : ''}
                      onClick={canEditRows ? () => openEditCrudModal(viewKey, row) : undefined}
                      onKeyDown={
                        canEditRows
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openEditCrudModal(viewKey, row);
                              }
                            }
                          : undefined
                      }
                      tabIndex={canEditRows ? 0 : undefined}
                    >
                      {config.columns.map((column) => {
                        const cellValue = formatReadOnlyCellValue(row?.[column]);

                        return (
                          <td key={`${rowKey}-${column}`} className={styles.dataTableCell}>
                            <span className={styles.dataTableCellText} title={cellValue}>
                              {cellValue}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyText}>No rows found.</p>
        )}
      </div>
    );
  }

  function renderUsersListContent() {
    const countLabel = hasUserSearch ? String(filteredUsers.length) : `Displaying ${DEFAULT_DISPLAY_COUNT}`;

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <h2 className={styles.title}>Users</h2>
          <div className={styles.readOnlyMetaBlock}>
            <div className={styles.countAccessRow}>
              <p className={styles.count}>{countLabel}</p>
              <p className={styles.accessText}>{READ_ACCESS_LABEL}</p>
            </div>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitUserSearch}>
          <input
            type="search"
            value={userSearchInput}
            onChange={(event) => setUserSearchInput(event.target.value)}
            placeholder="Search users (3 characters minimum)"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {showUsersIndexing ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : visibleUsers.length > 0 ? (
            visibleUsers.map((user) => {
              const { mainText, leftSubText, rightSubText } = getUserDisplayModel(user);

              return (
                <div key={user.id} className={styles.listItem}>
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
                </div>
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
    const countLabel = hasCaptionSearch ? String(filteredCaptions.length) : `Displaying ${DEFAULT_DISPLAY_COUNT}`;

    return (
      <div className={styles.subModeContent}>
        <div className={styles.header}>
          <h2 className={styles.title}>Captions</h2>
          <div className={styles.readOnlyMetaBlock}>
            <div className={styles.countAccessRow}>
              <p className={styles.count}>{countLabel}</p>
              <p className={styles.accessText}>{READ_ACCESS_LABEL}</p>
            </div>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitCaptionSearch}>
          <input
            type="search"
            value={captionSearchInput}
            onChange={(event) => setCaptionSearchInput(event.target.value)}
            placeholder="Search captions (3 characters minimum)"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {showCaptionsIndexing ? (
            <p className={styles.emptyText}>indexing...</p>
          ) : visibleCaptions.length > 0 ? (
            visibleCaptions.map((caption) => {
              const captionText = resolveCaptionText(caption);
              const captionThumbnailUrl = getCaptionThumbnailUrl(caption, imageUrlById);

              return (
                <div key={caption.id} className={`${styles.listItem} ${styles.captionListItem}`}>
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
                </div>
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
    const countLabel = hasImageSearch ? String(filteredImages.length) : `Displaying ${DEFAULT_IMAGE_COUNT}`;

    return (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        <div className={`${styles.header} ${styles.imagesHeader}`}>
          <div className={styles.imagesHeaderLeft}>
            <h2 className={styles.title}>Images</h2>
            <button type="button" className={styles.addButton} onClick={handleOpenAddImageModal}>
              Add image
            </button>
          </div>
          <div className={styles.imagesCountBlock}>
            <div className={styles.countAccessRow}>
              <p className={styles.count}>{countLabel}</p>
              <p className={styles.accessText}>{CRUD_ACCESS_LABEL}</p>
            </div>
            <p className={styles.imagesHint}>Click on image to modify</p>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={submitImageSearch}>
          <input
            type="search"
            value={imageSearchInput}
            onChange={(event) => setImageSearchInput(event.target.value)}
            placeholder="Search images (3 characters minimum)"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <div className={`${styles.scrollList} ${styles.expandedScroll}`}>
          {showImagesIndexing ? (
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
        {renderSubModeSwitcher(USERS_SUB_MODE_OPTIONS, activeUsersSubMode, setActiveUsersSubMode, 'Users data mode')}
        {activeUsersSubMode === 'users' ? renderUsersListContent() : renderReadOnlyTable(activeUsersSubMode)}
      </article>
    );
  } else if (panelMode === 'captions') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {renderSubModeSwitcher(
          CAPTIONS_SUB_MODE_OPTIONS,
          activeCaptionsSubMode,
          setActiveCaptionsSubMode,
          'Captions data mode'
        )}
        {activeCaptionsSubMode === 'captions' ? renderCaptionsListContent() : renderReadOnlyTable(activeCaptionsSubMode)}
      </article>
    );
  } else if (panelMode === 'humorFlavors') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {renderSubModeSwitcher(
          HUMOR_FLAVORS_SUB_MODE_OPTIONS,
          activeHumorSubMode,
          setActiveHumorSubMode,
          'Humor flavors data mode'
        )}
        {renderReadOnlyTable(activeHumorSubMode)}
      </article>
    );
  } else if (panelMode === 'llms') {
    modeBody = (
      <article className={`${styles.panel} ${styles.widePanel}`}>
        {renderSubModeSwitcher(LLMS_SUB_MODE_OPTIONS, activeLlmsSubMode, setActiveLlmsSubMode, 'LLM data mode')}
        {renderReadOnlyTable(activeLlmsSubMode)}
      </article>
    );
  } else if (panelMode === 'images') {
    modeBody = renderImagesPanel();
  }

  return (
    <section className={`${styles.wrapper} ${panelMode !== 'overview' ? styles.flushTop : ''}`}>
      {modeBody}
      {isClient && addImageModal ? createPortal(addImageModal, document.body) : null}
      {isClient && editImageModal ? createPortal(editImageModal, document.body) : null}
      {isClient && crudModal ? createPortal(crudModal, document.body) : null}
    </section>
  );
}
