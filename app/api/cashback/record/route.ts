import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Mock database - in production, use a real database
const cashbackDatabase = new Map<string, any[]>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      transactionHash,
      transactionType,
      amount,
      cashbackAmount,
      cashbackPercentage,
      tokenAddress,
      tokenSymbol,
      fromToken,
      toToken,
    } = body;

    if (!userAddress || !transactionHash || !transactionType || !amount || !cashbackAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const address = userAddress.toLowerCase();
    const userTransactions = cashbackDatabase.get(address) || [];

    // Create new cashback transaction record
    const newTransaction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAddress: address,
      transactionHash,
      transactionType,
      amount,
      amountFormatted: parseFloat(amount) / 1e18, // Convert wei to ETH
      cashbackAmount,
      cashbackAmountFormatted: parseFloat(cashbackAmount) / 1e18,
      cashbackPercentage,
      status: 'pending', // Will be confirmed after blockchain confirmation
      timestamp: Date.now(),
      blockNumber: 0, // Will be filled when confirmed
      tokenAddress,
      tokenSymbol,
      fromToken,
      toToken,
    };

    // Add to user's transactions
    userTransactions.push(newTransaction);
    cashbackDatabase.set(address, userTransactions);

    logger.log('Recorded cashback transaction:', newTransaction);

    return NextResponse.json({
      success: true,
      transaction: newTransaction,
    });
  } catch (error) {
    logger.error('Error recording cashback transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
