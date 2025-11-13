import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const config = {
      swapPercentage: 2, // 2% cashback for swaps
      sendPercentage: 1, // 1% cashback for sends
      buyPercentage: 1.5, // 1.5% cashback for buys
      stakePercentage: 5, // 5% cashback for staking
      unstakePercentage: 2, // 2% cashback for unstaking
      minimumTransaction: '100000000000000000', // 0.1 ETH minimum for cashback
      maximumCashback: '10000000000000000000', // 10 ETH maximum cashback per transaction
    };

    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error fetching cashback config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
