/**
 * 🔒 TRANSAK API - Server-Side Integration
 * 
 * Generates secure Transak widget URL
 * Keeps API key secure on server
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { 
      walletAddress, 
      walletAddresses,
      currencyCode,
      baseCurrencyCode,
      chainId 
    } = await req.json();
    
    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }
    
    // Get Transak API key from server environment (secure!)
    const transakApiKey = process.env.TRANSAK_API_KEY || process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
    
    if (!transakApiKey) {
      return NextResponse.json(
        { 
          error: 'Transak not configured',
          message: 'Please add TRANSAK_API_KEY to environment variables'
        },
        { status: 503 }
      );
    }
    
    // Build Transak widget URL with parameters
    const params = new URLSearchParams({
      apiKey: transakApiKey,
      environment: process.env.TRANSAK_ENVIRONMENT || 'STAGING',
      defaultCryptoCurrency: currencyCode || 'ETH',
      defaultFiatCurrency: baseCurrencyCode || 'EUR',
      walletAddress: walletAddress,
      themeColor: 'f97316', // Blaze orange (without #)
      hideMenu: 'false',
      disableWalletAddressForm: 'true',
      isAutoFillUserData: 'false',
    });
    
    // Add multi-chain wallet addresses if provided
    if (walletAddresses) {
      Object.entries(walletAddresses).forEach(([key, value]) => {
        params.append(`walletAddressesData[${key}]`, value as string);
      });
    }
    
    // Add network based on chainId
    if (chainId) {
      const networkMap: Record<string, string> = {
        'ethereum': 'ethereum',
        'polygon': 'polygon',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'base': 'base',
        'bsc': 'bsc',
        'avalanche': 'avaxcchain',
      };
      
      const network = networkMap[chainId];
      if (network) {
        params.append('network', network);
      }
    }
    
    const widgetUrl = `https://global.transak.com/?${params.toString()}`;
    
    logger.log('✅ Transak widget URL generated');
    
    return NextResponse.json({
      success: true,
      widgetUrl,
    });
    
  } catch (error: any) {
    logger.error('Transak init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Transak', details: error.message },
      { status: 500 }
    );
  }
}