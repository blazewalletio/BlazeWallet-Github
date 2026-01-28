// Priority List Service with Supabase Backend
// Handles registration, email verification, referrals, and admin functions

import { supabase, PriorityListRegistration, PriorityListStats, ReferralLeaderboardEntry } from './supabase';
import { sendEmail, generateUserConfirmationEmail, generateAdminNotificationEmail } from './email-service';
import { logger } from '@/lib/logger';

export interface RegisterOptions {
  email?: string;
  telegram?: string;
  twitter?: string;
  referralCode?: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  entry?: PriorityListRegistration;
  position?: number;
  isEarlyBird?: boolean;
}

// Priority List Dates - UPDATED TIMELINE
const REGISTRATION_START = new Date('2025-12-15T09:00:00Z'); // December 15, 2025
const PRESALE_START = new Date('2026-01-02T09:00:00Z'); // January 2, 2026 (Priority members only)
const EXCLUSIVITY_END = new Date('2026-01-09T09:00:00Z'); // January 9, 2026 (Open to everyone)
const EARLY_BIRD_LIMIT = 500; // First 500 get early bird bonus

export class PriorityListService {
  /**
   * Check if priority list registration is open
   */
  static isRegistrationOpen(): boolean {
    const now = new Date();
    return now >= REGISTRATION_START && now < PRESALE_START;
  }

  /**
   * Check if presale is in priority-only phase
   */
  static isPriorityOnlyPhase(): boolean {
    const now = new Date();
    return now >= PRESALE_START && now < EXCLUSIVITY_END;
  }

  /**
   * Check if presale is open to everyone
   */
  static isPresaleOpenToAll(): boolean {
    const now = new Date();
    return now >= EXCLUSIVITY_END;
  }

  /**
   * Register for priority list
   */
  static async registerForPriorityList(
    walletAddress: string,
    options: RegisterOptions = {}
  ): Promise<RegisterResult> {
    try {
      // Validate registration period
      if (!this.isRegistrationOpen()) {
        const now = new Date();
        if (now < REGISTRATION_START) {
          return {
            success: false,
            message: `Priority list registration opens on December 15, 2025 at 11:00 CEST`,
          };
        } else {
          return {
            success: false,
            message: `Priority list registration closed. Presale starts January 2, 2026.`,
          };
        }
      }

      // Validate wallet address
      if (!this.isValidWalletAddress(walletAddress)) {
        return {
          success: false,
          message: 'Invalid wallet address format.',
        };
      }

      // Check if wallet already registered
      const { data: existing } = await supabase
        .from('priority_list_registrations')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (existing) {
        return {
          success: false,
          message: 'This wallet is already registered for the priority list.',
        };
      }

      // Check if email already registered
      if (options.email) {
        const { data: emailExists } = await supabase
          .from('priority_list_registrations')
          .select('wallet_address')
          .ilike('email', options.email)
          .single();

        if (emailExists) {
          return {
            success: false,
            message: 'This email is already registered with another wallet.',
          };
        }
      }

      // Validate and find referrer
      let referredBy: string | undefined;
      if (options.referralCode) {
        if (!this.isValidReferralCode(options.referralCode)) {
          return {
            success: false,
            message: 'Invalid referral code format.',
          };
        }

        const { data: referrer } = await supabase
          .from('priority_list_registrations')
          .select('wallet_address')
          .eq('referral_code', options.referralCode)
          .single();

        if (!referrer) {
          return {
            success: false,
            message: 'Referral code not found.',
          };
        }

        referredBy = referrer.wallet_address;
      }

      // Generate referral code for new user
      const referralCode = this.generateReferralCode(walletAddress);

      // Generate email verification token
      const emailVerificationToken = options.email ? this.generateVerificationToken() : undefined;

      // Check if early bird (first 500)
      const { count } = await supabase
        .from('priority_list_registrations')
        .select('*', { count: 'exact', head: true });

      const isEarlyBird = (count || 0) < EARLY_BIRD_LIMIT;

      // Insert registration
      const { data, error } = await supabase
        .from('priority_list_registrations')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          email: options.email,
          telegram: options.telegram,
          twitter: options.twitter,
          referral_code: referralCode,
          referred_by: referredBy,
          is_early_bird: isEarlyBird,
          email_verification_token: emailVerificationToken,
        })
        .select()
        .single();

      if (error) {
        logger.error('Supabase insert error:', error);
        return {
          success: false,
          message: 'Failed to register. Please try again.',
        };
      }

      // Create email verification token record
      if (options.email && emailVerificationToken) {
        await supabase
          .from('email_verification_tokens')
          .insert({
            wallet_address: walletAddress.toLowerCase(),
            token: emailVerificationToken,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          });
      }

      // Send confirmation email (with verification link if email provided)
      if (options.email) {
        const userEmailHtml = generateUserConfirmationEmail({
          walletAddress: data.wallet_address,
          registeredAt: new Date(data.registered_at),
          referralCode: data.referral_code,
        });

        await sendEmail({
          to: options.email,
          subject: '🔥 Welcome to BLAZE Priority List - Confirm Your Email!',
          html: userEmailHtml,
        });
      }

      // Send notification to admin
      const adminEmailHtml = generateAdminNotificationEmail({
        walletAddress: data.wallet_address,
        email: options.email,
        telegram: options.telegram,
        twitter: options.twitter,
        registeredAt: new Date(data.registered_at),
        referralCode: data.referral_code,
        referredBy: data.referred_by,
      });

      await sendEmail({
        to: 'info@blazewallet.io',
        subject: `🔥 New Priority List Registration #${data.position} - ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        html: adminEmailHtml,
      });

      return {
        success: true,
        message: isEarlyBird 
          ? `🎉 Success! You're registered as Early Bird #${data.position}! Check your email for confirmation.`
          : `Successfully registered for priority list! You're #${data.position}. Check your email for confirmation.`,
        entry: data,
        position: data.position,
        isEarlyBird: data.is_early_bird,
      };
    } catch (error) {
      logger.error('Error registering for priority list:', error);
      return {
        success: false,
        message: 'Failed to register. Please try again.',
      };
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find token
      const { data: tokenData, error: tokenError } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .single();

      if (tokenError || !tokenData) {
        return {
          success: false,
          message: 'Invalid or expired verification token.',
        };
      }

      // Check if expired
      if (new Date(tokenData.expires_at) < new Date()) {
        return {
          success: false,
          message: 'Verification token has expired. Please request a new one.',
        };
      }

      // Mark token as used
      await supabase
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      // Update registration
      await supabase
        .from('priority_list_registrations')
        .update({
          email_verified_at: new Date().toISOString(),
          is_verified: true,
        })
        .eq('wallet_address', tokenData.wallet_address);

      return {
        success: true,
        message: 'Email verified successfully!',
      };
    } catch (error) {
      logger.error('Error verifying email:', error);
      return {
        success: false,
        message: 'Failed to verify email. Please try again.',
      };
    }
  }

  /**
   * Get registration by wallet address
   */
  static async getRegistration(walletAddress: string): Promise<PriorityListRegistration | null> {
    const { data, error } = await supabase
      .from('priority_list_registrations')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error) {
      logger.error('Error fetching registration:', error);
      return null;
    }

    return data;
  }

  /**
   * Get priority list statistics
   */
  static async getStats(): Promise<PriorityListStats | null> {
    const { data, error } = await supabase
      .from('priority_list_stats')
      .select('*')
      .single();

    if (error) {
      logger.error('Error fetching stats:', error);
      return null;
    }

    return data;
  }

  /**
   * Get referral leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<ReferralLeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('referral_leaderboard')
      .select('*')
      .limit(limit);

    if (error) {
      logger.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get user's referrals
   */
  static async getUserReferrals(walletAddress: string): Promise<PriorityListRegistration[]> {
    const { data, error } = await supabase
      .from('priority_list_registrations')
      .select('*')
      .eq('referred_by', walletAddress.toLowerCase())
      .order('registered_at', { ascending: false });

    if (error) {
      logger.error('Error fetching referrals:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Check if wallet is in priority list
   */
  static async isInPriorityList(walletAddress: string): Promise<boolean> {
    const { data } = await supabase
      .from('priority_list_registrations')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    return !!data;
  }

  /**
   * Get time until registration/presale/exclusivity end
   */
  static getTimeUntilRegistration(): { days: number; hours: number; minutes: number; seconds: number } {
    return this.calculateTimeDiff(REGISTRATION_START);
  }

  static getTimeUntilPresale(): { days: number; hours: number; minutes: number; seconds: number } {
    return this.calculateTimeDiff(PRESALE_START);
  }

  static getTimeUntilExclusivityEnd(): { days: number; hours: number; minutes: number; seconds: number } {
    return this.calculateTimeDiff(EXCLUSIVITY_END);
  }

  // Helper methods
  private static calculateTimeDiff(targetDate: Date): { days: number; hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }

  private static isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private static isValidReferralCode(code: string): boolean {
    return /^BLAZE[A-Z0-9]{6}$/.test(code);
  }

  private static generateReferralCode(walletAddress: string): string {
    const hash = this.simpleHash(walletAddress);
    return `BLAZE${hash.toString(36).toUpperCase().slice(0, 6)}`;
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private static generateVerificationToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate referral code for a wallet
   */
  static generateReferralCodeForWallet(walletAddress: string): string {
    return this.generateReferralCode(walletAddress);
  }
}

