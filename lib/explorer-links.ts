import { CHAINS } from '@/lib/chains';

export function getTransactionExplorerUrl(chainKey: string, txHash: string): string {
  const chain = CHAINS[chainKey];
  if (!chain || !txHash) return '';

  // Chain-specific transaction URL patterns.
  if (chainKey === 'litecoin') {
    return `${chain.explorerUrl}/transaction/${txHash}`;
  }
  if (chainKey === 'dogecoin') {
    return `${chain.explorerUrl}/transaction/${txHash}`;
  }
  if (chainKey === 'bitcoincash') {
    return `${chain.explorerUrl}/transaction/${txHash}`;
  }

  return `${chain.explorerUrl}/tx/${txHash}`;
}

