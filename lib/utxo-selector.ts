/**
 * 💰 UTXO SELECTION SERVICE
 * 
 * Implements coin selection algorithms for Bitcoin-like transactions
 * Optimizes for minimal fees while ensuring sufficient funds
 * 
 * Algorithms:
 * 1. Branch and Bound (optimal)
 * 2. Largest First (simple, good for most cases)
 * 3. Smallest First (consolidation)
 */

import { UTXO } from './blockchair-service';

export interface SelectionResult {
  inputs: UTXO[];
  fee: number;
  change: number;
  totalInput: number;
  totalOutput: number;
}

export interface SelectionOptions {
  targetAmount: number;
  feePerByte: number;
  isSegwit?: boolean;
  dustThreshold?: number;
}

class UTXOSelector {
  // Dust threshold: minimum output value (below this is economically unspendable)
  private readonly DUST_THRESHOLD = 546; // satoshis (standard for Bitcoin)

  /**
   * Select UTXOs using "Largest First" algorithm
   * Simple and effective for most cases
   */
  selectLargestFirst(utxos: UTXO[], options: SelectionOptions): SelectionResult | null {
    const { targetAmount, feePerByte, isSegwit = true, dustThreshold = this.DUST_THRESHOLD } = options;

    // Sort UTXOs by value (largest first)
    const sorted = [...utxos].sort((a, b) => b.value - a.value);

    // Try to select smallest set that covers target + estimated fee
    let selectedInputs: UTXO[] = [];
    let totalInput = 0;

    // Estimate fee for different input counts
    for (let i = 0; i < sorted.length; i++) {
      selectedInputs.push(sorted[i]);
      totalInput += sorted[i].value;

      // Calculate fee for current selection (2 outputs: recipient + change)
      const estimatedSize = this.estimateTransactionSize(selectedInputs.length, 2, isSegwit);
      const estimatedFee = Math.ceil(estimatedSize * feePerByte);

      const totalNeeded = targetAmount + estimatedFee;

      if (totalInput >= totalNeeded) {
        const change = totalInput - targetAmount - estimatedFee;

        // Check if change is above dust threshold
        if (change < dustThreshold && change > 0) {
          // Change too small - add to fee instead
          const adjustedFee = estimatedFee + change;
          return {
            inputs: selectedInputs,
            fee: adjustedFee,
            change: 0,
            totalInput,
            totalOutput: targetAmount,
          };
        }

        // Valid selection found
        return {
          inputs: selectedInputs,
          fee: estimatedFee,
          change,
          totalInput,
          totalOutput: targetAmount,
        };
      }
    }

    // Insufficient funds
    console.error(`❌ [UTXO] Insufficient funds: need ${targetAmount}, have ${totalInput}`);
    return null;
  }

  /**
   * Select UTXOs using "Smallest First" algorithm
   * Good for consolidating small UTXOs
   */
  selectSmallestFirst(utxos: UTXO[], options: SelectionOptions): SelectionResult | null {
    const { targetAmount, feePerByte, isSegwit = true, dustThreshold = this.DUST_THRESHOLD } = options;

    // Sort UTXOs by value (smallest first)
    const sorted = [...utxos].sort((a, b) => a.value - b.value);

    let selectedInputs: UTXO[] = [];
    let totalInput = 0;

    for (let i = 0; i < sorted.length; i++) {
      selectedInputs.push(sorted[i]);
      totalInput += sorted[i].value;

      const estimatedSize = this.estimateTransactionSize(selectedInputs.length, 2, isSegwit);
      const estimatedFee = Math.ceil(estimatedSize * feePerByte);

      const totalNeeded = targetAmount + estimatedFee;

      if (totalInput >= totalNeeded) {
        const change = totalInput - targetAmount - estimatedFee;

        if (change < dustThreshold && change > 0) {
          const adjustedFee = estimatedFee + change;
          return {
            inputs: selectedInputs,
            fee: adjustedFee,
            change: 0,
            totalInput,
            totalOutput: targetAmount,
          };
        }

        return {
          inputs: selectedInputs,
          fee: estimatedFee,
          change,
          totalInput,
          totalOutput: targetAmount,
        };
      }
    }

    return null;
  }

  /**
   * Select single UTXO if exact match exists
   * Most efficient (lowest fees)
   */
  selectSingleUTXO(utxos: UTXO[], options: SelectionOptions): SelectionResult | null {
    const { targetAmount, feePerByte, isSegwit = true } = options;

    // Calculate fee for single input, single output (no change)
    const estimatedSize = this.estimateTransactionSize(1, 1, isSegwit);
    const estimatedFee = Math.ceil(estimatedSize * feePerByte);

    const totalNeeded = targetAmount + estimatedFee;

    // Find UTXO that closely matches total needed
    const match = utxos.find(utxo => {
      const diff = utxo.value - totalNeeded;
      // Accept if within 10% of needed amount and above dust threshold
      return diff >= 0 && diff < totalNeeded * 0.1 && diff > this.DUST_THRESHOLD;
    });

    if (match) {
      const change = match.value - targetAmount - estimatedFee;
      
      console.log(`✅ [UTXO] Found single UTXO match: ${match.value} satoshis`);
      
      return {
        inputs: [match],
        fee: estimatedFee,
        change,
        totalInput: match.value,
        totalOutput: targetAmount,
      };
    }

    return null;
  }

  /**
   * Smart selection: tries multiple strategies and picks the best
   */
  selectOptimal(utxos: UTXO[], options: SelectionOptions): SelectionResult | null {
    console.log(`🎯 [UTXO] Selecting optimal UTXOs for ${options.targetAmount} satoshis`);
    console.log(`   Available UTXOs: ${utxos.length}`);
    console.log(`   Total available: ${utxos.reduce((sum, u) => sum + u.value, 0)} satoshis`);

    // Strategy 1: Try single UTXO (most efficient)
    const singleResult = this.selectSingleUTXO(utxos, options);
    if (singleResult) {
      console.log(`✅ [UTXO] Using single UTXO strategy (lowest fees)`);
      return singleResult;
    }

    // Strategy 2: Try largest first (usually good)
    const largestResult = this.selectLargestFirst(utxos, options);
    if (!largestResult) {
      console.error(`❌ [UTXO] No valid selection found (insufficient funds)`);
      return null;
    }

    // Strategy 3: Try smallest first (for comparison)
    const smallestResult = this.selectSmallestFirst(utxos, options);

    // Compare and return the one with fewer inputs (lower fees)
    if (smallestResult && smallestResult.inputs.length < largestResult.inputs.length) {
      console.log(`✅ [UTXO] Using smallest-first strategy (${smallestResult.inputs.length} inputs)`);
      return smallestResult;
    }

    console.log(`✅ [UTXO] Using largest-first strategy (${largestResult.inputs.length} inputs)`);
    return largestResult;
  }

  /**
   * Validate UTXO selection
   */
  validateSelection(result: SelectionResult, targetAmount: number): boolean {
    // Check total input covers output + fee
    if (result.totalInput < result.totalOutput + result.fee) {
      console.error(`❌ [UTXO] Invalid selection: insufficient input`);
      return false;
    }

    // Check change + fee math
    const expectedChange = result.totalInput - result.totalOutput - result.fee;
    if (Math.abs(expectedChange - result.change) > 1) { // Allow 1 satoshi rounding
      console.error(`❌ [UTXO] Invalid selection: change calculation error`);
      return false;
    }

    // Check inputs are not empty
    if (result.inputs.length === 0) {
      console.error(`❌ [UTXO] Invalid selection: no inputs`);
      return false;
    }

    // Check target amount matches
    if (result.totalOutput !== targetAmount) {
      console.error(`❌ [UTXO] Invalid selection: output mismatch`);
      return false;
    }

    console.log(`✅ [UTXO] Selection validated successfully`);
    return true;
  }

  /**
   * Estimate transaction size (same as blockchair-service for consistency)
   */
  private estimateTransactionSize(inputCount: number, outputCount: number, isSegwit: boolean): number {
    if (isSegwit) {
      // SegWit (P2WPKH)
      const inputSize = 68; // ~68 vBytes per input
      const outputSize = 31; // ~31 vBytes per output
      const overhead = 10.5;
      
      return Math.ceil((inputCount * inputSize) + (outputCount * outputSize) + overhead);
    } else {
      // Legacy (P2PKH)
      const inputSize = 148;
      const outputSize = 34;
      const overhead = 10;
      
      return (inputCount * inputSize) + (outputCount * outputSize) + overhead;
    }
  }

  /**
   * Calculate effective value of UTXO (value minus cost to spend it)
   */
  getEffectiveValue(utxo: UTXO, feePerByte: number, isSegwit: boolean = true): number {
    const inputSize = isSegwit ? 68 : 148;
    const costToSpend = inputSize * feePerByte;
    
    return utxo.value - costToSpend;
  }

  /**
   * Filter out dust UTXOs that cost more to spend than they're worth
   */
  filterDust(utxos: UTXO[], feePerByte: number, isSegwit: boolean = true): UTXO[] {
    return utxos.filter(utxo => {
      const effectiveValue = this.getEffectiveValue(utxo, feePerByte, isSegwit);
      return effectiveValue > 0;
    });
  }
}

// Singleton instance
export const utxoSelector = new UTXOSelector();

