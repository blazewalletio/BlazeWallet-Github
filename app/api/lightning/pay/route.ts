/**
 * POST /api/lightning/pay
 * 
 * Pay Lightning invoice (send payment)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { bolt11 } = await request.json();

    if (!bolt11 || !bolt11.startsWith('ln')) {
      return NextResponse.json(
        { error: 'Valid BOLT11 invoice is required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual Greenlight payment
    
    console.log(`⚡ [Greenlight API] Paying invoice: ${bolt11.substring(0, 30)}...`);

    // Mock payment (replace with actual Greenlight API call)
    const mockPayment = {
      paymentHash: Buffer.from(Date.now().toString()).toString('hex'),
      amount: 10000000, // 10k sats in millisats
      fee: 1000, // 1 sat fee
      destination: '03' + '0'.repeat(64),
      status: 'success' as const,
    };

    return NextResponse.json({
      success: true,
      payment: mockPayment,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] Payment failed:', error);
    return NextResponse.json(
      { error: error.message || 'Payment failed' },
      { status: 500 }
    );
  }
}

