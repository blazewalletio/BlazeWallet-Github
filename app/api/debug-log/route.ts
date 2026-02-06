/**
 * 🔍 DEBUG LOG API
 * Receives client-side logs and outputs them server-side
 * View logs in Vercel deployment logs
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, message, data, timestamp } = body;
    
    // Get client info
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const isPWA = userAgent.includes('PWA') || request.headers.get('sec-fetch-dest') === 'document';
    
    // Format log message
    const logPrefix = `[CLIENT-${level.toUpperCase()}] [${isPWA ? 'PWA' : 'BROWSER'}]`;
    const logMessage = `${logPrefix} ${message}`;
    
    // Output to Vercel logs based on level
    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'warn') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DEBUG-LOG-API] Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

