'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './SettingsMenu.module.css';

const THEME_STORAGE_KEY = 'ui-theme';
const THEME_PREFERENCES = ['system', 'light', 'dark'];

function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemePreference(preference) {
  const nextPreference = THEME_PREFERENCES.includes(preference) ? preference : 'system';
  const effectiveTheme = nextPreference === 'system' ? getSystemTheme() : nextPreference;
  const root = document.documentElement;
  root.classList.toggle('dark', effectiveTheme === 'dark');
  root.style.colorScheme = effectiveTheme;
  root.dataset.themePreference = nextPreference;
  return effectiveTheme;
}

export default function SettingsMenu({ showSignOut = false, userEmail = null, profileId = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [themePreference, setThemePreference] = useState('system');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextPreference = THEME_PREFERENCES.includes(storedTheme) ? storedTheme : 'system';
    applyThemePreference(nextPreference);
    setThemePreference(nextPreference);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (themePreference !== 'system') {
      return;
    }

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    const handlePreferenceChange = () => {
      applyThemePreference('system');
    };

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handlePreferenceChange);
    } else {
      mediaQueryList.addListener(handlePreferenceChange);
    }
    return () => {
      if (typeof mediaQueryList.removeEventListener === 'function') {
        mediaQueryList.removeEventListener('change', handlePreferenceChange);
      } else {
        mediaQueryList.removeListener(handlePreferenceChange);
      }
    };
  }, [themePreference]);

  const handleThemeChange = (nextPreference) => {
    const normalizedPreference = THEME_PREFERENCES.includes(nextPreference) ? nextPreference : 'system';
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedPreference);
    applyThemePreference(normalizedPreference);
    setThemePreference(normalizedPreference);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await fetch('/auth/signout', { method: 'POST' });
    } catch {
      // Always navigate home even if the network request fails.
    } finally {
      window.location.assign('/');
    }
  };

  return (
    <div className={styles.root} data-settings-menu-open={isOpen ? 'true' : 'false'}>
      <div className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`} aria-hidden />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="settings-panel"
        aria-label="Open settings"
        className={styles.menuButton}
      >
        <svg viewBox="0 0 24 24" className={styles.menuIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div id="settings-panel" ref={panelRef} className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.themeOptionsRow}>
          <span className={styles.toggleLabel}>Theme</span>
          <div className={styles.themeSegmentTrack} role="radiogroup" aria-label="Theme preference">
            <div
              className={styles.themeSegmentGrid}
              style={{ '--theme-option-count': THEME_PREFERENCES.length }}
            >
              <span
                aria-hidden
                className={styles.themeSegmentThumb}
                style={{
                  transform: `translateX(${Math.max(THEME_PREFERENCES.indexOf(themePreference), 0) * 100}%)`,
                }}
              />
              {THEME_PREFERENCES.map((preference) => {
                const isActive = themePreference === preference;

                return (
                  <button
                    key={preference}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => handleThemeChange(preference)}
                    className={`${styles.themeSegmentButton} ${isActive ? styles.themeSegmentButtonActive : ''}`}
                  >
                    {preference.charAt(0).toUpperCase() + preference.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {showSignOut ? (
          <>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className={styles.signOutButton}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
            {userEmail ? <p className={styles.userEmail}>{userEmail}</p> : null}
            {profileId ? <p className={styles.profileId}>Profile Id: {profileId}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
