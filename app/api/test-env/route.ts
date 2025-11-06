// ============================================================================
// 🔥 BLAZE WALLET - ENV TEST API
// ============================================================================
// Test if environment variables are loaded correctly
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env_check: {
      url: supabaseUrl,
      url_length: supabaseUrl?.length || 0,
      url_has_newline: supabaseUrl?.includes('\n') || false,
      url_trimmed: supabaseUrl?.trim(),
      service_key_length: supabaseServiceKey?.length || 0,
      service_key_prefix: supabaseServiceKey?.substring(0, 30) + '...',
      service_key_has_newline: supabaseServiceKey?.includes('\n') || false,
    }
  });
}

