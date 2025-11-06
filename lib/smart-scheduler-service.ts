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

      // Get supabase_user_id from localStorage if available
      const supabaseUserId = typeof window !== 'undefined' 
        ? localStorage.getItem('supabase_user_id') 
        : null;

      const response = await fetch(`${this.baseUrl}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          supabase_user_id: supabaseUserId || undefined,
          scheduled_for: options.scheduled_for?.toISOString(),
          current_gas_price: currentGasPrice,
          current_gas_cost_usd: currentGasCostUSD,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Schedule transaction error:', data);
        throw new Error(data.error || 'Failed to create scheduled transaction');
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
   * Calculate optimal gas timing for a chain using AI + historical data
   * Returns recommended execution time and estimated savings
   * Only recommends if 95%+ confident
   */
  async calculateOptimalTiming(chain: string, maxWaitHours: number = 24): Promise<{
    optimal_time: Date;
    current_gas_price: number;
    predicted_optimal_gas: number;
    estimated_savings_percent: number;
    estimated_savings_usd: number;
    confidence_score: number;
    reasoning: string;
    should_execute_now: boolean;
    alternative_times?: Array<{
      time: Date;
      gas_price: number;
      savings_percent: number;
    }>;
  }> {
    try {
      // Get current gas price
      const currentGasData = await gasPriceService.getGasPrice(chain);
      const currentGas = currentGasData?.standard || 0;

      if (!currentGas) {
        throw new Error('Failed to fetch current gas price');
      }

      console.log('🤖 Requesting AI prediction for', chain, 'current gas:', currentGas);

      // Call AI prediction API
      const response = await fetch('/api/smart-scheduler/predict-optimal-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          current_gas_price: currentGas,
          max_wait_hours: maxWaitHours,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ AI prediction failed:', data);
        throw new Error(data.error || 'Failed to predict optimal time');
      }

      const prediction = data.data;

      console.log('✅ AI prediction received:', {
        optimal_time: prediction.optimal_time,
        confidence: prediction.confidence_score,
        savings: prediction.estimated_savings_percent,
      });

      // Check if we should execute now (low confidence or current gas is already optimal)
      const should_execute_now = prediction.confidence_score < 95 || 
                                   prediction.estimated_savings_percent < 5;

      return {
        optimal_time: new Date(prediction.optimal_time),
        current_gas_price: currentGas,
        predicted_optimal_gas: prediction.predicted_gas_price,
        estimated_savings_percent: prediction.estimated_savings_percent,
        estimated_savings_usd: prediction.estimated_savings_usd,
        confidence_score: prediction.confidence_score,
        reasoning: prediction.reasoning,
        should_execute_now,
        alternative_times: prediction.alternative_times?.map((alt: any) => ({
          time: new Date(alt.time),
          gas_price: alt.gas_price,
          savings_percent: alt.savings_percent,
        })),
      };
    } catch (error) {
      console.error('❌ Failed to calculate optimal timing:', error);
      
      // Fallback: recommend executing now if prediction fails
      const currentGasData = await gasPriceService.getGasPrice(chain);
      const currentGas = currentGasData?.standard || 0;
      
      return {
        optimal_time: new Date(),
        current_gas_price: currentGas,
        predicted_optimal_gas: currentGas,
        estimated_savings_percent: 0,
        estimated_savings_usd: 0,
        confidence_score: 0,
        reasoning: 'Unable to predict optimal time. Recommend executing now.',
        should_execute_now: true,
      };
    }
  }

  /**
   * Format gas price for display
   */
  formatGasPrice(gasPrice: number, chain: string): string {
    if (chain === 'solana') {
      return `${gasPrice.toFixed(0)} lamports`;
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

