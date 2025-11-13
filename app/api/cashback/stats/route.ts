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

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    const userAddress = address.toLowerCase();
    const userTransactions = cashbackDatabase.get(userAddress) || [];

    // Calculate stats
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const thisMonth = userTransactions.filter(
      tx => tx.timestamp >= thirtyDaysAgo
    );

    const totalEarned = userTransactions
      .filter(tx => tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.cashbackAmountFormatted, 0);

    const thisMonthEarned = thisMonth
      .filter(tx => tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.cashbackAmountFormatted, 0);

    const pending = userTransactions
      .filter(tx => tx.status === 'pending')
      .reduce((sum, tx) => sum + tx.cashbackAmountFormatted, 0);

    const averageCashback = userTransactions.length > 0 
      ? totalEarned / userTransactions.length 
      : 0;

    // Find most common transaction type
    const typeCounts = userTransactions.reduce((counts, tx) => {
      counts[tx.transactionType] = (counts[tx.transactionType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const topTransactionType = Object.entries(typeCounts).reduce(
      (top, [type, count]) => (count as number) > (typeCounts[top] || 0) ? type : top,
      'swap'
    );

    const stats = {
      totalEarned: totalEarned.toString(),
      totalEarnedFormatted: totalEarned,
      thisMonth: thisMonthEarned.toString(),
      thisMonthFormatted: thisMonthEarned,
      pending: pending.toString(),
      pendingFormatted: pending,
      transactions: userTransactions.length,
      averageCashback,
      topTransactionType,
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('Error fetching cashback stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
