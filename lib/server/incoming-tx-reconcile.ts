import { ethers } from 'ethers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { CHAINS } from '@/lib/chains';
import { MultiChainService } from '@/lib/multi-chain-service';
import { AlchemyService } from '@/lib/alchemy-service';
import { dispatchNotification } from '@/lib/server/notification-dispatcher';

type WatchRow = {
  user_id: string;
  chain_key: string;
  address: string;
};

type CursorRow = {
  user_id: string;
  chain_key: string;
  address: string;
  last_seen_tx_hash: string | null;
};

type NormalizedIncomingTx = {
  hash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenSymbol: string;
  timestampIso: string;
  isNative: boolean;
};

const UTXO_CHAINS = new Set(['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash']);

const EVM_EXPLORER_CONFIG: Record<number, string> = {
  1: 'https://api.etherscan.io/api',
  11155111: 'https://api-sepolia.etherscan.io/api',
  56: 'https://api.bscscan.com/api',
  97: 'https://api-testnet.bscscan.com/api',
  137: 'https://api.polygonscan.com/api',
  42161: 'https://api.arbiscan.io/api',
  10: 'https://api-optimistic.etherscan.io/api',
  8453: 'https://api.basescan.org/api',
  43114: 'https://api.snowtrace.io/api',
  250: 'https://api.ftmscan.com/api',
  25: 'https://api.cronoscan.com/api',
  324: 'https://api-era.zksync.network/api',
  59144: 'https://api.lineascan.build/api',
};

function getExplorerApiKey(chainId: number): string {
  const keys: Record<number, string | undefined> = {
    1: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    11155111: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    56: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    97: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    137: process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    42161: process.env.NEXT_PUBLIC_ARBISCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    10: process.env.NEXT_PUBLIC_OPTIMISM_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    8453: process.env.NEXT_PUBLIC_BASESCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    43114: process.env.NEXT_PUBLIC_SNOWTRACE_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    250: process.env.NEXT_PUBLIC_FTMSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    25: process.env.NEXT_PUBLIC_CRONOSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    324: process.env.NEXT_PUBLIC_ZKSYNC_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    59144: process.env.NEXT_PUBLIC_LINEASCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
  };
  return (keys[chainId] || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '').trim();
}

function isEvmChain(chainKey: string): boolean {
  const chainId = CHAINS[chainKey]?.id;
  return typeof chainId === 'number' && chainId > 0 && chainKey !== 'solana';
}

function sameAddress(a: unknown, b: unknown): boolean {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function pickAddress(value: unknown, fallback = 'unknown'): string {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    return first ? String(first) : fallback;
  }
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
}

function parseAmount(chainKey: string, tx: any): string {
  if (typeof tx?.valueNative === 'string' && tx.valueNative.trim()) return tx.valueNative;
  if (typeof tx?.valueBTC === 'string' && tx.valueBTC.trim()) return tx.valueBTC;
  if (typeof tx?.value === 'string' && tx.value.trim()) return tx.value;

  const numeric = Number(tx?.value);
  if (!Number.isFinite(numeric)) return '0';

  const decimals = CHAINS[chainKey]?.nativeCurrency?.decimals ?? 18;
  if (numeric > 1_000_000 && decimals > 0) {
    return (numeric / Math.pow(10, decimals)).toString();
  }
  return numeric.toString();
}

function parseTimestampIso(tx: any): string {
  const ts = tx?.timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof ts === 'string' && ts.trim()) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

async function fetchEvmNativeHistory(chainKey: string, address: string, limit: number): Promise<any[]> {
  const chainId = CHAINS[chainKey]?.id;
  if (!chainId || !EVM_EXPLORER_CONFIG[chainId]) return [];

  const apiKey = getExplorerApiKey(chainId);
  if (!apiKey) return [];

  const url = `${EVM_EXPLORER_CONFIG[chainId]}?module=account&action=txlist&address=${encodeURIComponent(
    address
  )}&startblock=0&endblock=99999999&page=1&offset=${Math.max(1, Math.min(limit, 50))}&sort=desc&apikey=${apiKey}`;

  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'BlazeWallet/1.0' } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  if (data?.status !== '1' || !Array.isArray(data?.result)) return [];

  const nativeSymbol = CHAINS[chainKey]?.nativeCurrency?.symbol || 'ETH';
  return data.result.map((tx: any) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: ethers.formatEther(String(tx.value || '0')),
    timestamp: Number(tx.timeStamp || 0) * 1000,
    tokenSymbol: nativeSymbol,
    type: sameAddress(tx.from, address) ? 'send' : 'receive',
  }));
}

async function fetchRecentTransactions(chainKey: string, address: string, limit: number): Promise<any[]> {
  if (chainKey === 'solana' || UTXO_CHAINS.has(chainKey)) {
    return MultiChainService.getInstance(chainKey).getTransactionHistory(address, limit);
  }

  if (isEvmChain(chainKey)) {
    if (AlchemyService.isSupported(chainKey)) {
      try {
        return await new AlchemyService(chainKey).getFullTransactionHistory(address, limit);
      } catch {
        // fall through to explorer fetch
      }
    }
    return fetchEvmNativeHistory(chainKey, address, limit);
  }

  return [];
}

function normalizeIncomingTxs(chainKey: string, address: string, rawTxs: any[]): NormalizedIncomingTx[] {
  const walletAddress = String(address || '').toLowerCase();
  const nativeSymbol = CHAINS[chainKey]?.nativeCurrency?.symbol || 'asset';

  const normalized: NormalizedIncomingTx[] = [];

  for (const tx of rawTxs || []) {
    const hash = String(tx?.hash || tx?.txid || '').trim();
    if (!hash) continue;

    const fromAddress = pickAddress(tx?.from, 'unknown');
    const toAddress = pickAddress(tx?.to, 'unknown');
    const isIncomingByType = String(tx?.type || '').toLowerCase() === 'receive';
    const isIncomingByAddresses = sameAddress(toAddress, walletAddress) && !sameAddress(fromAddress, walletAddress);
    if (!isIncomingByType && !isIncomingByAddresses) continue;

    const tokenSymbol = String(tx?.tokenSymbol || nativeSymbol);
    normalized.push({
      hash,
      fromAddress,
      toAddress,
      amount: parseAmount(chainKey, tx),
      tokenSymbol,
      timestampIso: parseTimestampIso(tx),
      isNative: tokenSymbol.toUpperCase() === nativeSymbol.toUpperCase(),
    });
  }

  return normalized;
}

export interface IncomingTxReconcileOptions {
  maxRows?: number;
  txLimitPerAddress?: number;
}

export interface IncomingTxReconcileResult {
  watched: number;
  bootstrapped: number;
  checked: number;
  receivedDetected: number;
  tracked: number;
  notified: number;
  skippedExisting: number;
  errors: Array<{ chainKey: string; address: string; reason: string }>;
}

export async function reconcileIncomingTransactions(
  options: IncomingTxReconcileOptions = {}
): Promise<IncomingTxReconcileResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const maxRows = Math.max(1, Math.min(1000, options.maxRows ?? 300));
  const txLimitPerAddress = Math.max(5, Math.min(50, options.txLimitPerAddress ?? 20));

  const result: IncomingTxReconcileResult = {
    watched: 0,
    bootstrapped: 0,
    checked: 0,
    receivedDetected: 0,
    tracked: 0,
    notified: 0,
    skippedExisting: 0,
    errors: [],
  };

  const { data: watchRows, error: watchError } = await supabaseAdmin
    .from('user_chain_addresses')
    .select('user_id,chain_key,address')
    .eq('is_active', true)
    .limit(maxRows);

  if (watchError) {
    result.errors.push({ chainKey: 'system', address: 'n/a', reason: watchError.message || 'watch_query_failed' });
    return result;
  }

  const rows = (watchRows || []) as WatchRow[];
  result.watched = rows.length;
  if (rows.length === 0) return result;

  const { data: cursorRows } = await supabaseAdmin
    .from('incoming_tx_watch_cursors')
    .select('user_id,chain_key,address,last_seen_tx_hash')
    .in('user_id', Array.from(new Set(rows.map((r) => r.user_id))));
  const cursorMap = new Map(
    ((cursorRows || []) as CursorRow[]).map((row) => [`${row.user_id}:${row.chain_key}:${row.address}`, row.last_seen_tx_hash || ''])
  );

  for (const row of rows) {
    const cursorKey = `${row.user_id}:${row.chain_key}:${row.address}`;
    const nowIso = new Date().toISOString();

    try {
      const rawTxs = await fetchRecentTransactions(row.chain_key, row.address, txLimitPerAddress);
      result.checked += 1;

      if (!rawTxs || rawTxs.length === 0) {
        await supabaseAdmin
          .from('incoming_tx_watch_cursors')
          .upsert(
            {
              user_id: row.user_id,
              chain_key: row.chain_key,
              address: row.address,
              last_checked_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,chain_key,address' }
          );
        continue;
      }

      const normalized = normalizeIncomingTxs(row.chain_key, row.address, rawTxs);
      const latestHash = normalized[0]?.hash || String(rawTxs[0]?.hash || '');
      const latestTimestamp = parseTimestampIso(normalized[0] || rawTxs[0]);
      const previousCursorHash = cursorMap.get(cursorKey);

      // First run: seed cursor and avoid sending historic notifications.
      if (!previousCursorHash) {
        result.bootstrapped += 1;
        await supabaseAdmin
          .from('incoming_tx_watch_cursors')
          .upsert(
            {
              user_id: row.user_id,
              chain_key: row.chain_key,
              address: row.address,
              last_seen_tx_hash: latestHash || null,
              last_seen_tx_timestamp: latestTimestamp,
              last_checked_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,chain_key,address' }
          );
        continue;
      }

      const newIncoming: NormalizedIncomingTx[] = [];
      for (const tx of normalized) {
        if (tx.hash === previousCursorHash) break;
        newIncoming.push(tx);
      }

      // process oldest -> newest for clean chronology
      for (const tx of newIncoming.reverse()) {
        result.receivedDetected += 1;

        const { data: existing } = await supabaseAdmin
          .from('user_transactions')
          .select('id')
          .eq('user_id', row.user_id)
          .eq('chain_key', row.chain_key)
          .eq('tx_hash', tx.hash)
          .maybeSingle();

        if (existing?.id) {
          result.skippedExisting += 1;
          continue;
        }

        const amountNum = Number(tx.amount);
        const { error: insertError } = await supabaseAdmin.from('user_transactions').insert({
          user_id: row.user_id,
          chain_key: row.chain_key,
          tx_hash: tx.hash,
          transaction_type: 'receive',
          direction: 'received',
          from_address: tx.fromAddress,
          to_address: tx.toAddress,
          token_symbol: tx.tokenSymbol,
          token_address: null,
          token_decimals: CHAINS[row.chain_key]?.nativeCurrency?.decimals ?? 18,
          is_native: tx.isNative,
          amount: Number.isFinite(amountNum) ? amountNum : 0,
          amount_usd: null,
          status: 'confirmed',
          timestamp: tx.timestampIso,
          metadata: {
            source: 'server_incoming_reconcile',
          },
        });

        if (insertError) {
          result.errors.push({
            chainKey: row.chain_key,
            address: row.address,
            reason: insertError.message || 'insert_failed',
          });
          continue;
        }
        result.tracked += 1;

        try {
          const chainLabel = CHAINS[row.chain_key]?.name || row.chain_key;
          await dispatchNotification({
            userId: row.user_id,
            supabaseUserId: row.user_id,
            type: 'transaction_executed',
            title: 'Funds received',
            message: `You received ${tx.amount} ${tx.tokenSymbol} on ${chainLabel}.`,
            data: {
              txHash: tx.hash,
              chainKey: row.chain_key,
              direction: 'received',
              status: 'confirmed',
              url: '/?tab=history',
            },
          });
          result.notified += 1;
        } catch (notifyError: any) {
          result.errors.push({
            chainKey: row.chain_key,
            address: row.address,
            reason: notifyError?.message || 'notify_failed',
          });
        }
      }

      await supabaseAdmin
        .from('incoming_tx_watch_cursors')
        .upsert(
          {
            user_id: row.user_id,
            chain_key: row.chain_key,
            address: row.address,
            last_seen_tx_hash: latestHash || previousCursorHash,
            last_seen_tx_timestamp: latestTimestamp,
            last_checked_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'user_id,chain_key,address' }
        );
    } catch (error: any) {
      logger.warn('[IncomingTxReconcile] Address reconcile failed:', {
        chainKey: row.chain_key,
        address: row.address,
        error: error?.message,
      });
      result.errors.push({
        chainKey: row.chain_key,
        address: row.address,
        reason: error?.message || 'reconcile_failed',
      });
    }
  }

  return result;
}

