import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';



export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Pass-through with security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
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
