/**
 * ⚡ UNIFIED LIGHTNING SERVICE (BREEZ SDK + WEBLN FALLBACK)
 * 
 * Intelligent Lightning Network service that automatically selects the best implementation:
 * 
 * - **Native (iOS/Android)**: Breez SDK with Greenlight (non-custodial)
 * - **Web (Desktop/Mobile PWA)**: WebLN fallback (user's own wallet)
 * 
 * Features:
 * - Automatic platform detection
 * - Seamless fallback
 * - Unified API for all platforms
 * - Non-custodial on all platforms
 */

import { breezService } from './breez-service';
import { lightningService as webLNService } from './lightning-service-web';
import type { LightningInvoice, LightningPayment, DecodedInvoice } from './lightning-service-web';

export type { LightningInvoice, LightningPayment, DecodedInvoice };

export interface LightningBalance {
  totalSats: number;
  onChainSats?: number;
  lightningSats?: number;
  maxReceivableSats?: number;
  maxPayableSats?: number;
}

export interface LightningTransaction {
  id: string;
  type: 'sent' | 'received';
  timestamp: number;
  amountSats: number;
  feeSats: number;
  status: string;
  description?: string;
  invoice?: string;
}

/**
 * Unified Lightning Service
 * Automatically uses Breez SDK (native) or WebLN (web)
 */
export class UnifiedLightningService {
  private static instance: UnifiedLightningService | null = null;

  private constructor() {
    console.log(`⚡ Unified Lightning Service initialized`);
  }

  static getInstance(): UnifiedLightningService {
    if (!UnifiedLightningService.instance) {
      UnifiedLightningService.instance = new UnifiedLightningService();
    }
    return UnifiedLightningService.instance;
  }

  /**
   * Check if running on native platform
   */
  isNativePlatform(): boolean {
    return breezService.isNativePlatform();
  }

  /**
   * Check if Lightning is available (either Breez SDK or WebLN)
   */
  async isAvailable(): Promise<boolean> {
    if (this.isNativePlatform()) {
      return breezService.isAvailable();
    } else {
      return webLNService.isWebLNAvailable();
    }
  }

  /**
   * Initialize Lightning service
   * - Native: Connect to Breez/Greenlight
   * - Web: Enable WebLN wallet
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isNativePlatform()) {
        console.log('🔌 Initializing Breez SDK...');
        await breezService.connect();
        return breezService.isAvailable();
      } else {
        console.log('🔌 Initializing WebLN...');
        return await webLNService.enableWebLN();
      }
    } catch (error) {
      console.error('❌ Failed to initialize Lightning:', error);
      return false;
    }
  }

  /**
   * Get Lightning balance
   */
  async getBalance(): Promise<LightningBalance | null> {
    try {
      if (this.isNativePlatform()) {
        const balanceSats = await breezService.getBalance();
        return {
          totalSats: balanceSats,
          lightningSats: balanceSats,
        };
      } else {
        // WebLN doesn't expose balance for privacy
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      return null;
    }
  }

  /**
   * Create Lightning invoice (receive payment)
   * 
   * @param amountSats - Amount in satoshis
   * @param description - Payment description
   * @returns BOLT11 invoice
   */
  async createInvoice(amountSats: number, description: string = 'Blaze Wallet Payment'): Promise<string> {
    try {
      if (this.isNativePlatform()) {
        console.log('⚡ Creating invoice via Breez SDK...');
        return await breezService.createInvoice(amountSats, description);
      } else {
        console.log('⚡ Creating invoice via WebLN...');
        const invoice = await webLNService.createInvoice(amountSats, description);
        if (!invoice) {
          throw new Error('Failed to create invoice');
        }
        return invoice.bolt11;
      }
    } catch (error: any) {
      console.error('❌ Failed to create invoice:', error);
      throw new Error(error.message || 'Failed to create Lightning invoice');
    }
  }

  /**
   * Pay Lightning invoice (send payment)
   * 
   * @param bolt11 - Lightning invoice
   * @returns Payment result
   */
  async payInvoice(bolt11: string): Promise<LightningPayment> {
    try {
      if (this.isNativePlatform()) {
        console.log('⚡ Paying invoice via Breez SDK...');
        const response = await breezService.payInvoice(bolt11);
        return {
          success: true,
          paymentHash: response.payment.id,
          preimage: response.payment.id, // Breez uses payment ID
          feeSats: Math.floor(response.payment.feeMsat / 1000),
        };
      } else {
        console.log('⚡ Paying invoice via WebLN...');
        return await webLNService.payInvoice(bolt11);
      }
    } catch (error: any) {
      console.error('❌ Failed to pay invoice:', error);
      return {
        success: false,
        error: error.message || 'Payment failed',
      };
    }
  }

  /**
   * Decode BOLT11 invoice
   */
  decodeInvoice(bolt11: string): DecodedInvoice | null {
    return webLNService.decodeInvoice(bolt11);
  }

  /**
   * Validate BOLT11 invoice
   */
  validateInvoice(bolt11: string): { valid: boolean; error?: string; decoded?: DecodedInvoice } {
    return webLNService.validateInvoice(bolt11);
  }

  /**
   * Get Lightning transaction history
   */
  async getTransactions(): Promise<LightningTransaction[]> {
    try {
      if (this.isNativePlatform()) {
        const payments = await breezService.listPayments();
        return payments.map(p => ({
          id: p.id,
          type: p.paymentType,
          timestamp: p.paymentTime,
          amountSats: Math.floor(p.amountMsat / 1000),
          feeSats: Math.floor(p.feeMsat / 1000),
          status: p.status,
          description: p.description,
          invoice: p.bolt11,
        }));
      } else {
        // WebLN doesn't support transaction history
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get transactions:', error);
      return [];
    }
  }

  /**
   * Get platform info (for UI display)
   */
  getPlatformInfo(): { platform: 'native' | 'web'; provider: string; features: string[] } {
    if (this.isNativePlatform()) {
      return {
        platform: 'native',
        provider: 'Breez SDK (Greenlight)',
        features: ['Send', 'Receive', 'Balance', 'History', 'Non-custodial'],
      };
    } else {
      return {
        platform: 'web',
        provider: 'WebLN (User Wallet)',
        features: ['Send', 'Receive', 'Non-custodial', 'Privacy-focused'],
      };
    }
  }

  /**
   * Check if invoice payment monitoring is supported
   */
  supportsInvoiceMonitoring(): boolean {
    return this.isNativePlatform();
  }

  /**
   * Check if balance fetching is supported
   */
  supportsBalance(): boolean {
    return this.isNativePlatform();
  }

  /**
   * Check if transaction history is supported
   */
  supportsHistory(): boolean {
    return this.isNativePlatform();
  }

  /**
   * Get install guide for WebLN wallets (web only)
   */
  getInstallGuide() {
    if (!this.isNativePlatform()) {
      return {
        url: webLNService.getInstallGuideURL(),
        wallets: webLNService.getRecommendedWallets(),
      };
    }
    return null;
  }

  /**
   * Disconnect/cleanup
   */
  async disconnect(): Promise<void> {
    if (this.isNativePlatform()) {
      await breezService.disconnect();
    }
  }
}

// Export singleton instance
export const lightningService = UnifiedLightningService.getInstance();
