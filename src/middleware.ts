import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require admin authentication
const PROTECTED_ROUTES = [
  '/employees',
  '/settings',
  '/overtime',
  '/ashley-expenses',
  '/account',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/',
  '/adm1n_pan0l',
  '/attendance/mobile',
  '/attendance/checkin',
  '/gps',
  '/admin',
  '/login',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Check if the route is protected
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for admin session cookie
  const adminSession = request.cookies.get('ashley_admin_session')?.value;

  if (!adminSession) {
    // Redirect unauthenticated users to home page
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('auth_required', 'true');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|sw\\.js|manifest\\.json|ashley-logo\\.|employees/).*)',
  ],
};
