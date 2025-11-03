import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';

export type ChainType = 'evm' | 'solana' | 'bitcoin' | 'litecoin' | 'dogecoin' | 'bitcoin-cash';

export interface AddressValidationResult {
  isValid: boolean;
  chainType: ChainType | null;
  normalizedAddress: string;
  checksumAddress?: string;
  error?: string;
}

/**
 * 🎯 MULTI-CHAIN ADDRESS VALIDATOR
 * 
 * Validates addresses for all 18 supported chains in Blaze Wallet
 * - EVM chains (Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche, Fantom, Cronos, zkSync, Linea)
 * - Solana
 * - Bitcoin
 * - Bitcoin forks (Litecoin, Dogecoin, Bitcoin Cash)
 */
class AddressValidator {
  
  /**
   * Detect chain type from address format
   */
  detectChainType(address: string): ChainType | null {
    if (!address || typeof address !== 'string') return null;
    
    const trimmed = address.trim();
    
    // Solana: base58, 32-44 chars
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed) && !trimmed.startsWith('0x')) {
      try {
        new PublicKey(trimmed);
        return 'solana';
      } catch {
        // Continue to other checks
      }
    }
    
    // EVM: 0x prefix + 40 hex chars
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return 'evm';
    }
    
    // Bitcoin: bc1 (native segwit), 1 (legacy), or 3 (segwit)
    if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(trimmed)) {
      return 'bitcoin';
    }
    
    // Litecoin: ltc1 (native segwit), L (legacy), or M (segwit)
    if (/^(ltc1|[LM])[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(trimmed)) {
      return 'litecoin';
    }
    
    // Dogecoin: D (mainnet) or A (testnet)
    if (/^[DA][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
      return 'dogecoin';
    }
    
    // Bitcoin Cash: bitcoincash: prefix or legacy format (q, p prefix for CashAddr)
    if (/^(bitcoincash:)?[qp][a-z0-9]{41}$/i.test(trimmed) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
      return 'bitcoin-cash';
    }
    
    return null;
  }
  
  /**
   * Validate EVM address (Ethereum, Polygon, BSC, etc.)
   */
  validateEVM(address: string): AddressValidationResult {
    try {
      if (!ethers.isAddress(address)) {
        return {
          isValid: false,
          chainType: null,
          normalizedAddress: address,
          error: 'Invalid EVM address format',
        };
      }
      
      const checksumAddress = ethers.getAddress(address);
      
      return {
        isValid: true,
        chainType: 'evm',
        normalizedAddress: address.toLowerCase(),
        checksumAddress,
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid EVM address',
      };
    }
  }
  
  /**
   * Validate Solana address
   */
  validateSolana(address: string): AddressValidationResult {
    try {
      const pubkey = new PublicKey(address);
      
      // Check if it's on the curve (valid public key)
      if (!PublicKey.isOnCurve(pubkey.toBytes())) {
        return {
          isValid: false,
          chainType: null,
          normalizedAddress: address,
          error: 'Invalid Solana address (not on curve)',
        };
      }
      
      return {
        isValid: true,
        chainType: 'solana',
        normalizedAddress: pubkey.toBase58(),
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Solana address',
      };
    }
  }
  
  /**
   * Validate Bitcoin address
   */
  validateBitcoin(address: string): AddressValidationResult {
    try {
      // Try to decode with bitcoinjs-lib
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      
      return {
        isValid: true,
        chainType: 'bitcoin',
        normalizedAddress: address,
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Bitcoin address',
      };
    }
  }
  
  /**
   * Validate Litecoin address
   */
  validateLitecoin(address: string): AddressValidationResult {
    try {
      // Litecoin network config
      const litecoinNetwork = {
        messagePrefix: '\x19Litecoin Signed Message:\n',
        bech32: 'ltc',
        bip32: { public: 0x019da462, private: 0x019d9cfe },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
      };
      
      bitcoin.address.toOutputScript(address, litecoinNetwork as any);
      
      return {
        isValid: true,
        chainType: 'litecoin',
        normalizedAddress: address,
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Litecoin address',
      };
    }
  }
  
  /**
   * Validate Dogecoin address
   */
  validateDogecoin(address: string): AddressValidationResult {
    try {
      // Dogecoin network config
      const dogecoinNetwork = {
        messagePrefix: '\x19Dogecoin Signed Message:\n',
        bech32: 'doge',
        bip32: { public: 0x02facafd, private: 0x02fac398 },
        pubKeyHash: 0x1e,
        scriptHash: 0x16,
        wif: 0x9e,
      };
      
      bitcoin.address.toOutputScript(address, dogecoinNetwork as any);
      
      return {
        isValid: true,
        chainType: 'dogecoin',
        normalizedAddress: address,
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Dogecoin address',
      };
    }
  }
  
  /**
   * Validate Bitcoin Cash address
   */
  validateBitcoinCash(address: string): AddressValidationResult {
    try {
      // Remove bitcoincash: prefix if present
      const cleanAddress = address.replace('bitcoincash:', '');
      
      // For CashAddr format (q/p prefix) - basic validation
      if (/^[qp][a-z0-9]{41}$/i.test(cleanAddress)) {
        return {
          isValid: true,
          chainType: 'bitcoin-cash',
          normalizedAddress: cleanAddress.toLowerCase(),
        };
      }
      
      // For legacy format - use bitcoin validation
      const btcResult = this.validateBitcoin(cleanAddress);
      if (btcResult.isValid) {
        return {
          isValid: true,
          chainType: 'bitcoin-cash',
          normalizedAddress: cleanAddress,
        };
      }
      
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Bitcoin Cash address',
      };
    } catch (error) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: address,
        error: 'Invalid Bitcoin Cash address',
      };
    }
  }
  
  /**
   * 🎯 MAIN VALIDATION METHOD
   * Auto-detects chain and validates address
   */
  validate(address: string): AddressValidationResult {
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: '',
        error: 'Address is required',
      };
    }
    
    const trimmed = address.trim();
    const detectedChain = this.detectChainType(trimmed);
    
    if (!detectedChain) {
      return {
        isValid: false,
        chainType: null,
        normalizedAddress: trimmed,
        error: 'Could not detect chain type from address format',
      };
    }
    
    // Validate based on detected chain
    switch (detectedChain) {
      case 'evm':
        return this.validateEVM(trimmed);
      case 'solana':
        return this.validateSolana(trimmed);
      case 'bitcoin':
        return this.validateBitcoin(trimmed);
      case 'litecoin':
        return this.validateLitecoin(trimmed);
      case 'dogecoin':
        return this.validateDogecoin(trimmed);
      case 'bitcoin-cash':
        return this.validateBitcoinCash(trimmed);
      default:
        return {
          isValid: false,
          chainType: null,
          normalizedAddress: trimmed,
          error: 'Unsupported chain type',
        };
    }
  }
  
  /**
   * Get human-readable chain name
   */
  getChainName(chainType: ChainType): string {
    const names: Record<ChainType, string> = {
      evm: 'EVM (Ethereum, Polygon, BSC, etc.)',
      solana: 'Solana',
      bitcoin: 'Bitcoin',
      litecoin: 'Litecoin',
      dogecoin: 'Dogecoin',
      'bitcoin-cash': 'Bitcoin Cash',
    };
    
    return names[chainType] || chainType;
  }
  
  /**
   * Get supported chains for display
   */
  getSupportedChains(): string[] {
    return [
      '🔷 EVM: Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche, Fantom, Cronos, zkSync, Linea',
      '🟣 Solana',
      '🟠 Bitcoin',
      '⚪ Litecoin',
      '🟡 Dogecoin',
      '🟢 Bitcoin Cash',
    ];
  }
}

// Singleton export
export const addressValidator = new AddressValidator();

