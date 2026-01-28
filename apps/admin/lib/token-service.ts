import { ethers } from 'ethers';
import { Token } from './types';
import { logger } from '@/lib/logger';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

export class TokenService {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error('Error fetching token balance:', error);
      return '0';
    }
  }

  async getTokenInfo(tokenAddress: string): Promise<Partial<Token>> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals(),
      ]);
      
      return {
        address: tokenAddress,
        symbol,
        name,
        decimals,
      };
    } catch (error) {
      logger.error('Error fetching token info:', error);
      throw error;
    }
  }

  async sendToken(
    wallet: ethers.Wallet | ethers.HDNodeWallet,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    decimals: number
  ): Promise<ethers.TransactionResponse> {
    try {
      const connectedWallet = wallet.connect(this.provider);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);
      
      const amountInWei = ethers.parseUnits(amount, decimals);
      const tx = await contract.transfer(toAddress, amountInWei);
      
      return tx;
    } catch (error) {
      logger.error('Error sending token:', error);
      throw error;
    }
  }

  async getMultipleTokenBalances(
    tokens: Token[],
    walletAddress: string
  ): Promise<Token[]> {
    const balancePromises = tokens.map(async (token) => {
      const balance = await this.getTokenBalance(token.address, walletAddress);
      return {
        ...token,
        balance,
      };
    });

    return Promise.all(balancePromises);
  }
}
