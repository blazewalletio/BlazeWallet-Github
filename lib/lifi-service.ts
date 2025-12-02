import { logger } from '@/lib/logger';

// Li.Fi Native Token Addresses
// EVM chains use: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
// Solana uses: So11111111111111111111111111111111111111112 (Wrapped SOL)
const NATIVE_TOKEN_EVM = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_TOKEN_SOLANA = 'So11111111111111111111111111111111111111112'; // Wrapped SOL

// Li.Fi Base URL
const BASE_URL = 'https://li.quest/v1';

// TypeScript Interfaces
export interface LiFiToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  logoURI: string;
  priceUSD: string;
}

export interface LiFiQuote {
  id: string;
  action: {
    fromToken: LiFiToken;
    toToken: LiFiToken;
    fromAmount: string;
    toAmount: string;
    slippage: number;
    fromChainId: number;
    toChainId: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    feeCosts: Array<{
      name: string;
      description: string;
      token: LiFiToken;
      amount: string;
      amountUSD: string;
    }>;
    gasCosts: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
      amount: string;
      amountUSD: string;
      token: LiFiToken;
    }>;
    executionDuration: number;
  };
  tool: string;
  integrator: string;
  steps: Array<{
    id: string;
    type: string;
    action: {
      fromToken: LiFiToken;
      toToken: LiFiToken;
      fromAmount: string;
      toAmount: string;
      slippage: number;
      fromChainId: number;
      toChainId: number;
    };
    estimate: {
      fromAmount: string;
      toAmount: string;
      toAmountMin: string;
      approvalAddress: string;
      feeCosts: Array<any>;
      gasCosts: Array<any>;
      executionDuration: number;
    };
    tool: string;
    integrator: string;
  }>;
}

export interface LiFiTransaction {
  transactionRequest: {
    data: string;
    to: string;
    value: string;
    gasPrice: string;
    gasLimit: string;
    from: string;
  };
  route: LiFiQuote;
}

export interface LiFiStatus {
  status: 'PENDING' | 'DONE' | 'FAILED';
  sending: {
    txHash: string;
    txLink: string;
    amount: string;
    token: LiFiToken;
  };
  receiving?: {
    txHash?: string;
    txLink?: string;
    amount?: string;
    token?: LiFiToken;
  };
}

export class LiFiService {
  /**
   * Get swap quote from Li.Fi
   */
  static async getQuote(
    fromChain: number,
    toChain: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    fromAddress: string, // ✅ FIXED: According to Li.Fi docs, this should be 'fromAddress', not 'toAddress'
    slippage: number = 0.03,
    order: 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST' = 'RECOMMENDED',
    apiKey?: string
  ): Promise<LiFiQuote | null> {
    try {
      // Determine native token address based on chain
      const getNativeTokenAddress = (chainId: number): string => {
        // Solana chain ID is 101
        if (chainId === 101) {
          return NATIVE_TOKEN_SOLANA; // Wrapped SOL
        }
        // All EVM chains use the same native token address
        return NATIVE_TOKEN_EVM;
      };

      // Convert native token to Li.Fi format
      const fromTokenAddress = fromToken === 'native' || !fromToken 
        ? getNativeTokenAddress(fromChain)
        : fromToken;
      const toTokenAddress = toToken === 'native' || !toToken 
        ? getNativeTokenAddress(toChain)
        : toToken;

      // ✅ According to Li.Fi documentation: https://docs.li.fi/api-reference/introduction
      // The quote endpoint uses 'fromAddress' parameter (the wallet address initiating the swap)
      const params = new URLSearchParams({
        fromChain: fromChain.toString(),
        toChain: toChain.toString(),
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: fromAmount,
        fromAddress: fromAddress, // ✅ FIXED: Changed from 'toAddress' to 'fromAddress' per Li.Fi docs
        slippage: slippage.toString(),
        order: order,
      });

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      logger.log('📊 Fetching Li.Fi quote:', {
        fromChain,
        toChain,
        fromToken: fromTokenAddress.length > 10 ? fromTokenAddress.substring(0, 10) + '...' : fromTokenAddress,
        toToken: toTokenAddress.length > 10 ? toTokenAddress.substring(0, 10) + '...' : toTokenAddress,
        fromAmount,
      });

      const url = `${BASE_URL}/quote?${params.toString()}`;
      logger.log('🔗 Li.Fi API URL:', url);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        // ✅ According to Li.Fi docs: Errors consist of HTTP error code, LI.Fi error code, and error message
        logger.error('❌ Li.Fi quote API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          lifiErrorCode: errorData.code || errorData.errorCode || 'UNKNOWN',
          errorMessage: errorData.message || errorText,
          errorDetails: errorData,
          url,
        });
        return null;
      }

      const data = await response.json();
      logger.log('✅ Li.Fi quote received:', {
        tool: data.tool,
        steps: data.steps?.length || 0,
        toAmount: data.estimate?.toAmount,
      });

      return data;
    } catch (error) {
      logger.error('❌ Error fetching Li.Fi quote:', error);
      return null;
    }
  }

  /**
   * Get transaction data for a step
   */
  static async getStepTransaction(
    route: LiFiQuote,
    stepIndex: number,
    userAddress: string,
    apiKey?: string
  ): Promise<LiFiTransaction | null> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      logger.log(`📝 Getting transaction data for step ${stepIndex}...`);

      const response = await fetch(`${BASE_URL}/stepTransaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          route,
          stepIndex,
          userAddress,
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() };
        }
        logger.error('❌ Li.Fi stepTransaction API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          lifiErrorCode: errorData.code || errorData.errorCode || 'UNKNOWN',
          errorMessage: errorData.message || 'Unknown error',
          errorDetails: errorData,
        });
        return null;
      }

      const data = await response.json();
      logger.log('✅ Transaction data received');
      return data;
    } catch (error) {
      logger.error('❌ Error fetching step transaction:', error);
      return null;
    }
  }

  /**
   * Get transaction status
   */
  static async getStatus(
    txHash: string,
    bridge: string,
    fromChain: number,
    toChain: number,
    apiKey?: string
  ): Promise<LiFiStatus | null> {
    try {
      const params = new URLSearchParams({
        txHash,
        bridge,
        fromChain: fromChain.toString(),
        toChain: toChain.toString(),
      });

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${BASE_URL}/status?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() };
        }
        logger.error('❌ Li.Fi status API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          lifiErrorCode: errorData.code || errorData.errorCode || 'UNKNOWN',
          errorMessage: errorData.message || 'Unknown error',
          errorDetails: errorData,
        });
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('❌ Error fetching status:', error);
      return null;
    }
  }

  /**
   * Get supported chains
   */
  static async getChains(apiKey?: string): Promise<any[]> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${BASE_URL}/chains`, { headers });
      if (!response.ok) {
        logger.error('❌ Li.Fi chains API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
        });
        return [];
      }
      return await response.json();
    } catch (error) {
      logger.error('❌ Error fetching chains:', error);
      return [];
    }
  }

  /**
   * Get supported tokens for chains
   */
  static async getTokens(chainIds: number[], apiKey?: string): Promise<Record<string, LiFiToken[]>> {
    try {
      const params = new URLSearchParams({
        chainIds: chainIds.join(','),
      });

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${BASE_URL}/tokens?${params.toString()}`, { headers });
      if (!response.ok) {
        logger.error('❌ Li.Fi tokens API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
        });
        return {};
      }
      return await response.json();
    } catch (error) {
      logger.error('❌ Error fetching tokens:', error);
      return {};
    }
  }

  /**
   * Get native token address for a chain
   */
  static getNativeTokenAddress(chainId: number): string {
    if (chainId === 101) {
      return NATIVE_TOKEN_SOLANA; // Solana
    }
    return NATIVE_TOKEN_EVM; // EVM chains
  }

  /**
   * Check if address is native token
   */
  static isNativeToken(address: string, chainId?: number): boolean {
    if (chainId === 101) {
      return address === NATIVE_TOKEN_SOLANA;
    }
    return address.toLowerCase() === NATIVE_TOKEN_EVM.toLowerCase();
  }
}

