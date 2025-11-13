import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Mock database - in production, use a real database
const referralDatabase = new Map<string, any>();
const referralTransactions = new Map<string, any[]>();

// Mock referral transactions data
const mockReferralTransactions = {
  '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D': [
    {
      id: '1',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0x1234567890123456789012345678901234567890',
      transactionType: 'signup',
      amount: '50000000000000000000', // 50 BLAZE in wei
      amountFormatted: 50,
      status: 'confirmed',
      timestamp: Date.now() - 86400000, // 1 day ago
      description: 'Referral signup bonus',
    },
    {
      id: '2',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0x1234567890123456789012345678901234567890',
      transactionType: 'transaction_fee',
      amount: '2500000000000000000', // 2.5 BLAZE in wei
      amountFormatted: 2.5,
      status: 'confirmed',
      timestamp: Date.now() - 82800000, // 23 hours ago
      originalTransactionHash: '0xabcdef1234567890abcdef1234567890abcdef12',
      description: '10% fee share from referral transaction',
    },
    {
      id: '3',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      transactionType: 'signup',
      amount: '50000000000000000000', // 50 BLAZE in wei
      amountFormatted: 50,
      status: 'confirmed',
      timestamp: Date.now() - 172800000, // 2 days ago
      description: 'Referral signup bonus',
    },
    {
      id: '4',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      transactionType: 'transaction_fee',
      amount: '5000000000000000000', // 5 BLAZE in wei
      amountFormatted: 5,
      status: 'pending',
      timestamp: Date.now() - 3600000, // 1 hour ago
      originalTransactionHash: '0x9876543210fedcba9876543210fedcba98765432',
      description: '10% fee share from referral transaction',
    },
    {
      id: '5',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0x9876543210987654321098765432109876543210',
      transactionType: 'signup',
      amount: '50000000000000000000', // 50 BLAZE in wei
      amountFormatted: 50,
      status: 'confirmed',
      timestamp: Date.now() - 259200000, // 3 days ago
      description: 'Referral signup bonus',
    },
    {
      id: '6',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0x1111111111111111111111111111111111111111',
      transactionType: 'signup',
      amount: '50000000000000000000', // 50 BLAZE in wei
      amountFormatted: 50,
      status: 'confirmed',
      timestamp: Date.now() - 345600000, // 4 days ago
      description: 'Referral signup bonus',
    },
    {
      id: '7',
      referrerAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
      referredAddress: '0x2222222222222222222222222222222222222222',
      transactionType: 'signup',
      amount: '50000000000000000000', // 50 BLAZE in wei
      amountFormatted: 50,
      status: 'confirmed',
      timestamp: Date.now() - 432000000, // 5 days ago
      description: 'Referral signup bonus',
    },
  ],
};

// Initialize mock data
Object.entries(mockReferralTransactions).forEach(([address, transactions]) => {
  referralTransactions.set(address.toLowerCase(), transactions);
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
    const userTransactions = referralTransactions.get(userAddress) || [];

    // Calculate stats
    const confirmedTransactions = userTransactions.filter(tx => tx.status === 'confirmed');
    const pendingTransactions = userTransactions.filter(tx => tx.status === 'pending');

    const totalEarned = confirmedTransactions.reduce((sum, tx) => sum + tx.amountFormatted, 0);
    const pendingRewards = pendingTransactions.reduce((sum, tx) => sum + tx.amountFormatted, 0);
    const lifetimeEarnings = totalEarned + pendingRewards;

    // Count unique referrals
    const uniqueReferrals = new Set(confirmedTransactions.map(tx => tx.referredAddress)).size;
    const activeReferrals = uniqueReferrals; // For now, assume all are active

    const averageEarningsPerReferral = uniqueReferrals > 0 ? totalEarned / uniqueReferrals : 0;
    const topReferralEarnings = Math.max(...confirmedTransactions.map(tx => tx.amountFormatted), 0);

    const stats = {
      totalReferrals: uniqueReferrals,
      totalEarned: (totalEarned * 1e18).toString(), // Convert to wei
      totalEarnedFormatted: totalEarned,
      pendingRewards: (pendingRewards * 1e18).toString(), // Convert to wei
      pendingRewardsFormatted: pendingRewards,
      lifetimeEarnings: (lifetimeEarnings * 1e18).toString(), // Convert to wei
      lifetimeEarningsFormatted: lifetimeEarnings,
      activeReferrals,
      averageEarningsPerReferral,
      topReferralEarnings,
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('Error fetching referral stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
