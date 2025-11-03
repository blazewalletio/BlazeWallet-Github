/**
 * GET /api/lightning/balance
 * 
 * Get Lightning channel balance
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // TODO: Implement actual Greenlight balance fetch
    
    console.log('💰 [Greenlight API] Fetching balance...');

    // Mock response (replace with actual Greenlight API call)
    const mockBalance = {
      local: 1000000000, // 1M sats in millisats
      remote: 5000000000, // 5M sats in millisats
      total: 6000000000,
    };

    return NextResponse.json({
      success: true,
      balance: mockBalance,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] Balance fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance' },
      { status: 500 }
    );
  }
}
