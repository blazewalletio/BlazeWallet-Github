/**
 * 📥 Incoming Transaction Monitor
 * 
 * Monitors wallet addresses for incoming transactions and logs analytics.
 * - Runs periodically when wallet is active
 * - Detects new incoming funds
 * - Logs analytics for received transactions
 * - Privacy-first: only tracks metadata
 */

import { logger } from '@/lib/logger';
import { logTransactionEvent } from '@/lib/analytics-tracker';
import { MultiChainService } from '@/lib/multi-chain-service';
import { CHAINS } from '@/lib/chains';

interface LastSeenTransaction {
  chain: string;
  address: string;
  txHash: string;
  timestamp: number;
}

export class IncomingTransactionMonitor {
  private static instance: IncomingTransactionMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastSeenTxs: Map<string, LastSeenTransaction> = new Map();
  private isMonitoring: boolean = false;
  private CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

  // Singleton pattern
  static getInstance(): IncomingTransactionMonitor {
    if (typeof window === 'undefined') {
      // Server-side: return dummy instance
      return {
        startMonitoring: () => {},
        stopMonitoring: () => {},
        checkForNewTransactions: async () => {},
      } as any;
    }

    if (!this.instance) {
      this.instance = new IncomingTransactionMonitor();
    }
    return this.instance;
  }

  constructor() {
    if (typeof window === 'undefined') return;
    
    // Load last seen transactions from localStorage
    this.loadLastSeenTxs();
  }

  /**
   * Start monitoring for incoming transactions
   */
  startMonitoring(chains: string[], addresses: { [chain: string]: string }): void {
    if (this.isMonitoring) {
      logger.log('📥 [IncomingTxMonitor] Already monitoring');
      return;
    }

    logger.log('📥 [IncomingTxMonitor] Starting monitoring for chains:', chains);
    this.isMonitoring = true;

    // Check immediately
    this.checkForNewTransactions(chains, addresses);

    // Then check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkForNewTransactions(chains, addresses);
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    logger.log('📥 [IncomingTxMonitor] Stopping monitoring');
    this.isMonitoring = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for new incoming transactions across all chains
   */
  async checkForNewTransactions(
    chains: string[], 
    addresses: { [chain: string]: string }
  ): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      // Check each chain in parallel
      const checkPromises = chains.map(async (chainKey) => {
        const address = addresses[chainKey];
        if (!address) return;

        try {
          await this.checkChainForNewTxs(chainKey, address);
        } catch (error) {
          // Silent fail for individual chains
          logger.warn(`[IncomingTxMonitor] Error checking ${chainKey}:`, error);
        }
      });

      await Promise.allSettled(checkPromises);
    } catch (error) {
      logger.error('[IncomingTxMonitor] Error checking for new transactions:', error);
    }
  }

  /**
   * Check a specific chain for new incoming transactions
   */
  private async checkChainForNewTxs(chainKey: string, address: string): Promise<void> {
    const chain = CHAINS[chainKey];
    if (!chain) return;

    // Get blockchain service
    const blockchain = MultiChainService.getInstance(chainKey);
    
    // Fetch recent transaction history (last 10 transactions)
    const transactions = await blockchain.getTransactionHistory(address, 10);
    
    if (!transactions || transactions.length === 0) return;

    // Get last seen transaction for this chain
    const lastSeenKey = `${chainKey}:${address.toLowerCase()}`;
    const lastSeen = this.lastSeenTxs.get(lastSeenKey);

    // Find new incoming transactions
    for (const tx of transactions) {
      // Skip if we've already processed this transaction
      if (lastSeen && tx.hash === lastSeen.txHash) {
        break; // Transactions are ordered by time (newest first), so we can stop here
      }

      // Determine if this is an incoming transaction
      const isIncoming = this.isIncomingTransaction(tx, address);
      
      if (!isIncoming) continue;

      // This is a NEW incoming transaction!
      logger.log(`📥 [IncomingTxMonitor] New incoming ${tx.tokenSymbol || chain.symbol} on ${chain.name}`);
      logger.log(`   Amount: ${tx.value}`);
      logger.log(`   TX Hash: ${tx.hash}`);

      // Log analytics for received transaction
      await this.logIncomingTransaction(chainKey, tx, address);

      // Update last seen transaction
      this.lastSeenTxs.set(lastSeenKey, {
        chain: chainKey,
        address: address.toLowerCase(),
        txHash: tx.hash,
        timestamp: tx.timestamp || Date.now(),
      });
    }

    // Save to localStorage
    this.saveLastSeenTxs();
  }

  /**
   * Determine if a transaction is incoming (received) to our address
   */
  private isIncomingTransaction(tx: any, ourAddress: string): boolean {
    const ourAddressLower = ourAddress.toLowerCase();
    const toLower = tx.to?.toLowerCase();
    const fromLower = tx.from?.toLowerCase();

    // Transaction is incoming if we are the recipient and NOT the sender
    return toLower === ourAddressLower && fromLower !== ourAddressLower;
  }

  /**
   * Log analytics for incoming transaction
   */
  private async logIncomingTransaction(
    chainKey: string, 
    tx: any, 
    address: string
  ): Promise<void> {
    try {
      const chain = CHAINS[chainKey];
      const value = parseFloat(tx.value) || 0;
      
      // Get token price for USD value calculation
      let valueUSD = 0;
      const tokenSymbol = tx.tokenSymbol || chain.symbol;
      
      // Import price service dynamically to avoid circular deps
      const { PriceService } = await import('@/lib/price-service');
      const priceService = new PriceService();
      
      try {
        const priceData = await priceService.getPrice(tokenSymbol);
        valueUSD = value * priceData.price;
      } catch (error) {
        // If price fetch fails, just use 0
        logger.warn(`[IncomingTxMonitor] Could not fetch price for ${tokenSymbol}`);
      }

      // Log analytics event
      await logTransactionEvent({
        eventType: 'receive_detected',
        chainKey,
        tokenSymbol,
        valueUSD,
        status: 'success',
        referenceId: tx.hash,
        metadata: {
          fromAddress: tx.from,
          toAddress: address,
          amount: tx.value,
          isToken: !!tx.tokenSymbol,
        },
      });

      logger.log(`✅ [IncomingTxMonitor] Analytics logged for incoming ${tokenSymbol}`);
    } catch (error) {
      logger.error('[IncomingTxMonitor] Failed to log analytics:', error);
      // Fail silently - don't block transaction monitoring
    }
  }

  /**
   * Load last seen transactions from localStorage
   */
  private loadLastSeenTxs(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('last_seen_transactions');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.lastSeenTxs = new Map(Object.entries(parsed));
        logger.log(`📥 [IncomingTxMonitor] Loaded ${this.lastSeenTxs.size} last seen transactions`);
      }
    } catch (error) {
      logger.warn('[IncomingTxMonitor] Failed to load last seen transactions:', error);
    }
  }

  /**
   * Save last seen transactions to localStorage
   */
  private saveLastSeenTxs(): void {
    if (typeof window === 'undefined') return;

    try {
      const obj = Object.fromEntries(this.lastSeenTxs);
      localStorage.setItem('last_seen_transactions', JSON.stringify(obj));
    } catch (error) {
      logger.warn('[IncomingTxMonitor] Failed to save last seen transactions:', error);
    }
  }
}

// Export singleton instance
export const incomingTransactionMonitor = IncomingTransactionMonitor.getInstance();

