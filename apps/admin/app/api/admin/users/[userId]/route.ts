import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyAdminSession } from '@/lib/admin-auth-utils';
import { MultiChainService } from '@/lib/multi-chain-service';
import { PriceService } from '@/lib/price-service';
import { CHAINS } from '@/lib/chains';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const adminUser = await verifyAdminSession(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.userId;
    const url = new URL(request.url);
    const includeBalances = url.searchParams.get('balances') === 'true';

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get email from auth.users (not in user_profiles!)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email || 'No email';

    // Smart display name fallback
    let displayName = profile.display_name;
    if (!displayName || displayName === 'BLAZE User' || displayName.trim() === '') {
      // Fallback: use first part of email or "Anonymous"
      displayName = userEmail.split('@')[0];
    }

    // Get wallets
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId);

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          profile: {
            id: profile.user_id,
            email: userEmail,
            display_name: displayName,
            created_at: profile.created_at,
          },
          wallets: [],
          balances: null,
          message: 'No wallets found for this user'
        },
      });
    }

    // Get wallet address (first wallet for now)
    const mainWallet = wallets[0];
    const walletAddress = mainWallet.wallet_address;

    let balanceData = null;

    // Fetch balances if requested
    if (includeBalances && walletAddress) {
      const priceService = new PriceService();
      const chainBalances: any[] = [];
      let totalPortfolioUSD = 0;

      // Fetch balances for all supported EVM chains
      const evmChains = Object.keys(CHAINS).filter(key => {
        const chain = CHAINS[key];
        return chain.type !== 'bitcoin' && key !== 'solana'; // EVM chains only for now
      });

      for (const chainKey of evmChains) {
        try {
          const chain = CHAINS[chainKey];
          const chainService = MultiChainService.getInstance(chainKey);

          // Get native balance
          const nativeBalance = await chainService.getBalance(walletAddress);
          const nativeSymbol = chain.nativeCurrency.symbol;

          // Get USD price
          const priceData = await priceService.getPrice(nativeSymbol);
          const nativeValueUSD = parseFloat(nativeBalance) * (priceData || 0);

          // Get ERC20 tokens
          let tokens: any[] = [];
          try {
            tokens = await chainService.getERC20TokenBalances(walletAddress);
          } catch (err) {
            logger.warn(`Failed to fetch tokens for ${chainKey}:`, err);
          }

          // Calculate token values
          let tokensValueUSD = 0;
          const enrichedTokens = await Promise.all(
            tokens.map(async (token) => {
              try {
                const tokenPrice = await priceService.getPrice(token.symbol);
                const valueUSD = parseFloat(token.balance) * (tokenPrice || 0);
                tokensValueUSD += valueUSD;
                
                return {
                  ...token,
                  priceUSD: tokenPrice,
                  valueUSD,
                };
              } catch {
                return { ...token, priceUSD: 0, valueUSD: 0 };
              }
            })
          );

          const chainTotalUSD = nativeValueUSD + tokensValueUSD;
          totalPortfolioUSD += chainTotalUSD;

          chainBalances.push({
            chain: chainKey,
            chainName: chain.name,
            nativeBalance: {
              symbol: nativeSymbol,
              balance: nativeBalance,
              priceUSD: priceData || 0,
              valueUSD: nativeValueUSD,
            },
            tokens: enrichedTokens,
            totalValueUSD: chainTotalUSD,
          });
        } catch (error) {
          logger.error(`Failed to fetch balance for ${chainKey}:`, error);
        }
      }

      balanceData = {
        chains: chainBalances,
        totalPortfolioUSD,
        lastFetched: new Date().toISOString(),
        _warning: 'Balances are fetched live from blockchain APIs. This is slow (10-30s) and may hit rate limits. Consider implementing balance caching.',
      };
    }

    // Get transaction events
    const { data: transactions } = await supabaseAdmin
      .from('transaction_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get user events
    const { data: events } = await supabaseAdmin
      .from('user_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get cohort data
    const { data: cohort } = await supabaseAdmin
      .from('user_cohorts')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Calculate stats
    const totalTransactions = transactions?.length || 0;
    const successfulTxs = transactions?.filter(tx => tx.status === 'success').length || 0;
    const failedTxs = transactions?.filter(tx => tx.status === 'failed').length || 0;
    
    const sendTxs = transactions?.filter(tx => tx.event_type.startsWith('send_')).length || 0;
    const swapTxs = transactions?.filter(tx => tx.event_type.startsWith('swap_')).length || 0;
    const receiveTxs = transactions?.filter(tx => tx.event_type === 'receive_detected').length || 0;
    
    const onrampEvents = events?.filter(e => e.event_name.startsWith('onramp_')).length || 0;

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.user_id,
          email: userEmail,
          display_name: displayName,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        },
        wallets: wallets.map(w => ({
          id: w.id,
          address: w.wallet_address,
          created_at: w.created_at,
        })),
        balances: balanceData,
        cohort: cohort || null,
        stats: {
          total_transactions: totalTransactions,
          successful_transactions: successfulTxs,
          failed_transactions: failedTxs,
          send_count: sendTxs,
          swap_count: swapTxs,
          receive_count: receiveTxs,
          onramp_count: onrampEvents,
          success_rate: totalTransactions > 0 ? ((successfulTxs / totalTransactions) * 100).toFixed(2) : '0',
        },
        transactions: transactions || [],
        events: events || [],
        _notes: {
          transactions: 'Transaction stats are 0 because wallet app does not track to transaction_events table yet',
          balances: includeBalances ? 'Balances fetched live from blockchain - slow and may be inaccurate due to rate limits' : 'Use ?balances=true to fetch (slow)',
        },
      },
    });
  } catch (error: any) {
    logger.error('[Admin API] User details failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
