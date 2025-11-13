import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Mock database - in production, use a real database
const cashbackDatabase = new Map<string, any[]>();

// Mock cashback data for testing
const mockCashbackData = {
  '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D': [
    {
      id: '1',
      userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
      transactionType: 'swap',
      amount: '1000000000000000000', // 1 ETH in wei
      amountFormatted: 1.0,
      cashbackAmount: '20000000000000000', // 0.02 ETH (2%)
      cashbackAmountFormatted: 0.02,
      cashbackPercentage: 2,
      status: 'confirmed',
      timestamp: Date.now() - 86400000, // 1 day ago
      blockNumber: 12345678,
      tokenSymbol: 'ETH',
      fromToken: 'USDT',
      toToken: 'ETH',
    },
    {
      id: '2',
      userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef12',
      transactionType: 'send',
      amount: '500000000000000000', // 0.5 ETH in wei
      amountFormatted: 0.5,
      cashbackAmount: '5000000000000000', // 0.005 ETH (1%)
      cashbackAmountFormatted: 0.005,
      cashbackPercentage: 1,
      status: 'confirmed',
      timestamp: Date.now() - 172800000, // 2 days ago
      blockNumber: 12345670,
      tokenSymbol: 'ETH',
    },
    {
      id: '3',
      userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      transactionHash: '0x9876543210fedcba9876543210fedcba98765432',
      transactionType: 'swap',
      amount: '2000000000000000000', // 2 ETH in wei
      amountFormatted: 2.0,
      cashbackAmount: '40000000000000000', // 0.04 ETH (2%)
      cashbackAmountFormatted: 0.04,
      cashbackPercentage: 2,
      status: 'pending',
      timestamp: Date.now() - 3600000, // 1 hour ago
      blockNumber: 12345690,
      tokenSymbol: 'ETH',
      fromToken: 'BNB',
      toToken: 'ETH',
    },
    {
      id: '4',
      userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      transactionHash: '0x5555555555555555555555555555555555555555',
      transactionType: 'stake',
      amount: '5000000000000000000', // 5 ETH in wei
      amountFormatted: 5.0,
      cashbackAmount: '250000000000000000', // 0.25 ETH (5%)
      cashbackAmountFormatted: 0.25,
      cashbackPercentage: 5,
      status: 'confirmed',
      timestamp: Date.now() - 259200000, // 3 days ago
      blockNumber: 12345660,
      tokenSymbol: 'BLAZE',
    },
    {
      id: '5',
      userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      transactionHash: '0x6666666666666666666666666666666666666666',
      transactionType: 'buy',
      amount: '100000000000000000', // 0.1 ETH in wei
      amountFormatted: 0.1,
      cashbackAmount: '1500000000000000', // 0.0015 ETH (1.5%)
      cashbackAmountFormatted: 0.0015,
      cashbackPercentage: 1.5,
      status: 'pending',
      timestamp: Date.now() - 7200000, // 2 hours ago
      blockNumber: 12345695,
      tokenSymbol: 'BLAZE',
    },
  ],
};

// Initialize mock data
Object.entries(mockCashbackData).forEach(([address, transactions]) => {
  cashbackDatabase.set(address.toLowerCase(), transactions);
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    const userAddress = address.toLowerCase();
    const userTransactions = cashbackDatabase.get(userAddress) || [];

    // Sort by timestamp (newest first) and limit results
    const sortedTransactions = userTransactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return NextResponse.json(sortedTransactions);
  } catch (error) {
    logger.error('Error fetching cashback transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
