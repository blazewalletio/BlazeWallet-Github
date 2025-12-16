import { logger } from '@/lib/logger';
import { getLiFiChainId, isSolanaChainId } from '@/lib/lifi-chain-ids';

// Li.Fi Native Token Addresses
// EVM chains use: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
// Solana uses: 11111111111111111111111111111111 (System Program address for native SOL)
// According to Li.Fi docs: https://docs.li.fi/introduction/lifi-architecture/solana-overview
// "The native SOL is represented using the System Program address 11111111111111111111111111111111"
const NATIVE_TOKEN_EVM = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_TOKEN_SOLANA = '11111111111111111111111111111111'; // System Program address (native SOL)

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

// ✅ According to LI.FI docs: /v1/quote returns a Step object with transactionRequest
// This interface represents both:
// 1. A Step from /v1/quote (has transactionRequest)
// 2. A Route from /v1/advanced/routes (has steps array, steps may not have transactionRequest yet)
export interface LiFiQuote {
  id: string;
  type?: string; // 'swap', 'cross', 'lifi', 'protocol'
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
    toAmountUSD?: string; // Optional USD amount
    fromAmountUSD?: string; // Optional USD amount
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
  integrator?: string;
  // ✅ transactionRequest is present when from /v1/quote
  // For EVM chains: standard ethers.js TransactionRequest
  // For Solana: data contains base64-encoded Solana transaction
  transactionRequest?: {
    data: string; // For EVM: hex data, For Solana: base64-encoded transaction
    to?: string; // EVM only
    value?: string; // EVM only
    gasPrice?: string; // EVM only
    gasLimit?: string; // EVM only
    from?: string; // EVM only
  };
  // ✅ steps array is present when from /v1/advanced/routes
  steps?: Array<{
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
      toAmountUSD?: string; // Optional USD amount
      fromAmountUSD?: string; // Optional USD amount
      approvalAddress: string;
      feeCosts: Array<any>;
      gasCosts: Array<any>;
      executionDuration: number;
    };
    tool: string;
    integrator?: string;
    // ✅ transactionRequest may be present if step was populated
    // For EVM chains: standard ethers.js TransactionRequest
    // For Solana: data contains base64-encoded Solana transaction
    transactionRequest?: {
      data: string; // For EVM: hex data, For Solana: base64-encoded transaction
      to?: string; // EVM only
      value?: string; // EVM only
      gasPrice?: string; // EVM only
      gasLimit?: string; // EVM only
      from?: string; // EVM only
    };
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
   * 
   * @param fromChain - Chain ID (can be number for EVM or string for Solana)
   * @param toChain - Chain ID (can be number for EVM or string for Solana)
   * @param fromToken - Token address or 'native' for native token
   * @param toToken - Token address or 'native' for native token
   * @param fromAmount - Amount in smallest unit (wei/lamports)
   * @param fromAddress - Wallet address initiating the swap
   * @param slippage - Slippage tolerance (0.03 = 3%)
   * @param order - Route preference (RECOMMENDED, CHEAPEST, FASTEST)
   * @param apiKey - Optional API key for higher rate limits
   */
  static async getQuote(
    fromChain: string | number,
    toChain: string | number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    fromAddress: string,
    slippage: number = 0.03,
    order: 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST' = 'RECOMMENDED',
    apiKey?: string
  ): Promise<LiFiQuote | null> {
    try {
      // Determine native token address based on chain
      const getNativeTokenAddress = (chainId: string | number): string => {
        // Solana chain ID in Li.Fi is "1151111081099710" (string)
        if (isSolanaChainId(chainId)) {
          return NATIVE_TOKEN_SOLANA; // System Program address (1111...1111)
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

      // ✅ According to Li.Fi documentation: https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer-1
      // Parameters can be chain ID (number) or chain key (string)
      // For Solana, we must use the string chain ID: "1151111081099710"
      const params = new URLSearchParams({
        fromChain: fromChain.toString(), // Convert to string (handles both number and string)
        toChain: toChain.toString(),
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: fromAmount,
        fromAddress: fromAddress,
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
        const errorInfo = {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          lifiErrorCode: errorData.code || errorData.errorCode || 'UNKNOWN',
          errorMessage: errorData.message || errorText,
          errorDetails: errorData,
          url,
          fromChain,
          toChain,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
        };
        
        logger.error('❌ Li.Fi quote API error:', errorInfo);
        
        // Store error info for debugging (will be logged server-side)
        (errorData as any).__lifiErrorInfo = errorInfo;
        
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
   * 
   * According to LI.FI docs: https://docs.li.fi/api-reference/populate-a-step-with-transaction-data
   * Uses POST /v1/advanced/stepTransaction endpoint
   * 
   * ✅ Returns a Step object with transactionRequest populated (not a separate transaction object)
   * 
   * @param step - Full Step object from quote (not route)
   * @param apiKey - Optional API key for higher rate limits
   */
  static async getStepTransaction(
    step: any, // Full Step object from quote
    apiKey?: string
  ): Promise<LiFiQuote | null> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      logger.log(`📝 Getting transaction data for step ${step.id}...`);

      // ✅ According to LI.FI docs: POST /v1/advanced/stepTransaction
      // Requires full Step object (not route + stepIndex)
      // Returns the Step object with transactionRequest populated
      const response = await fetch(`${BASE_URL}/advanced/stepTransaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify(step), // Send full step object
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
      logger.log('✅ Step transaction data received (Step object with transactionRequest)');
      return data; // Returns Step object with transactionRequest populated
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
  static getNativeTokenAddress(chainId: string | number): string {
    if (isSolanaChainId(chainId)) {
      return NATIVE_TOKEN_SOLANA; // System Program address for native SOL
    }
    return NATIVE_TOKEN_EVM; // EVM chains
  }

  /**
   * Check if address is native token
   */
  static isNativeToken(address: string, chainId?: string | number): boolean {
    if (chainId && isSolanaChainId(chainId)) {
      // For Solana, check both System Program and wrapped SOL
      return address === NATIVE_TOKEN_SOLANA || 
             address === 'So11111111111111111111111111111111111111112';
    }
    return address.toLowerCase() === NATIVE_TOKEN_EVM.toLowerCase();
  }
}

