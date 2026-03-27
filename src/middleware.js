import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

function redirectHomeAndClearAuthCookies(request, options = {}) {
  const { superadminRequired = false } = options;
  const loginUrl = new URL('/', request.url);
  if (superadminRequired) {
    loginUrl.searchParams.set('superadmin_required', '1');
  }
  const redirect = NextResponse.redirect(loginUrl);

  // Remove stale Supabase cookies so a fresh OAuth flow can start cleanly.
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith('sb-')) {
      redirect.cookies.delete(name);
    }
  }

  return redirect;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/protected')) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }

            response = NextResponse.next({ request });

            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return redirectHomeAndClearAuthCookies(request);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return redirectHomeAndClearAuthCookies(request);
    }

    if (profile?.is_superadmin !== true) {
      return redirectHomeAndClearAuthCookies(request, { superadminRequired: true });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/protected/:path*'],
};
