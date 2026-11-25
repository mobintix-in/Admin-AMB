import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-auth';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth endpoints and static assets
  if (
    pathname.startsWith('/api/admin/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSessionToken(token);

  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/users', req.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/' || pathname.startsWith('/users') || pathname.startsWith('/packages')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/users/:path*', '/packages/:path*', '/login'],
};
