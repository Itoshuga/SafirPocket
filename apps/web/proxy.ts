import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, publicEnv } from './lib/env';
import { safeInternalPath } from './lib/navigation';

const privatePrefixes = [
  '/collection',
  '/decks',
  '/play',
  '/profile',
  '/settings',
  '/admin',
  '/boosters/open',
  '/boosters/history',
];

function loginRedirect(request: NextRequest, reason?: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'next',
    safeInternalPath(`${request.nextUrl.pathname}${request.nextUrl.search}`, '/'),
  );
  if (reason) loginUrl.searchParams.set('reason', reason);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPrivate = privatePrefixes.some(
    (prefix) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  const e2eAuthSecret = process.env.E2E_MOCK_AUTH_SECRET;
  const hasE2eAuth =
    process.env.E2E_ALLOW_MOCK_AUTH === 'true' &&
    ['localhost', '127.0.0.1'].includes(request.nextUrl.hostname) &&
    Boolean(e2eAuthSecret) &&
    request.cookies.get('safir-e2e-auth')?.value === e2eAuthSecret;
  if (hasE2eAuth) return response;
  if (!isSupabaseConfigured) {
    return isPrivate ? loginRedirect(request, 'config') : response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (isPrivate && !data?.claims?.sub) {
    return loginRedirect(request);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
