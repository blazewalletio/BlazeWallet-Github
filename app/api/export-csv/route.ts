import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Export transaction history as CSV
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }
    
    // Get user's activity log (transactions)
    const { data: activities, error: activitiesError } = await getSupabaseAdmin()
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_type', 'transaction')
      .order('created_at', { ascending: false });
    
    if (activitiesError) {
      logger.error('Failed to fetch activities:', activitiesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transaction history' },
        { status: 500 }
      );
    }
    
    // Get transaction stats
    const { data: stats } = await getSupabaseAdmin()
      .from('user_transaction_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Generate CSV content
    const csvRows = [];
    
    // Header
    csvRows.push([
      'Date',
      'Time',
      'Type',
      'Description',
      'Amount',
      'Token',
      'Status',
      'IP Address',
      'Transaction Hash'
    ].join(','));
    
    // Data rows
    if (activities && activities.length > 0) {
      for (const activity of activities) {
        const date = new Date(activity.created_at);
        const metadata = activity.metadata || {};
        
        csvRows.push([
          date.toLocaleDateString('en-US'),
          date.toLocaleTimeString('en-US'),
          metadata.type || 'Transaction',
          `"${activity.description.replace(/"/g, '""')}"`, // Escape quotes
          metadata.amount || '',
          metadata.token || '',
          metadata.status || 'Completed',
          activity.ip_address || '',
          metadata.txHash || ''
        ].join(','));
      }
    }
    
    // Add summary row
    if (stats) {
      csvRows.push(''); // Empty line
      csvRows.push('Summary');
      csvRows.push(`Total Transactions,${stats.total_transactions}`);
      csvRows.push(`Total Sent,${stats.total_sent}`);
      csvRows.push(`Total Received,${stats.total_received}`);
      csvRows.push(`Total Gas Spent,${stats.total_gas_spent}`);
      csvRows.push(`Favorite Token,${stats.favorite_token || 'N/A'}`);
    }
    
    const csvContent = csvRows.join('\n');
    
    // Log the export
    await getSupabaseAdmin().rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'settings_change',
      p_description: 'Exported transaction history (CSV)',
      p_metadata: JSON.stringify({ 
        format: 'csv',
        rows: activities?.length || 0
      })
    });
    
    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="blaze-wallet-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
    
  } catch (error: any) {
    logger.error('CSV Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

