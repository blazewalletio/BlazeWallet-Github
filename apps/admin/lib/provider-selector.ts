// Provider Selector Service
// Smart provider selection with user preference priority

import { logger } from './logger';
import { UserOnRampPreferencesService } from './user-onramp-preferences';

export interface Quote {
  ramp: string;
  paymentMethod: string;
  rate?: number;
  networkFee?: number;
  transactionFee?: number;
  payout?: number;
  availablePaymentMethods?: Array<{ paymentTypeId: string; name: string; icon: string }>;
  quoteId?: string;
  recommendations?: string[];
  errors?: Array<{ type: string; errorId: number; message: string }>;
}

export interface ProviderSelection {
  quote: Quote;
  showComparison?: boolean;
  comparisonQuotes?: Quote[];
  reason: 'preferred_verified' | 'verified_provider' | 'best_rate' | 'rate_comparison';
}

export class ProviderSelector {
  /**
   * Select best provider based on:
   * 1. User's preferred provider (if verified and rate acceptable)
   * 2. Any verified provider (if preferred not available)
   * 3. Best rate (new user or no verified providers)
   */
  static async selectProvider(
    quotes: Quote[],
    userId: string | null,
    paymentMethod: string
  ): Promise<ProviderSelection> {
    // Filter valid quotes (remove quotes with errors)
    let validQuotes = quotes.filter(q => !q.errors || q.errors.length === 0);

    // ⚠️ CRITICAL: Filter by payment method support if payment method is specified
    // Check if provider actually supports the selected payment method in their availablePaymentMethods
    if (paymentMethod) {
      const paymentMethodLower = paymentMethod.toLowerCase();
      const isIdeal = paymentMethodLower.includes('ideal');
      
      // For iDeal | Wero and other specific payment methods, verify the provider supports it
      validQuotes = validQuotes.filter(q => {
        // If quote already has the payment method set, it's supported
        if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
          return true;
        }
        
        // Check availablePaymentMethods array
        const methods = q.availablePaymentMethods || [];
        const supportsMethod = methods.some((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          return id.toLowerCase() === paymentMethodLower || 
                 (isIdeal && id.toLowerCase().includes('ideal'));
        });
        
        return supportsMethod;
      });

      if (validQuotes.length === 0) {
        logger.warn(`⚠️ No providers found supporting payment method: ${paymentMethod}`);
        // Fallback: return quotes with errors so user can see the issue
        if (quotes.length > 0) {
          return {
            quote: quotes[0],
            reason: 'best_rate',
          };
        }
      }
    }

    if (validQuotes.length === 0) {
      logger.warn('⚠️ No valid quotes available, using first quote with errors');
      // Fallback: use first quote even if it has errors (user can see error message)
      if (quotes.length > 0) {
        return {
          quote: quotes[0],
          reason: 'best_rate',
        };
      }
      throw new Error('No quotes available');
    }

    // If no userId, skip preference logic
    if (!userId) {
      const bestQuote = this.selectBestQuote(validQuotes);
      logger.log('✅ No user ID, using best rate provider:', bestQuote.ramp);
      return {
        quote: bestQuote,
        reason: 'best_rate',
      };
    }

    // Get user preferences
    const preferences = await UserOnRampPreferencesService.get(userId);

    // Priority 1: User's preferred provider (if verified)
    if (preferences?.preferredProvider && 
        preferences.verifiedProviders?.includes(preferences.preferredProvider)) {
      
      const preferredQuote = validQuotes.find(
        q => q.ramp === preferences.preferredProvider &&
        (q.paymentMethod?.toLowerCase() === paymentMethod.toLowerCase() ||
         // Also check availablePaymentMethods
         (q.availablePaymentMethods || []).some((pm: any) => {
           const id = pm.paymentTypeId || pm.id || '';
           return id.toLowerCase() === paymentMethod.toLowerCase() ||
                  (paymentMethod.toLowerCase().includes('ideal') && id.toLowerCase().includes('ideal'));
         }))
      );

      if (preferredQuote) {
        // Check if rate is acceptable (within 5% of best)
        const bestQuote = this.selectBestQuote(validQuotes);
        const rateDiff = this.calculateRateDifference(preferredQuote, bestQuote);

        if (rateDiff < 0.05) {
          // Rate is acceptable - use preferred provider
          logger.log('✅ Using preferred provider (user already verified):', preferredQuote.ramp);
          return {
            quote: preferredQuote,
            reason: 'preferred_verified',
          };
        } else {
          // Rate difference too large - show comparison
          logger.log('⚠️ Preferred provider has worse rate, showing comparison');
          return {
            quote: bestQuote,
            showComparison: true,
            comparisonQuotes: [preferredQuote, bestQuote],
            reason: 'rate_comparison',
          };
        }
      }
    }

    // Priority 2: Any verified provider (if preferred not available)
    if (preferences?.verifiedProviders && preferences.verifiedProviders.length > 0) {
      for (const verifiedProvider of preferences.verifiedProviders) {
        const verifiedQuote = validQuotes.find(
          q => q.ramp === verifiedProvider &&
          (q.paymentMethod?.toLowerCase() === paymentMethod.toLowerCase() ||
           // Also check availablePaymentMethods
           (q.availablePaymentMethods || []).some((pm: any) => {
             const id = pm.paymentTypeId || pm.id || '';
             return id.toLowerCase() === paymentMethod.toLowerCase() ||
                    (paymentMethod.toLowerCase().includes('ideal') && id.toLowerCase().includes('ideal'));
           }))
        );

        if (verifiedQuote) {
          logger.log('✅ Using verified provider:', verifiedQuote.ramp);
          return {
            quote: verifiedQuote,
            reason: 'verified_provider',
          };
        }
      }
    }

    // Priority 3: Best rate (new user or no verified providers)
    const bestQuote = this.selectBestQuote(validQuotes);
    logger.log('✅ Using best rate provider:', bestQuote.ramp);
    return {
      quote: bestQuote,
      reason: 'best_rate',
    };
  }

  /**
   * Select best quote based on:
   * 1. Recommendations (BestPrice, LowKyc)
   * 2. Highest payout (best rate)
   * 3. Lowest fees
   */
  private static selectBestQuote(quotes: Quote[]): Quote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    return quotes.sort((a, b) => {
      // Sort by recommendations first
      const aHasBestPrice = a.recommendations?.includes('BestPrice');
      const bHasBestPrice = b.recommendations?.includes('BestPrice');
      if (aHasBestPrice && !bHasBestPrice) return -1;
      if (!aHasBestPrice && bHasBestPrice) return 1;

      // Sort by payout (higher is better)
      const aPayout = parseFloat(String(a.payout || '0'));
      const bPayout = parseFloat(String(b.payout || '0'));
      if (aPayout !== bPayout) return bPayout - aPayout;

      // Sort by total fees (lower is better)
      const aFees = (parseFloat(String(a.networkFee || '0')) + parseFloat(String(a.transactionFee || '0')));
      const bFees = (parseFloat(String(b.networkFee || '0')) + parseFloat(String(b.transactionFee || '0')));
      if (aFees !== bFees) return aFees - bFees;

      return 0;
    })[0];
  }

  /**
   * Calculate rate difference between two quotes
   * Returns percentage difference (0.05 = 5%)
   */
  private static calculateRateDifference(quote1: Quote, quote2: Quote): number {
    const payout1 = parseFloat(String(quote1.payout || '0'));
    const payout2 = parseFloat(String(quote2.payout || '0'));
    
    if (payout2 === 0) return 1; // 100% difference if best is 0
    
    return Math.abs(payout1 - payout2) / payout2;
  }
}

