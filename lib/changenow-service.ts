import { logger } from '@/lib/logger';

export interface ChangeNowQuote {
  fromCurrency: string;
  fromNetwork: string;
  toCurrency: string;
  toNetwork: string;
  fromAmount: number;
  toAmount: number;
  transactionSpeedForecast?: string;
  depositFee?: number;
  withdrawalFee?: number;
}

export interface ChangeNowOrder {
  id: string;
  payinAddress: string;
  payoutAddress: string;
  fromCurrency: string;
  toCurrency: string;
  refundAddress?: string;
  expectedReceiveAmount?: number;
}

export interface ChangeNowStatus {
  id: string;
  status: string;
  payinAddress: string;
  payoutAddress: string;
  fromCurrency: string;
  toCurrency: string;
  expectedSendAmount?: number;
  expectedReceiveAmount?: number;
  updatedAt?: string;
  createdAt?: string;
}

const CHANGENOW_V2_BASE = 'https://api.changenow.io/v2';
const CHANGENOW_V1_BASE = 'https://api.changenow.io/v1';

export class ChangeNowService {
  static getNetworkForChain(chainKey: string): string {
    const mapping: Record<string, string> = {
      bitcoin: 'btc',
      ethereum: 'eth',
      polygon: 'matic',
      bsc: 'bsc',
      base: 'base',
      optimism: 'op',
      solana: 'sol',
      zksync: 'zksync',
      avalanche: 'avaxc',
      arbitrum: 'arb',
      linea: 'linea',
      fantom: 'ftm',
      cronos: 'cro',
    };

    const network = mapping[chainKey];
    if (!network) {
      throw new Error(`ChangeNOW does not support chain mapping for ${chainKey}`);
    }
    return network;
  }

  static getNativeCurrencyForChain(chainKey: string): string {
    const mapping: Record<string, string> = {
      bitcoin: 'btc',
      ethereum: 'eth',
      polygon: 'matic',
      bsc: 'bnb',
      base: 'eth',
      optimism: 'eth',
      solana: 'sol',
      zksync: 'eth',
      avalanche: 'avax',
      arbitrum: 'eth',
      linea: 'eth',
      fantom: 'ftm',
      cronos: 'cro',
    };

    const currency = mapping[chainKey];
    if (!currency) {
      throw new Error(`ChangeNOW does not support native currency mapping for ${chainKey}`);
    }
    return currency;
  }

  static async getQuote(params: {
    apiKey: string;
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    fromAmount: string;
  }): Promise<ChangeNowQuote> {
    const query = new URLSearchParams({
      fromCurrency: params.fromCurrency.toLowerCase(),
      toCurrency: params.toCurrency.toLowerCase(),
      fromNetwork: params.fromNetwork.toLowerCase(),
      toNetwork: params.toNetwork.toLowerCase(),
      fromAmount: params.fromAmount,
    });

    const response = await fetch(`${CHANGENOW_V2_BASE}/exchange/estimated-amount?${query.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'x-changenow-api-key': params.apiKey,
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = payload?.message || payload?.error || `ChangeNOW quote failed (${response.status})`;
      throw new Error(msg);
    }

    if (!payload?.toAmount || !payload?.fromAmount) {
      throw new Error('Invalid quote response from ChangeNOW');
    }

    return payload as ChangeNowQuote;
  }

  static async createOrder(params: {
    apiKey: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: string;
    payoutAddress: string;
    refundAddress: string;
    fromNetwork?: string;
    toNetwork?: string;
  }): Promise<ChangeNowOrder> {
    const body: Record<string, any> = {
      from: params.fromCurrency.toLowerCase(),
      to: params.toCurrency.toLowerCase(),
      amount: Number(params.fromAmount),
      address: params.payoutAddress,
      refundAddress: params.refundAddress,
    };

    // Supported by ChangeNOW v1 for network-specific destinations where required.
    if (params.fromNetwork) body.fromNetwork = params.fromNetwork.toLowerCase();
    if (params.toNetwork) body.toNetwork = params.toNetwork.toLowerCase();

    const response = await fetch(`${CHANGENOW_V1_BASE}/transactions/${params.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = payload?.message || payload?.error || `ChangeNOW create order failed (${response.status})`;
      throw new Error(msg);
    }

    if (!payload?.id || !payload?.payinAddress) {
      logger.error('Invalid ChangeNOW order response:', payload);
      throw new Error('Invalid order response from ChangeNOW');
    }

    return {
      id: payload.id,
      payinAddress: payload.payinAddress,
      payoutAddress: payload.payoutAddress,
      fromCurrency: payload.fromCurrency,
      toCurrency: payload.toCurrency,
      refundAddress: payload.refundAddress,
      expectedReceiveAmount: typeof payload.amount === 'number' ? payload.amount : undefined,
    };
  }

  static async getStatus(params: { apiKey: string; id: string }): Promise<ChangeNowStatus> {
    const response = await fetch(`${CHANGENOW_V1_BASE}/transactions/${params.id}/${params.apiKey}`, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = payload?.message || payload?.error || `ChangeNOW status failed (${response.status})`;
      throw new Error(msg);
    }

    if (!payload?.id || !payload?.status) {
      throw new Error('Invalid status response from ChangeNOW');
    }

    return payload as ChangeNowStatus;
  }
}

