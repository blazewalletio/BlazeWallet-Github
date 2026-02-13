import { NextResponse } from 'next/server';

export async function GET() {
  const publicVapidKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    '';

  return NextResponse.json({
    success: true,
    publicVapidKey: publicVapidKey || null,
  });
}


