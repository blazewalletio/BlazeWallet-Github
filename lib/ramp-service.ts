// Ramp Network integration for fiat on-ramp
// Docs: https://docs.ramp.network/
// Embedded widget - Fully integrated within Blaze UI

import { logger } from '@/lib/logger';

export interface RampConfig {
  hostAppName: string;
  hostLogoUrl?: string;
  hostApiKey: string;
  userAddress: string;
  defaultAsset?: string; // e.g., 'ETH_ETH', 'SOL_SOL', 'USDC_ETH'
  defaultAmount?: string; // Amount in smallest unit (wei, lamports, etc.)
  defaultFiatCurrency?: string; // e.g., 'EUR', 'USD'
  defaultFiatAmount?: string; // Fiat amount
  variant?: 'embedded-desktop' | 'embedded-mobile' | 'hosted-auto' | 'hosted-desktop' | 'hosted-mobile';
  containerNode?: HTMLElement; // Required for embedded variants
  enabledFlows?: string; // 'ONRAMP' | 'OFFRAMP' | 'ONRAMP,OFFRAMP'
  offrampAsset?: string;
  offrampAssetType?: string;
  offrampAssetAmount?: string;
  swapAsset?: string; // For crypto-to-crypto swaps
  swapAmount?: string;
  finalUrl?: string; // URL to redirect after completion
  webhookStatusUrl?: string; // Webhook URL for status updates
  userEmailAddress?: string;
  userLegalName?: string;
  userDateOfBirth?: string;
  userAddressInfo?: {
    countryCode?: string;
    city?: string;
    street?: string;
    postCode?: string;
  };
  defaultFlow?: 'ONRAMP' | 'OFFRAMP';
  theme?: 'light' | 'dark';
  themeName?: string; // Custom theme name
  minPurchaseAmount?: number;
  maxPurchaseAmount?: number;
  minPurchaseCrypto?: string; // e.g., '1000000000000000000' (1 ETH in wei)
  maxPurchaseCrypto?: string;
  disabledPaymentMethods?: string[]; // e.g., ['CARD_PAYMENT', 'APPLE_PAY']
  enabledPaymentMethods?: string[]; // e.g., ['CARD_PAYMENT', 'APPLE_PAY']
  defaultPaymentMethodType?: string;
  useSendCryptoCallback?: boolean; // Use callback for crypto sending
  sendCryptoCallbackUrl?: string;
  useReceiveCryptoCallback?: boolean;
  receiveCryptoCallbackUrl?: string;
}

export class RampService {
  // Map chain ID to Ramp asset code
  // Ramp uses format: {SYMBOL}_{CHAIN} (e.g., ETH_ETH, SOL_SOL, USDC_ETH)
  static getAssetCode(chainId: number, tokenSymbol?: string): string {
    // For Solana
    if (chainId === 101) {
      if (tokenSymbol === 'USDC') return 'USDC_SOL';
      if (tokenSymbol === 'USDT') return 'USDT_SOL';
      return 'SOL_SOL';
    }

    // For Ethereum and EVM chains
    const chainMap: Record<number, string> = {
      1: 'ETH', // Ethereum mainnet
      137: 'MATIC', // Polygon
      56: 'BNB', // BSC
      42161: 'ETH', // Arbitrum
      10: 'ETH', // Optimism
      8453: 'ETH', // Base
      43114: 'AVAX', // Avalanche
    };

    const chainSuffix = chainMap[chainId] || 'ETH';

    // For tokens
    if (tokenSymbol) {
      const tokenUpper = tokenSymbol.toUpperCase();
      if (tokenUpper === 'USDC' || tokenUpper === 'USDT') {
        return `${tokenUpper}_${chainSuffix}`;
      }
    }

    // Default to native token
    return `${chainSuffix}_${chainSuffix}`;
  }

  // Get default asset for chain
  static getDefaultAsset(chainId: number): string {
    return this.getAssetCode(chainId);
  }

  // Get supported assets by chain
  static getSupportedAssets(chainId: number): string[] {
    const assets: string[] = [];

    if (chainId === 101) {
      // Solana
      assets.push('SOL_SOL', 'USDC_SOL', 'USDT_SOL');
    } else {
      // EVM chains
      const chainSuffix = this.getAssetCode(chainId).split('_')[1];
      assets.push(`${chainSuffix}_${chainSuffix}`); // Native token
      assets.push(`USDC_${chainSuffix}`, `USDT_${chainSuffix}`);
    }

    return assets;
  }

  // Convert fiat amount to crypto amount (for defaultAmount)
  // This is approximate - Ramp will show actual quotes
  static convertFiatToCrypto(
    fiatAmount: number,
    cryptoAsset: string,
    fiatCurrency: string
  ): string {
    // This is just a placeholder - Ramp will handle actual conversion
    // For now, return empty string to let Ramp calculate
    return '';
  }
}

