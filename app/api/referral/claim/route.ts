import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Mock database - in production, use a real database
const referralTransactions = new Map<string, any[]>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, amount } = body;

    if (!userAddress || !amount) {
      return NextResponse.json(
        { error: 'userAddress and amount are required' },
        { status: 400 }
      );
    }

    const address = userAddress.toLowerCase();
    const userTransactions = referralTransactions.get(address) || [];

    // Find pending transactions
    const pendingTransactions = userTransactions.filter(tx => tx.status === 'pending');
    
    if (pendingTransactions.length === 0) {
      return NextResponse.json(
        { error: 'No pending referral rewards to claim' },
        { status: 400 }
      );
    }

    // Mark pending transactions as claimed
    pendingTransactions.forEach(tx => {
      tx.status = 'claimed';
      tx.claimedAt = Date.now();
    });

    // Update the database
    referralTransactions.set(address, userTransactions);

    // In a real implementation, this would:
    // 1. Call a smart contract to transfer BLAZE tokens
    // 2. Wait for transaction confirmation
    // 3. Return the actual transaction hash
    
    // For now, simulate a transaction hash
    const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    return NextResponse.json({
      success: true,
      transactionHash: mockTransactionHash,
      claimedAmount: amount,
      transactionsClaimed: pendingTransactions.length,
    });
  } catch (error) {
    logger.error('Error claiming referral rewards:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
