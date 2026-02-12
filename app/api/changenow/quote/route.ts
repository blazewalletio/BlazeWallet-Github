import { NextRequest, NextResponse } from 'next/server';
import { ChangeNowService } from '@/lib/changenow-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.CHANGENOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ChangeNOW is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fromChain = (searchParams.get('fromChain') || '').toLowerCase();
    const toChain = (searchParams.get('toChain') || '').toLowerCase();
    const fromAmount = searchParams.get('fromAmount') || '';
    const toSymbol = (searchParams.get('toSymbol') || '').toLowerCase();
    const toIsNative = searchParams.get('toIsNative') === 'true';

    if (!fromChain || !toChain || !fromAmount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (fromChain !== 'bitcoin') {
      return NextResponse.json({ error: 'ChangeNOW route currently supports BTC source only' }, { status: 400 });
    }

    const parsedAmount = Number(fromAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid fromAmount' }, { status: 400 });
    }

    const fromCurrency = 'btc';
    const fromNetwork = ChangeNowService.getNetworkForChain(fromChain);
    const toNetwork = ChangeNowService.getNetworkForChain(toChain);
    const toCurrency = toIsNative
      ? ChangeNowService.getNativeCurrencyForChain(toChain)
      : (toSymbol || ChangeNowService.getNativeCurrencyForChain(toChain));

    const quote = await ChangeNowService.getQuote({
      apiKey,
      fromCurrency,
      toCurrency,
      fromNetwork,
      toNetwork,
      fromAmount,
    });

    return NextResponse.json({
      success: true,
      routeEngine: 'changenow',
      quote,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch ChangeNOW quote' },
      { status: 400 }
    );
  }
}

