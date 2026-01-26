import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  balance?: string;
  balanceUSD?: string;
  priceUSD?: number;
  change24h?: number;
}

export interface Chain {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  color: string;
  icon: string;
  logoUrl?: string;
  isTestnet?: boolean;
  chainType?: 'EVM' | 'SOL' | 'UTXO'; // Chain type for better detection
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueUSD?: string;
  token?: Token;
  timestamp: number;
  type: 'sent' | 'received' | 'swap' | 'contract';
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  category?: string;
}

export interface Portfolio {
  totalValueUSD: number;
  change24h: number;
  change24hPercent: number;
  tokens: Token[];
  nativeBalance: string;
  nativeBalanceUSD: number;
}

export interface PriceAlert {
  id: string;
  tokenSymbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  enabled: boolean;
  triggered: boolean;
}
