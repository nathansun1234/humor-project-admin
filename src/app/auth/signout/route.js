import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function signOutCurrentSession() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function POST() {
  await signOutCurrentSession();
  return NextResponse.json({ ok: true });
}

export async function GET(request) {
  await signOutCurrentSession();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`);
}
