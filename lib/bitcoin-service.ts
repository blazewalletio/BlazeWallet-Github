// lib/bitcoin-service.ts
/**
 * 🟠 BITCOIN SERVICE - Complete Bitcoin Wallet Implementation
 * 
 * Features:
 * ✅ HD Wallet (BIP32/BIP44/BIP84)
 * ✅ Native SegWit (bc1...) - DEFAULT
 * ✅ Legacy (1...) support
 * ✅ SegWit (3...) support
 * ✅ UTXO management
 * ✅ Transaction building & signing
 * ✅ Fee estimation (slow/standard/fast)
 * ✅ Balance calculation
 * ✅ Transaction history
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import { getCurrencyLogoSync } from './currency-logo-service';
import { logger } from '@/lib/logger';

// Initialize BIP32 with secp256k1
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

export type BitcoinAddressType = 'legacy' | 'segwit' | 'native-segwit';
export type BitcoinNetwork = 'mainnet' | 'testnet';

export interface BitcoinUTXO {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey?: string;
  confirmations?: number;
}

export interface BitcoinTransaction {
  hash: string;
  from: string[];
  to: string[];
  value: number; // satoshis
  valueBTC: string; // formatted BTC
  fee: number; // satoshis
  timestamp: number;
  confirmations: number;
  isError: boolean;
  blockNumber?: number;
  type: 'send' | 'receive';
  // ✅ Metadata for transaction history display
  tokenName?: string;
  tokenSymbol?: string;
  logoUrl?: string;
}

export interface BitcoinFeeEstimate {
  slow: number; // sat/vB
  standard: number;
  fast: number;
  slowTotal: number; // total sats
  standardTotal: number;
  fastTotal: number;
}

/**
 * Bitcoin Service
 * Handles all Bitcoin blockchain operations
 */
export class BitcoinService {
  private network: bitcoin.Network;
  private apiBaseUrl: string;
  
  constructor(networkType: BitcoinNetwork = 'mainnet') {
    this.network = networkType === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    // Use Blockstream API (reliable & free)
    this.apiBaseUrl = networkType === 'mainnet'
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
  }

  /**
   * Derive Bitcoin address from mnemonic
   * ✅ BIP84 (Native SegWit) - DEFAULT
   * ✅ BIP44 (Legacy) - Optional
   * ✅ BIP49 (SegWit) - Optional
   */
  deriveBitcoinAddress(
    mnemonic: string,
    addressType: BitcoinAddressType = 'native-segwit',
    accountIndex: number = 0,
    changeIndex: number = 0,
    addressIndex: number = 0
  ): { address: string; publicKey: string; path: string } {
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Generate seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, this.network);

    // Derivation paths
    // BIP84 (Native SegWit): m/84'/0'/0'/0/0 → bc1...
    // BIP49 (SegWit):        m/49'/0'/0'/0/0 → 3...
    // BIP44 (Legacy):        m/44'/0'/0'/0/0 → 1...
    const coinType = this.network === bitcoin.networks.bitcoin ? 0 : 1;
    
    let purpose: number;
    switch (addressType) {
      case 'native-segwit':
        purpose = 84; // BIP84
        break;
      case 'segwit':
        purpose = 49; // BIP49
        break;
      case 'legacy':
        purpose = 44; // BIP44
        break;
    }

    const path = `m/${purpose}'/${coinType}'/${accountIndex}'/${changeIndex}/${addressIndex}`;
    const child = root.derivePath(path);

    if (!child.publicKey) {
      throw new Error('Failed to derive public key');
    }

    // Generate address based on type
    let address: string;
    
    if (addressType === 'native-segwit') {
      // Native SegWit (bc1...)
      const payment = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: this.network,
      });
      address = payment.address!;
    } else if (addressType === 'segwit') {
      // SegWit (3...)
      const payment = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: this.network,
        }),
        network: this.network,
      });
      address = payment.address!;
    } else {
      // Legacy (1...)
      const payment = bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: this.network,
      });
      address = payment.address!;
    }

    return {
      address,
      publicKey: Buffer.from(child.publicKey).toString('hex'),
      path,
    };
  }

  /**
   * Get Bitcoin balance for address
   */
  async getBalance(address: string): Promise<{
    confirmed: number; // satoshis
    unconfirmed: number;
    total: number;
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/address/${address}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const data = await response.json();

      const confirmed = data.chain_stats?.funded_txo_sum || 0;
      const spent = data.chain_stats?.spent_txo_sum || 0;
      const unconfirmed = data.mempool_stats?.funded_txo_sum || 0;

      return {
        confirmed: confirmed - spent,
        unconfirmed,
        total: (confirmed - spent) + unconfirmed,
      };
    } catch (error) {
      logger.error('Error fetching Bitcoin balance:', error);
      throw error;
    }
  }

  /**
   * Get UTXOs for address (needed for transactions)
   */
  async getUTXOs(address: string): Promise<BitcoinUTXO[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/address/${address}/utxo`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        confirmations: utxo.status?.confirmed ? utxo.status.block_height : 0,
      }));
    } catch (error) {
      logger.error('Error fetching UTXOs:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction fees (sat/vB)
   * If no UTXOs provided, returns just the fee rates
   */
  async estimateFees(
    utxos?: BitcoinUTXO[],
    outputs: number = 1
  ): Promise<BitcoinFeeEstimate> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/fee-estimates`);
      
      if (!response.ok) {
        // Fallback to default fees
        return this.getDefaultFees(utxos || [], outputs);
      }

      const fees = await response.json();

      // Get fee rates for different priorities
      const slowRate = fees['144'] || fees['504'] || 1; // ~24h
      const standardRate = fees['6'] || fees['12'] || 3; // ~1h
      const fastRate = fees['2'] || fees['3'] || 5; // ~20min

      // If no UTXOs, return just the rates
      if (!utxos || utxos.length === 0) {
        return {
          slow: Math.ceil(slowRate),
          standard: Math.ceil(standardRate),
          fast: Math.ceil(fastRate),
          slowTotal: 0,
          standardTotal: 0,
          fastTotal: 0,
        };
      }

      // Calculate transaction size (rough estimate)
      const txSize = this.estimateTransactionSize(utxos.length, outputs);

      return {
        slow: Math.ceil(slowRate),
        standard: Math.ceil(standardRate),
        fast: Math.ceil(fastRate),
        slowTotal: Math.ceil(slowRate * txSize),
        standardTotal: Math.ceil(standardRate * txSize),
        fastTotal: Math.ceil(fastRate * txSize),
      };
    } catch (error) {
      logger.error('Error estimating fees:', error);
      return this.getDefaultFees(utxos || [], outputs);
    }
  }

  /**
   * Estimate transaction size in vBytes
   */
  private estimateTransactionSize(inputs: number, outputs: number): number {
    // Native SegWit (P2WPKH) transaction size estimation
    // Base: 10 bytes
    // Input: ~68 vBytes per input
    // Output: ~31 bytes per output
    const baseSize = 10;
    const inputSize = 68 * inputs;
    const outputSize = 31 * outputs;
    
    return baseSize + inputSize + outputSize;
  }

  /**
   * Get default fees if API fails
   */
  private getDefaultFees(utxos: BitcoinUTXO[], outputs: number): BitcoinFeeEstimate {
    const txSize = this.estimateTransactionSize(utxos.length, outputs);
    
    return {
      slow: 1,
      standard: 3,
      fast: 5,
      slowTotal: 1 * txSize,
      standardTotal: 3 * txSize,
      fastTotal: 5 * txSize,
    };
  }

  /**
   * Build and sign Bitcoin transaction
   */
  async createTransaction(
    mnemonic: string,
    fromAddress: string,
    toAddress: string,
    amountSats: number,
    feeRate: number, // sat/vB
    addressType: BitcoinAddressType = 'native-segwit'
  ): Promise<{ txHex: string; txid: string; fee: number }> {
    // Get UTXOs
    const utxos = await this.getUTXOs(fromAddress);
    
    if (utxos.length === 0) {
      throw new Error('No UTXOs available');
    }

    // Calculate fee
    const txSize = this.estimateTransactionSize(utxos.length, 2); // 1 output + 1 change
    const fee = Math.ceil(feeRate * txSize);

    // Select UTXOs (simple strategy: use all for now)
    let totalInput = 0;
    const selectedUTXOs: BitcoinUTXO[] = [];
    
    for (const utxo of utxos) {
      selectedUTXOs.push(utxo);
      totalInput += utxo.value;
      
      if (totalInput >= amountSats + fee) {
        break;
      }
    }

    if (totalInput < amountSats + fee) {
      throw new Error(`Insufficient funds. Need ${amountSats + fee} sats, have ${totalInput} sats`);
    }

    const changeAmount = totalInput - amountSats - fee;

    // Build transaction
    const psbt = new bitcoin.Psbt({ network: this.network });

    // Derive private key
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, this.network);
    const coinType = this.network === bitcoin.networks.bitcoin ? 0 : 1;
    
    let purpose: number;
    if (addressType === 'native-segwit') purpose = 84;
    else if (addressType === 'segwit') purpose = 49;
    else purpose = 44;
    
    const path = `m/${purpose}'/${coinType}'/0'/0/0`;
    const keyPair = root.derivePath(path);

    // Add inputs
    for (const utxo of selectedUTXOs) {
      // Fetch transaction hex
      const txResponse = await fetch(`${this.apiBaseUrl}/tx/${utxo.txid}/hex`);
      const txHex = await txResponse.text();

      if (addressType === 'native-segwit') {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.payments.p2wpkh({
              pubkey: keyPair.publicKey,
              network: this.network,
            }).output!,
            value: BigInt(utxo.value),
          },
        });
      } else {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, 'hex'),
        });
      }
    }

    // Add outputs
    psbt.addOutput({
      address: toAddress,
      value: BigInt(amountSats),
    });

    // Add change output if needed
    if (changeAmount > 546) { // Dust limit
      psbt.addOutput({
        address: fromAddress,
        value: BigInt(changeAmount),
      });
    }

    // Sign all inputs
    for (let i = 0; i < selectedUTXOs.length; i++) {
      psbt.signInput(i, keyPair);
    }

    // Finalize and extract
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txid = tx.getId();

    return { txHex, txid, fee };
  }

  /**
   * Broadcast transaction to network
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/tx`, {
        method: 'POST',
        body: txHex,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to broadcast transaction: ${error}`);
      }

      const txid = await response.text();
      return txid;
    } catch (error) {
      logger.error('Error broadcasting transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for address
   */
  async getTransactionHistory(
    address: string,
    limit: number = 25
  ): Promise<BitcoinTransaction[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/address/${address}/txs`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const data = await response.json();
      const transactions: BitcoinTransaction[] = [];

      for (const tx of data.slice(0, limit)) {
        // Determine if send or receive
        let type: 'send' | 'receive' = 'receive';
        let value = 0;

        // Calculate net value for this address
        for (const vin of tx.vin) {
          if (vin.prevout?.scriptpubkey_address === address) {
            type = 'send';
            value -= vin.prevout.value;
          }
        }

        for (const vout of tx.vout) {
          if (vout.scriptpubkey_address === address) {
            value += vout.value;
          }
        }

        transactions.push({
          hash: tx.txid,
          from: tx.vin.map((vin: any) => vin.prevout?.scriptpubkey_address || 'Unknown').filter(Boolean),
          to: tx.vout.map((vout: any) => vout.scriptpubkey_address).filter(Boolean),
          value: Math.abs(value),
          valueBTC: (Math.abs(value) / 100000000).toFixed(8),
          fee: tx.fee || 0,
          timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
          confirmations: tx.status?.confirmed ? 1 : 0,
          isError: false,
          blockNumber: tx.status?.block_height,
          type,
          // ✅ Native currency metadata with DYNAMIC logo
          tokenName: 'Bitcoin',
          tokenSymbol: 'BTC',
          logoUrl: getCurrencyLogoSync('BTC'), // ✅ Dynamic currency logo
        });
      }

      return transactions;
    } catch (error) {
      logger.error('Error fetching transaction history:', error);
      return [];
    }
  }

  /**
   * Convert satoshis to BTC
   */
  static satsToBTC(sats: number): string {
    return (sats / 100000000).toFixed(8);
  }

  /**
   * Convert BTC to satoshis
   */
  static btcToSats(btc: string | number): number {
    return Math.floor(parseFloat(btc.toString()) * 100000000);
  }

  /**
   * Validate Bitcoin address
   */
  static isValidAddress(address: string, network: BitcoinNetwork = 'mainnet'): boolean {
    try {
      const net = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
      bitcoin.address.toOutputScript(address, net);
      return true;
    } catch {
      return false;
    }
  }
}

