import { Chain } from './types';

export const CHAINS: Record<string, Chain> = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    color: '#627EEA',
    icon: 'Ξ',
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    shortName: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
    },
    color: '#8247E5',
    icon: '⬡',
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    shortName: 'ARB',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    color: '#28A0F0',
    icon: '◆',
  },
  base: {
    id: 8453,
    name: 'Base',
    shortName: 'BASE',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    color: '#0052FF',
    icon: '🔵',
  },
  sepolia: {
    id: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'SEP',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    color: '#627EEA',
    icon: 'Ξ',
    isTestnet: true,
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    color: '#F3BA2F',
    icon: '💎',
  },
  bscTestnet: {
    id: 97,
    name: 'BSC Testnet',
    shortName: 'BSC-T',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'tBNB',
      decimals: 18,
    },
    color: '#F3BA2F',
    icon: '🧪',
    isTestnet: true,
  },
  solana: {
    id: 101,
    name: 'Solana',
    shortName: 'SOL',
    rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/demo', // ✅ More reliable RPC
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    color: '#9945FF',
    icon: '◎',
  },
};

export const DEFAULT_CHAIN = 'ethereum';

export const POPULAR_TOKENS: Record<string, any[]> = {
  ethereum: [
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logo: '💵',
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logo: '💲',
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      logo: '₿',
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      logo: '🔗',
    },
  ],
  polygon: [
    {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logo: '💵',
    },
    {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logo: '💲',
    },
  ],
  arbitrum: [
    {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logo: '💵',
    },
    {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logo: '💲',
    },
  ],
  base: [
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logo: '💲',
    },
  ],
  bsc: [
    {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      logo: '💵',
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      logo: '💲',
    },
    {
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      symbol: 'BUSD',
      name: 'Binance USD',
      decimals: 18,
      logo: '💰',
    },
  ],
  bscTestnet: [
    {
      address: '0x2C1421595151991ac3894943123d6c285bdF5116',
      symbol: 'BLAZE',
      name: 'Blaze Token',
      decimals: 18,
      logo: '🔥',
    },
  ],
  // Solana SPL Tokens - fetched dynamically via SolanaService.getSPLTokenBalances()
  // Note: These are just for reference, actual SPL tokens are loaded from chain
  solana: [
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logo: '💲',
    },
    {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logo: '💵',
    },
    {
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      decimals: 6,
      logo: '🌊',
    },
    {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      decimals: 5,
      logo: '🐶',
    },
  ],
};






