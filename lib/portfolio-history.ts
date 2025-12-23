// Portfolio history tracking - stores real balance snapshots over time
import { logger } from '@/lib/logger';

export interface BalanceSnapshot {
  timestamp: number;
  balance: number; // in USD
  address: string;
  chain: string;
}

const STORAGE_KEY = 'arc_portfolio_history';
const MAX_SNAPSHOTS = 100; // Keep last 100 data points
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // Save snapshot every 5 minutes

export class PortfolioHistory {
  private snapshots: BalanceSnapshot[] = [];

  constructor() {
    this.loadFromStorage();
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

  // Add a new balance snapshot
  addSnapshot(balance: number, address: string, chain: string) {
    const now = Date.now();
    
    // Check if we should add a new snapshot (avoid too frequent updates)
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (lastSnapshot && now - lastSnapshot.timestamp < SNAPSHOT_INTERVAL) {
      // Update the last snapshot instead of creating a new one
      lastSnapshot.balance = balance;
      lastSnapshot.timestamp = now;
    } else {
      // Add new snapshot
      this.snapshots.push({
        timestamp: now,
        balance,
        address,
        chain,
      });
    }

    // Keep only the last MAX_SNAPSHOTS
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }

    this.saveToStorage();
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




