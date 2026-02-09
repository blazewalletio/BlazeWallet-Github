/**
 * Supabase Admin Client Helper
 * Lazy initialization to avoid build-time errors when env vars are not available
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build time, use placeholder values
    if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
      supabaseAdminClient = createClient(
        'https://placeholder-project.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      return supabaseAdminClient;
    }
    
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  supabaseAdminClient = createClient(
    supabaseUrl.trim(),
    supabaseServiceKey.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabaseAdminClient;
}

