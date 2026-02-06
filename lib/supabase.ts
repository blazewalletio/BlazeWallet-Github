import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// CRITICAL: Validate environment variables before creating client
if (!supabaseUrl) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_URL is missing!');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required but not set');
}

if (!supabaseAnonKey) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!');
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
} catch (error) {
  console.error('💥 FATAL ERROR creating Supabase client:', error);
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

