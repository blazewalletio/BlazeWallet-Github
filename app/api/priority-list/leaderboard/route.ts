import { NextRequest, NextResponse } from 'next/server';
import { PriorityListService } from '@/lib/priority-list-service';

// GET /api/priority-list/leaderboard - Get referral leaderboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const leaderboard = await PriorityListService.getLeaderboard(limit);

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

