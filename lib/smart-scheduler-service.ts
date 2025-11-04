// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER SERVICE
// ============================================================================
// Core service for scheduling transactions at optimal gas times
// ============================================================================

import { gasPriceService } from './gas-price-service';
import { priceService } from './price-service';

export interface ScheduledTransaction {
  id: string;
  user_id: string;
  supabase_user_id?: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address?: string;
  token_symbol?: string;
  scheduled_for?: string;
  optimal_gas_threshold?: number;
  max_wait_hours: number;
  priority: 'low' | 'standard' | 'high' | 'instant';
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  executed_at?: string;
  expires_at?: string;
  estimated_gas_price?: number;
  estimated_gas_cost_usd?: number;
  actual_gas_price?: number;
  actual_gas_cost_usd?: number;
  estimated_savings_usd?: number;
  actual_savings_usd?: number;
  transaction_hash?: string;
  error_message?: string;
  memo?: string;
}

export interface ScheduleOptions {
  user_id: string;
  supabase_user_id?: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address?: string;
  token_symbol?: string;
  schedule_type: 'optimal' | 'specific_time' | 'gas_threshold';
  scheduled_for?: Date;
  optimal_gas_threshold?: number;
  max_wait_hours?: number;
  priority?: 'low' | 'standard' | 'high' | 'instant';
  memo?: string;
}

export interface SavingsStats {
  total_transactions: number;
  scheduled_transactions: number;
  total_savings_usd: number;
  average_savings_per_tx_usd: number;
  best_single_saving_usd: number;
  savings_per_chain: Record<string, number>;
}

class SmartSchedulerService {
  private baseUrl = '/api/smart-scheduler';

  /**
   * Schedule a new transaction
   */
  async scheduleTransaction(options: ScheduleOptions): Promise<ScheduledTransaction> {
    try {
      // Get current gas price for savings estimation
      const currentGasData = await gasPriceService.getGasPrice(options.chain);
      const currentGasPrice = currentGasData?.standard || 0;

      // Calculate current gas cost in USD
      let currentGasCostUSD = 0;
      try {
        const nativePrice = await priceService.getPrice(
          options.chain === 'solana' ? 'solana' : 
          options.chain === 'bitcoin' ? 'bitcoin' : 
          'ethereum'
        );

        if (options.chain === 'solana') {
          currentGasCostUSD = (currentGasPrice * 5000 / 1_000_000_000) * nativePrice;
        } else if (options.chain.includes('bitcoin') || options.chain === 'litecoin' || options.chain === 'dogecoin') {
          currentGasCostUSD = ((currentGasPrice * 250) / 100_000_000) * nativePrice;
        } else {
          // EVM chains
          currentGasCostUSD = ((21000 * currentGasPrice) / 1e9) * nativePrice;
        }
      } catch (e) {
        console.error('Failed to calculate gas cost:', e);
      }

      const response = await fetch(`${this.baseUrl}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          scheduled_for: options.scheduled_for?.toISOString(),
          current_gas_price: currentGasPrice,
          current_gas_cost_usd: currentGasCostUSD,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule transaction');
      }

      return data.data;
    } catch (error: any) {
      console.error('❌ Failed to schedule transaction:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled transactions for a user
   */
  async getScheduledTransactions(
    userId: string,
    chain?: string,
    status: string = 'pending'
  ): Promise<ScheduledTransaction[]> {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        status,
      });

      if (chain) {
        params.append('chain', chain);
      }

      const response = await fetch(`${this.baseUrl}/list?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch scheduled transactions');
      }

      return data.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch scheduled transactions:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled transaction
   */
  async cancelTransaction(transactionId: string, userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel transaction');
      }
    } catch (error: any) {
      console.error('❌ Failed to cancel transaction:', error);
      throw error;
    }
  }

  /**
   * Get savings statistics for a user
   */
  async getSavingsStats(userId: string): Promise<{
    stats: SavingsStats;
    recent_savings: any[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/savings?user_id=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch savings stats');
      }

      return {
        stats: data.stats,
        recent_savings: data.recent_savings,
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch savings stats:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal gas timing for a chain
   * Returns recommended execution time and estimated savings
   */
  async calculateOptimalTiming(chain: string): Promise<{
    optimal_time: Date;
    current_gas_price: number;
    predicted_optimal_gas: number;
    estimated_savings_percent: number;
  }> {
    try {
      const currentGasData = await gasPriceService.getGasPrice(chain);
      const currentGas = currentGasData?.standard || 0;

      // Simple heuristic: optimal time is typically 2-4 hours from now
      // In production, this would use ML/historical data
      const optimalTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
      const predictedOptimalGas = currentGas * 0.7; // Assume 30% lower gas
      const estimatedSavingsPercent = 30;

      return {
        optimal_time: optimalTime,
        current_gas_price: currentGas,
        predicted_optimal_gas: predictedOptimalGas,
        estimated_savings_percent: estimatedSavingsPercent,
      };
    } catch (error) {
      console.error('❌ Failed to calculate optimal timing:', error);
      throw error;
    }
  }

  /**
   * Format gas price for display
   */
  formatGasPrice(gasPrice: number, chain: string): string {
    if (chain === 'solana') {
      return `${(gasPrice / 1_000_000).toFixed(2)} microlamports`;
    } else if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin') {
      return `${gasPrice.toFixed(0)} sat/vB`;
    } else {
      // EVM chains
      return `${gasPrice.toFixed(2)} gwei`;
    }
  }

  /**
   * Estimate transaction cost in USD
   */
  async estimateTransactionCost(
    chain: string,
    gasPrice: number
  ): Promise<number> {
    try {
      const nativePrice = await priceService.getPrice(
        chain === 'solana' ? 'solana' :
        chain === 'bitcoin' ? 'bitcoin' :
        'ethereum'
      );

      if (chain === 'solana') {
        return (gasPrice * 5000 / 1_000_000_000) * nativePrice;
      } else if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin') {
        return ((gasPrice * 250) / 100_000_000) * nativePrice;
      } else {
        // EVM chains
        return ((21000 * gasPrice) / 1e9) * nativePrice;
      }
    } catch (error) {
      console.error('❌ Failed to estimate transaction cost:', error);
      return 0;
    }
  }
}

export const smartSchedulerService = new SmartSchedulerService();

