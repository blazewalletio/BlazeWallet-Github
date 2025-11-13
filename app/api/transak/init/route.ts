/**
 * 🔒 TRANSAK API - Server-Side Integration
 * 
 * Generates one-time Transak session tokens
 * Keeps API key secure on server
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, fiatAmount, fiatCurrency, cryptoCurrency } = await req.json();
    
    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }
    
    // Get Transak API key from server environment (secure!)
    const transakApiKey = process.env.TRANSAK_API_KEY;
    
    if (!transakApiKey) {
      return NextResponse.json(
        { 
          error: 'Transak not configured',
          message: 'Please add TRANSAK_API_KEY to environment variables'
        },
        { status: 503 }
      );
    }
    
    // Generate Transak widget parameters
    const transakConfig = {
      apiKey: transakApiKey,
      environment: process.env.TRANSAK_ENVIRONMENT || 'STAGING',
      walletAddress,
      fiatAmount: fiatAmount || 100,
      fiatCurrency: fiatCurrency || 'EUR',
      cryptoCurrencyCode: cryptoCurrency || 'ETH',
      networks: 'ethereum,polygon,arbitrum,optimism,base',
      disableWalletAddressForm: true,
      themeColor: 'f97316', // Blaze orange
    };
    
    return NextResponse.json({
      success: true,
      config: transakConfig,
    });
    
  } catch (error: any) {
    logger.error('Transak init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Transak', details: error.message },
      { status: 500 }
    );
  }
}

