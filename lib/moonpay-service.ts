// MoonPay integration for fiat on-ramp
// Docs: https://dev.moonpay.com/docs/integrating-the-widget
// Embedded widget - Fully integrated within Blaze UI
// IMPORTANT: URL signing is REQUIRED when using walletAddress
// Docs: https://dev.moonpay.com/docs/url-signing

import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface MoonPayConfig {
  walletAddress: string;
  currencyCode?: string; // e.g., 'eth', 'sol', 'usdc'
  baseCurrencyCode?: string; // e.g., 'eur', 'usd', 'gbp'
  baseCurrencyAmount?: number; // Default fiat amount
  quoteCurrencyAmount?: number; // Crypto amount (takes precedence over baseCurrencyAmount)
  theme?: 'light' | 'dark';
  mode?: 'buy' | 'sell';
  email?: string; // Customer email (pre-fills if valid)
  externalTransactionId?: string; // External transaction ID for tracking
  externalCustomerId?: string; // External customer ID for tracking
  redirectURL?: string; // URL to redirect after completion
  showWalletAddressForm?: boolean; // Show wallet address form (default: false)
  showOnlyCurrencies?: string; // Comma-separated list of currency codes to show
  showAllCurrencies?: boolean; // Show all currencies (default: false)
  lockAmount?: boolean; // Lock amount (prevent modification)
  defaultPaymentMethod?: string; // Pre-select payment method
  language?: string; // ISO 639-1 language code (e.g., 'en', 'nl')
}

export interface MoonPayQuote {
  quoteCurrencyCode: string;
  baseCurrencyCode: string;
  quoteCurrencyAmount: number;
  baseCurrencyAmount: number;
  totalAmount: number;
  feeAmount: number;
  networkFeeAmount: number;
  exchangeRate: number;
}

export class MoonPayService {
  private static readonly WIDGET_URL = 'https://buy.moonpay.com';
  private static readonly API_URL = 'https://api.moonpay.com/v3'; // Use v3 API (v2 quotes endpoint doesn't exist)
  private static readonly SANDBOX_WIDGET_URL = 'https://buy-sandbox.moonpay.com';
  private static readonly SANDBOX_API_URL = 'https://api-sandbox.moonpay.com/v3';

  // Get supported crypto currencies by chain
  static getSupportedCryptos(chainId: number): string[] {
    const cryptoMap: Record<number, string[]> = {
      1: ['eth', 'usdc', 'usdt', 'dai', 'wbtc', 'link', 'uni', 'aave'], // Ethereum
      137: ['matic', 'usdc', 'usdt'], // Polygon
      56: ['bnb', 'usdt', 'busd'], // BSC
      42161: ['eth', 'usdc', 'usdt'], // Arbitrum
      10: ['eth', 'usdc', 'usdt'], // Optimism
      8453: ['eth', 'usdc'], // Base
      43114: ['avax', 'usdc', 'usdt'], // Avalanche
      101: ['sol', 'usdc_sol', 'usdt_sol'], // Solana
    };

    return cryptoMap[chainId] || ['eth'];
  }

  // Get default crypto currency for chain
  static getDefaultCrypto(chainId: number): string {
    const defaultMap: Record<number, string> = {
      1: 'eth',
      137: 'matic',
      56: 'bnb',
      42161: 'eth',
      10: 'eth',
      8453: 'eth',
      43114: 'avax',
      101: 'sol',
    };

    return defaultMap[chainId] || 'eth';
  }

  // Map chain ID to MoonPay currency code
  static getCurrencyCode(chainId: number, tokenSymbol?: string): string {
    // For Solana, we need to specify the network
    if (chainId === 101) {
      if (tokenSymbol === 'USDC') return 'usdc_sol';
      if (tokenSymbol === 'USDT') return 'usdt_sol';
      return 'sol';
    }

    // For other chains, use standard codes
    const codeMap: Record<number, string> = {
      1: 'eth',
      137: 'matic',
      56: 'bnb',
      42161: 'eth', // Arbitrum uses ETH
      10: 'eth', // Optimism uses ETH
      8453: 'eth', // Base uses ETH
      43114: 'avax',
    };

    // If token symbol is provided, try to map it
    if (tokenSymbol) {
      const tokenLower = tokenSymbol.toLowerCase();
      if (tokenLower === 'usdc' || tokenLower === 'usdt') {
        return tokenLower;
      }
    }

    return codeMap[chainId] || 'eth';
  }

  // Build MoonPay widget URL for embedded iframe
  // IMPORTANT: URL signing is REQUIRED when using walletAddress
  // Docs: https://dev.moonpay.com/docs/url-signing
  static buildWidgetUrl(
    config: MoonPayConfig,
    apiKey: string,
    secretKey: string,
    isSandbox: boolean = false
  ): string {
    const baseUrl = isSandbox ? this.SANDBOX_WIDGET_URL : this.WIDGET_URL;
    const params = new URLSearchParams();

    // Required parameters
    params.append('apiKey', apiKey);
    
    // Wallet address - REQUIRES URL SIGNING
    // All parameter values must be URL-encoded before signing
    params.append('walletAddress', encodeURIComponent(config.walletAddress));

    // Optional parameters (all values must be URL-encoded)
    if (config.currencyCode) {
      params.append('currencyCode', encodeURIComponent(config.currencyCode.toLowerCase()));
    }
    if (config.baseCurrencyCode) {
      params.append('baseCurrencyCode', encodeURIComponent(config.baseCurrencyCode.toLowerCase()));
    }
    if (config.baseCurrencyAmount) {
      params.append('baseCurrencyAmount', encodeURIComponent(config.baseCurrencyAmount.toString()));
    }
    if (config.quoteCurrencyAmount) {
      params.append('quoteCurrencyAmount', encodeURIComponent(config.quoteCurrencyAmount.toString()));
    }
    if (config.theme) {
      params.append('theme', encodeURIComponent(config.theme));
    }
    if (config.mode) {
      params.append('mode', encodeURIComponent(config.mode));
    }
    if (config.email) {
      params.append('email', encodeURIComponent(config.email));
    }
    if (config.externalTransactionId) {
      params.append('externalTransactionId', encodeURIComponent(config.externalTransactionId));
    }
    if (config.externalCustomerId) {
      params.append('externalCustomerId', encodeURIComponent(config.externalCustomerId));
    }
    if (config.redirectURL) {
      params.append('redirectURL', encodeURIComponent(config.redirectURL));
    }
    if (config.showWalletAddressForm !== undefined) {
      params.append('showWalletAddressForm', encodeURIComponent(config.showWalletAddressForm.toString()));
    } else {
      params.append('showWalletAddressForm', 'false'); // Hide wallet address form (we provide it)
    }
    if (config.showOnlyCurrencies) {
      params.append('showOnlyCurrencies', encodeURIComponent(config.showOnlyCurrencies));
    }
    if (config.showAllCurrencies) {
      params.append('showAllCurrencies', encodeURIComponent('true'));
    }
    if (config.lockAmount) {
      params.append('lockAmount', encodeURIComponent('true'));
    }
    if (config.defaultPaymentMethod) {
      params.append('defaultPaymentMethod', encodeURIComponent(config.defaultPaymentMethod));
    }
    if (config.language) {
      params.append('language', encodeURIComponent(config.language));
    }

    // Generate signature for URL-based integrations
    // According to MoonPay docs: All query parameter values must be URL-encoded before signing
    // Signature is generated from the query string (without the signature parameter itself)
    const queryString = params.toString();
    const signature = this.generateSignature(queryString, secretKey);
    
    // Append signature (also URL-encoded)
    params.append('signature', encodeURIComponent(signature));

    return `${baseUrl}?${params.toString()}`;
  }

  // Generate HMAC-SHA256 signature for MoonPay widget URL
  // Docs: https://dev.moonpay.com/docs/url-signing
  // IMPORTANT: All parameter values must be URL-encoded BEFORE generating the signature
  private static generateSignature(queryString: string, secretKey: string): string {
    try {
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(queryString);
      // MoonPay uses base64 encoding for signatures (not hex)
      return hmac.digest('base64');
    } catch (error: any) {
      logger.error('MoonPay signature generation error:', error);
      throw new Error('Failed to generate MoonPay signature');
    }
  }

  // Get quote from MoonPay API v3
  // Docs: https://dev.moonpay.com/reference/get_v3-currencies-quote
  static async getQuote(
    baseCurrencyAmount: number,
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    apiKey: string,
    isSandbox: boolean = false
  ): Promise<MoonPayQuote | null> {
    try {
      const baseUrl = isSandbox ? this.SANDBOX_API_URL : this.API_URL;
      
      // Normalize currency codes
      const normalizedBaseCode = baseCurrencyCode.toLowerCase();
      let normalizedQuoteCode = quoteCurrencyCode.toLowerCase();
      
      // MoonPay uses 'sol' for Solana, not 'sol_sol'
      if (normalizedQuoteCode === 'sol_sol') {
        normalizedQuoteCode = 'sol';
      }
      
      // Use v3 API endpoint: /v3/currencies/{currencyCode}/quote
      const url = `${baseUrl}/currencies/${normalizedQuoteCode}/quote?baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${normalizedBaseCode}&apiKey=${apiKey}`;

      logger.log('MoonPay quote API request:', {
        url: url.replace(apiKey, '***'),
        baseCurrencyCode: normalizedBaseCode,
        quoteCurrencyCode: normalizedQuoteCode,
        baseCurrencyAmount,
      });
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = errorText;
        }
        
        logger.error('MoonPay quote API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url: url.replace(apiKey, '***'),
        });
        return null;
      }

      const data = await response.json();
      
      logger.log('MoonPay quote response:', {
        quoteCurrencyCode: data.quoteCurrencyCode,
        baseCurrencyCode: data.baseCurrencyCode,
        quoteCurrencyAmount: data.quoteCurrencyAmount,
      });
      
      // v3 API returns quote object directly
      return {
        quoteCurrencyCode: data.quoteCurrencyCode || normalizedQuoteCode,
        baseCurrencyCode: data.baseCurrencyCode || normalizedBaseCode,
        quoteCurrencyAmount: data.quoteCurrencyAmount || 0,
        baseCurrencyAmount: data.baseCurrencyAmount || baseCurrencyAmount,
        totalAmount: data.totalAmount || data.baseCurrencyAmount || baseCurrencyAmount,
        feeAmount: data.feeAmount || 0,
        networkFeeAmount: data.networkFeeAmount || 0,
        exchangeRate: data.exchangeRate || 0,
      };
    } catch (error: any) {
      logger.error('MoonPay getQuote error:', {
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  // Get list of supported currencies
  // Docs: https://dev.moonpay.com/reference/get_v3-currencies
  static async getSupportedCurrencies(apiKey: string, isSandbox: boolean = false): Promise<any[]> {
    try {
      const baseUrl = isSandbox ? this.SANDBOX_API_URL : this.API_URL;
      const url = `${baseUrl}/currencies?apiKey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.error('MoonPay supported currencies API error:', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = await response.json();
      return data || [];
    } catch (error: any) {
      logger.error('MoonPay getSupportedCurrencies error:', error);
      return [];
    }
  }

  // Verify MoonPay webhook signature
  // Docs: https://dev.moonpay.com/docs/webhooks
  // MoonPay sends webhook signature in X-Moonpay-Signature header
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secretKey: string
  ): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(payload);
      // MoonPay webhook signatures use hex encoding
      const expectedSignature = hmac.digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error: any) {
      logger.error('MoonPay webhook signature verification error:', error);
      return false;
    }
  }
}

