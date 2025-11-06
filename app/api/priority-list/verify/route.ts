import { NextRequest, NextResponse } from 'next/server';
import { PriorityListService } from '@/lib/priority-list-service';

// GET /api/priority-list/verify?token=xxx - Verify email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Verification token is required' },
        { status: 400 }
      );
    }

    const result = await PriorityListService.verifyEmail(token);

    if (result.success) {
      // Redirect to success page
      return NextResponse.redirect(new URL('/?verified=true', request.url));
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to verify email' },
      { status: 500 }
    );
  }
}

