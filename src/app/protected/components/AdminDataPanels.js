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

function hasGeneratedCelebrityRecognition(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (typeof value === 'object') {
    return true;
  }

  return true;
}

function hasGeneratedEmbedding(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function hasGeneratedImageMetadata(image) {
  if (!image) {
    return false;
  }

  return (
    Boolean(toDisplayText(image.image_description)) &&
    hasGeneratedCelebrityRecognition(image.celebrity_recognition) &&
    hasGeneratedEmbedding(image.embedding)
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
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
  const [addImageStatusMessage, setAddImageStatusMessage] = useState('Select an image file to upload.');
  const [isSubmittingImage, setIsSubmittingImage] = useState(false);
  const [addImageError, setAddImageError] = useState('');
  const [addImageFormValues, setAddImageFormValues] = useState(createInitialImageFormValues);
  const [isEditImageModalOpen, setIsEditImageModalOpen] = useState(false);
  const [isSavingImageEdit, setIsSavingImageEdit] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [editImageError, setEditImageError] = useState('');
  const [editImageFormValues, setEditImageFormValues] = useState(createInitialEditImageFormValues);
  const isEditActionInProgress = isSavingImageEdit || isDeletingImage;

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

  const showUsersPanel = panelMode === 'overview' || panelMode === 'users';
  const showCaptionsPanel = panelMode === 'overview' || panelMode === 'captions';
  const showImagesPanel = panelMode === 'overview' || panelMode === 'images';
  const usersPanelClassName = `${styles.panel}${panelMode === 'users' ? ` ${styles.widePanel}` : ''}`;
  const captionsPanelClassName = `${styles.panel}${panelMode === 'captions' ? ` ${styles.widePanel}` : ''}`;

  useEffect(() => {
    setIsClient(true);
    return () => {
      setIsClient(false);
    };
  }, []);

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

  function handleOpenAddImageModal() {
    setIsAddImageModalOpen(true);
    setAddImageError('');
    setAddImageSelectedFile(null);
    setAddImageStatusMessage('Select an image file to upload.');
    setAddImageFormValues(createInitialImageFormValues());
  }

  function handleCloseAddImageModal() {
    if (isSubmittingImage) {
      return;
    }

    setIsAddImageModalOpen(false);
    setAddImageError('');
    setAddImageSelectedFile(null);
    setAddImageStatusMessage('Select an image file to upload.');
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
    setAddImageStatusMessage(nextFile ? 'Image selected. Ready to upload.' : 'Select an image file to upload.');
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

  async function fetchAdminImageById(imageId) {
    const response = await fetch(`/api/admin/images?id=${encodeURIComponent(imageId)}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Could not fetch uploaded image record.');
    }

    return payload?.image ?? null;
  }

  async function waitForGeneratedImageMetadata(imageId) {
    const maxAttempts = 24;
    const delayMilliseconds = 1500;
    let latestImage = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        latestImage = await fetchAdminImageById(imageId);
      } catch {
        latestImage = null;
      }

      if (hasGeneratedImageMetadata(latestImage)) {
        return latestImage;
      }

      if (attempt < maxAttempts - 1) {
        await sleep(delayMilliseconds);
      }
    }

    return latestImage;
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

      setAddImageStatusMessage('Generating upload URL...');
      const presignedData = await postJson(
        '/pipeline/generate-presigned-url',
        token,
        { contentType: addImageSelectedFile.type },
        'Could not generate upload URL.'
      );

      setAddImageStatusMessage('Uploading image...');
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

      setAddImageStatusMessage('Registering uploaded image...');
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

      setAddImageStatusMessage('Running caption pipeline...');
      await postJson(
        '/pipeline/generate-captions',
        token,
        {
          imageId,
          numCaptions: 0,
        },
        'Could not run caption pipeline.'
      );

      setAddImageStatusMessage('Finalizing image settings...');
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

      setAddImageStatusMessage('Generating description and recognition...');
      const generatedImage = await waitForGeneratedImageMetadata(imageId);
      const nextImage =
        generatedImage ??
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

      setAddImageStatusMessage('Image uploaded successfully.');
      setAddImageSelectedFile(null);
      setAddImageFormValues(createInitialImageFormValues());
      setIsAddImageModalOpen(false);
    } catch (error) {
      setAddImageError(error?.message ?? 'Unable to add image.');
      setAddImageStatusMessage('Image upload failed.');
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

          <p className={styles.formStatus}>{addImageStatusMessage}</p>
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

  return (
    <section className={`${styles.wrapper} ${panelMode !== 'overview' ? styles.flushTop : ''}`}>
      {showUsersPanel ? (
        <article className={usersPanelClassName}>
        <div className={styles.header}>
          <h2 className={styles.title}>Users</h2>
          {hasUserSearch ? (
            <p className={styles.count}>{filteredUsers.length}</p>
          ) : (
            <p className={styles.count}>Displaying 100</p>
          )}
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
                  {!rightSubText && leftSubText ? (
                    <p className={styles.secondaryText}>{leftSubText}</p>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className={styles.emptyText}>No users found.</p>
          )}
        </div>
      </article>
      ) : null}

      {showCaptionsPanel ? (
        <article className={captionsPanelClassName}>
        <div className={styles.header}>
          <h2 className={styles.title}>Captions</h2>
          {hasCaptionSearch ? (
            <p className={styles.count}>{filteredCaptions.length}</p>
          ) : (
            <p className={styles.count}>Displaying 100</p>
          )}
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
                    <img
                      src={captionThumbnailUrl}
                      alt="Caption image"
                      loading="lazy"
                      className={styles.captionThumb}
                    />
                  ) : (
                    <div className={styles.captionThumbPlaceholder}>No image</div>
                  )}
                  <div className={styles.captionBody}>
                    <p className={styles.primaryText}>{captionText ?? '[no caption content]'}</p>
                    <p className={styles.secondaryText}>id: {caption.id}</p>
                    <p className={styles.secondaryText}>user: {caption.profile_id}</p>
                    {isPublicCaption(caption) ? (
                      <span className={`${styles.badge} ${styles.publicBadge}`}>public</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className={styles.emptyText}>No captions found.</p>
          )}
        </div>
      </article>
      ) : null}

      {showImagesPanel ? (
        <article className={`${styles.panel} ${styles.widePanel}`}>
        <div className={`${styles.header} ${styles.imagesHeader}`}>
          <div className={styles.imagesHeaderLeft}>
            <h2 className={styles.title}>Images</h2>
            <button type="button" className={styles.addButton} onClick={handleOpenAddImageModal}>
              Add image
            </button>
          </div>
          <div className={styles.imagesCountBlock}>
            {hasImageSearch ? (
              <p className={styles.count}>{filteredImages.length}</p>
            ) : (
              <p className={styles.count}>Displaying {DEFAULT_IMAGE_COUNT}</p>
            )}
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
                      <img
                        src={image.url}
                        alt={imageDescription}
                        loading="lazy"
                        className={styles.imagePreview}
                      />
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
      ) : null}
      {isClient && addImageModal ? createPortal(addImageModal, document.body) : null}
      {isClient && editImageModal ? createPortal(editImageModal, document.body) : null}
    </section>
  );
}
