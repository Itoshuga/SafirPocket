import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, publicEnv } from './lib/env';

const privatePrefixes = ['/collection', '/decks', '/boosters', '/play', '/profile', '/admin'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPrivate = privatePrefixes.some(
    (prefix) =>
      request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (!isSupabaseConfigured) {
    return isPrivate
      ? NextResponse.redirect(new URL('/login?reason=config', request.url))
      : response;
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const metadata = data?.claims?.app_metadata;
    const role =
      metadata && typeof metadata === 'object' && 'role' in metadata ? metadata.role : null;
    if (role !== 'admin') return NextResponse.redirect(new URL('/', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
