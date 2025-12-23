// Portfolio history tracking - stores real balance snapshots over time
// Hybrid approach: localStorage (fast) + Supabase (multi-device sync)
import { logger } from '@/lib/logger';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface BalanceSnapshot {
  timestamp: number;
  balance: number; // in USD
  address: string;
  chain: string;
}

const STORAGE_KEY = 'arc_portfolio_history';
const MAX_SNAPSHOTS = 100; // Keep last 100 data points

// Smart snapshot intervals (like Bitvavo)
const SNAPSHOT_INTERVALS: Record<string, number> = {
  LIVE: 30 * 1000,           // 30 seconds (last 30 min)
  '1D': 60 * 60 * 1000,      // 1 hour (24 points)
  '7D': 6 * 60 * 60 * 1000,  // 6 hours (28 points)
  '30D': 24 * 60 * 60 * 1000, // 1 day (30 points)
  '1J': 7 * 24 * 60 * 60 * 1000, // 1 week (52 points)
  'ALLES': 7 * 24 * 60 * 60 * 1000, // 1 week (for long-term)
};

// Default interval (if timeframe not specified)
const DEFAULT_SNAPSHOT_INTERVAL = 60 * 60 * 1000; // 1 hour

export class PortfolioHistory {
  private snapshots: BalanceSnapshot[] = [];
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;
  private isSyncing: boolean = false;

  constructor() {
    // Initialize Supabase if available
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        // Get user ID from localStorage
        this.userId = localStorage.getItem('supabase_user_id');
      }
    }
    
    // Load from localStorage first (fast, for instant display)
    this.loadFromStorage();
    
    // Then sync from Supabase in background (if logged in)
    if (this.supabase && this.userId) {
      this.syncFromSupabase();
    }
  }

  // Load history from localStorage
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.snapshots = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading portfolio history:', error);
      this.snapshots = [];
    }
  }

  // Save history to localStorage
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots));
    } catch (error) {
      logger.error('Error saving portfolio history:', error);
    }
  }

  // Check if we should take a snapshot based on timeframe
  private shouldTakeSnapshot(
    lastSnapshotTime: number,
    timeframe?: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'
  ): boolean {
    if (!timeframe) {
      // Default: 1 hour interval
      return Date.now() - lastSnapshotTime >= DEFAULT_SNAPSHOT_INTERVAL;
    }
    
    const interval = SNAPSHOT_INTERVALS[timeframe] || DEFAULT_SNAPSHOT_INTERVAL;
    return Date.now() - lastSnapshotTime >= interval;
  }

  // Add a new balance snapshot (hybrid: localStorage + Supabase)
  async addSnapshot(
    balance: number, 
    address: string, 
    chain: string,
    timeframe?: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES'
  ) {
    const now = Date.now();
    
    // Check if we should take a snapshot (smart intervals)
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (lastSnapshot && this.shouldTakeSnapshot(lastSnapshot.timestamp, timeframe)) {
      // Update last snapshot instead of creating new one (if within interval)
      if (lastSnapshot.address === address && lastSnapshot.chain === chain) {
        lastSnapshot.balance = balance;
        lastSnapshot.timestamp = now;
        this.saveToStorage();
        // Update in Supabase (background)
        if (this.supabase && this.userId) {
          this.updateLastSnapshotInSupabase(lastSnapshot);
        }
        return;
      }
    }
    
    // Create new snapshot
    const snapshot: BalanceSnapshot = {
      timestamp: now,
      balance,
      address,
      chain,
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only last MAX_SNAPSHOTS
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }
    
    // Save to localStorage (fast, for instant display)
    this.saveToStorage();
    
    // Save to Supabase (background, for multi-device sync)
    if (this.supabase && this.userId) {
      this.saveSnapshotToSupabase(snapshot);
    }
  }

  // Sync from Supabase (background, for multi-device sync)
  private async syncFromSupabase() {
    if (!this.supabase || !this.userId || this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      const { data, error } = await this.supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', this.userId)
        .order('snapshot_at', { ascending: false })
        .limit(MAX_SNAPSHOTS);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Convert Supabase format to BalanceSnapshot
        const supabaseSnapshots = data.map(s => ({
          timestamp: new Date(s.snapshot_at).getTime(),
          balance: parseFloat(s.balance_usd),
          address: s.address,
          chain: s.chain,
        }));
        
        // Merge with localStorage snapshots (keep most recent)
        const merged = [...this.snapshots, ...supabaseSnapshots]
          .sort((a, b) => b.timestamp - a.timestamp)
          .filter((snapshot, index, self) => 
            index === self.findIndex(s => 
              s.timestamp === snapshot.timestamp && 
              s.address === snapshot.address && 
              s.chain === snapshot.chain
            )
          )
          .slice(0, MAX_SNAPSHOTS);
        
        this.snapshots = merged;
        this.saveToStorage();
        
        logger.log(`✅ Synced ${supabaseSnapshots.length} snapshots from Supabase`);
      }
    } catch (error) {
      logger.error('Error syncing from Supabase:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Save snapshot to Supabase (background, non-blocking)
  private async saveSnapshotToSupabase(snapshot: BalanceSnapshot) {
    if (!this.supabase || !this.userId) return;
    
    // Don't await - fire and forget for performance
    this.supabase
      .from('portfolio_snapshots')
      .insert({
        user_id: this.userId,
        balance_usd: snapshot.balance,
        address: snapshot.address,
        chain: snapshot.chain,
        snapshot_at: new Date(snapshot.timestamp).toISOString(),
      })
      .then(() => {
        logger.log(`✅ Saved snapshot to Supabase: $${snapshot.balance.toFixed(2)}`);
      })
      .catch((error) => {
        logger.error('Error saving snapshot to Supabase:', error);
        // Don't throw - localStorage is primary, Supabase is sync
      });
  }

  // Update last snapshot in Supabase
  private async updateLastSnapshotInSupabase(snapshot: BalanceSnapshot) {
    if (!this.supabase || !this.userId) return;
    
    // Find and update the most recent snapshot for this address/chain
    this.supabase
      .from('portfolio_snapshots')
      .update({
        balance_usd: snapshot.balance,
        snapshot_at: new Date(snapshot.timestamp).toISOString(),
      })
      .eq('user_id', this.userId)
      .eq('address', snapshot.address)
      .eq('chain', snapshot.chain)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .then(() => {
        logger.log(`✅ Updated snapshot in Supabase`);
      })
      .catch((error) => {
        logger.error('Error updating snapshot in Supabase:', error);
      });
  }

  // Get snapshots within a specific time range (optionally filtered by chain and address)
  getSnapshotsInRange(hours: number | null = null, chain?: string, address?: string): BalanceSnapshot[] {
    if (this.snapshots.length === 0) {
      return [];
    }

    // Filter by chain and address if provided
    let filtered = this.snapshots;
    if (chain) {
      filtered = filtered.filter(s => s.chain === chain);
    }
    if (address) {
      filtered = filtered.filter(s => s.address === address);
    }

    // If null, return all filtered snapshots
    if (hours === null) {
      return filtered;
    }

    const now = Date.now();
    const cutoffTime = now - (hours * 60 * 60 * 1000);

    // Filter snapshots within the time range
    const timeFiltered = filtered.filter(s => s.timestamp >= cutoffTime);

    return timeFiltered.length > 0 ? timeFiltered : filtered;
  }

  // Get recent snapshots for chart (last N points from a time range, optionally filtered by chain and address)
  getRecentSnapshots(count: number = 20, hours: number | null = null, chain?: string, address?: string): BalanceSnapshot[] {
    const rangeSnapshots = this.getSnapshotsInRange(hours, chain, address);
    
    if (rangeSnapshots.length === 0) {
      return [];
    }

    // If we have fewer snapshots than requested, return all
    if (rangeSnapshots.length <= count) {
      return rangeSnapshots;
    }

    // Return evenly distributed snapshots across the range
    const step = Math.floor(rangeSnapshots.length / count);
    const result: BalanceSnapshot[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = Math.min(i * step, rangeSnapshots.length - 1);
      result.push(rangeSnapshots[index]);
    }

    return result;
  }

  // Get the change percentage over a specific time range (optionally filtered by chain and address)
  getChangePercentage(hours: number | null = null, chain?: string, address?: string): number {
    const rangeSnapshots = this.getSnapshotsInRange(hours, chain, address);
    
    if (rangeSnapshots.length < 2) {
      return 0;
    }

    const first = rangeSnapshots[0].balance;
    const last = rangeSnapshots[rangeSnapshots.length - 1].balance;

    if (first === 0) return 0;

    return ((last - first) / first) * 100;
  }

  // Get change in absolute value over a specific time range (optionally filtered by chain and address)
  getChangeValue(hours: number | null = null, chain?: string, address?: string): number {
    const rangeSnapshots = this.getSnapshotsInRange(hours, chain, address);
    
    if (rangeSnapshots.length < 2) {
      return 0;
    }

    const first = rangeSnapshots[0].balance;
    const last = rangeSnapshots[rangeSnapshots.length - 1].balance;

    return last - first;
  }

  // Clear all history (useful for testing or reset)
  clear() {
    this.snapshots = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // Get total number of snapshots
  getSnapshotCount(): number {
    return this.snapshots.length;
  }
}

// Singleton instance
let portfolioHistoryInstance: PortfolioHistory | null = null;

export function getPortfolioHistory(): PortfolioHistory {
  if (!portfolioHistoryInstance) {
    portfolioHistoryInstance = new PortfolioHistory();
  }
  return portfolioHistoryInstance;
}




