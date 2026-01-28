import { ethers } from 'ethers';
import { CURRENT_PRESALE, PRESALE_CONSTANTS } from './presale-config';
import { logger } from '@/lib/logger';

// Simplified ABIs - only functions we need
const PRESALE_ABI = [
  'function contribute() external payable',
  'function getPresaleInfo() external view returns (bool active, bool finalized, uint256 raised, uint256 tokensSold, uint256 participantCount, uint256 timeRemaining)',
  'function getUserInfo(address user) external view returns (uint256 contribution, uint256 tokenAllocation, bool claimed)',
  'function claimTokens() external',
  'function claimRefund() external',
  'function startPresale(uint256 durationInDays) external',
  'function finalizePresale() external',
];

const TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
];

export interface PresaleInfo {
  active: boolean;
  finalized: boolean;
  raised: number; // in USD
  tokensSold: number;
  participantCount: number;
  timeRemaining: number; // in milliseconds
  bnbPrice: number; // Current BNB price in USD
}

export interface UserInfo {
  contribution: number; // in USD
  tokenAllocation: number;
  hasClaimed: boolean;
}

export class PresaleService {
  private presaleContract: ethers.Contract;
  private tokenContract: ethers.Contract | null = null;
  private provider: ethers.BrowserProvider;
  private wallet: ethers.Signer;

  constructor(wallet: ethers.Signer) {
    this.wallet = wallet;
    
    // Check if wallet has a provider
    if (!wallet.provider) {
      throw new Error('Wallet provider is not available. Please ensure wallet is connected.');
    }
    
    this.provider = wallet.provider as ethers.BrowserProvider;
    
    // Initialize presale contract
    if (!CURRENT_PRESALE.presaleAddress) {
      throw new Error('Presale contract address not configured');
    }
    
    this.presaleContract = new ethers.Contract(
      CURRENT_PRESALE.presaleAddress,
      PRESALE_ABI,
      wallet
    );

    // Initialize token contract if address is available
    if (CURRENT_PRESALE.tokenAddress) {
      this.tokenContract = new ethers.Contract(
        CURRENT_PRESALE.tokenAddress,
        TOKEN_ABI,
        wallet
      );
    }
  }

  /**
   * Get current presale information
   */
  async getPresaleInfo(): Promise<PresaleInfo> {
    try {
      logger.log('🔍 Fetching presale info from contract:', CURRENT_PRESALE.presaleAddress);
      logger.log('🔍 Using provider: Browser provider');
      
      const info = await this.presaleContract.getPresaleInfo();
      
      logger.log('📊 Raw contract result:', {
        active: info.active,
        finalized: info.finalized,
        raised: info.raised.toString(),
        tokensSold: info.tokensSold.toString(),
        participantCount: info.participantCount.toString(),
        timeRemaining: info.timeRemaining.toString(),
      });
      
      // Convert raised amount from wei to USD
      const bnbPrice = await this.getBNBPrice();
      const raisedBNB = parseFloat(ethers.formatEther(info.raised));
      const raisedUSD = raisedBNB * bnbPrice;
      
      const timeRemainingSeconds = Number(info.timeRemaining);
      const timeRemainingMs = timeRemainingSeconds * 1000;
      
      logger.log('💰 Conversion:', {
        raisedBNB,
        bnbPrice,
        raisedUSD,
        timeRemainingSeconds,
        timeRemainingMs,
        timeRemainingDays: timeRemainingSeconds / (24 * 60 * 60),
      });
      
      const result = {
        active: info.active,
        finalized: info.finalized,
        raised: raisedUSD,
        tokensSold: parseFloat(ethers.formatUnits(info.tokensSold, 18)),
        participantCount: Number(info.participantCount),
        timeRemaining: timeRemainingMs, // Convert seconds to ms
        bnbPrice: bnbPrice, // Include BNB price for frontend calculations
      };
      
      logger.log('✅ Final result:', result);
      
      return result;
    } catch (error) {
      logger.error('❌ Error getting presale info:', error);
      logger.error('❌ Error details:', {
        message: (error as any).message,
        code: (error as any).code,
        reason: (error as any).reason,
      });
      throw error;
    }
  }

  /**
   * Get user's contribution and allocation info
   */
  async getUserInfo(address: string): Promise<UserInfo> {
    try {
      const info = await this.presaleContract.getUserInfo(address);
      
      const bnbPrice = await this.getBNBPrice();
      const contributionBNB = parseFloat(ethers.formatEther(info.contribution));
      const contributionUSD = contributionBNB * bnbPrice;
      
      return {
        contribution: contributionUSD,
        tokenAllocation: parseFloat(ethers.formatUnits(info.tokenAllocation, 18)),
        hasClaimed: info.claimed,
      };
    } catch (error) {
      logger.error('Error getting user info:', error);
      throw error;
    }
  }

  /**
   * Contribute to presale
   * @param amountUSD Amount in USD to contribute
   */
  async contribute(amountUSD: number): Promise<string> {
    try {
      // Convert USD to BNB
      const bnbPrice = await this.getBNBPrice();
      const amountBNB = amountUSD / bnbPrice;
      
      logger.log(`Contributing $${amountUSD} (${amountBNB.toFixed(4)} BNB)`);
      
      // Check limits (frontend validation)
      if (amountUSD < PRESALE_CONSTANTS.minContribution) {
        throw new Error(`Minimum contribution is $${PRESALE_CONSTANTS.minContribution}`);
      }
      
      // Additional check: Contract minimum is ~0.0167 BNB (~$10 at $600/BNB)
      // Frontend enforces $100 minimum, but contract allows lower
      // This ensures contract will accept the transaction
      const contractMinBNB = 0.0167; // Contract minimum in BNB
      if (amountBNB < contractMinBNB) {
        throw new Error(`Amount too low. Minimum is $${PRESALE_CONSTANTS.minContribution} (${contractMinBNB.toFixed(4)} BNB minimum for contract)`);
      }
      
      // Send transaction
      const valueInWei = ethers.parseEther(amountBNB.toFixed(18));
      logger.log('💰 Contributing:', {
        amountUSD: amountUSD,
        amountBNB: amountBNB.toFixed(4),
        valueInWei: valueInWei.toString(),
        presaleAddress: this.presaleContract.target,
      });
      
      // Encode the function call
      const iface = new ethers.Interface(PRESALE_ABI);
      const data = iface.encodeFunctionData('contribute', []);
      
      logger.log('📝 Transaction data:', {
        to: this.presaleContract.target,
        value: valueInWei.toString(),
        data: data
      });
      
      // Send the transaction with encoded data
      const tx = await this.wallet.sendTransaction({
        to: this.presaleContract.target,
        value: valueInWei,
        data: data,
        gasLimit: 300000, // Set gas limit to avoid estimation issues
      });
      
      logger.log('Transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }
      logger.log('Transaction confirmed:', receipt.hash);
      
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error contributing:', error);
      
      // Parse error message
      if (error.message.includes('Below minimum contribution')) {
        throw new Error(`Minimum contribution is $${PRESALE_CONSTANTS.minContribution}`);
      } else if (error.message.includes('Exceeds maximum contribution')) {
        throw new Error(`Maximum contribution is $${PRESALE_CONSTANTS.maxContribution} per wallet`);
      } else if (error.message.includes('Hard cap reached')) {
        throw new Error('Presale is full! Hard cap reached.');
      } else if (error.message.includes('Presale not active')) {
        throw new Error('Presale is not active yet');
      } else if (error.message.includes('user rejected')) {
        throw new Error('Transaction rejected by user');
      }
      
      throw error;
    }
  }

  /**
   * Claim tokens after presale is finalized
   */
  async claimTokens(): Promise<string> {
    try {
      const tx = await this.presaleContract.claimTokens({
        gasLimit: 200000,
      });
      
      logger.log('Claim transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      logger.log('Tokens claimed:', receipt.hash);
      
      return receipt.hash;
    } catch (error: any) {
      logger.error('Error claiming tokens:', error);
      
      if (error.message.includes('Presale not finalized')) {
        throw new Error('Presale is not finalized yet. Please wait.');
      } else if (error.message.includes('Already claimed')) {
        throw new Error('You have already claimed your tokens');
      } else if (error.message.includes('No tokens to claim')) {
        throw new Error('You have no tokens to claim');
      }
      
      throw error;
    }
  }

  /**
   * Claim refund if soft cap not reached
   */
  async claimRefund(): Promise<string> {
    try {
      const tx = await this.presaleContract.claimRefund({
        gasLimit: 200000,
      });
      
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      logger.error('Error claiming refund:', error);
      throw error;
    }
  }

  /**
   * Get user's token balance (after claim)
   */
  async getTokenBalance(address: string): Promise<number> {
    if (!this.tokenContract) {
      throw new Error('Token contract not initialized');
    }
    
    try {
      const balance = await this.tokenContract.balanceOf(address);
      return parseFloat(ethers.formatUnits(balance, 18));
    } catch (error) {
      logger.error('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Get BNB price in USD (mock for now - replace with real price feed)
   * TODO: Integrate with Chainlink or CoinGecko API
   */
  private async getBNBPrice(): Promise<number> {
    try {
      // Fetch real-time BNB price from CoinGecko via our API proxy
      const response = await fetch('/api/prices?symbols=BNB');
      if (!response.ok) {
        logger.warn('Failed to fetch BNB price, using fallback');
        return 600; // Fallback price
      }
      
      const data = await response.json();
      // API returns: { "BNB": { price: 600, change24h: 0.2 } }
      const bnbPrice = data.BNB?.price || 600;
      
      logger.log('💰 Live BNB Price:', bnbPrice);
      return bnbPrice;
    } catch (error) {
      logger.error('Error fetching BNB price:', error);
      return 600; // Fallback to safe estimate
    }
  }

  /**
   * Helper: Get current chain ID
   */
  async getChainId(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  /**
   * Helper: Verify we're on correct network
   */
  async verifyNetwork(): Promise<boolean> {
    const chainId = await this.getChainId();
    return chainId === CURRENT_PRESALE.chainId;
  }

  /**
   * Helper: Switch to presale network
   */
  async switchNetwork(): Promise<void> {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CURRENT_PRESALE.chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // If chain not added, add it
      if (error.code === 4902) {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${CURRENT_PRESALE.chainId.toString(16)}`,
            chainName: CURRENT_PRESALE.chainId === 97 ? 'BSC Testnet' : 'BSC Mainnet',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18,
            },
            rpcUrls: [CURRENT_PRESALE.rpcUrl],
            blockExplorerUrls: [CURRENT_PRESALE.explorerUrl],
          }],
        });
      } else {
        throw error;
      }
    }
  }
}





