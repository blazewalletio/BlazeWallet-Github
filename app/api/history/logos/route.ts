import { NextRequest, NextResponse } from 'next/server';
import { resolveCoinGeckoHistoryLogo } from '@/lib/server/coingecko-logo-resolver';

interface HistoryLogoRequestItem {
  key: string;
  isNative: boolean;
  address?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chainKey = String(body?.chainKey || '').trim();
    const items = Array.isArray(body?.items) ? (body.items as HistoryLogoRequestItem[]) : [];

    if (!chainKey) {
      return NextResponse.json({ success: false, error: 'Missing chainKey' }, { status: 400 });
    }

    if (!items.length) {
      return NextResponse.json({ success: true, logos: {} });
    }

    const limitedItems = items.slice(0, 120);
    const logos: Record<string, string | null> = {};

    await Promise.all(
      limitedItems.map(async (item) => {
        const key = String(item.key || '').trim();
        if (!key) return;

        const logo = await resolveCoinGeckoHistoryLogo({
          chainKey,
          isNative: Boolean(item.isNative),
          address: item.address,
        });
        logos[key] = logo;
      })
    );

    return NextResponse.json(
      { success: true, logos },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to resolve logos' },
      { status: 500 }
    );
  }
}

