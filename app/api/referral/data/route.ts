import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Mock database - in production, use a real database
const referralDatabase = new Map<string, any>();
const referralTransactions = new Map<string, any[]>();

// Mock referral data for testing
const mockReferralData = {
  '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D': {
    userAddress: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
    referralCode: 'BLAZE-ABC123',
    referralLink: 'https://blazewallet.app/ref/BLAZE-ABC123',
    totalReferrals: 5,
    totalEarned: '650000000000000000000', // 650 BLAZE in wei
    totalEarnedFormatted: 650,
    pendingRewards: '150000000000000000000', // 150 BLAZE in wei
    pendingRewardsFormatted: 150,
    lifetimeEarnings: '800000000000000000000', // 800 BLAZE in wei
    lifetimeEarningsFormatted: 800,
  },
};

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
  ],
};

// Initialize mock data
Object.entries(mockReferralData).forEach(([address, data]) => {
  referralDatabase.set(address.toLowerCase(), data);
});

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
    let userData = referralDatabase.get(userAddress);

    // If user doesn't exist, create a new referral profile
    if (!userData) {
      // Generate a unique referral code
      const referralCode = `BLAZE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const referralLink = `https://blazewallet.app/ref/${referralCode}`;

      userData = {
        userAddress,
        referralCode,
        referralLink,
        totalReferrals: 0,
        totalEarned: '0',
        totalEarnedFormatted: 0,
        pendingRewards: '0',
        pendingRewardsFormatted: 0,
        lifetimeEarnings: '0',
        lifetimeEarningsFormatted: 0,
      };

      // Save to database
      referralDatabase.set(userAddress, userData);
    }

    return NextResponse.json(userData);
  } catch (error) {
    logger.error('Error fetching referral data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
