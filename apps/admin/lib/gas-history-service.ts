/**
 * 🔥 BLAZE WALLET - GAS HISTORY SERVICE
 * 
 * Manages historical gas price data
 * - Fetches from Supabase (7-day rolling window)
 * - Records new gas prices every 12 seconds
 * - Provides trend analysis and statistics
 * - Powers AI predictions
 */

import { createClient } from '@supabase/supabase-js';
import { gasPriceService, GasPrice } from './gas-price-service';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface HistoricalGasPoint {
  timestamp: number;
  baseFee: number;
  priorityFee: number;
  gasPrice: number;
  slow: number;
  standard: number;
  fast: number;
  instant: number;
}

export interface GasStatistics {
  current: number;
  avg24h: number;
  min24h: number;
  max24h: number;
  avg7d: number;
  min7d: number;
  max7d: number;
  percentile: number; // Where current gas sits (0-100)
  trend: 'rising' | 'falling' | 'stable';
  volatility: 'low' | 'medium' | 'high';
}

class GasHistoryService {
  /**
   * Get historical gas data for a chain
   */
  async getHistory(chain: string, hours: number = 24): Promise<HistoricalGasPoint[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('gas_history')
        .select('*')
        .eq('chain', chain)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) {
        logger.error(`[Gas History] Supabase error:`, error);
        return [];
      }
      
      return (data || []).map(row => ({
        timestamp: new Date(row.created_at).getTime(),
        baseFee: parseFloat(row.base_fee),
        priorityFee: parseFloat(row.priority_fee),
        gasPrice: parseFloat(row.gas_price),
        slow: parseFloat(row.slow || row.gas_price * 0.8),
        standard: parseFloat(row.standard || row.gas_price),
        fast: parseFloat(row.fast || row.gas_price * 1.2),
        instant: parseFloat(row.instant || row.gas_price * 1.5),
      }));
    } catch (error) {
      logger.error(`[Gas History] Error fetching history:`, error);
      return [];
    }
  }
  
  /**
   * Get gas statistics for a chain
   */
  async getStatistics(chain: string): Promise<GasStatistics> {
    try {
      // Get current gas
      const currentGas = await gasPriceService.getGasPrice(chain);
      
      // Get 24h and 7d data
      const history24h = await this.getHistory(chain, 24);
      const history7d = await this.getHistory(chain, 168);
      
      if (history24h.length === 0) {
        // No historical data, return current as all values
        return {
          current: currentGas.standard,
          avg24h: currentGas.standard,
          min24h: currentGas.slow,
          max24h: currentGas.instant,
          avg7d: currentGas.standard,
          min7d: currentGas.slow,
          max7d: currentGas.instant,
          percentile: 50,
          trend: 'stable',
          volatility: 'medium',
        };
      }
      
      // Calculate 24h stats
      const prices24h = history24h.map(h => h.gasPrice);
      const avg24h = prices24h.reduce((a, b) => a + b, 0) / prices24h.length;
      const min24h = Math.min(...prices24h);
      const max24h = Math.max(...prices24h);
      
      // Calculate 7d stats
      const prices7d = history7d.map(h => h.gasPrice);
      const avg7d = prices7d.length > 0 
        ? prices7d.reduce((a, b) => a + b, 0) / prices7d.length 
        : avg24h;
      const min7d = prices7d.length > 0 ? Math.min(...prices7d) : min24h;
      const max7d = prices7d.length > 0 ? Math.max(...prices7d) : max24h;
      
      // Calculate percentile (where current gas sits)
      const sortedPrices = [...prices24h].sort((a, b) => a - b);
      const percentile = (sortedPrices.filter(p => p <= currentGas.standard).length / sortedPrices.length) * 100;
      
      // Determine trend (compare recent vs older data)
      const recentPrices = prices24h.slice(-12); // Last hour (12 * 5min)
      const olderPrices = prices24h.slice(0, 12); // First hour
      const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
      const trendChange = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      const trend: 'rising' | 'falling' | 'stable' = 
        trendChange > 5 ? 'rising' :
        trendChange < -5 ? 'falling' : 'stable';
      
      // Calculate volatility (coefficient of variation)
      const stdDev = Math.sqrt(
        prices24h.reduce((sum, price) => sum + Math.pow(price - avg24h, 2), 0) / prices24h.length
      );
      const coefficientOfVariation = (stdDev / avg24h) * 100;
      
      const volatility: 'low' | 'medium' | 'high' = 
        coefficientOfVariation < 15 ? 'low' :
        coefficientOfVariation < 30 ? 'medium' : 'high';
      
      return {
        current: currentGas.standard,
        avg24h,
        min24h,
        max24h,
        avg7d,
        min7d,
        max7d,
        percentile,
        trend,
        volatility,
      };
    } catch (error) {
      logger.error(`[Gas History] Error calculating statistics:`, error);
      
      // Fallback: use current gas price
      const currentGas = await gasPriceService.getGasPrice(chain);
      return {
        current: currentGas.standard,
        avg24h: currentGas.standard,
        min24h: currentGas.slow,
        max24h: currentGas.instant,
        avg7d: currentGas.standard,
        min7d: currentGas.slow,
        max7d: currentGas.instant,
        percentile: 50,
        trend: 'stable',
        volatility: 'medium',
      };
    }
  }
  
  /**
   * Record gas price (called by background worker)
   */
  async recordGasPrice(chain: string, gasPrice: GasPrice): Promise<void> {
    try {
      const { error } = await supabase
        .from('gas_history')
        .insert({
          chain,
          base_fee: gasPrice.baseFee,
          priority_fee: gasPrice.maxPriorityFeePerGas,
          gas_price: gasPrice.gasPrice,
          slow: gasPrice.slow,
          standard: gasPrice.standard,
          fast: gasPrice.fast,
          instant: gasPrice.instant,
          block_number: gasPrice.blockNumber,
          source: gasPrice.source,
        });
      
      if (error) {
        logger.error(`[Gas History] Error recording gas price:`, error);
      }
    } catch (error) {
      logger.error(`[Gas History] Error in recordGasPrice:`, error);
    }
  }
  
  /**
   * Get chart data for visualization (downsampled for performance)
   */
  async getChartData(chain: string, hours: number = 24, maxPoints: number = 100): Promise<HistoricalGasPoint[]> {
    const history = await this.getHistory(chain, hours);
    
    if (history.length <= maxPoints) {
      return history;
    }
    
    // Downsample to maxPoints
    const step = Math.floor(history.length / maxPoints);
    return history.filter((_, index) => index % step === 0);
  }
}

export const gasHistoryService = new GasHistoryService();

