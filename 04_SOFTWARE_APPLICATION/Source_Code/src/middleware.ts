import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // 1. Bypass public endpoints, API routes, and assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/register/') ||
    pathname.startsWith('/status/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico' ||
    pathname === '/staff/login'
  ) {
    return supabaseResponse;
  }

  // 2. Only protect /staff routes
  if (!pathname.startsWith('/staff')) {
    return supabaseResponse;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isRealSupabase = Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    !url.includes('placeholder') &&
    !key.includes('your-anon-key')
  );

  // In Zero-Setup In-Memory Mode, check mock session cookie without external network calls
  if (!isRealSupabase) {
    const mockSession = request.cookies.get('silid_mock_session');
    if (!mockSession) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/staff/login';
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }: any) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/staff/login';
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error('[Middleware] Supabase auth check error:', err);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/staff/:path*'],
};
