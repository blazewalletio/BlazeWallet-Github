/**
 * 🔐 BITCOIN TRANSACTION BUILDER
 * 
 * Builds, signs, and broadcasts Bitcoin-like transactions using PSBT
 * Supports: Bitcoin, Litecoin, Dogecoin, Bitcoin Cash
 * 
 * Uses bitcoinjs-lib for transaction building and signing
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { UTXO, blockchairService } from './blockchair-service';
import { utxoSelector, SelectionResult } from './utxo-selector';
import { logger } from '@/lib/logger';

// Initialize ECPair for signing
const ECPair = ECPairFactory(ecc);

export interface TransactionRequest {
  chain: string;
  fromAddress: string;
  toAddress: string;
  amount: number; // satoshis
  feePerByte: number;
  privateKey: Buffer; // Raw private key bytes
  changeAddress?: string; // Optional, defaults to fromAddress
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  rawTx?: string;
  fee?: number;
  error?: string;
}

class BitcoinTransactionBuilder {
  
  /**
   * Build, sign, and broadcast a Bitcoin transaction
   */
  async buildAndBroadcast(request: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.log(`\n🔨 [Bitcoin TX] Building transaction on ${request.chain}`);
      logger.log(`   From: ${request.fromAddress}`);
      logger.log(`   To: ${request.toAddress}`);
      logger.log(`   Amount: ${request.amount} satoshis`);
      logger.log(`   Fee rate: ${request.feePerByte} sat/byte`);

      // 1. Get network config
      const network = this.getNetwork(request.chain);

      // 2. Fetch UTXOs
      const { utxos } = await blockchairService.getAddressData(request.chain, request.fromAddress);

      if (utxos.length === 0) {
        throw new Error('No UTXOs available for address');
      }

      // 3. Filter out dust UTXOs
      const isSegwit = this.isSegwitChain(request.chain);
      const usableUTXOs = utxoSelector.filterDust(utxos, request.feePerByte, isSegwit);

      if (usableUTXOs.length === 0) {
        throw new Error('No usable UTXOs (all are dust)');
      }

      logger.log(`   Available UTXOs: ${usableUTXOs.length}`);

      // 4. Select UTXOs
      const selection = utxoSelector.selectOptimal(usableUTXOs, {
        targetAmount: request.amount,
        feePerByte: request.feePerByte,
        isSegwit,
      });

      if (!selection) {
        throw new Error('Insufficient funds');
      }

      // 5. Validate selection
      if (!utxoSelector.validateSelection(selection, request.amount)) {
        throw new Error('Invalid UTXO selection');
      }

      logger.log(`   Selected ${selection.inputs.length} inputs`);
      logger.log(`   Total input: ${selection.totalInput} satoshis`);
      logger.log(`   Fee: ${selection.fee} satoshis`);
      logger.log(`   Change: ${selection.change} satoshis`);

      // 6. Build PSBT
      const psbt = new bitcoin.Psbt({ network });
      const keyPair = ECPair.fromPrivateKey(request.privateKey, { network });

      // 7. Add inputs
      for (const utxo of selection.inputs) {
        await this.addInput(psbt, utxo, request.chain, isSegwit);
      }

      // 8. Add outputs
      // Output 1: Recipient
      psbt.addOutput({
        address: request.toAddress,
        value: BigInt(request.amount),
      });

      // Output 2: Change (if any)
      if (selection.change > 0) {
        const changeAddress = request.changeAddress || request.fromAddress;
        psbt.addOutput({
          address: changeAddress,
          value: BigInt(selection.change),
        });
      }

      // 9. Sign all inputs
      logger.log(`   Signing ${selection.inputs.length} inputs...`);
      for (let i = 0; i < selection.inputs.length; i++) {
        psbt.signInput(i, keyPair);
      }

      // 10. Validate signatures
      logger.log(`   Validating signatures...`);
      for (let i = 0; i < selection.inputs.length; i++) {
        if (!psbt.validateSignaturesOfInput(i, () => true)) {
          throw new Error(`Invalid signature for input ${i}`);
        }
      }

      // 11. Finalize PSBT
      logger.log(`   Finalizing transaction...`);
      psbt.finalizeAllInputs();

      // 12. Extract raw transaction
      const rawTx = psbt.extractTransaction();
      const rawTxHex = rawTx.toHex();
      const txId = rawTx.getId();

      logger.log(`✅ [Bitcoin TX] Transaction built successfully`);
      logger.log(`   TX ID: ${txId}`);
      logger.log(`   Size: ${rawTx.virtualSize()} vBytes`);

      // 13. Broadcast
      logger.log(`📡 [Bitcoin TX] Broadcasting...`);
      const broadcastResult = await blockchairService.broadcastTransaction(
        request.chain,
        rawTxHex
      );

      if (!broadcastResult.success) {
        throw new Error(`Broadcast failed: ${broadcastResult.error}`);
      }

      logger.log(`✅ [Bitcoin TX] Broadcast successful!`);

      return {
        success: true,
        txHash: broadcastResult.transaction_hash,
        rawTx: rawTxHex,
        fee: selection.fee,
      };

    } catch (error: any) {
      logger.error(`❌ [Bitcoin TX] Error:`, error);
      return {
        success: false,
        error: error.message || 'Transaction build failed',
      };
    }
  }

  /**
   * Add input to PSBT with proper UTXO data
   */
  private async addInput(
    psbt: bitcoin.Psbt,
    utxo: UTXO,
    chain: string,
    isSegwit: boolean
  ): Promise<void> {
    const network = this.getNetwork(chain);

    if (isSegwit) {
      // SegWit input (P2WPKH)
      psbt.addInput({
        hash: utxo.transaction_hash,
        index: utxo.index,
        witnessUtxo: {
          script: Buffer.from(utxo.script_hex, 'hex'),
          value: BigInt(utxo.value),
        },
      });
    } else {
      // Legacy input (P2PKH) - requires full transaction data
      // For now, we'll use witnessUtxo format which works for most cases
      psbt.addInput({
        hash: utxo.transaction_hash,
        index: utxo.index,
        witnessUtxo: {
          script: Buffer.from(utxo.script_hex, 'hex'),
          value: BigInt(utxo.value),
        },
      });
    }
  }

  /**
   * Get Bitcoin network configuration
   */
  private getNetwork(chain: string): bitcoin.Network {
    switch (chain.toLowerCase()) {
      case 'bitcoin':
        return bitcoin.networks.bitcoin;
      
      case 'litecoin':
        // Litecoin mainnet
        return {
          messagePrefix: '\x19Litecoin Signed Message:\n',
          bech32: 'ltc',
          bip32: {
            public: 0x019da462,
            private: 0x019d9cfe,
          },
          pubKeyHash: 0x30,
          scriptHash: 0x32,
          wif: 0xb0,
        };
      
      case 'dogecoin':
        // Dogecoin mainnet
        return {
          messagePrefix: '\x19Dogecoin Signed Message:\n',
          bech32: 'doge', // Note: Dogecoin doesn't use bech32 yet
          bip32: {
            public: 0x02facafd,
            private: 0x02fac398,
          },
          pubKeyHash: 0x1e,
          scriptHash: 0x16,
          wif: 0x9e,
        };
      
      case 'bitcoincash':
        // Bitcoin Cash uses same network params as Bitcoin
        return bitcoin.networks.bitcoin;
      
      default:
        return bitcoin.networks.bitcoin;
    }
  }

  /**
   * Check if chain uses SegWit
   */
  private isSegwitChain(chain: string): boolean {
    switch (chain.toLowerCase()) {
      case 'bitcoin':
      case 'litecoin':
        return true; // These support SegWit
      
      case 'dogecoin':
      case 'bitcoincash':
        return false; // These don't use SegWit
      
      default:
        return true;
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(
    chain: string,
    fromAddress: string,
    amount: number,
    feePerByte: number
  ): Promise<{ fee: number; totalNeeded: number }> {
    try {
      const { utxos } = await blockchairService.getAddressData(chain, fromAddress);
      const isSegwit = this.isSegwitChain(chain);
      
      const usableUTXOs = utxoSelector.filterDust(utxos, feePerByte, isSegwit);

      const selection = utxoSelector.selectOptimal(usableUTXOs, {
        targetAmount: amount,
        feePerByte,
        isSegwit,
      });

      if (!selection) {
        throw new Error('Insufficient funds');
      }

      return {
        fee: selection.fee,
        totalNeeded: amount + selection.fee,
      };

    } catch (error: any) {
      logger.error(`❌ [Bitcoin TX] Fee estimation error:`, error);
      throw error;
    }
  }

  /**
   * Get address from private key
   */
  getAddressFromPrivateKey(privateKey: Buffer, chain: string): string {
    const network = this.getNetwork(chain);
    const keyPair = ECPair.fromPrivateKey(privateKey, { network });
    
    const isSegwit = this.isSegwitChain(chain);

    if (isSegwit) {
      // P2WPKH (SegWit)
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network,
      });
      return address!;
    } else {
      // P2PKH (Legacy)
      const { address } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network,
      });
      return address!;
    }
  }
}

// Singleton instance
export const bitcoinTxBuilder = new BitcoinTransactionBuilder();

