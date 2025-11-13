/**
 * 🔒 CSRF Token Generation API
 * 
 * Generates and sets CSRF token cookie for client-side requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Generate or retrieve CSRF token
  const existingToken = request.cookies.get('csrf_token');
  const token = existingToken?.value || nanoid(32);
  
  const response = NextResponse.json({ token });
  
  // Set CSRF cookie if not exists
  if (!existingToken) {
    response.cookies.set('csrf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
  }
  
  return response;
}

