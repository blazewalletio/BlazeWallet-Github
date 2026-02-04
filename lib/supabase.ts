import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// 🔍 EXTENSIVE DEBUGGING FOR ENV VAR ISSUES
console.group('🚀 SUPABASE INITIALIZATION DEBUG');
// Get environment variables with multiple fallback methods
// Method 1: process.env (works in Node.js / Server-side / Build time)
// Method 2: Direct from next.config.mjs env export (for client-side)
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Detailed value inspection
if (supabaseUrl) {
} else {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is:', supabaseUrl);
  console.error('❌ Type:', typeof supabaseUrl);
}

if (supabaseAnonKey) {
} else {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is:', supabaseAnonKey);
  console.error('❌ Type:', typeof supabaseAnonKey);
}

// CRITICAL: Validate environment variables before creating client
if (!supabaseUrl) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_URL is missing!');
  console.error('💥 All env vars:', process.env);
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required but not set');
}

if (!supabaseAnonKey) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!');
  console.error('💥 All env vars:', process.env);
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required but not set');
}

// Trim any whitespace that might have snuck in
const cleanUrl = supabaseUrl.trim();
const cleanKey = supabaseAnonKey.trim();
let supabaseClient;

try {
  // Create Supabase client with validated, cleaned values
  supabaseClient = createClient(
    cleanUrl,
    cleanKey,
    {
      auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  console.groupEnd();
} catch (error) {
  console.error('💥 FATAL ERROR creating Supabase client:', error);
  console.error('💥 Error details:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.groupEnd();
  throw error;
}

export const supabase = supabaseClient;

// Database Types
export interface PriorityListRegistration {
  id: string;
  wallet_address: string;
  email?: string;
  telegram?: string;
  twitter?: string;
  referral_code?: string;
  referred_by?: string;
  is_verified: boolean;
  is_early_bird: boolean;
  position?: number;
  registered_at: string;
  email_verified_at?: string;
  email_verification_token?: string;
  created_at: string;
  updated_at: string;
}

export interface PriorityListStats {
  total_registered: number;
  verified_count: number;
  referral_count: number;
  early_bird_count: number;
  email_provided_count: number;
  last_registration: string | null;
}

export interface ReferralLeaderboardEntry {
  wallet_address: string;
  email?: string;
  referral_code?: string;
  referral_count: number;
  registered_at: string;
}

