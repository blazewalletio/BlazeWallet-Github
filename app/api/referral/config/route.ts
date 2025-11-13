import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const config = {
      signupReward: '50000000000000000000', // 50 BLAZE in wei
      signupRewardFormatted: 50,
      feeSharePercentage: 10, // 10% of referred user's transaction fees
      minimumTransactionForFeeShare: '100000000000000000', // 0.1 ETH minimum for fee share
      maximumFeeSharePerTransaction: '10000000000000000000', // 10 ETH maximum fee share per transaction
    };

    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error fetching referral config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
