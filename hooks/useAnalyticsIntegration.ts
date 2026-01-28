/**
 * 🔌 useAnalyticsIntegration Hook
 * 
 * Zero-impact analytics integration for Dashboard
 * Tracks transaction events without blocking UI
 */

import { useEffect, useRef } from 'react';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { logger } from '@/lib/logger';

export function useAnalyticsIntegration() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Log page view
    analyticsTracker.logFeatureUsage('dashboard_viewed').catch(err => {
      logger.error('[Analytics] Failed to log dashboard view:', err);
    });
  }, []);

  return {
    /**
     * Track transaction initiated
     */
    trackTransactionInitiated: (params: {
      chainKey: string;
      tokenSymbol: string;
      valueUSD?: number;
      txHash?: string;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'send_initiated',
        chainKey: params.chainKey,
        tokenSymbol: params.tokenSymbol,
        valueUSD: params.valueUSD,
        status: 'pending',
        referenceId: params.txHash,
      }).catch(err => {
        logger.error('[Analytics] Failed to track transaction:', err);
      });
    },

    /**
     * Track transaction confirmed
     */
    trackTransactionConfirmed: (params: {
      chainKey: string;
      tokenSymbol: string;
      valueUSD?: number;
      txHash?: string;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'send_confirmed',
        chainKey: params.chainKey,
        tokenSymbol: params.tokenSymbol,
        valueUSD: params.valueUSD,
        status: 'success',
        referenceId: params.txHash,
      }).catch(err => {
        logger.error('[Analytics] Failed to track confirmation:', err);
      });
    },

    /**
     * Track transaction failed
     */
    trackTransactionFailed: (params: {
      chainKey: string;
      tokenSymbol: string;
      valueUSD?: number;
      txHash?: string;
      error?: string;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'send_failed',
        chainKey: params.chainKey,
        tokenSymbol: params.tokenSymbol,
        valueUSD: params.valueUSD,
        status: 'failed',
        referenceId: params.txHash,
        metadata: { error: params.error },
      }).catch(err => {
        logger.error('[Analytics] Failed to track failure:', err);
      });
    },

    /**
     * Track swap initiated
     */
    trackSwapInitiated: (params: {
      chainKey: string;
      fromToken: string;
      toToken: string;
      valueUSD?: number;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'swap_initiated',
        chainKey: params.chainKey,
        tokenSymbol: `${params.fromToken}→${params.toToken}`,
        valueUSD: params.valueUSD,
        status: 'pending',
        metadata: {
          fromToken: params.fromToken,
          toToken: params.toToken,
        },
      }).catch(err => {
        logger.error('[Analytics] Failed to track swap:', err);
      });
    },

    /**
     * Track swap confirmed
     */
    trackSwapConfirmed: (params: {
      chainKey: string;
      fromToken: string;
      toToken: string;
      valueUSD?: number;
      txHash?: string;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'swap_confirmed',
        chainKey: params.chainKey,
        tokenSymbol: `${params.fromToken}→${params.toToken}`,
        valueUSD: params.valueUSD,
        status: 'success',
        referenceId: params.txHash,
        metadata: {
          fromToken: params.fromToken,
          toToken: params.toToken,
        },
      }).catch(err => {
        logger.error('[Analytics] Failed to track swap confirmation:', err);
      });
    },

    /**
     * Track onramp initiated
     */
    trackOnrampInitiated: (params: {
      provider: string;
      fiatAmount: number;
      fiatCurrency: string;
      cryptoCurrency: string;
    }) => {
      analyticsTracker.logTransactionEvent({
        eventType: 'onramp_initiated',
        chainKey: 'multi', // Onramps can be multi-chain
        tokenSymbol: params.cryptoCurrency,
        valueUSD: params.fiatCurrency === 'USD' ? params.fiatAmount : undefined,
        status: 'pending',
        metadata: {
          provider: params.provider,
          fiatAmount: params.fiatAmount,
          fiatCurrency: params.fiatCurrency,
        },
      }).catch(err => {
        logger.error('[Analytics] Failed to track onramp:', err);
      });
    },

    /**
     * Track feature usage
     */
    trackFeature: (featureName: string, metadata?: Record<string, any>) => {
      analyticsTracker.logFeatureUsage(featureName, metadata).catch(err => {
        logger.error('[Analytics] Failed to track feature:', err);
      });
    },
  };
}

