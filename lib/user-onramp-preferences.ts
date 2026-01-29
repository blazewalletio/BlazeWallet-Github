// User OnRamp Preferences Service
// Manages user preferences for onramp providers to enable KYC reuse

import { supabase } from './supabase';
import { logger } from './logger';

export interface UserOnRampPreferences {
  id?: string;
  userId: string;
  preferredProvider: string | null;
  verifiedProviders: string[];
  lastUsedProvider: string | null;
  lastTransactionDate: Date | null;
  preferredPaymentMethod: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserOnRampPreferencesService {
  /**
   * Get user preferences
   */
  static async get(userId: string): Promise<UserOnRampPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_onramp_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found - return null (will be created on first use)
          return null;
        }
        if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          // Table doesn't exist yet - migration not run, fail silently
          // Don't log to console - this is expected if migration hasn't run yet
          return null;
        }
        // Only log unexpected errors (but silently for now to avoid console spam)
        // logger.error('❌ Error fetching user onramp preferences:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        preferredProvider: data.preferred_provider,
        verifiedProviders: data.verified_providers || [],
        lastUsedProvider: data.last_used_provider,
        lastTransactionDate: data.last_transaction_date ? new Date(data.last_transaction_date) : null,
        preferredPaymentMethod: data.preferred_payment_method,
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      };
    } catch (error: any) {
      logger.error('❌ Error in get user preferences:', error);
      return null;
    }
  }

  /**
   * Add provider to verified providers list
   */
  static async addVerifiedProvider(userId: string, provider: string): Promise<boolean> {
    try {
      // Get current preferences
      const current = await this.get(userId);
      const verifiedProviders = current?.verifiedProviders || [];

      // Check if already verified
      if (verifiedProviders.includes(provider)) {
        logger.log('✅ Provider already in verified list:', provider);
        return true;
      }

      // Add to verified list
      const newVerifiedProviders = [...verifiedProviders, provider];

      // Upsert preferences
      const { error } = await supabase
        .from('user_onramp_preferences')
        .upsert({
          user_id: userId,
          verified_providers: newVerifiedProviders,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        logger.error('❌ Error adding verified provider:', error);
        return false;
      }

      logger.log('✅ Added verified provider:', { userId, provider, verifiedProviders: newVerifiedProviders });
      return true;
    } catch (error: any) {
      logger.error('❌ Error in addVerifiedProvider:', error);
      return false;
    }
  }

  /**
   * Set preferred provider
   */
  static async setPreferredProvider(userId: string, provider: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_onramp_preferences')
        .upsert({
          user_id: userId,
          preferred_provider: provider,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        logger.error('❌ Error setting preferred provider:', error);
        return false;
      }

      logger.log('✅ Set preferred provider:', { userId, provider });
      return true;
    } catch (error: any) {
      logger.error('❌ Error in setPreferredProvider:', error);
      return false;
    }
  }

  /**
   * Set last used provider and payment method
   */
  static async setLastUsedProvider(
    userId: string,
    provider: string,
    paymentMethod: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_onramp_preferences')
        .upsert({
          user_id: userId,
          last_used_provider: provider,
          preferred_payment_method: paymentMethod,
          last_transaction_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        logger.error('❌ Error setting last used provider:', error);
        return false;
      }

      logger.log('✅ Set last used provider:', { userId, provider, paymentMethod });
      return true;
    } catch (error: any) {
      logger.error('❌ Error in setLastUsedProvider:', error);
      return false;
    }
  }

  /**
   * Update preferences after transaction completion
   * This is called when a transaction status is 'completed'
   */
  static async updateAfterTransaction(
    userId: string,
    transactionId: string
  ): Promise<boolean> {
    try {
      // Import OnramperService dynamically to avoid circular dependency
      const { OnramperService } = await import('./onramper-service');
      
      // Get transaction details from Onramper
      const transaction = await OnramperService.getTransaction(transactionId);
      
      if (!transaction) {
        logger.warn('⚠️ Transaction not found:', transactionId);
        return false;
      }

      // Extract provider and payment method from transaction
      const provider = transaction.onramp;
      const paymentMethod = transaction.paymentMethod;
      const status = transaction.status;

      if (status === 'completed') {
        // Transaction completed = user successfully bought crypto
        // This means they have KYC verified at this provider (or already had it)
        
        // Add to verified providers
        await this.addVerifiedProvider(userId, provider);
        
        // Set as preferred provider
        await this.setPreferredProvider(userId, provider);
        
        // Set as last used
        await this.setLastUsedProvider(userId, provider, paymentMethod);

        logger.log('✅ Updated user preferences after transaction:', {
          userId,
          transactionId,
          provider,
          paymentMethod,
          status,
        });

        return true;
      } else {
        logger.log('ℹ️ Transaction not completed yet, not updating preferences:', {
          transactionId,
          status,
        });
        return false;
      }
    } catch (error: any) {
      logger.error('❌ Error in updateAfterTransaction:', error);
      return false;
    }
  }

  /**
   * Check if user has verified a specific provider
   */
  static async isProviderVerified(userId: string, provider: string): Promise<boolean> {
    const preferences = await this.get(userId);
    return preferences?.verifiedProviders?.includes(provider) || false;
  }

  /**
   * Get preferred provider (if user has one)
   */
  static async getPreferredProvider(userId: string): Promise<string | null> {
    const preferences = await this.get(userId);
    return preferences?.preferredProvider || null;
  }
}

