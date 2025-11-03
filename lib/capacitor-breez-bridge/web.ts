import { WebPlugin } from '@capacitor/core';
import type { BreezBridgePlugin } from './index';

// Web fallback - uses WebLN
export class BreezBridgeWeb extends WebPlugin implements BreezBridgePlugin {
  async connect(options: { certificate: string }): Promise<void> {
    console.log('ℹ️ Breez Bridge (Web): Using WebLN fallback');
    // WebLN doesn't need connection
    return Promise.resolve();
  }

  async getNodeInfo(): Promise<{
    id: string;
    maxPayable: number;
    maxReceivable: number;
    channelsBalanceMsat: number;
  }> {
    throw new Error('WebLN not available. Please install Alby or another Lightning wallet.');
  }

  async createInvoice(options: {
    amountSats: number;
    description?: string;
  }): Promise<{
    bolt11: string;
    paymentHash: string;
  }> {
    // Try WebLN
    if (window.webln) {
      try {
        await window.webln.enable();
        const invoice = await window.webln.makeInvoice({
          amount: options.amountSats,
          defaultMemo: options.description,
        });
        
        // Extract payment hash from bolt11 invoice
        let paymentHash = '';
        try {
          const bolt11Decoder = require('light-bolt11-decoder');
          const decoded = bolt11Decoder.decode(invoice.paymentRequest);
          const paymentHashTag = decoded.sections.find((s: any) => s.name === 'payment_hash');
          paymentHash = paymentHashTag?.value || '';
        } catch (e) {
          console.warn('Could not decode invoice for payment hash');
        }
        
        return {
          bolt11: invoice.paymentRequest,
          paymentHash,
        };
      } catch (error: any) {
        throw new Error(`WebLN failed: ${error.message}`);
      }
    }
    
    throw new Error('WebLN not available. Please install Alby or another Lightning wallet.');
  }

  async payInvoice(options: { bolt11: string }): Promise<{
    paymentHash: string;
    amountSats: number;
  }> {
    // Try WebLN
    if (window.webln) {
      try {
        await window.webln.enable();
        const response = await window.webln.sendPayment(options.bolt11);
        
        return {
          paymentHash: response.preimage || '',
          amountSats: 0, // WebLN doesn't return amount
        };
      } catch (error: any) {
        throw new Error(`WebLN failed: ${error.message}`);
      }
    }
    
    throw new Error('WebLN not available. Please install Alby or another Lightning wallet.');
  }

  async disconnect(): Promise<void> {
    // No-op for WebLN
    return Promise.resolve();
  }
}

