import { registerPlugin } from '@capacitor/core';
import { logger } from '@/lib/logger';

export interface BreezBridgePlugin {
  /**
   * Connect to Breez SDK with Greenlight certificate
   */
  connect(options: { certificate: string }): Promise<void>;
  
  /**
   * Get Lightning node information
   */
  getNodeInfo(): Promise<{
    id: string;
    maxPayable: number;
    maxReceivable: number;
    channelsBalanceMsat: number;
  }>;
  
  /**
   * Create a Lightning invoice
   */
  createInvoice(options: {
    amountSats: number;
    description?: string;
  }): Promise<{
    bolt11: string;
    paymentHash: string;
  }>;
  
  /**
   * Pay a Lightning invoice
   */
  payInvoice(options: { bolt11: string }): Promise<{
    paymentHash: string;
    amountSats: number;
  }>;
  
  /**
   * Disconnect from Breez SDK
   */
  disconnect(): Promise<void>;
}

const BreezBridge = registerPlugin<BreezBridgePlugin>('BreezBridge', {
  web: () => import('./web').then(m => new m.BreezBridgeWeb()),
});

export default BreezBridge;

