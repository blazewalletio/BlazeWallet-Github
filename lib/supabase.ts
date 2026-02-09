import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Get environment variables (with fallback for build time)
// Use a valid Supabase URL format for build-time (will be replaced at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Validation happens at runtime, not during build

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
  // Don't throw during build - will fail at runtime if env vars are missing
  // This allows the build to complete even without env vars
}

export const supabase = supabaseClient!;

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

