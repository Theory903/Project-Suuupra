'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function setAuthCookie(token: string, refreshToken?: string) {
  const cookieStore = await cookies();
  
  // Set auth token cookie (httpOnly for security)
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  // Set refresh token if provided
  if (refreshToken) {
    cookieStore.set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
  cookieStore.delete('refresh-token');
}

export async function redirectToDashboard() {
  redirect('/dashboard');
}
