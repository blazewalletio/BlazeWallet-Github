/**
 * 🔗 BLOCKCHAIR API SERVICE
 * 
 * Provides UTXO fetching, transaction history, and broadcasting
 * for Bitcoin-like chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash)
 * 
 * API Documentation: https://blockchair.com/api/docs
 * Rate Limits: 10,000 requests/day (free tier)
 */

import { logger } from '@/lib/logger';

export interface UTXO {
  transaction_hash: string;
  index: number;
  value: number; // satoshis
  script_hex: string;
  block_id: number;
  confirmations?: number;
}

export interface AddressInfo {
  balance: number; // satoshis
  received: number;
  spent: number;
  unspent_output_count: number;
  transaction_count: number;
}

export interface FeeRecommendation {
  fastest: number; // sat/byte
  fast: number;
  medium: number;
  slow: number;
}

export interface BroadcastResult {
  success: boolean;
  transaction_hash?: string;
  error?: string;
}

class BlockchairService {
  private baseUrl = 'https://api.blockchair.com';
  private apiKey?: string; // Optional for paid tier
  
  constructor() {
    this.apiKey = process.env.BLOCKCHAIR_API_KEY;
  }

  /**
   * Get address information and UTXOs with fallback to alternative APIs
   */
  async getAddressData(chain: string, address: string): Promise<{
    info: AddressInfo;
    utxos: UTXO[];
  }> {
    // Try Blockchair first
    try {
      return await this.getAddressDataFromBlockchair(chain, address);
    } catch (error: any) {
      logger.warn(`⚠️ [Blockchair] Primary API failed, trying fallback: ${error.message}`);
      
      // Fallback to alternative APIs
      if (chain.toLowerCase() === 'bitcoin') {
        try {
          return await this.getAddressDataFromBlockstream(chain, address);
        } catch (fallbackError: any) {
          logger.warn(`⚠️ [Blockstream] Fallback also failed: ${fallbackError.message}`);
        }
      }
      
      // If all fallbacks fail, throw original error
      throw error;
    }
  }

  /**
   * Get address data from Blockchair (primary)
   */
  private async getAddressDataFromBlockchair(chain: string, address: string): Promise<{
    info: AddressInfo;
    utxos: UTXO[];
  }> {
    const chainName = this.getChainName(chain);
    const url = `${this.baseUrl}/${chainName}/dashboards/address/${address}`;
    
    logger.log(`🔍 [Blockchair] Fetching address data for ${address} on ${chainName}`);
    
    const params = new URLSearchParams();
    if (this.apiKey) {
      params.append('key', this.apiKey);
    }
    
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const addressData = data.data[address];

    if (!addressData) {
      throw new Error('Address not found in response');
    }

    const info: AddressInfo = {
      balance: addressData.address.balance || 0,
      received: addressData.address.received || 0,
      spent: addressData.address.spent || 0,
      unspent_output_count: addressData.address.unspent_output_count || 0,
      transaction_count: addressData.address.transaction_count || 0,
    };

    const utxos: UTXO[] = (addressData.utxo || []).map((utxo: any) => ({
      transaction_hash: utxo.transaction_hash,
      index: utxo.index,
      value: utxo.value,
      script_hex: utxo.script_hex,
      block_id: utxo.block_id,
      confirmations: data.context?.state ? 
        data.context.state - utxo.block_id + 1 : undefined,
    }));

    logger.log(`✅ [Blockchair] Found ${utxos.length} UTXOs for ${address}`);
    logger.log(`💰 [Blockchair] Balance: ${info.balance} satoshis`);

    return { info, utxos };
  }

  /**
   * Get address data from Blockstream API (fallback for Bitcoin)
   */
  private async getAddressDataFromBlockstream(chain: string, address: string): Promise<{
    info: AddressInfo;
    utxos: UTXO[];
  }> {
    if (chain.toLowerCase() !== 'bitcoin') {
      throw new Error('Blockstream API only supports Bitcoin');
    }

    logger.log(`🔍 [Blockstream] Fetching address data for ${address} (fallback)`);
    
    // Blockstream API endpoint
    const url = `https://blockstream.info/api/address/${address}/utxo`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const utxoData = await response.json();
    
    // Get address info from summary endpoint
    const summaryUrl = `https://blockstream.info/api/address/${address}`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    let balance = 0;
    if (summaryResponse.ok) {
      const summary = await summaryResponse.json();
      balance = summary.chain_stats?.funded_txo_sum || 0;
    }

    // Get current block height once (for confirmations calculation)
    const currentBlockHeight = await this.getCurrentBlockHeight();

    // Convert Blockstream format to our UTXO format
    const utxos: UTXO[] = utxoData.map((utxo: any) => ({
      transaction_hash: utxo.txid,
      index: utxo.vout,
      value: utxo.value,
      script_hex: '', // Blockstream doesn't provide script_hex in UTXO endpoint
      block_id: utxo.status?.block_height || 0,
      confirmations: utxo.status?.block_height ? 
        currentBlockHeight - utxo.status.block_height + 1 : 0,
    }));

    // Calculate balance from UTXOs if summary failed
    if (balance === 0) {
      balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    }

    const info: AddressInfo = {
      balance,
      received: balance, // Approximate
      spent: 0, // Not available from Blockstream UTXO endpoint
      unspent_output_count: utxos.length,
      transaction_count: 0, // Not available
    };

    logger.log(`✅ [Blockstream] Found ${utxos.length} UTXOs for ${address} (fallback)`);
    logger.log(`💰 [Blockstream] Balance: ${info.balance} satoshis`);

    return { info, utxos };
  }

  /**
   * Get current block height (for confirmations calculation)
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await fetch('https://blockstream.info/api/blocks/tip/height', {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return parseInt(await response.text());
      }
    } catch (error) {
      logger.warn('⚠️ Failed to get block height from Blockstream');
    }
    return 0; // Fallback
  }

  /**
   * Get current fee recommendations
   */
  async getFeeRecommendations(chain: string): Promise<FeeRecommendation> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/stats`;
      
      logger.log(`🔍 [Blockchair] Fetching fee recommendations for ${chainName}`);
      
      const params = new URLSearchParams();
      if (this.apiKey) {
        params.append('key', this.apiKey);
      }
      
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const stats = data.data;

      // Blockchair provides suggested fee per byte
      const suggestedFee = stats.suggested_transaction_fee_per_byte_sat || 10;

      const fees: FeeRecommendation = {
        fastest: Math.ceil(suggestedFee * 2), // 2x for fastest
        fast: Math.ceil(suggestedFee * 1.5), // 1.5x for fast
        medium: suggestedFee, // Base recommendation
        slow: Math.max(1, Math.ceil(suggestedFee * 0.5)), // 0.5x for slow, min 1
      };

      logger.log(`✅ [Blockchair] Fee recommendations:`, fees);

      return fees;

    } catch (error) {
      logger.error(`❌ [Blockchair] Error fetching fees:`, error);
      
      // Fallback fees per chain
      const fallbackFees: Record<string, FeeRecommendation> = {
        bitcoin: { fastest: 100, fast: 50, medium: 20, slow: 5 },
        litecoin: { fastest: 50, fast: 20, medium: 10, slow: 2 },
        dogecoin: { fastest: 1000, fast: 500, medium: 200, slow: 100 },
        bitcoincash: { fastest: 5, fast: 3, medium: 2, slow: 1 },
      };

      return fallbackFees[chain] || fallbackFees.bitcoin;
    }
  }

  /**
   * Broadcast signed transaction with fallback to alternative APIs
   */
  async broadcastTransaction(chain: string, rawTxHex: string): Promise<BroadcastResult> {
    // Try Blockchair first
    const blockchairResult = await this.broadcastTransactionToBlockchair(chain, rawTxHex);
    if (blockchairResult.success) {
      return blockchairResult;
    }

    logger.warn(`⚠️ [Blockchair] Broadcast failed, trying fallback: ${blockchairResult.error}`);
    
    // Fallback to alternative APIs
    if (chain.toLowerCase() === 'bitcoin') {
      const blockstreamResult = await this.broadcastTransactionToBlockstream(chain, rawTxHex);
      if (blockstreamResult.success) {
        return blockstreamResult;
      }
      
      // Try Mempool.space as second fallback
      const mempoolResult = await this.broadcastTransactionToMempool(chain, rawTxHex);
      if (mempoolResult.success) {
        return mempoolResult;
      }
    }
    
    // If all fallbacks fail, return original error
    return blockchairResult;
  }

  /**
   * Broadcast transaction to Blockchair (primary)
   */
  private async broadcastTransactionToBlockchair(chain: string, rawTxHex: string): Promise<BroadcastResult> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/push/transaction`;
      
      logger.log(`📡 [Blockchair] Broadcasting transaction on ${chainName}`);
      
      const params = new URLSearchParams();
      if (this.apiKey) {
        params.append('key', this.apiKey);
      }
      
      const response = await fetch(`${url}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: rawTxHex,
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      const data = await response.json();

      if (!response.ok || data.context?.error) {
        throw new Error(data.context?.error || `HTTP ${response.status}`);
      }

      const txHash = data.data?.transaction_hash;

      if (!txHash) {
        throw new Error('No transaction hash in response');
      }

      logger.log(`✅ [Blockchair] Transaction broadcast successful: ${txHash}`);

      return {
        success: true,
        transaction_hash: txHash,
      };

    } catch (error: any) {
      logger.error(`❌ [Blockchair] Broadcast error:`, error);
      return {
        success: false,
        error: error.message || 'Broadcast failed',
      };
    }
  }

  /**
   * Broadcast transaction to Blockstream API (fallback for Bitcoin)
   */
  private async broadcastTransactionToBlockstream(chain: string, rawTxHex: string): Promise<BroadcastResult> {
    if (chain.toLowerCase() !== 'bitcoin') {
      return { success: false, error: 'Blockstream API only supports Bitcoin' };
    }

    try {
      logger.log(`📡 [Blockstream] Broadcasting transaction (fallback)`);
      
      const url = 'https://blockstream.info/api/tx';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: rawTxHex,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const txHash = await response.text();
      
      logger.log(`✅ [Blockstream] Transaction broadcast successful: ${txHash}`);

      return {
        success: true,
        transaction_hash: txHash.trim(),
      };

    } catch (error: any) {
      logger.error(`❌ [Blockstream] Broadcast error:`, error);
      return {
        success: false,
        error: error.message || 'Broadcast failed',
      };
    }
  }

  /**
   * Broadcast transaction to Mempool.space API (fallback for Bitcoin)
   */
  private async broadcastTransactionToMempool(chain: string, rawTxHex: string): Promise<BroadcastResult> {
    if (chain.toLowerCase() !== 'bitcoin') {
      return { success: false, error: 'Mempool.space API only supports Bitcoin' };
    }

    try {
      logger.log(`📡 [Mempool.space] Broadcasting transaction (fallback)`);
      
      const url = 'https://mempool.space/api/tx';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: rawTxHex,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const txHash = await response.text();
      
      logger.log(`✅ [Mempool.space] Transaction broadcast successful: ${txHash}`);

      return {
        success: true,
        transaction_hash: txHash.trim(),
      };

    } catch (error: any) {
      logger.error(`❌ [Mempool.space] Broadcast error:`, error);
      return {
        success: false,
        error: error.message || 'Broadcast failed',
      };
    }
  }

  /**
   * Get transaction history for address
   */
  async getTransactionHistory(chain: string, address: string, limit: number = 50): Promise<any[]> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/dashboards/address/${address}`;
      
      logger.log(`🔍 [Blockchair] Fetching transaction history for ${address}`);
      
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', '0');
      if (this.apiKey) {
        params.append('key', this.apiKey);
      }
      
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const addressData = data.data[address];

      if (!addressData || !addressData.transactions) {
        return [];
      }

      const transactions = addressData.transactions.map((tx: any) => ({
        hash: tx.hash,
        time: tx.time,
        balance_change: tx.balance_change,
        block_id: tx.block_id,
      }));

      logger.log(`✅ [Blockchair] Found ${transactions.length} transactions`);

      return transactions;

    } catch (error) {
      logger.error(`❌ [Blockchair] Error fetching transaction history:`, error);
      return [];
    }
  }

  /**
   * Map internal chain name to Blockchair chain name
   */
  private getChainName(chain: string): string {
    const mapping: Record<string, string> = {
      bitcoin: 'bitcoin',
      litecoin: 'litecoin',
      dogecoin: 'dogecoin',
      bitcoincash: 'bitcoin-cash',
    };

    return mapping[chain.toLowerCase()] || 'bitcoin';
  }

  /**
   * Estimate transaction size in bytes (for fee calculation)
   * This is a rough estimate - actual size depends on script types
   */
  estimateTransactionSize(inputCount: number, outputCount: number, isSegwit: boolean = true): number {
    if (isSegwit) {
      // SegWit transaction (P2WPKH)
      const inputSize = 68; // ~68 vBytes per input
      const outputSize = 31; // ~31 vBytes per output
      const overhead = 10.5; // Base transaction overhead
      
      return Math.ceil((inputCount * inputSize) + (outputCount * outputSize) + overhead);
    } else {
      // Legacy transaction (P2PKH)
      const inputSize = 148; // ~148 bytes per input
      const outputSize = 34; // ~34 bytes per output
      const overhead = 10;
      
      return (inputCount * inputSize) + (outputCount * outputSize) + overhead;
    }
  }

  /**
   * Calculate fee for transaction
   */
  calculateFee(txSize: number, feePerByte: number): number {
    return Math.ceil(txSize * feePerByte);
  }
}

// Singleton instance
export const blockchairService = new BlockchairService();

