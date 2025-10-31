/**
 * ⚡ CHECK INVOICE STATUS API
 * 
 * Checks if a Lightning invoice has been paid
 * 
 * POST /api/lightning/check-invoice
 * Body: { paymentHash: string }
 * Returns: { settled: boolean, settledAt?: number }
 */

import { NextRequest, NextResponse } from 'next/server';

// TODO: Import your LND/CLN client here
// import { LndClient } from '@/lib/lnd-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentHash } = body;

    if (!paymentHash) {
      return NextResponse.json(
        { error: 'Payment hash required' },
        { status: 400 }
      );
    }

    console.log(`⚡ Checking invoice status: ${paymentHash.substring(0, 10)}...`);

    // TODO: Replace with actual LND/CLN implementation
    // const lnd = new LndClient();
    // const invoice = await lnd.lookupInvoice({
    //   r_hash_str: paymentHash,
    // });
    // 
    // return NextResponse.json({
    //   settled: invoice.settled,
    //   settledAt: invoice.settle_date ? Number(invoice.settle_date) * 1000 : undefined,
    // });

    // For now, return mock status (always unpaid in development)
    return NextResponse.json({
      settled: false,
      settledAt: undefined,
    });
  } catch (error: any) {
    console.error('❌ Failed to check invoice status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check invoice' },
      { status: 500 }
    );
  }
}

