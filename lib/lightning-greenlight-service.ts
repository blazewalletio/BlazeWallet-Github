/**
 * 🚀 Breez SDK Greenlight Lightning Service
 * 
 * Non-custodial Lightning Network implementation using Greenlight
 * Works on both mobile and desktop via backend API
 * 
 * Features:
 * - Non-custodial: User controls their own Lightning node
 * - Instant payments: Send and receive Lightning payments
 * - Low fees: < 1 sat per payment
 * - Full privacy: No KYC, no tracking
 * 
 * Architecture:
 * - Frontend: This service (creates invoices, checks status)
 * - Backend: Greenlight API integration (/api/lightning/*)
 * - Node: Greenlight hosted node with user's keys
 */

export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amount: number; // millisats
  description: string;
  expiresAt: number;
  status: 'pending' | 'paid' | 'expired';
}

export interface LightningPayment {
  paymentHash: string;
  amount: number; // millisats
  fee: number; // millisats
  destination: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

export interface LightningBalance {
  local: number; // millisats (can send)
  remote: number; // millisats (can receive)
  total: number; // millisats
}

export interface LightningNodeInfo {
  nodeId: string;
  alias: string;
  color: string;
  version: string;
  blockHeight: number;
  network: 'mainnet' | 'testnet';
}

class GreenlightLightningService {
  private apiUrl = '/api/lightning';
  private initialized = false;
  private nodeInfo: LightningNodeInfo | null = null;

  /**
   * Initialize Lightning node
   * Creates or connects to existing Greenlight node
   */
  async initialize(mnemonic: string): Promise<LightningNodeInfo> {
    try {
      console.log('🚀 [Greenlight] Initializing Lightning node...');

      const response = await fetch(`${this.apiUrl}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.statusText}`);
      }

      const data = await response.json();
      this.nodeInfo = data.nodeInfo;
      this.initialized = true;

      console.log('✅ [Greenlight] Lightning node initialized:', this.nodeInfo?.nodeId.substring(0, 16) + '...');
      return this.nodeInfo!;
    } catch (error) {
      console.error('❌ [Greenlight] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Lightning balance
   */
  async getBalance(): Promise<LightningBalance> {
    this.ensureInitialized();

    try {
      const response = await fetch(`${this.apiUrl}/balance`);
      
      if (!response.ok) {
        throw new Error(`Failed to get balance: ${response.statusText}`);
      }

      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Create Lightning invoice (receive payment)
   */
  async createInvoice(
    amountSats: number,
    description: string
  ): Promise<LightningInvoice> {
    this.ensureInitialized();

    try {
      console.log(`⚡ [Greenlight] Creating invoice for ${amountSats} sats`);

      const response = await fetch(`${this.apiUrl}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSats,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ [Greenlight] Invoice created:', data.invoice.bolt11.substring(0, 30) + '...');
      
      return data.invoice;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to create invoice:', error);
      throw error;
    }
  }

  /**
   * Pay Lightning invoice (send payment)
   */
  async payInvoice(bolt11: string): Promise<LightningPayment> {
    this.ensureInitialized();

    try {
      console.log(`⚡ [Greenlight] Paying invoice: ${bolt11.substring(0, 30)}...`);

      // Decode invoice first to show user the amount
      const decoded = await this.decodeInvoice(bolt11);
      console.log(`💰 Invoice amount: ${decoded.amountSats} sats`);

      const response = await fetch(`${this.apiUrl}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolt11 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Payment failed');
      }

      const data = await response.json();
      console.log('✅ [Greenlight] Payment successful!');
      
      return data.payment;
    } catch (error) {
      console.error('❌ [Greenlight] Payment failed:', error);
      throw error;
    }
  }

  /**
   * Check invoice status
   */
  async checkInvoiceStatus(paymentHash: string): Promise<LightningInvoice> {
    this.ensureInitialized();

    try {
      const response = await fetch(`${this.apiUrl}/invoice/${paymentHash}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check invoice: ${response.statusText}`);
      }

      const data = await response.json();
      return data.invoice;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to check invoice:', error);
      throw error;
    }
  }

  /**
   * Decode Lightning invoice (to show amount before paying)
   */
  async decodeInvoice(bolt11: string): Promise<{
    paymentHash: string;
    amountSats: number;
    description: string;
    expiresAt: number;
    destination: string;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolt11 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to decode invoice: ${response.statusText}`);
      }

      const data = await response.json();
      return data.decoded;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to decode invoice:', error);
      throw error;
    }
  }

  /**
   * Get node info
   */
  async getNodeInfo(): Promise<LightningNodeInfo> {
    if (this.nodeInfo) {
      return this.nodeInfo;
    }

    try {
      const response = await fetch(`${this.apiUrl}/node`);
      
      if (!response.ok) {
        throw new Error(`Failed to get node info: ${response.statusText}`);
      }

      const data = await response.json();
      this.nodeInfo = data.nodeInfo;
      return this.nodeInfo!;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to get node info:', error);
      throw error;
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(limit = 50): Promise<LightningPayment[]> {
    this.ensureInitialized();

    try {
      const response = await fetch(`${this.apiUrl}/history?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.payments;
    } catch (error) {
      console.error('❌ [Greenlight] Failed to get history:', error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset service (logout)
   */
  reset(): void {
    this.initialized = false;
    this.nodeInfo = null;
    console.log('🔄 [Greenlight] Service reset');
  }

  /**
   * Private helper: ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Lightning service not initialized. Call initialize() first.');
    }
  }

  /**
   * Convert sats to millisats
   */
  static satsToMillisats(sats: number): number {
    return sats * 1000;
  }

  /**
   * Convert millisats to sats
   */
  static millisatsToSats(millisats: number): number {
    return Math.floor(millisats / 1000);
  }

  /**
   * Convert millisats to BTC
   */
  static millisatsToBTC(millisats: number): number {
    return millisats / 100000000000; // 1 BTC = 100,000,000,000 millisats
  }
}

// Singleton instance
export const greenlightService = new GreenlightLightningService();

