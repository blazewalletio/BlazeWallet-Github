/**
 * 📋 BITCOIN TRANSACTION HISTORY SERVICE
 * 
 * Fetches transaction history for Bitcoin-like chains
 * Uses Blockchair API for comprehensive transaction data
 */

import { blockchairService } from './blockchair-service';

export interface BitcoinTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  isError: boolean;
  tokenSymbol?: string;
  tokenName?: string;
  type?: string;
}

class BitcoinHistoryService {
  /**
   * Get transaction history for Bitcoin-like address
   */
  async getTransactionHistory(
    chain: string,
    address: string,
    limit: number = 50
  ): Promise<BitcoinTransaction[]> {
    try {
      console.log(`📋 [Bitcoin History] Fetching history for ${address} on ${chain}`);
      
      const txHistory = await blockchairService.getTransactionHistory(chain, address, limit);
      
      // Transform Blockchair format to our format
      const transactions: BitcoinTransaction[] = txHistory.map((tx: any) => {
        const isSent = tx.balance_change < 0;
        
        return {
          hash: tx.hash,
          from: isSent ? address : 'Unknown', // Blockchair doesn't provide full details
          to: isSent ? 'Unknown' : address,
          value: Math.abs(tx.balance_change / 1e8).toString(), // Convert satoshis to BTC
          timestamp: new Date(tx.time).getTime(),
          isError: false,
          tokenSymbol: this.getChainSymbol(chain),
          tokenName: this.getChainName(chain),
          type: isSent ? 'Sent' : 'Received',
        };
      });
      
      console.log(`✅ [Bitcoin History] Found ${transactions.length} transactions`);
      
      return transactions;
      
    } catch (error) {
      console.error(`❌ [Bitcoin History] Error fetching history:`, error);
      return [];
    }
  }
  
  /**
   * Get chain native currency symbol
   */
  private getChainSymbol(chain: string): string {
    const symbols: Record<string, string> = {
      bitcoin: 'BTC',
      litecoin: 'LTC',
      dogecoin: 'DOGE',
      bitcoincash: 'BCH',
    };
    
    return symbols[chain.toLowerCase()] || 'BTC';
  }
  
  /**
   * Get chain native currency name
   */
  private getChainName(chain: string): string {
    const names: Record<string, string> = {
      bitcoin: 'Bitcoin',
      litecoin: 'Litecoin',
      dogecoin: 'Dogecoin',
      bitcoincash: 'Bitcoin Cash',
    };
    
    return names[chain.toLowerCase()] || 'Bitcoin';
  }
}

export const bitcoinHistoryService = new BitcoinHistoryService();

