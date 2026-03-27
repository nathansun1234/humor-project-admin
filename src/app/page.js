'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SettingsMenu from './components/SettingsMenu';
import styles from './page.module.css';

const REFRESH_TOKEN_ERROR_MESSAGES = [
  'Invalid Refresh Token',
  'Refresh Token Not Found',
];

function isRefreshTokenError(error) {
  if (!error?.message) {
    return false;
  }

  return REFRESH_TOKEN_ERROR_MESSAGES.some((message) =>
    error.message.includes(message)
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isSuperadminRequired = searchParams.get('superadmin_required') === '1';

  useEffect(() => {
    if (!isSuperadminRequired) {
      return;
    }

    void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }, [isSuperadminRequired, supabase]);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

  const handleSignInWithGoogle = async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { error } = await signInWithGoogle();

    if (!error) {
      return;
    }

    if (isRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: 'local' });

      const retry = await signInWithGoogle();

      if (!retry.error) {
        return;
      }

      setErrorMessage(retry.error.message);
      setIsLoading(false);
      return;
    }

    setErrorMessage(error.message);
    setIsLoading(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.backgroundLayer} />
      <SettingsMenu />
      {isSuperadminRequired ? (
        <p className={styles.superadminRequiredMessage} role="alert">
          Superadmin Required!
        </p>
      ) : null}
      <div className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Welcome</p>
          <h1 className={styles.title}>Admin Panel</h1>
          <p className={styles.subtitle}>
            Requires Superadmin.
          </p>
          <button
            onClick={handleSignInWithGoogle}
            disabled={isLoading}
            className={styles.signInButton}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          {errorMessage ? (
            <p className={styles.errorMessage} role="alert">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
