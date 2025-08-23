import { NextRequest, NextResponse } from 'next/server';

// Helper function to validate token and get role (simplified for now)
function validateTokenAndGetRole(token: string): string | null {
  try {
    // In a real implementation, you'd verify the JWT and extract the role
    // For now, we'll just decode the payload (this is not secure, just for structure)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || 'USER';
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/pricing',
    '/courses',
    '/live',
    '/about',
    '/status',
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/callback',
    '/creators/sign-up'
  ];

  // Check if it's a public route or static asset
  if (publicRoutes.some(route => pathname.startsWith(route)) || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (!token) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  const userRole = validateTokenAndGetRole(token.value);
  
  if (!userRole) {
    // Invalid token, redirect to sign-in
    const response = NextResponse.redirect(new URL('/auth/sign-in', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Creator routes
  if (pathname.startsWith('/creators')) {
    if (!['CREATOR', 'ADMIN'].includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
