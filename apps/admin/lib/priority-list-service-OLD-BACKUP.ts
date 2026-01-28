// Priority List Service for Blaze Presale
// Handles registration from October 27, 2025 with 48-hour exclusivity

import { logger } from '@/lib/logger';

export interface PriorityListEntry {
  id: string;
  walletAddress: string;
  email?: string;
  telegram?: string;
  twitter?: string;
  registeredAt: Date;
  isVerified: boolean;
  referralCode?: string;
  referredBy?: string;
}

export interface PriorityListStats {
  totalRegistered: number;
  verifiedCount: number;
  referralCount: number;
  lastRegistration: Date | null;
}

export class PriorityListService {
  private static instance: PriorityListService;
  private entries: Map<string, PriorityListEntry> = new Map();
  private stats: PriorityListStats = {
    totalRegistered: 0,
    verifiedCount: 0,
    referralCount: 0,
    lastRegistration: null,
  };

  // Priority List Dates - TESTING MODE
  // Original: 2025-10-27T00:00:00Z
  // Testing: Registration opens NOW for testing
  private static readonly REGISTRATION_START = new Date('2025-10-23T09:00:00Z'); // NOW - 23 Oct 2025 11:00 CEST
  private static readonly PRESALE_START = new Date('2025-10-30T09:00:00Z'); // 7 days later
  private static readonly EXCLUSIVITY_END = new Date('2025-11-01T09:00:00Z'); // 48 hours after presale start

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): PriorityListService {
    if (!PriorityListService.instance) {
      PriorityListService.instance = new PriorityListService();
    }
    return PriorityListService.instance;
  }

  /**
   * Check if priority list registration is open
   */
  isRegistrationOpen(): boolean {
    const now = new Date();
    return now >= PriorityListService.REGISTRATION_START && now < PriorityListService.PRESALE_START;
  }

  /**
   * Check if presale is in priority-only phase (first 48 hours)
   */
  isPriorityOnlyPhase(): boolean {
    const now = new Date();
    return now >= PriorityListService.PRESALE_START && now < PriorityListService.EXCLUSIVITY_END;
  }

  /**
   * Check if presale is open to everyone
   */
  isPresaleOpenToAll(): boolean {
    const now = new Date();
    return now >= PriorityListService.EXCLUSIVITY_END;
  }

  /**
   * Register for priority list
   */
  async registerForPriorityList(
    walletAddress: string,
    options: {
      email?: string;
      telegram?: string;
      twitter?: string;
      referralCode?: string;
    } = {}
  ): Promise<{ success: boolean; message: string; entry?: PriorityListEntry }> {
    try {
      // Validate registration period
      if (!this.isRegistrationOpen()) {
        const now = new Date();
        if (now < PriorityListService.REGISTRATION_START) {
          return {
            success: false,
            message: `Priority list registration opens on October 27, 2025 at 00:00 UTC`,
          };
        } else {
          return {
            success: false,
            message: `Priority list registration closed. Presale starts November 3, 2025.`,
          };
        }
      }

      // Check if already registered
      if (this.entries.has(walletAddress.toLowerCase())) {
        return {
          success: false,
          message: 'This wallet is already registered for the priority list.',
        };
      }

      // Validate wallet address
      if (!this.isValidWalletAddress(walletAddress)) {
        return {
          success: false,
          message: 'Invalid wallet address format.',
        };
      }

      // Check referral code if provided
      if (options.referralCode && !this.isValidReferralCode(options.referralCode)) {
        return {
          success: false,
          message: 'Invalid referral code.',
        };
      }

      // Create entry
      const entry: PriorityListEntry = {
        id: this.generateId(),
        walletAddress: walletAddress.toLowerCase(),
        email: options.email,
        telegram: options.telegram,
        twitter: options.twitter,
        registeredAt: new Date(),
        isVerified: false,
        referralCode: options.referralCode,
        referredBy: options.referralCode ? this.getReferrerByCode(options.referralCode) : undefined,
      };

      // Save entry
      this.entries.set(walletAddress.toLowerCase(), entry);
      this.updateStats();
      this.saveToStorage();

      return {
        success: true,
        message: 'Successfully registered for priority list! You will have 48-hour early access to the presale.',
        entry,
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
   * Check if wallet is in priority list
   */
  isInPriorityList(walletAddress: string): boolean {
    return this.entries.has(walletAddress.toLowerCase());
  }

  /**
   * Get priority list entry
   */
  getPriorityEntry(walletAddress: string): PriorityListEntry | null {
    return this.entries.get(walletAddress.toLowerCase()) || null;
  }

  /**
   * Get all priority list entries (admin only)
   */
  getAllEntries(): PriorityListEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get priority list statistics
   */
  getStats(): PriorityListStats {
    return { ...this.stats };
  }

  /**
   * Verify a priority list entry (admin only)
   */
  verifyEntry(walletAddress: string): boolean {
    const entry = this.entries.get(walletAddress.toLowerCase());
    if (entry) {
      entry.isVerified = true;
      this.updateStats();
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Generate referral code
   */
  generateReferralCode(walletAddress: string): string {
    const hash = this.simpleHash(walletAddress);
    return `BLAZE${hash.toString(36).toUpperCase().slice(0, 6)}`;
  }

  /**
   * Get time until registration opens
   */
  getTimeUntilRegistration(): { days: number; hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const diff = PriorityListService.REGISTRATION_START.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }

  /**
   * Get time until presale starts
   */
  getTimeUntilPresale(): { days: number; hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const diff = PriorityListService.PRESALE_START.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }

  /**
   * Get time until exclusivity ends
   */
  getTimeUntilExclusivityEnd(): { days: number; hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const diff = PriorityListService.EXCLUSIVITY_END.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }

  // Private helper methods
  private isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidReferralCode(code: string): boolean {
    return /^BLAZE[A-Z0-9]{6}$/.test(code);
  }

  private getReferrerByCode(code: string): string | undefined {
    // Find the wallet address that generated this referral code
    for (const [address, entry] of this.entries.entries()) {
      if (this.generateReferralCode(address) === code) {
        return address;
      }
    }
    return undefined;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private updateStats(): void {
    const entries = Array.from(this.entries.values());
    this.stats.totalRegistered = entries.length;
    this.stats.verifiedCount = entries.filter(e => e.isVerified).length;
    this.stats.referralCount = entries.filter(e => e.referredBy).length;
    this.stats.lastRegistration = entries.length > 0 
      ? new Date(Math.max(...entries.map(e => e.registeredAt.getTime())))
      : null;
  }

  private saveToStorage(): void {
    try {
      const data = {
        entries: Array.from(this.entries.entries()),
        stats: this.stats,
      };
      localStorage.setItem('blaze_priority_list', JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to save priority list to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('blaze_priority_list');
      if (data) {
        const parsed = JSON.parse(data);
        this.entries = new Map(parsed.entries);
        this.stats = parsed.stats;
      }
    } catch (error) {
      logger.error('Failed to load priority list from storage:', error);
    }
  }
}

// Export singleton instance
export const priorityListService = PriorityListService.getInstance();

