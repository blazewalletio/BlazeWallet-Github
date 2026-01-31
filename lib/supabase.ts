import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

logger.log('🔍 Supabase Configuration Check:');
logger.log('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : '❌ NOT SET');
logger.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 20)}...` : '❌ NOT SET');

// CRITICAL: Environment variables MUST be set
if (!supabaseUrl || !supabaseAnonKey) {
  const error = '❌ CRITICAL: Supabase environment variables are not set!';
  logger.error(error);
  logger.error('Required variables:');
  logger.error('  - NEXT_PUBLIC_SUPABASE_URL');
  logger.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (typeof window !== 'undefined') {
    // Client-side: Show user-friendly error
    throw new Error('Configuration error: Unable to connect to backend services. Please check your deployment configuration.');
  } else {
    // Server-side: Log but allow build to continue
    logger.warn('⚠️  Build will continue, but runtime features will not work without these variables.');
  }
}

// Create Supabase client - will throw error if keys are invalid
export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      persistSession: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

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

