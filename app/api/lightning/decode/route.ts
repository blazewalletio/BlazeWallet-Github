/**
 * POST /api/lightning/decode
 * 
 * Decode BOLT11 invoice to show details before paying
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

    // TODO: Implement actual BOLT11 decoding
    // Can use bolt11 npm package or Greenlight API
    
    console.log(`🔍 [Greenlight API] Decoding invoice: ${bolt11.substring(0, 30)}...`);

    // Mock decode (replace with actual decoding)
    const mockDecoded = {
      paymentHash: Buffer.from(Date.now().toString()).toString('hex'),
      amountSats: 1000, // Mock amount
      description: 'Lightning payment',
      expiresAt: Date.now() + 900000,
      destination: '03' + '0'.repeat(64),
    };

    return NextResponse.json({
      success: true,
      decoded: mockDecoded,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] Decode failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to decode invoice' },
      { status: 500 }
    );
  }
}

