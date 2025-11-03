/**
 * GET /api/lightning/history
 * 
 * Get Lightning payment history
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // TODO: Implement actual Greenlight history fetch
    
    console.log(`📜 [Greenlight API] Fetching payment history (limit: ${limit})...`);

    // Mock history (replace with actual Greenlight API call)
    const mockPayments = [];

    return NextResponse.json({
      success: true,
      payments: mockPayments,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] History fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get history' },
      { status: 500 }
    );
  }
}

