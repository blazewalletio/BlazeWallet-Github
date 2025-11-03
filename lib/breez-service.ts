/**
 * 🚀 Breez Lightning Service with Greenlight Integration
 * 
 * Features:
 * - Platform detection (native vs web)
 * - Greenlight certificate authentication
 * - Non-custodial Lightning payments
 * - Auto-fallback to WebLN on web
 * 
 * Platforms:
 * - ✅ Native (iOS/Android): Full Breez SDK via Capacitor
 * - ✅ Web (Desktop/Mobile): WebLN fallback
 */

import { Capacitor } from '@capacitor/core';

// Types for Breez SDK (will be available in native context)
interface BreezEvent {
  type: string;
  data?: any;
}

interface NodeConfig {
  type: 'greenlight';
  config: {
    partnerCredentials: {
      deviceKey: Uint8Array | null;
      deviceCert: Uint8Array | null;
    };
  };
}

interface BreezConfig {
  breezApiKey: string;
  nodeConfig: NodeConfig;
  workingDir: string;
}

interface ReceivePaymentRequest {
  amountMsat: number;
  description: string;
}

interface ReceivePaymentResponse {
  lnInvoice: {
    bolt11: string;
    paymentHash: string;
  };
}

interface SendPaymentRequest {
  bolt11: string;
  amountMsat?: number;
}

interface SendPaymentResponse {
  payment: {
    id: string;
    paymentType: string;
    paymentTime: number;
    amountMsat: number;
    feeMsat: number;
    status: string;
    description?: string;
  };
}

interface NodeInfo {
  id: string;
  maxPayableMsat?: number;
  maxReceivableMsat?: number;
  onchainBalanceMsat: number;
}

interface Payment {
  id: string;
  paymentType: 'sent' | 'received';
  paymentTime: number;
  amountMsat: number;
  feeMsat: number;
  status: string;
  description?: string;
  bolt11?: string;
}

interface ListPaymentsRequest {
  // Empty for now, can add filters later
}

// Breez SDK module (only available in native)
let BreezSDK: any = null;

// Dynamically load Breez SDK only when needed (prevents Next.js build errors)
function loadBreezSDK() {
  if (BreezSDK !== null) return BreezSDK;
  
  // Only try to load in browser context
  if (typeof window === 'undefined') return null;
  
  try {
    // Dynamic require only in native Capacitor context
    const { Capacitor } = require('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      BreezSDK = require('@breeztech/react-native-breez-sdk');
      console.log('✅ Breez SDK loaded successfully');
      return BreezSDK;
    }
  } catch (e) {
    // Expected on web - WebLN fallback will be used
    console.log('ℹ️ Breez SDK not available (web mode - using WebLN fallback)');
  }
  
  return null;
}

export class BreezService {
  private static instance: BreezService | null = null;
  private isNative: boolean;
  private isInitialized = false;
  private isConnecting = false;
  private eventListeners: Array<(event: BreezEvent) => void> = [];

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    console.log(`🔌 BreezService initialized (${this.isNative ? 'NATIVE' : 'WEB'} mode)`);
  }

  static getInstance(): BreezService {
    if (!BreezService.instance) {
      BreezService.instance = new BreezService();
    }
    return BreezService.instance;
  }

  /**
   * Check if running on native platform (iOS/Android)
   */
  isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Check if Breez SDK is available and initialized
   */
  isAvailable(): boolean {
    return this.isNative && this.isInitialized;
  }

  /**
   * Initialize and connect to Breez/Greenlight
   * ✅ Only works on native platforms
   */
  async connect(): Promise<void> {
    if (!this.isNative) {
      console.warn('⚠️ Breez SDK only works on native platforms. Use WebLN fallback.');
      return;
    }

    if (this.isInitialized) {
      console.log('✅ Breez SDK already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('⏳ Breez SDK connection in progress...');
      return;
    }

    // Load Breez SDK dynamically
    const SDK = loadBreezSDK();
    if (!SDK) {
      throw new Error('Breez SDK not available');
    }

    this.isConnecting = true;

    try {
      console.log('🔌 Connecting to Breez/Greenlight...');

      // Get Greenlight certificate from environment
      const greenlightCert = process.env.NEXT_PUBLIC_GREENLIGHT_CERT;
      
      if (!greenlightCert) {
        throw new Error('NEXT_PUBLIC_GREENLIGHT_CERT not found in environment');
      }

      // Parse certificate (base64 or PEM format)
      const certBuffer = this.parseCertificate(greenlightCert);

      // Event handler for Breez SDK events
      const onEvent = (breezEvent: BreezEvent) => {
        console.log(`⚡ [Breez Event] ${breezEvent.type}:`, breezEvent.data);
        this.eventListeners.forEach(listener => listener(breezEvent));
      };

      // Configure Greenlight node
      const nodeConfig: NodeConfig = {
        type: 'greenlight',
        config: {
          partnerCredentials: {
            deviceKey: null, // Will be auto-generated on first connect
            deviceCert: certBuffer,
          },
        },
      };

      // Get default config
      const config = await SDK.defaultConfig(
        SDK.EnvironmentType.PRODUCTION,
        process.env.NEXT_PUBLIC_BREEZ_API_KEY || '', // Optional API key
        nodeConfig
      );

      // Set working directory for Breez data
      config.workingDir = `${Capacitor.convertFileSrc('Documents')}/breez`;

      // Connect to Breez SDK
      await SDK.connect(config, null, onEvent);

      this.isInitialized = true;
      this.isConnecting = false;

      console.log('✅ Connected to Breez/Greenlight successfully!');

      // Sync node state
      await this.sync();

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Failed to connect to Breez:', error);
      throw error;
    }
  }

  /**
   * Parse Greenlight certificate from various formats
   */
  private parseCertificate(cert: string): Uint8Array {
    try {
      // Remove PEM headers if present
      const cleanCert = cert
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '');

      // Decode base64
      const binaryString = atob(cleanCert);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return bytes;
    } catch (error) {
      console.error('❌ Failed to parse certificate:', error);
      throw new Error('Invalid certificate format');
    }
  }

  /**
   * Sync node state with Greenlight
   */
  async sync(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Breez SDK not available');
    }

    const SDK = loadBreezSDK();
    if (!SDK) throw new Error('Breez SDK not loaded');

    try {
      console.log('🔄 Syncing with Greenlight...');
      await SDK.sync();
      console.log('✅ Sync completed');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  /**
   * Get Lightning node info and balance
   */
  async getNodeInfo(): Promise<NodeInfo> {
    if (!this.isAvailable()) {
      throw new Error('Breez SDK not available');
    }

    const SDK = loadBreezSDK();
    if (!SDK) throw new Error('Breez SDK not loaded');

    try {
      const nodeInfo = await SDK.nodeInfo();
      console.log('📊 Node info:', nodeInfo);
      return nodeInfo;
    } catch (error) {
      console.error('❌ Failed to get node info:', error);
      throw error;
    }
  }

  /**
   * Get Lightning balance in satoshis
   */
  async getBalance(): Promise<number> {
    if (!this.isAvailable()) {
      // Fallback for web: return 0
      return 0;
    }

    try {
      const nodeInfo = await this.getNodeInfo();
      // Convert millisatoshis to satoshis
      const balanceSats = Math.floor(nodeInfo.onchainBalanceMsat / 1000);
      return balanceSats;
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Create Lightning invoice (receive payment)
   * 
   * @param amountSats - Amount in satoshis
   * @param description - Payment description
   * @returns BOLT11 invoice string
   */
  async createInvoice(amountSats: number, description: string): Promise<string> {
    if (!this.isAvailable()) {
      // Fallback for web: use WebLN if available
      if (typeof window !== 'undefined' && (window as any).webln) {
        try {
          await (window as any).webln.enable();
          const invoice = await (window as any).webln.makeInvoice({
            amount: amountSats,
            defaultMemo: description,
          });
          return invoice.paymentRequest;
        } catch (error) {
          console.error('❌ WebLN invoice creation failed:', error);
          throw new Error('WebLN not available. Please use a Lightning wallet extension like Alby.');
        }
      }
      throw new Error('Lightning not available on web. Use native app or WebLN extension.');
    }

    const SDK = loadBreezSDK();
    if (!SDK) throw new Error('Breez SDK not loaded');

    try {
      console.log(`📥 Creating invoice: ${amountSats} sats - ${description}`);

      const request: ReceivePaymentRequest = {
        amountMsat: amountSats * 1000, // Convert sats to millisats
        description,
      };

      const response: ReceivePaymentResponse = await SDK.receivePayment(request);
      const invoice = response.lnInvoice.bolt11;

      console.log(`✅ Invoice created: ${invoice.substring(0, 20)}...`);
      return invoice;
    } catch (error) {
      console.error('❌ Failed to create invoice:', error);
      throw error;
    }
  }

  /**
   * Pay Lightning invoice (send payment)
   * 
   * @param bolt11 - Lightning invoice (BOLT11 format)
   * @returns Payment response with fee and status
   */
  async payInvoice(bolt11: string): Promise<SendPaymentResponse> {
    if (!this.isAvailable()) {
      // Fallback for web: use WebLN if available
      if (typeof window !== 'undefined' && (window as any).webln) {
        try {
          await (window as any).webln.enable();
          const result = await (window as any).webln.sendPayment(bolt11);
          
          // Convert WebLN response to Breez format
          return {
            payment: {
              id: result.preimage || 'unknown',
              paymentType: 'sent',
              paymentTime: Date.now(),
              amountMsat: 0, // WebLN doesn't provide this
              feeMsat: 0,
              status: 'complete',
            },
          };
        } catch (error) {
          console.error('❌ WebLN payment failed:', error);
          throw new Error('WebLN payment failed. ' + (error as Error).message);
        }
      }
      throw new Error('Lightning not available on web. Use native app or WebLN extension.');
    }

    const SDK = loadBreezSDK();
    if (!SDK) throw new Error('Breez SDK not loaded');

    try {
      console.log(`📤 Paying invoice: ${bolt11.substring(0, 20)}...`);

      const request: SendPaymentRequest = {
        bolt11,
      };

      const response: SendPaymentResponse = await SDK.sendPayment(request);

      console.log(`✅ Payment sent:`, response.payment);
      return response;
    } catch (error) {
      console.error('❌ Failed to pay invoice:', error);
      throw error;
    }
  }

  /**
   * Get payment history
   */
  async listPayments(): Promise<Payment[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const SDK = loadBreezSDK();
    if (!SDK) return [];

    try {
      const payments: Payment[] = await SDK.listPayments({} as ListPaymentsRequest);
      console.log(`📜 Found ${payments.length} payments`);
      return payments;
    } catch (error) {
      console.error('❌ Failed to list payments:', error);
      return [];
    }
  }

  /**
   * Add event listener for Breez SDK events
   */
  addEventListener(listener: (event: BreezEvent) => void): () => void {
    this.eventListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Disconnect from Breez SDK
   */
  async disconnect(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const SDK = loadBreezSDK();
    if (!SDK) return;

    try {
      console.log('🔌 Disconnecting from Breez...');
      await SDK.disconnect();
      this.isInitialized = false;
      console.log('✅ Disconnected from Breez');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const breezService = BreezService.getInstance();

