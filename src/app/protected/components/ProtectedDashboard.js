'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../protected.module.css';
import AdminDataPanels from './AdminDataPanels';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
const EMPTY_CAPTION_ANALYTICS = {
  totalCaptions: 0,
  captionsWithVotes: 0,
  captionsWithoutVotes: 0,
  coveragePercent: 0,
  upvotesTotal: 0,
  downvotesTotal: 0,
  totalVotes: 0,
  upvoteToDownvoteRatio: null,
  hasDownvoteData: false,
  distribution: {
    positive: 0,
    neutral: 0,
    negative: 0,
    noVotes: 0,
  },
};
const EMPTY_DASHBOARD = {
  newUsers: { day: 0, week: 0, month: 0 },
  newCaptions: { day: 0, week: 0, month: 0 },
  totals: { users: 0, captions: 0, images: 0 },
  captionAnalytics: EMPTY_CAPTION_ANALYTICS,
  topCaptions: [],
  topUsers: [],
  topImages: [],
  users: [],
  captions: [],
  images: [],
  errors: { stats: '', totals: '', data: '' },
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, toNumber(value)));
}

function formatCount(value) {
  return NUMBER_FORMATTER.format(Math.max(0, toNumber(value)));
}

function formatSignedCount(value) {
  return NUMBER_FORMATTER.format(toNumber(value));
}

function formatPercentage(value) {
  return `${clampPercentage(value).toFixed(1)}%`;
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
  { id: 'users', label: 'Access Control' },
  { id: 'captions', label: 'Caption Management' },
  { id: 'images', label: 'Image Management' },
  { id: 'humorFlavors', label: 'Humor Workflow' },
  { id: 'llms', label: 'LLMs' },
];
const MODE_FADE_DURATION_MS = 260;
const COMPACT_LAYOUT_QUERY = '(max-width: 1023px)';
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
const OVERVIEW_SUB_MODE_OPTIONS = [{ id: 'overview', label: 'Overview' }];
const IMAGES_SUB_MODE_OPTIONS = [{ id: 'images', label: 'Images' }];

export default function ProtectedDashboard() {
  const modeTransitionTimeoutRef = useRef(null);
  const compactModePanelRef = useRef(null);
  const compactModeButtonRef = useRef(null);
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activePanelMode, setActivePanelMode] = useState('overview');
  const [renderedPanelMode, setRenderedPanelMode] = useState('overview');
  const [isModeContentVisible, setIsModeContentVisible] = useState(true);
  const [activeUsersSubMode, setActiveUsersSubMode] = useState('users');
  const [activeCaptionsSubMode, setActiveCaptionsSubMode] = useState('captions');
  const [activeHumorSubMode, setActiveHumorSubMode] = useState('humorFlavors');
  const [activeLlmsSubMode, setActiveLlmsSubMode] = useState('llmModels');
  const [isCompactModeMenuOpen, setIsCompactModeMenuOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

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
      setIsCompactModeMenuOpen(false);
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
          newUsers: {
            day: toNumber(payload?.newUsers?.day ?? payload?.votes?.day),
            week: toNumber(payload?.newUsers?.week ?? payload?.votes?.week),
            month: toNumber(payload?.newUsers?.month ?? payload?.votes?.month),
          },
          newCaptions: {
            day: toNumber(payload?.newCaptions?.day),
            week: toNumber(payload?.newCaptions?.week),
            month: toNumber(payload?.newCaptions?.month),
          },
          totals: {
            users: toNumber(payload?.totals?.users),
            captions: toNumber(payload?.totals?.captions),
            images: toNumber(payload?.totals?.images),
          },
          captionAnalytics: {
            totalCaptions: toNumber(payload?.captionAnalytics?.totalCaptions ?? payload?.totals?.captions),
            captionsWithVotes: Math.max(0, toNumber(payload?.captionAnalytics?.captionsWithVotes)),
            captionsWithoutVotes: Math.max(0, toNumber(payload?.captionAnalytics?.captionsWithoutVotes)),
            coveragePercent: clampPercentage(payload?.captionAnalytics?.coveragePercent),
            upvotesTotal: Math.max(0, toNumber(payload?.captionAnalytics?.upvotesTotal)),
            downvotesTotal: Math.max(0, toNumber(payload?.captionAnalytics?.downvotesTotal)),
            totalVotes: Math.max(0, toNumber(payload?.captionAnalytics?.totalVotes)),
            upvoteToDownvoteRatio:
              payload?.captionAnalytics?.upvoteToDownvoteRatio === null
                ? null
                : toNumber(payload?.captionAnalytics?.upvoteToDownvoteRatio),
            hasDownvoteData: payload?.captionAnalytics?.hasDownvoteData === true,
            distribution: {
              positive: Math.max(0, toNumber(payload?.captionAnalytics?.distribution?.positive)),
              neutral: Math.max(0, toNumber(payload?.captionAnalytics?.distribution?.neutral)),
              negative: Math.max(0, toNumber(payload?.captionAnalytics?.distribution?.negative)),
              noVotes: Math.max(0, toNumber(payload?.captionAnalytics?.distribution?.noVotes)),
            },
          },
          topCaptions: Array.isArray(payload?.topCaptions) ? payload.topCaptions : [],
          topUsers: Array.isArray(payload?.topUsers) ? payload.topUsers : [],
          topImages: Array.isArray(payload?.topImages) ? payload.topImages : [],
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
    return () => {
      clearModeTransitionTimeout();
    };
  }, [clearModeTransitionTimeout]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const handleViewportChange = () => {
      const isCompact = mediaQueryList.matches;
      setIsCompactViewport(isCompact);

      if (!isCompact) {
        setIsCompactModeMenuOpen(false);
      }
    };

    handleViewportChange();

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleViewportChange);
    } else {
      mediaQueryList.addListener(handleViewportChange);
    }

    return () => {
      if (typeof mediaQueryList.removeEventListener === 'function') {
        mediaQueryList.removeEventListener('change', handleViewportChange);
      } else {
        mediaQueryList.removeListener(handleViewportChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCompactModeMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (compactModePanelRef.current?.contains(target) || compactModeButtonRef.current?.contains(target)) {
        return;
      }

      setIsCompactModeMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsCompactModeMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCompactModeMenuOpen]);

  const newUsersSeries = [
    { key: 'day', label: '24h', value: Math.max(0, toNumber(dashboardData.newUsers.day)) },
    { key: 'week', label: '7d', value: Math.max(0, toNumber(dashboardData.newUsers.week)) },
    { key: 'month', label: '30d', value: Math.max(0, toNumber(dashboardData.newUsers.month)) },
  ];
  const newCaptionsSeries = [
    { key: 'day', label: '24h', value: Math.max(0, toNumber(dashboardData.newCaptions.day)) },
    { key: 'week', label: '7d', value: Math.max(0, toNumber(dashboardData.newCaptions.week)) },
    { key: 'month', label: '30d', value: Math.max(0, toNumber(dashboardData.newCaptions.month)) },
  ];
  const maxNewUsersValue = Math.max(0, ...newUsersSeries.map((entry) => entry.value));
  const maxNewCaptionsValue = Math.max(0, ...newCaptionsSeries.map((entry) => entry.value));
  const totalUsers = isLoading ? '...' : dashboardData.totals.users;
  const totalCaptions = isLoading ? '...' : dashboardData.totals.captions;
  const totalImages = isLoading ? '...' : dashboardData.totals.images;
  const coveragePercent = clampPercentage(dashboardData.captionAnalytics.coveragePercent);
  const captionCoverageDisplay = isLoading ? '...' : formatPercentage(coveragePercent);
  const captionsWithVotesDisplay = isLoading ? '...' : formatCount(dashboardData.captionAnalytics.captionsWithVotes);
  const captionsWithoutVotesDisplay = isLoading ? '...' : formatCount(dashboardData.captionAnalytics.captionsWithoutVotes);
  const upvotesTotalDisplay = isLoading ? '...' : formatCount(dashboardData.captionAnalytics.upvotesTotal);
  const downvotesTotalDisplay = isLoading ? '...' : formatCount(dashboardData.captionAnalytics.downvotesTotal);
  const upvoteSharePercent =
    dashboardData.captionAnalytics.totalVotes > 0
      ? (dashboardData.captionAnalytics.upvotesTotal / dashboardData.captionAnalytics.totalVotes) * 100
      : 0;
  const downvoteSharePercent = Math.max(0, 100 - upvoteSharePercent);
  const ratioValue =
    dashboardData.captionAnalytics.downvotesTotal > 0
      ? dashboardData.captionAnalytics.upvotesTotal / dashboardData.captionAnalytics.downvotesTotal
      : null;
  const ratioDisplay = isLoading
    ? '...'
    : dashboardData.captionAnalytics.hasDownvoteData
      ? ratioValue === null
        ? dashboardData.captionAnalytics.upvotesTotal > 0
          ? 'All upvotes'
          : 'No votes'
        : `${ratioValue.toFixed(2)} : 1`
      : 'N/A';
  const distributionEntries = [
    {
      key: 'positive',
      label: 'Positive',
      value: Math.max(0, toNumber(dashboardData.captionAnalytics.distribution.positive)),
      fillClassName: styles.distributionFillPositive,
    },
    {
      key: 'neutral',
      label: 'Neutral',
      value: Math.max(0, toNumber(dashboardData.captionAnalytics.distribution.neutral)),
      fillClassName: styles.distributionFillNeutral,
    },
    {
      key: 'negative',
      label: 'Negative',
      value: Math.max(0, toNumber(dashboardData.captionAnalytics.distribution.negative)),
      fillClassName: styles.distributionFillNegative,
    },
    {
      key: 'noVotes',
      label: 'Unrated',
      value: Math.max(0, toNumber(dashboardData.captionAnalytics.distribution.noVotes)),
      fillClassName: styles.distributionFillUnrated,
    },
  ];
  const distributionTotal = distributionEntries.reduce((sum, entry) => sum + entry.value, 0);
  const isOverviewMode = renderedPanelMode === 'overview';
  const selectedModeIndex = MODE_OPTIONS.findIndex((option) => option.id === activePanelMode);
  const modeContentClassName = `${styles.modeContent} ${
    isModeContentVisible ? styles.modeContentVisible : styles.modeContentHidden
  }`;
  const secondaryModeOptions =
    activePanelMode === 'users'
      ? USERS_SUB_MODE_OPTIONS
      : activePanelMode === 'captions'
        ? CAPTIONS_SUB_MODE_OPTIONS
        : activePanelMode === 'images'
          ? IMAGES_SUB_MODE_OPTIONS
          : activePanelMode === 'humorFlavors'
            ? HUMOR_FLAVORS_SUB_MODE_OPTIONS
            : activePanelMode === 'llms'
              ? LLMS_SUB_MODE_OPTIONS
              : OVERVIEW_SUB_MODE_OPTIONS;
  const activeSecondaryMode =
    activePanelMode === 'users'
      ? activeUsersSubMode
      : activePanelMode === 'captions'
        ? activeCaptionsSubMode
        : activePanelMode === 'images'
          ? 'images'
          : activePanelMode === 'humorFlavors'
            ? activeHumorSubMode
            : activePanelMode === 'llms'
              ? activeLlmsSubMode
              : 'overview';
  const selectedSecondaryModeIndex = secondaryModeOptions.findIndex((option) => option.id === activeSecondaryMode);
  const showCompactModeMenuButton = isCompactViewport;

  function handleSecondaryModeChange(nextMode) {
    if (activePanelMode === 'users') {
      setActiveUsersSubMode(nextMode);
      return;
    }

    if (activePanelMode === 'captions') {
      setActiveCaptionsSubMode(nextMode);
      return;
    }

    if (activePanelMode === 'humorFlavors') {
      setActiveHumorSubMode(nextMode);
      return;
    }

    if (activePanelMode === 'llms') {
      setActiveLlmsSubMode(nextMode);
    }
  }

  function renderTopLevelModeSwitcher() {
    return (
      <div
        className={styles.verticalModeTrack}
        role="tablist"
        aria-label="Dashboard mode"
        aria-orientation="vertical"
        style={{ '--mode-option-count': MODE_OPTIONS.length }}
      >
        <div className={styles.verticalModeGrid}>
          <span
            aria-hidden
            className={styles.verticalModeThumb}
            style={{
              transform: `translateY(calc(${Math.max(selectedModeIndex, 0)} * (var(--vertical-mode-row-height) + var(--vertical-mode-gap))))`,
            }}
          />
          {MODE_OPTIONS.map((option) => {
            const isActive = activePanelMode === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.verticalModeButton} ${isActive ? styles.verticalModeButtonActive : ''}`}
                onClick={() => handleModeChange(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {!isLoading && !isCompactViewport ? <div className={styles.sideModeMenuRoot}>{renderTopLevelModeSwitcher()}</div> : null}

      {isCompactViewport ? (
        <>
          <button
            ref={compactModeButtonRef}
            type="button"
            aria-expanded={isCompactModeMenuOpen}
            aria-controls="dashboard-mode-panel"
            aria-label="Open dashboard modes"
            className={`${styles.compactModeMenuButton} ${showCompactModeMenuButton ? styles.compactModeMenuButtonVisible : ''} ${
              isCompactModeMenuOpen ? styles.compactModeMenuButtonHidden : ''
            }`}
            onClick={() => setIsCompactModeMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" className={styles.compactModeMenuIcon} fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>
          <div
            className={`${styles.compactModeBackdrop} ${isCompactModeMenuOpen ? styles.compactModeBackdropOpen : ''}`}
            aria-hidden
            onClick={() => setIsCompactModeMenuOpen(false)}
          />
          <div
            id="dashboard-mode-panel"
            ref={compactModePanelRef}
            className={`${styles.compactModePanel} ${isCompactModeMenuOpen ? styles.compactModePanelOpen : ''}`}
          >
            <button
              type="button"
              aria-label="Close dashboard modes"
              className={styles.compactModeCloseButton}
              onClick={() => setIsCompactModeMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" className={styles.compactModeCloseIcon} fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12" />
                <path strokeLinecap="round" d="M18 6L6 18" />
              </svg>
            </button>
            <p className={styles.compactModeTitle}>Admin Panel</p>
            {renderTopLevelModeSwitcher()}
          </div>
        </>
      ) : null}

      <div className={styles.modeMenuRoot}>
        {isLoading ? (
          <p className={`${styles.statusMessage} ${styles.statusMessageLoading}`}>Loading admin panel data...</p>
        ) : (
          <div
            className={styles.modeSegmentTrack}
            role="tablist"
            aria-label={`${MODE_OPTIONS.find((option) => option.id === activePanelMode)?.label ?? 'Dashboard'} section`}
            style={{ '--mode-option-count': secondaryModeOptions.length }}
          >
            <div className={styles.modeSegmentGrid}>
              <span
                aria-hidden
                className={styles.modeSegmentThumb}
                style={{ transform: `translateX(${Math.max(selectedSecondaryModeIndex, 0) * 100}%)` }}
              />
              {secondaryModeOptions.map((option) => {
                const isActive = activeSecondaryMode === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.modeSegmentButton} ${isActive ? styles.modeSegmentButtonActive : ''}`}
                    onClick={() => handleSecondaryModeChange(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={modeContentClassName} style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}>
        {isOverviewMode ? (
          <>
            <section className={styles.statsPanel}>
              <header className={styles.statsHeader}>
                <h2 className={styles.statsTitle}>Total</h2>
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
                <h1 className={styles.statsTitle}>Ratings</h1>
              </header>

              <div className={`${styles.statsGrid} ${styles.analyticsGrid}`}>
                <article className={styles.statCard}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Coverage</p>
                    <p className={styles.rankMetric}>captions with votes</p>
                  </div>

                  <div className={styles.coverageCardBody}>
                    <div className={styles.coverageDonut} style={{ '--coverage-percent': coveragePercent }}>
                      <span className={styles.coverageDonutValue}>{captionCoverageDisplay}</span>
                    </div>
                    <div className={styles.coverageSummary}>
                      <p className={styles.coverageSummaryLine}>
                        <span className={styles.coverageSummaryValue}>{captionsWithVotesDisplay}</span> rated
                      </p>
                      <p className={styles.coverageSummaryLine}>
                        <span className={styles.coverageSummaryValue}>{captionsWithoutVotesDisplay}</span> unrated
                      </p>
                    </div>
                  </div>
                </article>

                <article className={styles.statCard}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Vote Ratio</p>
                    <p className={styles.rankMetric}>overall split</p>
                  </div>

                  <p className={styles.chartMetricValue}>{ratioDisplay}</p>
                  <p className={styles.statMeta}>upvotes : downvotes</p>
                  <div className={styles.voteSplitTrack} aria-hidden>
                    <span
                      className={styles.voteSplitUp}
                      style={{ width: `${isLoading ? 0 : clampPercentage(upvoteSharePercent)}%` }}
                    />
                    <span
                      className={styles.voteSplitDown}
                      style={{ width: `${isLoading ? 0 : clampPercentage(downvoteSharePercent)}%` }}
                    />
                  </div>
                  <div className={styles.voteLegend}>
                    <p className={styles.voteLegendLine}>
                      <span className={`${styles.voteLegendDot} ${styles.voteLegendDotUp}`} /> Upvotes {upvotesTotalDisplay}
                    </p>
                    <p className={styles.voteLegendLine}>
                      <span className={`${styles.voteLegendDot} ${styles.voteLegendDotDown}`} /> Downvotes {downvotesTotalDisplay}
                    </p>
                  </div>
                </article>

                <article className={styles.statCard}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Score Breakdown</p>
                    <p className={styles.rankMetric}>caption-level</p>
                  </div>

                  <div className={styles.distributionList}>
                    {distributionEntries.map((entry) => {
                      const entryShare = distributionTotal > 0 ? (entry.value / distributionTotal) * 100 : 0;
                      const entryCountLabel = isLoading ? '...' : formatCount(entry.value);
                      const entryPercentLabel = isLoading ? '...' : formatPercentage(entryShare);

                      return (
                        <div key={entry.key} className={styles.distributionRow}>
                          <div className={styles.distributionRowHeader}>
                            <span className={styles.distributionLabel}>{entry.label}</span>
                            <span className={styles.distributionValue}>
                              {entryCountLabel} ({entryPercentLabel})
                            </span>
                          </div>
                          <div className={styles.distributionTrack}>
                            <span
                              className={`${styles.distributionFill} ${entry.fillClassName}`}
                              style={{ width: `${isLoading ? 0 : clampPercentage(entryShare)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </div>

              {dashboardData.errors.data ? (
                <p className={styles.statsError}>Error loading one or more caption analytics metrics. {dashboardData.errors.data}</p>
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
                          <div className={styles.rankScoreBlock}>
                            <span className={styles.rankCount}>{formatSignedCount(entry.likes)} likes</span>
                            <span className={styles.rankVoteBreakdown}>
                              <span className={styles.rankVoteUp}>+{formatCount(entry.upvotes)}</span>
                              <span className={styles.rankVoteDown}>-{formatCount(entry.downvotes)}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.rankEmpty}>No upvotes yet.</p>
                  )}
                </article>

                <article className={styles.statCard}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Images</p>
                  </div>
                  {isLoading ? (
                    <p className={styles.rankEmpty}>indexing...</p>
                  ) : dashboardData.topImages.length > 0 ? (
                    <ol className={styles.rankList}>
                      {dashboardData.topImages.map((entry, index) => (
                        <li key={entry.imageId} className={`${styles.rankItem} ${styles.rankCaptionItem}`}>
                          <div className={styles.rankCaptionMain}>
                            <span className={styles.rankIndex}>{index + 1}.</span>
                            {entry.imageUrl ? (
                              <img src={entry.imageUrl} alt="Top image" loading="lazy" className={styles.rankThumb} />
                            ) : (
                              <span className={styles.rankThumbPlaceholder}>No image</span>
                            )}
                            <span className={styles.rankLabel}>{entry.label}</span>
                          </div>
                          <div className={styles.rankScoreBlock}>
                            <span className={styles.rankCount}>{formatSignedCount(entry.likes)} likes</span>
                            <span className={styles.rankVoteBreakdown}>
                              <span className={styles.rankVoteUp}>+{formatCount(entry.upvotes)}</span>
                              <span className={styles.rankVoteDown}>-{formatCount(entry.downvotes)}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.rankEmpty}>No liked images yet.</p>
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
                          <span className={styles.rankCount}>{formatCount(entry.upvotes)} votes</span>
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

            <section className={`${styles.statsPanel} ${styles.stackedPanel}`}>
              <header className={styles.statsHeader}>
                <h2 className={styles.statsTitle}>New</h2>
              </header>

              <div className={`${styles.statsGrid} ${styles.newActivityGrid}`}>
                <article className={`${styles.statCard} ${styles.newActivityCard}`}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Captions</p>
                    <p className={styles.rankMetric}>new captions</p>
                  </div>
                  <ul className={styles.newActivityList}>
                    {newCaptionsSeries.map((entry) => {
                      const fillPercent =
                        maxNewCaptionsValue > 0 && entry.value > 0
                          ? Math.max(8, (entry.value / maxNewCaptionsValue) * 100)
                          : 0;

                      return (
                        <li key={`new-captions-${entry.key}`} className={styles.newActivityRow}>
                          <span className={styles.newActivityLabel}>{entry.label}</span>
                          <span className={styles.newActivityTrack}>
                            <span
                              className={`${styles.newActivityFill} ${styles.newActivityFillCaptions}`}
                              style={{ width: `${fillPercent}%` }}
                            />
                          </span>
                          <span className={styles.newActivityValue}>{isLoading ? '...' : formatCount(entry.value)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
                <article className={`${styles.statCard} ${styles.newActivityCard}`}>
                  <div className={styles.rankHeader}>
                    <p className={styles.rankHeading}>Users</p>
                    <p className={styles.rankMetric}>new accounts</p>
                  </div>
                  <ul className={styles.newActivityList}>
                    {newUsersSeries.map((entry) => {
                      const fillPercent =
                        maxNewUsersValue > 0 && entry.value > 0
                          ? Math.max(8, (entry.value / maxNewUsersValue) * 100)
                          : 0;

                      return (
                        <li key={`new-users-${entry.key}`} className={styles.newActivityRow}>
                          <span className={styles.newActivityLabel}>{entry.label}</span>
                          <span className={styles.newActivityTrack}>
                            <span
                              className={`${styles.newActivityFill} ${styles.newActivityFillUsers}`}
                              style={{ width: `${fillPercent}%` }}
                            />
                          </span>
                          <span className={styles.newActivityValue}>{isLoading ? '...' : formatCount(entry.value)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </div>

              {dashboardData.errors.stats ? (
                <p className={styles.statsError}>
                  Error loading one or more new activity statistics. {dashboardData.errors.stats}
                </p>
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
            activeUsersSubMode={activeUsersSubMode}
            activeCaptionsSubMode={activeCaptionsSubMode}
            activeHumorSubMode={activeHumorSubMode}
            activeLlmsSubMode={activeLlmsSubMode}
          />
        )}
      </div>

      {loadError ? <p className={styles.statsError}>{loadError}</p> : null}
    </>
  );
}
