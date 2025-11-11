/**
 * 🔗 BLOCKCHAIR API SERVICE
 * 
 * Provides UTXO fetching, transaction history, and broadcasting
 * for Bitcoin-like chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash)
 * 
 * API Documentation: https://blockchair.com/api/docs
 * Rate Limits: 10,000 requests/day (free tier)
 */

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
   * Get address information and UTXOs
   */
  async getAddressData(chain: string, address: string): Promise<{
    info: AddressInfo;
    utxos: UTXO[];
  }> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/dashboards/address/${address}`;
      
      console.log(`🔍 [Blockchair] Fetching address data for ${address} on ${chainName}`);
      
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

      console.log(`✅ [Blockchair] Found ${utxos.length} UTXOs for ${address}`);
      console.log(`💰 [Blockchair] Balance: ${info.balance} satoshis`);

      return { info, utxos };

    } catch (error) {
      console.error(`❌ [Blockchair] Error fetching address data:`, error);
      throw error;
    }
  }

  /**
   * Get current fee recommendations
   */
  async getFeeRecommendations(chain: string): Promise<FeeRecommendation> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/stats`;
      
      console.log(`🔍 [Blockchair] Fetching fee recommendations for ${chainName}`);
      
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

      console.log(`✅ [Blockchair] Fee recommendations:`, fees);

      return fees;

    } catch (error) {
      console.error(`❌ [Blockchair] Error fetching fees:`, error);
      
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
   * Broadcast signed transaction
   */
  async broadcastTransaction(chain: string, rawTxHex: string): Promise<BroadcastResult> {
    try {
      const chainName = this.getChainName(chain);
      const url = `${this.baseUrl}/${chainName}/push/transaction`;
      
      console.log(`📡 [Blockchair] Broadcasting transaction on ${chainName}`);
      
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

      console.log(`✅ [Blockchair] Transaction broadcast successful: ${txHash}`);

      return {
        success: true,
        transaction_hash: txHash,
      };

    } catch (error: any) {
      console.error(`❌ [Blockchair] Broadcast error:`, error);
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
      
      console.log(`🔍 [Blockchair] Fetching transaction history for ${address}`);
      
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

      console.log(`✅ [Blockchair] Found ${transactions.length} transactions`);

      return transactions;

    } catch (error) {
      console.error(`❌ [Blockchair] Error fetching transaction history:`, error);
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

