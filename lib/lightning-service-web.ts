/**
 * ⚡ BLAZE LIGHTNING SERVICE (WEBLN - NON-CUSTODIAL)
 * 
 * This is a NON-CUSTODIAL Lightning implementation using WebLN.
 * Users connect their own Lightning wallets (Alby, Zeus, Mutiny, etc.)
 * 
 * Architecture:
 * - Client-side: WebLN browser wallet integration
 * - Non-custodial: Users control their own keys & funds
 * - No backend needed: Direct peer-to-peer Lightning
 * 
 * Future: Easy migration to Breez SDK Greenlight when API key arrives
 */

import * as bolt11 from 'light-bolt11-decoder';

// WebLN types
interface WebLN {
  enable(): Promise<void>;
  getInfo(): Promise<{ node: { alias: string; pubkey: string }; methods: string[] }>;
  sendPayment(invoice: string): Promise<SendPaymentResponse>;
  makeInvoice(args: MakeInvoiceArgs): Promise<RequestInvoiceResponse>;
  signMessage(message: string): Promise<SignMessageResponse>;
  verifyMessage(signature: string, message: string): Promise<void>;
  keysend(args: KeysendArgs): Promise<SendPaymentResponse>;
}

interface SendPaymentResponse {
  preimage: string;
  paymentHash?: string;
  route?: {
    total_amt: number;
    total_fees: number;
  };
}

interface MakeInvoiceArgs {
  amount?: number | string; // Amount in satoshis
  defaultAmount?: number | string;
  minimumAmount?: number | string;
  maximumAmount?: number | string;
  defaultMemo?: string;
}

interface RequestInvoiceResponse {
  paymentRequest: string; // BOLT11 invoice
  rHash: string; // Payment hash
}

interface SignMessageResponse {
  message: string;
  signature: string;
}

interface KeysendArgs {
  destination: string;
  amount: number | string;
  customRecords?: Record<string, string>;
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
 * ⚡ BLAZE LIGHTNING SERVICE (WEBLN - NON-CUSTODIAL)
 * 
 * Handles all Lightning Network operations using WebLN
 * Users connect their own Lightning wallets - truly non-custodial!
 */
export class BlazeLightningService {
  private static instance: BlazeLightningService;
  private weblnEnabled = false;
  private walletInfo: { alias: string; pubkey: string } | null = null;

  private constructor() {
    // Auto-detect WebLN on init
    if (typeof window !== 'undefined') {
      this.detectWebLN();
    }
  }

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
   * Detect if WebLN wallet is available
   */
  private detectWebLN() {
    if (typeof window !== 'undefined' && window.webln) {
      console.log('✅ WebLN wallet detected!');
    } else {
      console.log('ℹ️ No WebLN wallet detected. User needs Alby/Zeus/etc.');
    }
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
      console.log('❌ WebLN not available');
      return false;
    }

    try {
      console.log('🔐 Requesting WebLN permission...');
      await window.webln!.enable();
      
      // Get wallet info
      const info = await window.webln!.getInfo();
      this.walletInfo = info.node;
      this.weblnEnabled = true;
      
      console.log('✅ WebLN enabled!', {
        wallet: info.node.alias,
        pubkey: info.node.pubkey.substring(0, 16) + '...',
        methods: info.methods,
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to enable WebLN:', error);
      return false;
    }
  }

  /**
   * Get connected wallet info
   */
  getWalletInfo() {
    return this.walletInfo;
  }

  /**
   * Check if WebLN is enabled
   */
  isEnabled(): boolean {
    return this.weblnEnabled;
  }

  /**
   * 📝 DECODE BOLT11 INVOICE
   * Parse Lightning invoice to extract payment details
   */
  decodeInvoice(bolt11String: string): DecodedInvoice | null {
    try {
      const cleanBolt11 = bolt11String.replace('lightning:', '').trim();
      const decoded = bolt11.decode(cleanBolt11);
      const sections = decoded.sections as any[];
      
      const paymentHashSection = sections.find((s) => s.name === 'payment_hash');
      const paymentHash = paymentHashSection?.value || '';
      
      const amountSection = sections.find((s) => s.name === 'amount');
      const amountMsat = amountSection?.value || 0;
      const amountSats = Math.floor(Number(amountMsat) / 1000);
      
      const descSection = sections.find((s) => s.name === 'description');
      const description = descSection?.value || '';
      
      const expirySection = sections.find((s) => s.name === 'expiry');
      const expiry = expirySection?.value || 3600;
      
      const timestampSection = sections.find((s) => s.name === 'timestamp');
      const timestamp = timestampSection?.value || 0;
      
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
   */
  validateInvoice(bolt11String: string): { valid: boolean; error?: string; decoded?: DecodedInvoice } {
    if (!bolt11String.startsWith('lnbc') && !bolt11String.startsWith('lightning:lnbc')) {
      return { valid: false, error: 'Invalid invoice format (must start with lnbc)' };
    }

    const decoded = this.decodeInvoice(bolt11String);
    if (!decoded) {
      return { valid: false, error: 'Failed to decode invoice' };
    }

    if (Date.now() > decoded.expiresAt) {
      return { valid: false, error: 'Invoice expired', decoded };
    }

    if (decoded.amountSats <= 0) {
      return { valid: false, error: 'Invalid amount', decoded };
    }

    return { valid: true, decoded };
  }

  /**
   * 🔥 CREATE LIGHTNING INVOICE (via user's WebLN wallet)
   * Generate a BOLT11 invoice using the connected Lightning wallet
   */
  async createInvoice(
    amountSats: number,
    description: string = 'Blaze Wallet Payment'
  ): Promise<LightningInvoice | null> {
    try {
      console.log(`⚡ Creating Lightning invoice for ${amountSats} sats via WebLN...`);

      // Check if WebLN is enabled
      if (!this.weblnEnabled) {
        const enabled = await this.enableWebLN();
        if (!enabled) {
          throw new Error('WebLN not available. Please install Alby or another Lightning wallet.');
        }
      }

      // Request invoice from user's wallet
      const response = await window.webln!.makeInvoice({
        amount: amountSats,
        defaultMemo: description,
      });

      console.log('✅ Invoice created via WebLN:', response.paymentRequest.substring(0, 40) + '...');

      // Decode the invoice to get full details
      const decoded = this.decodeInvoice(response.paymentRequest);
      if (!decoded) {
        throw new Error('Failed to decode created invoice');
      }

      return {
        bolt11: response.paymentRequest,
        paymentHash: response.rHash || decoded.paymentHash,
        amountSats: decoded.amountSats,
        description: decoded.description,
        createdAt: decoded.timestamp,
        expiresAt: decoded.expiresAt,
      };
    } catch (error: any) {
      console.error('❌ Failed to create invoice:', error);
      throw new Error(error.message || 'Failed to create Lightning invoice');
    }
  }

  /**
   * 💸 PAY LIGHTNING INVOICE (via user's WebLN wallet)
   * Send payment using the connected Lightning wallet
   */
  async payInvoice(bolt11: string): Promise<LightningPayment> {
    try {
      console.log('⚡ Paying Lightning invoice via WebLN...');

      // Validate invoice first
      const validation = this.validateInvoice(bolt11);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Check if WebLN is enabled
      if (!this.weblnEnabled) {
        const enabled = await this.enableWebLN();
        if (!enabled) {
          return {
            success: false,
            error: 'WebLN not available. Please install Alby or another Lightning wallet.',
          };
        }
      }

      // Send payment via user's wallet
      const response = await window.webln!.sendPayment(bolt11);
      
      console.log('✅ Payment successful via WebLN!');

      return {
        success: true,
        preimage: response.preimage,
        paymentHash: validation.decoded!.paymentHash,
        feeSats: response.route?.total_fees || 0,
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
   * Note: WebLN doesn't expose balance for privacy
   * This returns mock data - users see balance in their own wallet
   */
  async getBalance(): Promise<LightningBalance | null> {
    console.log('ℹ️ WebLN doesn\'t expose balance for privacy reasons');
    console.log('💡 Users can check their balance in their Lightning wallet (Alby, Zeus, etc.)');
    
    // Return null to indicate balance not available
    return null;
  }

  /**
   * 🔄 MONITOR INVOICE PAYMENT
   * Note: WebLN doesn't support invoice monitoring
   * Users need to check their wallet for incoming payments
   */
  async checkInvoiceStatus(paymentHash: string): Promise<{ settled: boolean; settledAt?: number }> {
    console.log('ℹ️ WebLN doesn\'t support invoice monitoring');
    console.log('💡 Users will see payment confirmation in their Lightning wallet');
    
    // Always return unsettled - monitoring not supported
    return { settled: false };
  }

  /**
   * 🆘 SHOW WEBLN INSTALL GUIDE
   * Help users install a Lightning wallet if they don't have one
   */
  getInstallGuideURL(): string {
    return 'https://www.webln.guide/ressources/webln-providers';
  }

  /**
   * 📱 GET RECOMMENDED WALLETS
   */
  getRecommendedWallets() {
    return [
      {
        name: 'Alby',
        url: 'https://getalby.com',
        description: 'Browser extension Lightning wallet',
        platforms: ['Chrome', 'Firefox', 'Safari'],
        icon: '🐝',
      },
      {
        name: 'Zeus',
        url: 'https://zeusln.com',
        description: 'Mobile Lightning wallet with WebLN support',
        platforms: ['iOS', 'Android'],
        icon: '⚡',
      },
      {
        name: 'Mutiny Wallet',
        url: 'https://www.mutinywallet.com',
        description: 'Privacy-focused web Lightning wallet',
        platforms: ['Web', 'Mobile'],
        icon: '🏴‍☠️',
      },
    ];
  }
}

/**
 * Export singleton instance
 */
export const lightningService = BlazeLightningService.getInstance();

