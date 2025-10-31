import { ethers } from 'ethers';
import { CHAINS } from './chains';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private chainKey: string;

  constructor(chainKey: string = 'ethereum') {
    this.chainKey = chainKey;
    const chain = CHAINS[chainKey];
    if (!chain) {
      throw new Error(`Unknown chain: ${chainKey}`);
    }
    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  }

  getChain() {
    return CHAINS[this.chainKey];
  }

  // Get ETH/native balance
  async getBalance(address: string): Promise<string> {
    try {
      // Force latest block to avoid cached data
      const balance = await this.provider.getBalance(address, 'latest');
      const formatted = ethers.formatEther(balance);
      console.log(`Balance for ${address}: ${formatted} on chain ${this.chainKey}`);
      return formatted;
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error; // Re-throw so we can see the actual error
    }
  }

  // Get current gas price
  async getGasPrice(): Promise<{ slow: string; standard: string; fast: string }> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      
      // Calculate different speed options
      const slow = ethers.formatUnits(gasPrice * BigInt(80) / BigInt(100), 'gwei');
      const standard = ethers.formatUnits(gasPrice, 'gwei');
      const fast = ethers.formatUnits(gasPrice * BigInt(120) / BigInt(100), 'gwei');

      return { slow, standard, fast };
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return { slow: '0', standard: '0', fast: '0' };
    }
  }

  // Send ETH transaction
  async sendTransaction(
    wallet: ethers.Wallet | ethers.HDNodeWallet,
    to: string,
    amount: string,
    gasPrice?: string
  ): Promise<ethers.TransactionResponse> {
    try {
      // Connect wallet to provider
      const connectedWallet = wallet.connect(this.provider);

      // Prepare transaction
      const tx = {
        to,
        value: ethers.parseEther(amount),
        gasLimit: 21000,
        ...(gasPrice && { gasPrice: ethers.parseUnits(gasPrice, 'gwei') }),
      };

      // Send transaction
      const transaction = await connectedWallet.sendTransaction(tx);
      return transaction;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  // Get transaction history from block explorer APIs with RPC fallback
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    try {
      const chainId = await this.provider.getNetwork().then(n => Number(n.chainId));
      
      // Get API keys from environment with fallbacks
      const getApiKey = (chain: number): string => {
        const keys: Record<number, string | undefined> = {
          1: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          11155111: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          56: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          97: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          137: process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          42161: process.env.NEXT_PUBLIC_ARBISCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          10: process.env.NEXT_PUBLIC_OPTIMISM_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
          8453: process.env.NEXT_PUBLIC_BASESCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        };
        return keys[chain] || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
      };

      // API endpoints - using native APIs for better reliability (matches server-side)
      const apiConfig: Record<number, { url: string; v2: boolean }> = {
        1: { url: 'https://api.etherscan.io/api', v2: false }, // Ethereum
        56: { url: 'https://api.bscscan.com/api', v2: false }, // BSC Mainnet
        97: { url: 'https://api-testnet.bscscan.com/api', v2: false }, // BSC Testnet
        137: { url: 'https://api.polygonscan.com/api', v2: false }, // Polygon
        42161: { url: 'https://api.arbiscan.io/api', v2: false }, // Arbitrum
        10: { url: 'https://api-optimistic.etherscan.io/api', v2: false }, // Optimism
        8453: { url: 'https://api.basescan.org/api', v2: false }, // Base
        11155111: { url: 'https://api-sepolia.etherscan.io/api', v2: false }, // Sepolia
      };

      const config = apiConfig[chainId];
      const apiKey = getApiKey(chainId);

      // Try block explorer API via server proxy (if config exists)
      if (config) {
        try {
          // Use Next.js API route to avoid CORS issues
          const proxyUrl = `/api/transactions?chainId=${chainId}&address=${address}&limit=${limit}`;
          
          console.log(`🔍 Trying block explorer API for chain ${chainId}...`);

          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            const data = await response.json();

            if (data.status === '1' && data.result && Array.isArray(data.result)) {
              console.log(`✅ Loaded ${data.result.length} transactions from block explorer`);
              
              // Get chain config for metadata
              const chainConfig = CHAINS[this.chainKey];
              
              return data.result.map((tx: any) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: ethers.formatEther(tx.value),
                timestamp: parseInt(tx.timeStamp) * 1000,
                isError: tx.isError === '1',
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                blockNumber: tx.blockNumber,
                // ✅ Native currency metadata for proper display
                tokenName: chainConfig?.nativeCurrency.name || 'ETH',
                tokenSymbol: chainConfig?.nativeCurrency.symbol || 'ETH',
                logoUrl: chainConfig?.logoUrl || '/crypto-ethereum.png',
              }));
            } else {
              console.warn(`Block explorer API failed: ${data.message || 'Unknown error'}`);
            }
          }
        } catch (explorerError) {
          console.warn('Block explorer API unavailable, falling back to RPC scan');
        }
      }

      // No API key or API failed - show helpful message
      console.error('❌ Transaction history unavailable');
      console.error('📋 To view transaction history, add a valid Etherscan API key:');
      console.error('   1. Create free account: https://etherscan.io/register');
      console.error('   2. Get API key: https://etherscan.io/myapikey');
      console.error('   3. Add to Vercel: NEXT_PUBLIC_ETHERSCAN_API_KEY');
      console.error('   4. Redeploy app');
      
      return [];

    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  // Validate Ethereum address
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  // Format address for display (0x1234...5678)
  static formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Estimate transaction fee in USD (simplified)
  async estimateTransactionFee(gasPrice: string): Promise<string> {
    try {
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei');
      const gasLimit = BigInt(21000); // Standard ETH transfer
      const feeInEth = ethers.formatEther(gasPriceWei * gasLimit);
      
      // In production, fetch real ETH price
      const ethPriceUSD = 1700; // Placeholder
      const feeInUSD = (parseFloat(feeInEth) * ethPriceUSD).toFixed(2);
      
      return feeInUSD;
    } catch (error) {
      console.error('Error estimating fee:', error);
      return '0';
    }
  }
}



