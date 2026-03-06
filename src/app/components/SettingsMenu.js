'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './SettingsMenu.module.css';

const THEME_STORAGE_KEY = 'ui-theme';

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export default function SettingsMenu({ showSignOut = false, userEmail = null, profileId = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const htmlElement = document.documentElement;
    const syncDarkMode = () => {
      setIsDarkMode(htmlElement.classList.contains('dark'));
    };

    syncDarkMode();

    const observer = new MutationObserver(syncDarkMode);
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
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

  const handleToggleTheme = () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    setIsDarkMode(nextTheme === 'dark');
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
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Dark mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={handleToggleTheme}
            className={`${styles.switchBase} ${isDarkMode ? styles.switchEnabled : styles.switchDisabled}`}
          >
            <span className={`${styles.switchThumb} ${isDarkMode ? styles.thumbEnabled : styles.thumbDisabled}`} />
          </button>
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
