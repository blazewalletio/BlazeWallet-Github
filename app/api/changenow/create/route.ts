import { NextRequest, NextResponse } from 'next/server';
import { ChangeNowService } from '@/lib/changenow-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CHANGENOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ChangeNOW is not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const fromChain = (body.fromChain || '').toLowerCase();
    const toChain = (body.toChain || '').toLowerCase();
    const fromAmount = body.fromAmount?.toString() || '';
    const toSymbol = (body.toSymbol || '').toLowerCase();
    const toIsNative = Boolean(body.toIsNative);
    const payoutAddress = (body.payoutAddress || '').trim();
    const refundAddress = (body.refundAddress || '').trim();

    if (!fromChain || !toChain || !fromAmount || !payoutAddress || !refundAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const order = await ChangeNowService.createOrder({
      apiKey,
      fromCurrency,
      toCurrency,
      fromAmount,
      payoutAddress,
      refundAddress,
      fromNetwork,
      toNetwork,
    });

    return NextResponse.json({ success: true, routeEngine: 'changenow', order });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create ChangeNOW order' }, { status: 400 });
  }
}

