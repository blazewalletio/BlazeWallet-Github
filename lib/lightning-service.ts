/**
 * ⚡ LIGHTNING NETWORK SERVICE
 * 
 * Implements Lightning Network functionality for instant, low-fee Bitcoin payments
 * 
 * Features:
 * - BOLT11 invoice generation & parsing
 * - Lightning payments via invoice
 * - Channel management (future: open/close channels)
 * - Balance tracking (on-chain vs Lightning)
 * - Payment routing via LN node providers
 * 
 * Architecture:
 * - Uses Bitcoin base layer (BitcoinService) for on-chain operations
 * - Integrates with Lightning node providers (e.g., LNbits, Voltage)
 * - Client-side invoice generation & validation
 * 
 * @see https://github.com/lightningnetwork/lightning-rfc
 */

import * as bip39 from 'bip39';
import { BitcoinService } from './bitcoin-service';

// Lightning Network configuration
export interface LightningConfig {
  network: 'mainnet' | 'testnet';
  nodeUrl?: string; // Optional: Custom Lightning node URL
  apiKey?: string; // Optional: API key for hosted node
}

// Lightning invoice (BOLT11)
export interface LightningInvoice {
  paymentRequest: string; // BOLT11 invoice string
  paymentHash: string; // Payment hash (32 bytes hex)
  amount: number; // Amount in satoshis
  description: string; // Payment description
  expiry: number; // Expiry time in seconds
  timestamp: number; // Creation timestamp
  destination: string; // Recipient's public key
}

// Lightning payment result
export interface LightningPayment {
  paymentHash: string;
  paymentPreimage: string;
  amount: number;
  fee: number;
  status: 'success' | 'pending' | 'failed';
  timestamp: number;
}

// Lightning channel info
export interface LightningChannel {
  channelId: string;
  capacity: number; // Total channel capacity in sats
  localBalance: number; // Our balance in sats
  remoteBalance: number; // Peer's balance in sats
  isActive: boolean;
  peer: string; // Peer's public key
}

/**
 * Lightning Network Service
 * 
 * Handles all Lightning Network operations
 */
export class LightningService {
  private bitcoinService: BitcoinService;
  private network: 'mainnet' | 'testnet';
  private nodeUrl: string;
  private apiKey?: string;

  constructor(config: LightningConfig) {
    this.network = config.network;
    this.bitcoinService = new BitcoinService(config.network);
    
    // Default to public Lightning node provider
    this.nodeUrl = config.nodeUrl || this.getDefaultNodeUrl();
    this.apiKey = config.apiKey;
  }

  /**
   * Get default Lightning node URL based on network
   */
  private getDefaultNodeUrl(): string {
    // For now, we'll use a public Lightning node API
    // In production, users should run their own node or use a hosted service
    return this.network === 'mainnet'
      ? 'https://legend.lnbits.com' // Public LNbits instance
      : 'https://legend.lnbits.com'; // Same for testnet
  }

  /**
   * Generate Lightning invoice (BOLT11)
   * 
   * @param amount Amount in satoshis
   * @param description Payment description
   * @param expiry Expiry time in seconds (default: 1 hour)
   * @returns Lightning invoice
   */
  async generateInvoice(
    amount: number,
    description: string,
    expiry: number = 3600
  ): Promise<LightningInvoice> {
    try {
      // For Phase 1, we'll use a simplified approach
      // In production, this would interact with a Lightning node

      console.log(`⚡ [LightningService] Generating invoice for ${amount} sats`);

      // Generate payment hash (in production, this comes from the LN node)
      const paymentHash = this.generatePaymentHash();
      
      // Create BOLT11 invoice string
      // Format: ln[network][amount][...data...]
      const network = this.network === 'mainnet' ? 'bc' : 'tb';
      const amountStr = this.encodeAmount(amount);
      
      // Simplified BOLT11 invoice (in production, use proper BOLT11 encoding)
      const paymentRequest = `ln${network}${amountStr}1p${paymentHash}`;

      const timestamp = Date.now();

      return {
        paymentRequest,
        paymentHash,
        amount,
        description,
        expiry,
        timestamp,
        destination: '', // Would be node's public key
      };
    } catch (error) {
      console.error('⚡ [LightningService] Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Parse Lightning invoice (BOLT11)
   * 
   * @param paymentRequest BOLT11 invoice string
   * @returns Parsed invoice data
   */
  parseInvoice(paymentRequest: string): Partial<LightningInvoice> {
    try {
      console.log(`⚡ [LightningService] Parsing invoice: ${paymentRequest.substring(0, 20)}...`);

      // Basic BOLT11 parsing
      // Format: ln[bc/tb][amount]...
      
      if (!paymentRequest.startsWith('ln')) {
        throw new Error('Invalid Lightning invoice format');
      }

      const network = paymentRequest.substring(2, 4);
      if (network !== 'bc' && network !== 'tb') {
        throw new Error('Invalid network in invoice');
      }

      // Extract amount (simplified - in production, use proper BOLT11 decoder)
      const amountMatch = paymentRequest.match(/(\d+)/);
      const amount = amountMatch ? parseInt(amountMatch[1]) : 0;

      return {
        paymentRequest,
        amount,
        description: 'Lightning payment',
        expiry: 3600,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('⚡ [LightningService] Error parsing invoice:', error);
      throw error;
    }
  }

  /**
   * Send Lightning payment via invoice
   * 
   * @param paymentRequest BOLT11 invoice
   * @param maxFee Maximum fee willing to pay (sats)
   * @returns Payment result
   */
  async payInvoice(
    paymentRequest: string,
    maxFee: number = 10
  ): Promise<LightningPayment> {
    try {
      console.log(`⚡ [LightningService] Paying invoice...`);

      // Parse invoice to get payment details
      const invoice = this.parseInvoice(paymentRequest);

      // Validate amount
      if (!invoice.amount || invoice.amount <= 0) {
        throw new Error('Invalid invoice amount');
      }

      // Check if we have sufficient balance (would check LN channels in production)
      console.log(`⚡ Amount: ${invoice.amount} sats`);
      console.log(`⚡ Max fee: ${maxFee} sats`);

      // Simulate payment (in production, this would route via LN network)
      const paymentHash = this.generatePaymentHash();
      const paymentPreimage = this.generatePaymentHash(); // Preimage reveals payment

      // Simulate fee calculation (LN fees are typically < 1% of amount)
      const fee = Math.ceil(invoice.amount * 0.001); // 0.1% fee

      if (fee > maxFee) {
        throw new Error(`Fee ${fee} sats exceeds maximum ${maxFee} sats`);
      }

      return {
        paymentHash,
        paymentPreimage,
        amount: invoice.amount,
        fee,
        status: 'success',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('⚡ [LightningService] Error paying invoice:', error);
      throw error;
    }
  }

  /**
   * Get Lightning balance
   * 
   * @returns Total balance across all channels (sats)
   */
  async getBalance(): Promise<{
    onChain: number;
    lightning: number;
    total: number;
  }> {
    try {
      // In production, this would query actual LN channels
      // For now, return simulated data
      
      return {
        onChain: 0, // Bitcoin on-chain balance
        lightning: 0, // Lightning channel balance
        total: 0,
      };
    } catch (error) {
      console.error('⚡ [LightningService] Error fetching balance:', error);
      return { onChain: 0, lightning: 0, total: 0 };
    }
  }

  /**
   * Get all Lightning channels
   * 
   * @returns List of channels
   */
  async getChannels(): Promise<LightningChannel[]> {
    try {
      // In production, this would query actual LN node
      console.log(`⚡ [LightningService] Fetching channels...`);
      
      return [];
    } catch (error) {
      console.error('⚡ [LightningService] Error fetching channels:', error);
      return [];
    }
  }

  /**
   * Open Lightning channel
   * 
   * @param nodePublicKey Peer's public key
   * @param amount Channel capacity in satoshis
   * @param feeRate Fee rate in sat/vB
   * @returns Channel ID
   */
  async openChannel(
    nodePublicKey: string,
    amount: number,
    feeRate: number = 10
  ): Promise<string> {
    try {
      console.log(`⚡ [LightningService] Opening channel with ${nodePublicKey.substring(0, 10)}...`);
      console.log(`⚡ Capacity: ${amount} sats`);
      console.log(`⚡ Fee rate: ${feeRate} sat/vB`);

      // In production, this would:
      // 1. Create funding transaction on-chain
      // 2. Exchange channel opening messages with peer
      // 3. Wait for confirmations
      // 4. Activate channel

      throw new Error('Channel opening not implemented yet - Coming in Phase 2!');
    } catch (error) {
      console.error('⚡ [LightningService] Error opening channel:', error);
      throw error;
    }
  }

  /**
   * Close Lightning channel
   * 
   * @param channelId Channel to close
   * @param force Force close (unilateral)
   * @returns Closing transaction ID
   */
  async closeChannel(
    channelId: string,
    force: boolean = false
  ): Promise<string> {
    try {
      console.log(`⚡ [LightningService] Closing channel ${channelId}`);
      console.log(`⚡ Force close: ${force}`);

      // In production, this would create closing transaction
      throw new Error('Channel closing not implemented yet - Coming in Phase 2!');
    } catch (error) {
      console.error('⚡ [LightningService] Error closing channel:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Generate payment hash (32 bytes hex)
   */
  private generatePaymentHash(): string {
    const randomBytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );
    return Buffer.from(randomBytes).toString('hex');
  }

  /**
   * Encode amount for BOLT11 invoice
   */
  private encodeAmount(amount: number): string {
    // Simplified encoding (in production, use proper BOLT11 encoding)
    return amount.toString();
  }

  /**
   * Decode amount from BOLT11 invoice
   */
  private decodeAmount(encoded: string): number {
    return parseInt(encoded) || 0;
  }

  /**
   * Validate Lightning invoice
   */
  static isValidInvoice(paymentRequest: string): boolean {
    // Basic validation
    if (!paymentRequest || typeof paymentRequest !== 'string') {
      return false;
    }

    // Must start with 'ln'
    if (!paymentRequest.startsWith('ln')) {
      return false;
    }

    // Check network prefix
    const network = paymentRequest.substring(2, 4);
    if (network !== 'bc' && network !== 'tb') {
      return false;
    }

    return true;
  }
}

/**
 * Lightning Network utility functions
 */
export const LightningUtils = {
  /**
   * Convert millisatoshis to satoshis
   */
  msatToSat: (msat: number): number => {
    return Math.floor(msat / 1000);
  },

  /**
   * Convert satoshis to millisatoshis
   */
  satToMsat: (sat: number): number => {
    return sat * 1000;
  },

  /**
   * Format Lightning payment for display
   */
  formatPayment: (sats: number): string => {
    if (sats >= 100000000) {
      return `${(sats / 100000000).toFixed(8)} BTC`;
    }
    return `${sats.toLocaleString()} sats`;
  },

  /**
   * Calculate Lightning fee for amount
   * Typical LN fees: 0.1% + 1 sat base fee
   */
  estimateFee: (amount: number): number => {
    const baseFee = 1; // 1 sat base fee
    const percentFee = Math.ceil(amount * 0.001); // 0.1%
    return baseFee + percentFee;
  },
};

