/**
 * POST /api/lightning/invoice
 * 
 * Create Lightning invoice (receive payment)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amountSats, description } = await request.json();

    if (!amountSats || amountSats <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual Greenlight invoice creation
    
    console.log(`⚡ [Greenlight API] Creating invoice: ${amountSats} sats`);

    // Mock invoice (replace with actual Greenlight API call)
    const mockInvoice = {
      bolt11: `lnbc${amountSats}u1pj...${Date.now()}`, // Mock BOLT11
      paymentHash: Buffer.from(Date.now().toString()).toString('hex'),
      amount: amountSats * 1000, // Convert to millisats
      description: description || '',
      expiresAt: Date.now() + 900000, // 15 minutes
      status: 'pending' as const,
    };

    return NextResponse.json({
      success: true,
      invoice: mockInvoice,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] Invoice creation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

