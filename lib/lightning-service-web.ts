/**
 * ⚡ BLAZE LIGHTNING SERVICE (WEB VERSION)
 * 
 * This is a web-compatible Lightning Network implementation that uses:
 * 1. BOLT11 invoice encoding/decoding
 * 2. WebLN for browser wallet integration
 * 3. Backend API for non-custodial Lightning operations
 * 
 * Architecture:
 * - Client-side: Invoice generation, QR display, payment requests
 * - Server-side: LND/CLN integration, channel management
 * - Non-custodial: Users control their keys
 */

import * as bolt11 from 'light-bolt11-decoder';

// WebLN types (for browser Lightning wallets like Alby, Getalby, etc.)
interface WebLN {
  enable(): Promise<void>;
  sendPayment(invoice: string): Promise<{ preimage: string }>;
  makeInvoice(args: { amount?: number; defaultMemo?: string }): Promise<{ paymentRequest: string }>;
  signMessage(message: string): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    webln?: WebLN;
  }
}

/**
 * Lightning Invoice Data
 */
export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amountSats: number;
  description: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Lightning Payment Result
 */
export interface LightningPayment {
  success: boolean;
  paymentHash?: string;
  preimage?: string;
  feeSats?: number;
  error?: string;
}

/**
 * Decoded BOLT11 Invoice
 */
export interface DecodedInvoice {
  paymentHash: string;
  amountSats: number;
  description: string;
  expiresAt: number;
  destination: string;
  timestamp: number;
}

/**
 * Lightning Balance
 */
export interface LightningBalance {
  onChainSats: number;
  lightningSats: number;
  maxReceivableSats: number;
  maxPayableSats: number;
}

/**
 * ⚡ BLAZE LIGHTNING SERVICE
 * 
 * Handles all Lightning Network operations for Blaze Wallet
 */
export class BlazeLightningService {
  private static instance: BlazeLightningService;
  private weblnEnabled = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BlazeLightningService {
    if (!BlazeLightningService.instance) {
      BlazeLightningService.instance = new BlazeLightningService();
    }
    return BlazeLightningService.instance;
  }

  /**
   * Check if WebLN is available (browser Lightning wallet)
   */
  isWebLNAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.webln;
  }

  /**
   * Enable WebLN (request permission from user's Lightning wallet)
   */
  async enableWebLN(): Promise<boolean> {
    if (!this.isWebLNAvailable()) {
      console.log('ℹ️ WebLN not available (no browser Lightning wallet detected)');
      return false;
    }

    try {
      await window.webln!.enable();
      this.weblnEnabled = true;
      console.log('✅ WebLN enabled');
      return true;
    } catch (error) {
      console.error('❌ Failed to enable WebLN:', error);
      return false;
    }
  }

  /**
   * 📝 DECODE BOLT11 INVOICE
   * Parse Lightning invoice to extract payment details
   */
  decodeInvoice(bolt11String: string): DecodedInvoice | null {
    try {
      // Remove "lightning:" prefix if present
      const cleanBolt11 = bolt11String.replace('lightning:', '').trim();
      
      const decoded = bolt11.decode(cleanBolt11);
      
      // Extract sections (cast to any to avoid TypeScript issues with Section type)
      const sections = decoded.sections as any[];
      
      // Get payment hash
      const paymentHashSection = sections.find((s) => s.name === 'payment_hash');
      const paymentHash = paymentHashSection?.value || '';
      
      // Get amount (in millisatoshis)
      const amountSection = sections.find((s) => s.name === 'amount');
      const amountMsat = amountSection?.value || 0;
      const amountSats = Math.floor(Number(amountMsat) / 1000);
      
      // Get description
      const descSection = sections.find((s) => s.name === 'description');
      const description = descSection?.value || '';
      
      // Get expiry
      const expirySection = sections.find((s) => s.name === 'expiry');
      const expiry = expirySection?.value || 3600;
      
      // Get timestamp
      const timestampSection = sections.find((s) => s.name === 'timestamp');
      const timestamp = timestampSection?.value || 0;
      
      // Get destination (payee pubkey)
      const destSection = sections.find((s) => s.name === 'payee_node_key');
      const destination = destSection?.value || '';
      
      return {
        paymentHash,
        amountSats,
        description,
        expiresAt: (Number(timestamp) + Number(expiry)) * 1000,
        destination,
        timestamp: Number(timestamp) * 1000,
      };
    } catch (error) {
      console.error('❌ Failed to decode invoice:', error);
      return null;
    }
  }

  /**
   * 📊 VALIDATE BOLT11 INVOICE
   * Check if invoice is valid and not expired
   */
  validateInvoice(bolt11String: string): { valid: boolean; error?: string; decoded?: DecodedInvoice } {
    // Check format
    if (!bolt11String.startsWith('lnbc') && !bolt11String.startsWith('lightning:lnbc')) {
      return { valid: false, error: 'Invalid invoice format (must start with lnbc)' };
    }

    // Decode invoice
    const decoded = this.decodeInvoice(bolt11String);
    if (!decoded) {
      return { valid: false, error: 'Failed to decode invoice' };
    }

    // Check expiry
    if (Date.now() > decoded.expiresAt) {
      return { valid: false, error: 'Invoice expired', decoded };
    }

    // Check amount
    if (decoded.amountSats <= 0) {
      return { valid: false, error: 'Invalid amount', decoded };
    }

    return { valid: true, decoded };
  }

  /**
   * 🔥 CREATE LIGHTNING INVOICE
   * Generate a BOLT11 invoice to receive payment
   * 
   * For now, this uses our backend API to generate invoices via LND
   * In production, this would connect to Blaze's Lightning infrastructure
   */
  async createInvoice(
    amountSats: number,
    description: string = 'Blaze Wallet Payment'
  ): Promise<LightningInvoice | null> {
    try {
      console.log(`⚡ Creating Lightning invoice for ${amountSats} sats...`);

      // TODO: Replace with actual LND/Breez backend call
      // For now, we'll return a mock invoice structure
      // In production: POST to /api/lightning/create-invoice

      const response = await fetch('/api/lightning/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSats,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const data = await response.json();
      return data.invoice;
    } catch (error) {
      console.error('❌ Failed to create invoice:', error);
      
      // For development: return mock invoice
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Using MOCK Lightning invoice (development mode)');
        return this.createMockInvoice(amountSats, description);
      }
      
      return null;
    }
  }

  /**
   * 💸 PAY LIGHTNING INVOICE
   * Send payment to a BOLT11 invoice
   */
  async payInvoice(bolt11: string): Promise<LightningPayment> {
    try {
      console.log('⚡ Paying Lightning invoice...');

      // Validate invoice first
      const validation = this.validateInvoice(bolt11);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Try WebLN first (if user has browser Lightning wallet)
      if (this.weblnEnabled && this.isWebLNAvailable()) {
        try {
          const result = await window.webln!.sendPayment(bolt11);
          return {
            success: true,
            preimage: result.preimage,
            paymentHash: validation.decoded!.paymentHash,
          };
        } catch (error) {
          console.error('❌ WebLN payment failed:', error);
          // Fall through to backend payment
        }
      }

      // Use backend API for payment
      const response = await fetch('/api/lightning/pay-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: bolt11 }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Payment failed',
        };
      }

      const data = await response.json();
      return {
        success: true,
        paymentHash: data.paymentHash,
        preimage: data.preimage,
        feeSats: data.feeSats,
      };
    } catch (error: any) {
      console.error('❌ Failed to pay invoice:', error);
      return {
        success: false,
        error: error.message || 'Payment failed',
      };
    }
  }

  /**
   * 💰 GET LIGHTNING BALANCE
   * Fetch current Lightning and on-chain balance
   */
  async getBalance(): Promise<LightningBalance | null> {
    try {
      const response = await fetch('/api/lightning/balance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      
      // For development: return mock balance
      if (process.env.NODE_ENV === 'development') {
        return {
          onChainSats: 1000000, // 0.01 BTC
          lightningSats: 500000, // 0.005 BTC
          maxReceivableSats: 5000000,
          maxPayableSats: 500000,
        };
      }
      
      return null;
    }
  }

  /**
   * 🔄 MONITOR INVOICE PAYMENT
   * Check if invoice has been paid
   */
  async checkInvoiceStatus(paymentHash: string): Promise<{ settled: boolean; settledAt?: number }> {
    try {
      const response = await fetch(`/api/lightning/check-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentHash }),
      });

      if (!response.ok) {
        throw new Error('Failed to check invoice');
      }

      const data = await response.json();
      return {
        settled: data.settled,
        settledAt: data.settledAt,
      };
    } catch (error) {
      console.error('❌ Failed to check invoice:', error);
      return { settled: false };
    }
  }

  /**
   * 🧪 CREATE MOCK INVOICE (for development)
   */
  private createMockInvoice(amountSats: number, description: string): LightningInvoice {
    const now = Date.now();
    const paymentHash = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Generate mock BOLT11 invoice
    const bolt11 = `lnbc${amountSats}n1p${Math.random().toString(36).substring(2, 15)}pp5${paymentHash.substring(0, 52)}`;

    return {
      bolt11,
      paymentHash,
      amountSats,
      description,
      createdAt: now,
      expiresAt: now + 900000, // 15 minutes
    };
  }
}

/**
 * Export singleton instance
 */
export const lightningService = BlazeLightningService.getInstance();

