import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Middleware performs the superadmin gate; skip duplicate checks here
      // to reduce OAuth callback latency.
      return NextResponse.redirect(`${origin}/protected`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
