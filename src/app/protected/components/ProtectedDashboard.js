'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../protected.module.css';
import AdminDataPanels from './AdminDataPanels';

const EMPTY_DASHBOARD = {
  votes: { day: 0, week: 0, month: 0 },
  totals: { users: 0, captions: 0, images: 0 },
  topCaptions: [],
  topUsers: [],
  users: [],
  captions: [],
  images: [],
  errors: { stats: '', totals: '', data: '' },
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dedupeById(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  const seen = new Set();
  const dedupedRows = [];

  for (const row of rows) {
    const id = typeof row?.id === 'string' ? row.id : null;

    if (!id) {
      dedupedRows.push(row);
      continue;
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    dedupedRows.push(row);
  }

  return dedupedRows;
}

const MODE_OPTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'captions', label: 'Captions' },
  { id: 'images', label: 'Images' },
  { id: 'humorFlavors', label: 'Humor Flavors' },
  { id: 'llms', label: 'LLMs' },
];
const MODE_FADE_DURATION_MS = 260;

export default function ProtectedDashboard() {
  const modeTransitionTimeoutRef = useRef(null);
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadingDots, setLoadingDots] = useState('.');
  const [activePanelMode, setActivePanelMode] = useState('overview');
  const [renderedPanelMode, setRenderedPanelMode] = useState('overview');
  const [isModeContentVisible, setIsModeContentVisible] = useState(true);

  const clearModeTransitionTimeout = useCallback(() => {
    if (modeTransitionTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(modeTransitionTimeoutRef.current);
    modeTransitionTimeoutRef.current = null;
  }, []);

  const handleModeChange = useCallback(
    (nextMode) => {
      if (nextMode === activePanelMode && nextMode === renderedPanelMode && isModeContentVisible) {
        return;
      }

      setActivePanelMode(nextMode);
      setIsModeContentVisible(false);
      clearModeTransitionTimeout();

      modeTransitionTimeoutRef.current = window.setTimeout(() => {
        setRenderedPanelMode(nextMode);
        setIsModeContentVisible(true);
        modeTransitionTimeoutRef.current = null;
      }, MODE_FADE_DURATION_MS);
    },
    [activePanelMode, clearModeTransitionTimeout, isModeContentVisible, renderedPanelMode]
  );

  function handleImageAdded(insertedImage) {
    if (!insertedImage || !insertedImage.id) {
      return;
    }

    setDashboardData((currentData) => {
      const dedupedExistingImages = currentData.images.filter((image) => image?.id !== insertedImage.id);
      const nextImageTotal = toNumber(currentData.totals.images) + 1;

      return {
        ...currentData,
        totals: {
          ...currentData.totals,
          images: nextImageTotal,
        },
        images: [insertedImage, ...dedupedExistingImages],
      };
    });
  }

  function handleImageUpdated(updatedImage) {
    if (!updatedImage || !updatedImage.id) {
      return;
    }

    setDashboardData((currentData) => ({
      ...currentData,
      images: currentData.images.map((image) =>
        image?.id === updatedImage.id ? { ...image, ...updatedImage } : image
      ),
    }));
  }

  function handleImageDeleted(imageId) {
    if (!imageId) {
      return;
    }

    setDashboardData((currentData) => {
      const imageExists = currentData.images.some((image) => image?.id === imageId);
      const nextImageTotal = imageExists ? Math.max(0, toNumber(currentData.totals.images) - 1) : toNumber(currentData.totals.images);

      return {
        ...currentData,
        totals: {
          ...currentData.totals,
          images: nextImageTotal,
        },
        images: currentData.images.filter((image) => image?.id !== imageId),
      };
    });
  }

  useEffect(() => {
    const abortController = new AbortController();
    let isCancelled = false;

    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/admin/dashboard', {
          method: 'GET',
          cache: 'no-store',
          signal: abortController.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load admin dashboard data.');
        }

        if (isCancelled) {
          return;
        }

        setDashboardData({
          votes: {
            day: toNumber(payload?.votes?.day),
            week: toNumber(payload?.votes?.week),
            month: toNumber(payload?.votes?.month),
          },
          totals: {
            users: toNumber(payload?.totals?.users),
            captions: toNumber(payload?.totals?.captions),
            images: toNumber(payload?.totals?.images),
          },
          topCaptions: Array.isArray(payload?.topCaptions) ? payload.topCaptions : [],
          topUsers: Array.isArray(payload?.topUsers) ? payload.topUsers : [],
          users: dedupeById(payload?.users),
          captions: dedupeById(payload?.captions),
          images: dedupeById(payload?.images),
          errors: {
            stats: typeof payload?.errors?.stats === 'string' ? payload.errors.stats : '',
            totals: typeof payload?.errors?.totals === 'string' ? payload.errors.totals : '',
            data: typeof payload?.errors?.data === 'string' ? payload.errors.data : '',
          },
        });
        setLoadError('');
      } catch (error) {
        if (error?.name === 'AbortError' || isCancelled) {
          return;
        }

        setLoadError(error?.message ?? 'Unable to load admin dashboard data.');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchDashboardData();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }

    const dotSequence = ['.', '..', '...', ''];
    let sequenceIndex = 0;

    const intervalId = window.setInterval(() => {
      sequenceIndex = (sequenceIndex + 1) % dotSequence.length;
      setLoadingDots(dotSequence[sequenceIndex]);
    }, 340);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoading]);

  useEffect(() => {
    return () => {
      clearModeTransitionTimeout();
    };
  }, [clearModeTransitionTimeout]);

  const dayVotes = isLoading ? '...' : dashboardData.votes.day;
  const weekVotes = isLoading ? '...' : dashboardData.votes.week;
  const monthVotes = isLoading ? '...' : dashboardData.votes.month;
  const totalUsers = isLoading ? '...' : dashboardData.totals.users;
  const totalCaptions = isLoading ? '...' : dashboardData.totals.captions;
  const totalImages = isLoading ? '...' : dashboardData.totals.images;
  const isOverviewMode = renderedPanelMode === 'overview';
  const selectedModeIndex = MODE_OPTIONS.findIndex((option) => option.id === activePanelMode);
  const modeContentClassName = `${styles.modeContent} ${
    isModeContentVisible ? styles.modeContentVisible : styles.modeContentHidden
  }`;

  return (
    <>
      {!isLoading ? (
        <div className={styles.modeMenuRoot}>
          <div
            className={styles.modeSegmentTrack}
            role="tablist"
            aria-label="Dashboard mode"
            style={{ '--mode-option-count': MODE_OPTIONS.length }}
          >
            <div className={styles.modeSegmentGrid}>
              <span
                aria-hidden
                className={styles.modeSegmentThumb}
                style={{ transform: `translateX(${Math.max(selectedModeIndex, 0) * 100}%)` }}
              />
              {MODE_OPTIONS.map((option) => {
                const isActive = activePanelMode === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.modeSegmentButton} ${isActive ? styles.modeSegmentButtonActive : ''}`}
                    onClick={() => handleModeChange(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className={`${styles.pageLabel} ${styles.loadingLabel}`}>
          Loading
          <span className={styles.loadingDots}>{loadingDots}</span>
        </p>
      ) : null}

      <div className={modeContentClassName} style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}>
        {isOverviewMode ? (
          <>
            <section className={styles.statsPanel}>
        <header className={styles.statsHeader}>
          <h1 className={styles.statsTitle}>Totals</h1>
        </header>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Captions</p>
            <p className={styles.statValue}>{totalCaptions}</p>
            <p className={styles.statMeta}>total records</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Pictures</p>
            <p className={styles.statValue}>{totalImages}</p>
            <p className={styles.statMeta}>total records</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Users</p>
            <p className={styles.statValue}>{totalUsers}</p>
            <p className={styles.statMeta}>total records</p>
          </article>
        </div>

        {dashboardData.errors.totals ? (
          <p className={styles.statsError}>Error loading total counts. {dashboardData.errors.totals}</p>
        ) : null}
      </section>

      <section className={`${styles.statsPanel} ${styles.stackedPanel}`}>
        <header className={styles.statsHeader}>
          <h2 className={styles.statsTitle}>New</h2>
        </header>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Last 24 Hours</p>
            <p className={styles.statValue}>{dayVotes}</p>
            <p className={styles.statMeta}>new votes</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Last 7 Days</p>
            <p className={styles.statValue}>{weekVotes}</p>
            <p className={styles.statMeta}>new votes</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>Last 30 Days</p>
            <p className={styles.statValue}>{monthVotes}</p>
            <p className={styles.statMeta}>new votes</p>
          </article>
        </div>

        {dashboardData.errors.stats ? (
          <p className={styles.statsError}>
            Error loading one or more vote statistics. {dashboardData.errors.stats}
          </p>
        ) : null}
      </section>

      <section className={`${styles.statsPanel} ${styles.stackedPanel}`}>
        <header className={styles.statsHeader}>
          <h2 className={styles.statsTitle}>Top</h2>
        </header>

        <div className={`${styles.statsGrid} ${styles.leadersGrid}`}>
          <article className={styles.statCard}>
            <div className={styles.rankHeader}>
              <p className={styles.rankHeading}>Captions</p>
            </div>
            {isLoading ? (
              <p className={styles.rankEmpty}>indexing...</p>
            ) : dashboardData.topCaptions.length > 0 ? (
              <ol className={styles.rankList}>
                {dashboardData.topCaptions.map((entry, index) => (
                  <li key={entry.captionId} className={`${styles.rankItem} ${styles.rankCaptionItem}`}>
                    <div className={styles.rankCaptionMain}>
                      <span className={styles.rankIndex}>{index + 1}.</span>
                      {entry.imageUrl ? (
                        <img
                          src={entry.imageUrl}
                          alt="Top caption image"
                          loading="lazy"
                          className={styles.rankThumb}
                        />
                      ) : (
                        <span className={styles.rankThumbPlaceholder}>No image</span>
                      )}
                      <span className={styles.rankLabel}>{entry.label}</span>
                    </div>
                    <span className={styles.rankCount}>{entry.upvotes} likes</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.rankEmpty}>No upvotes yet.</p>
            )}
          </article>

          <article className={styles.statCard}>
            <div className={styles.rankHeader}>
              <p className={styles.rankHeading}>Users</p>
            </div>
            {isLoading ? (
              <p className={styles.rankEmpty}>indexing...</p>
            ) : dashboardData.topUsers.length > 0 ? (
              <ol className={styles.rankList}>
                {dashboardData.topUsers.map((entry, index) => (
                  <li key={entry.userId} className={styles.rankItem}>
                    <div className={styles.rankUserMain}>
                      <span className={styles.rankIndex}>{index + 1}.</span>
                      <div className={styles.rankUserDetails}>
                        <span className={styles.rankLabel}>{entry.label}</span>
                        {entry.email ? <span className={styles.rankSubLabel}>{entry.email}</span> : null}
                      </div>
                    </div>
                    <span className={styles.rankCount}>{entry.upvotes} votes</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.rankEmpty}>No upvotes yet.</p>
            )}
          </article>
        </div>

        {dashboardData.errors.data ? (
          <p className={styles.statsError}>Error loading leaderboard/list data. {dashboardData.errors.data}</p>
        ) : null}
      </section>
          </>
        ) : (
          <AdminDataPanels
            users={dashboardData.users}
            captions={dashboardData.captions}
            images={dashboardData.images}
            isDataLoading={isLoading}
            onImageAdded={handleImageAdded}
            onImageUpdated={handleImageUpdated}
            onImageDeleted={handleImageDeleted}
            panelMode={renderedPanelMode}
          />
        )}
      </div>

      {loadError ? <p className={styles.statsError}>{loadError}</p> : null}
    </>
  );
}
