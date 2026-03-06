import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsMenu from '../components/SettingsMenu';
import ProtectedDashboard from './components/ProtectedDashboard';
import styles from './protected.module.css';

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundLayer} />
      <SettingsMenu showSignOut userEmail={user.email ?? null} profileId={user.id} />
      <div className={styles.shell}>
        <ProtectedDashboard />
      </div>
    </main>
  );
}
