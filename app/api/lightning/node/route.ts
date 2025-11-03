/**
 * GET /api/lightning/node
 * 
 * Get Lightning node information
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // TODO: Implement actual Greenlight node info fetch
    
    console.log('ℹ️ [Greenlight API] Fetching node info...');

    // Mock node info (replace with actual Greenlight API call)
    const mockNodeInfo = {
      nodeId: '03' + 'a'.repeat(64),
      alias: 'Blaze Wallet',
      color: '#ff6b00',
      version: 'greenlight-1.0',
      blockHeight: 850000,
      network: 'mainnet' as const,
    };

    return NextResponse.json({
      success: true,
      nodeInfo: mockNodeInfo,
    });
  } catch (error: any) {
    console.error('❌ [Greenlight API] Node info fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get node info' },
      { status: 500 }
    );
  }
}

