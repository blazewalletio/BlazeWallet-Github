// MoonPay integration for fiat on-ramp
// Docs: https://dev.moonpay.com/docs/integrating-the-widget
// Embedded widget - Fully integrated within Blaze UI

import { logger } from '@/lib/logger';

export interface MoonPayConfig {
  walletAddress: string;
  currencyCode?: string; // e.g., 'eth', 'sol', 'usdc'
  baseCurrencyCode?: string; // e.g., 'eur', 'usd', 'gbp'
  baseCurrencyAmount?: number; // Default fiat amount
  theme?: 'light' | 'dark';
  mode?: 'buy' | 'sell';
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
  private static readonly API_URL = 'https://api.moonpay.com/v3';
  private static readonly SANDBOX_WIDGET_URL = 'https://buy-staging.moonpay.com';
  private static readonly SANDBOX_API_URL = 'https://api-staging.moonpay.com/v3';

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
  static buildWidgetUrl(config: MoonPayConfig, apiKey: string, isSandbox: boolean = false): string {
    const baseUrl = isSandbox ? this.SANDBOX_WIDGET_URL : this.WIDGET_URL;
    const params = new URLSearchParams();

    // Required parameters
    params.append('apiKey', apiKey);
    params.append('walletAddress', config.walletAddress);

    // Optional parameters
    if (config.currencyCode) {
      params.append('currencyCode', config.currencyCode.toLowerCase());
    }
    if (config.baseCurrencyCode) {
      params.append('baseCurrencyCode', config.baseCurrencyCode.toLowerCase());
    }
    if (config.baseCurrencyAmount) {
      params.append('baseCurrencyAmount', config.baseCurrencyAmount.toString());
    }
    if (config.theme) {
      params.append('theme', config.theme);
    }
    if (config.mode) {
      params.append('mode', config.mode);
    }

    // Additional UX parameters
    // Note: redirectURL should be set by the caller if needed
    params.append('showWalletAddressForm', 'false'); // Hide wallet address form (we provide it)

    return `${baseUrl}?${params.toString()}`;
  }

  // Get quote from MoonPay API
  static async getQuote(
    baseCurrencyAmount: number,
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    apiKey: string,
    isSandbox: boolean = false
  ): Promise<MoonPayQuote | null> {
    try {
      const baseUrl = isSandbox ? this.SANDBOX_API_URL : this.API_URL;
      const url = `${baseUrl}/currencies/${quoteCurrencyCode.toLowerCase()}/quote?baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${baseCurrencyCode.toLowerCase()}&apiKey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MoonPay quote API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return null;
      }

      const data = await response.json();
      
      return {
        quoteCurrencyCode: data.quoteCurrencyCode,
        baseCurrencyCode: data.baseCurrencyCode,
        quoteCurrencyAmount: data.quoteCurrencyAmount,
        baseCurrencyAmount: data.baseCurrencyAmount,
        totalAmount: data.totalAmount,
        feeAmount: data.feeAmount,
        networkFeeAmount: data.networkFeeAmount || 0,
        exchangeRate: data.exchangeRate,
      };
    } catch (error: any) {
      logger.error('MoonPay getQuote error:', error);
      return null;
    }
  }

  // Get list of supported currencies
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

  // Verify MoonPay signature (for webhook validation)
  static verifySignature(
    payload: string,
    signature: string,
    secretKey: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');
      
      return hash === signature;
    } catch (error: any) {
      logger.error('MoonPay signature verification error:', error);
      return false;
    }
  }
}

