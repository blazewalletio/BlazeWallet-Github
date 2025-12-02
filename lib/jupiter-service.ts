import { logger } from '@/lib/logger';

/**
 * Jupiter Aggregator Service for Solana Swaps
 * 
 * Jupiter is the best DEX aggregator for Solana same-chain swaps.
 * Li.Fi is used for cross-chain swaps, but for Solana → Solana, we use Jupiter.
 */

const JUPITER_BASE_URL = 'https://quote-api.jup.ag/v6';

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapTransaction {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export class JupiterService {
  /**
   * Get swap quote from Jupiter
   * 
   * @param inputMint - Input token mint address (native SOL: So11111111111111111111111111111111111111112)
   * @param outputMint - Output token mint address
   * @param amount - Amount in smallest unit (lamports for SOL)
   * @param slippageBps - Slippage in basis points (e.g., 50 = 0.5%)
   * @param onlyDirectRoutes - Only use direct routes (faster, but may have worse rates)
   */
  static async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50, // 0.5% default slippage
    onlyDirectRoutes: boolean = false
  ): Promise<JupiterQuote | null> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: onlyDirectRoutes.toString(),
      });

      const url = `${JUPITER_BASE_URL}/quote?${params.toString()}`;
      logger.log('🪐 Fetching Jupiter quote:', {
        inputMint: inputMint.substring(0, 10) + '...',
        outputMint: outputMint.substring(0, 10) + '...',
        amount,
        slippageBps,
      });

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        logger.error('❌ Jupiter quote API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          errorMessage: errorData.message || errorText,
          errorDetails: errorData,
          url,
        });
        return null;
      }

      const data = await response.json();
      logger.log('✅ Jupiter quote received:', {
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        priceImpact: data.priceImpactPct,
        routes: data.routePlan?.length || 0,
      });

      return data;
    } catch (error) {
      logger.error('❌ Error fetching Jupiter quote:', error);
      return null;
    }
  }

  /**
   * Get swap transaction from Jupiter
   * 
   * @param quote - Quote from getQuote()
   * @param userPublicKey - User's Solana public key (base58)
   * @param wrapUnwrapSOL - Automatically wrap/unwrap SOL if needed
   * @param feeAccount - Optional fee account for platform fees
   * @param asLegacyTransaction - Use legacy transaction format
   */
  static async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    wrapUnwrapSOL: boolean = true,
    feeAccount?: string,
    asLegacyTransaction: boolean = false
  ): Promise<JupiterSwapTransaction | null> {
    try {
      const body = {
        quoteResponse: quote,
        userPublicKey,
        wrapUnwrapSOL,
        feeAccount,
        asLegacyTransaction,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      };

      logger.log('🪐 Getting Jupiter swap transaction...');

      const response = await fetch(`${JUPITER_BASE_URL}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        logger.error('❌ Jupiter swap transaction API error:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          errorMessage: errorData.message || errorText,
          errorDetails: errorData,
        });
        return null;
      }

      const data = await response.json();
      logger.log('✅ Jupiter swap transaction received');
      return data;
    } catch (error) {
      logger.error('❌ Error getting Jupiter swap transaction:', error);
      return null;
    }
  }

  /**
   * Get native SOL address for Jupiter
   */
  static getNativeSOLAddress(): string {
    return 'So11111111111111111111111111111111111111112'; // Wrapped SOL
  }

  /**
   * Check if address is native SOL
   */
  static isNativeSOL(address: string): boolean {
    return address === 'So11111111111111111111111111111111111111112' ||
           address === '11111111111111111111111111111111' ||
           address === 'native';
  }
}

