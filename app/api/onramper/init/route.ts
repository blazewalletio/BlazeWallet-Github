/**
 * 🔒 ONRAMPER API - Server-Side Widget Initialization
 * 
 * Generates secure Onramper widget URL
 * Keeps API key secure on server
 * 
 * Docs: https://docs.onramper.com/docs/integration-steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { 
      walletAddress, 
      walletAddresses,
      defaultCryptoCurrency,
      defaultFiatCurrency,
      defaultAmount,
      chainId,
      theme,
      solanaAddress,
      bitcoinAddress
    } = await req.json();
    
    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }
    
    // Get Onramper API key from server environment (secure!)
    const onramperApiKey = process.env.ONRAMPER_API_KEY || process.env.NEXT_PUBLIC_ONRAMPER_API_KEY;
    
    if (!onramperApiKey) {
      logger.warn('⚠️ Onramper API key not configured');
      return NextResponse.json(
        { 
          error: 'Onramper not configured',
          message: 'Please add ONRAMPER_API_KEY to environment variables'
        },
        { status: 503 }
      );
    }
    
    // Check if sandbox mode
    const isSandbox = process.env.ONRAMPER_ENVIRONMENT === 'sandbox' || 
                      process.env.NODE_ENV !== 'production';
    
    // Determine default crypto if not provided
    const defaultCrypto = defaultCryptoCurrency || 
                         (chainId ? OnramperService.getDefaultCrypto(chainId) : 'ETH');
    
    // Create wallet addresses object if not provided
    let walletAddressesObj = walletAddresses;
    if (!walletAddressesObj && chainId) {
      walletAddressesObj = OnramperService.createWalletAddresses(
        walletAddress,
        chainId,
        solanaAddress,
        bitcoinAddress
      );
    } else if (!walletAddressesObj) {
      walletAddressesObj = { ethereum: walletAddress };
    }
    
    // Build Onramper config
    const config = {
      walletAddress,
      walletAddresses: walletAddressesObj,
      defaultCryptoCurrency: defaultCrypto,
      defaultFiatCurrency: defaultFiatCurrency || 'EUR',
      defaultAmount,
      theme: theme || 'light',
      mode: 'buy' as const,
    };
    
    // Generate widget URL
    const widgetUrl = OnramperService.generateWidgetUrl(config, onramperApiKey, isSandbox);
    
    logger.log('✅ Onramper widget URL generated successfully');
    logger.log('Config:', {
      defaultCrypto: config.defaultCryptoCurrency,
      defaultFiat: config.defaultFiatCurrency,
      chainId,
      isSandbox,
    });
    
    return NextResponse.json({
      success: true,
      widgetUrl,
      config: {
        defaultCryptoCurrency: config.defaultCryptoCurrency,
        defaultFiatCurrency: config.defaultFiatCurrency,
        theme: config.theme,
      },
    });
    
  } catch (error: any) {
    logger.error('❌ Onramper init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Onramper', details: error.message },
      { status: 500 }
    );
  }
}

