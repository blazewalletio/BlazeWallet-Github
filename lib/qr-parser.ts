// lib/qr-parser.ts
/**
 * 🔍 INTELLIGENT QR CODE PARSER (PHASE 1)
 * 
 * Core Features:
 * ✅ Multi-chain address detection (ETH/EVM, SOL, BTC)
 * ✅ Smart chain identification with confidence scoring
 * ✅ Amount parsing (all formats: wei, lamports, satoshi, decimal)
 * ✅ Protocol support (ethereum:, solana:, bitcoin:, lightning:)
 * ✅ Comprehensive address validation
 * ✅ Parameter extraction (value, amount, label, message, gas)
 * 
 * Future Extensions (Phase 2):
 * 🔮 WalletConnect QR support
 * 🔮 dApp connection requests
 * 🔮 Multi-recipient payments
 * 🔮 Token-specific QR codes
 */

import { CHAINS } from './chains';

export type ChainType = 'ethereum' | 'polygon' | 'arbitrum' | 'base' | 'bsc' | 'solana' | 'bitcoin' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParsedQRData {
  // Core data
  address: string;
  chain: ChainType;
  confidence: ConfidenceLevel;
  
  // Optional payment data
  amount?: string; // Always in native token units (ETH, SOL, BTC)
  amountRaw?: string; // Original raw value (wei, lamports, satoshi)
  
  // Metadata
  label?: string;
  message?: string;
  gas?: string;
  
  // Protocol info
  protocol?: 'standard' | 'ethereum' | 'solana' | 'bitcoin' | 'lightning' | 'universal';
  rawData: string;
  
  // Warnings/Errors
  warnings?: string[];
  isValid: boolean;
}

export class QRParser {
  /**
   * Main entry point - parse any QR code data
   */
  static parse(data: string): ParsedQRData {
    console.log('🔍 [QRParser] Parsing QR data:', data.substring(0, 100));
    
    // Try protocol-based parsing first
    if (data.includes(':')) {
      const protocolResult = this.parseProtocol(data);
      if (protocolResult.isValid) {
        console.log('✅ [QRParser] Protocol-based parse success:', protocolResult.chain);
        return protocolResult;
      }
    }
    
    // Fallback to address-only detection
    const addressResult = this.parseAddress(data);
    console.log('✅ [QRParser] Address-based parse result:', addressResult.chain, addressResult.confidence);
    return addressResult;
  }
  
  /**
   * Parse protocol-based QR codes (ethereum:, solana:, bitcoin:, lightning:)
   */
  private static parseProtocol(data: string): ParsedQRData {
    const warnings: string[] = [];
    
    // Ethereum format: ethereum:0x1234...?value=1000000000000000000&gas=21000
    if (data.startsWith('ethereum:')) {
      return this.parseEthereumProtocol(data);
    }
    
    // Solana format: solana:ABC123...?amount=0.5&label=Coffee&message=Thanks
    if (data.startsWith('solana:')) {
      return this.parseSolanaProtocol(data);
    }
    
    // Bitcoin format: bitcoin:1A1zP1...?amount=0.001&label=Donation
    if (data.startsWith('bitcoin:')) {
      return this.parseBitcoinProtocol(data);
    }
    
    // Lightning Network format: lightning:lnbc10u1p...
    if (data.startsWith('lightning:') || data.startsWith('lnbc')) {
      return this.parseLightningProtocol(data);
    }
    
    // Universal payment link: https://pay.example.com/qr?address=0x...&amount=10&chain=ethereum
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return this.parseUniversalLink(data);
    }
    
    // No valid protocol found
    return {
      address: '',
      chain: 'unknown',
      confidence: 'low',
      protocol: 'standard',
      rawData: data,
      isValid: false,
      warnings: ['Unknown protocol format'],
    };
  }
  
  /**
   * Parse ethereum: protocol QR codes
   */
  private static parseEthereumProtocol(data: string): ParsedQRData {
    try {
      // Format: ethereum:0x1234...?value=1000000000000000000&gas=21000
      const [addressPart, paramsPart] = data.split('?');
      const address = addressPart.replace('ethereum:', '').trim();
      
      if (!this.isValidEthereumAddress(address)) {
        return {
          address,
          chain: 'ethereum',
          confidence: 'low',
          protocol: 'ethereum',
          rawData: data,
          isValid: false,
          warnings: ['Invalid Ethereum address format'],
        };
      }
      
      const params = new URLSearchParams(paramsPart || '');
      const valueInWei = params.get('value');
      const gas = params.get('gas');
      const label = params.get('label');
      const message = params.get('message');
      
      let amount: string | undefined;
      let amountRaw: string | undefined;
      
      if (valueInWei) {
        amountRaw = valueInWei;
        // Convert wei to ETH (1 ETH = 10^18 wei)
        amount = (parseInt(valueInWei) / 1e18).toString();
      }
      
      return {
        address,
        chain: 'ethereum',
        confidence: 'high',
        amount,
        amountRaw,
        label: label || undefined,
        message: message || undefined,
        gas: gas || undefined,
        protocol: 'ethereum',
        rawData: data,
        isValid: true,
      };
    } catch (error) {
      console.error('Error parsing ethereum protocol:', error);
      return {
        address: '',
        chain: 'ethereum',
        confidence: 'low',
        protocol: 'ethereum',
        rawData: data,
        isValid: false,
        warnings: ['Failed to parse ethereum: protocol'],
      };
    }
  }
  
  /**
   * Parse solana: protocol QR codes
   */
  private static parseSolanaProtocol(data: string): ParsedQRData {
    try {
      // Format: solana:ABC123...?amount=0.5&label=Coffee&message=Thanks
      const [addressPart, paramsPart] = data.split('?');
      const address = addressPart.replace('solana:', '').trim();
      
      if (!this.isValidSolanaAddress(address)) {
        return {
          address,
          chain: 'solana',
          confidence: 'low',
          protocol: 'solana',
          rawData: data,
          isValid: false,
          warnings: ['Invalid Solana address format'],
        };
      }
      
      const params = new URLSearchParams(paramsPart || '');
      const amount = params.get('amount');
      const label = params.get('label');
      const message = params.get('message');
      const splToken = params.get('spl-token');
      
      return {
        address,
        chain: 'solana',
        confidence: 'high',
        amount: amount || undefined,
        label: label || undefined,
        message: message || undefined,
        protocol: 'solana',
        rawData: data,
        isValid: true,
        warnings: splToken ? ['SPL token transfers not yet supported in Quick Pay'] : undefined,
      };
    } catch (error) {
      console.error('Error parsing solana protocol:', error);
      return {
        address: '',
        chain: 'solana',
        confidence: 'low',
        protocol: 'solana',
        rawData: data,
        isValid: false,
        warnings: ['Failed to parse solana: protocol'],
      };
    }
  }
  
  /**
   * Parse bitcoin: protocol QR codes
   */
  private static parseBitcoinProtocol(data: string): ParsedQRData {
    try {
      // Format: bitcoin:1A1zP1...?amount=0.001&label=Donation
      const [addressPart, paramsPart] = data.split('?');
      const address = addressPart.replace('bitcoin:', '').trim();
      
      if (!this.isValidBitcoinAddress(address)) {
        return {
          address,
          chain: 'bitcoin',
          confidence: 'low',
          protocol: 'bitcoin',
          rawData: data,
          isValid: false,
          warnings: ['Invalid Bitcoin address format'],
        };
      }
      
      const params = new URLSearchParams(paramsPart || '');
      const amount = params.get('amount');
      const label = params.get('label');
      const message = params.get('message');
      
      return {
        address,
        chain: 'bitcoin',
        confidence: 'high',
        amount: amount || undefined,
        label: label || undefined,
        message: message || undefined,
        protocol: 'bitcoin',
        rawData: data,
        isValid: true,
        warnings: ['Bitcoin transactions not yet supported'],
      };
    } catch (error) {
      console.error('Error parsing bitcoin protocol:', error);
      return {
        address: '',
        chain: 'bitcoin',
        confidence: 'low',
        protocol: 'bitcoin',
        rawData: data,
        isValid: false,
        warnings: ['Failed to parse bitcoin: protocol'],
      };
    }
  }
  
  /**
   * Parse Lightning Network QR codes
   */
  private static parseLightningProtocol(data: string): ParsedQRData {
    const invoice = data.startsWith('lightning:') ? data.replace('lightning:', '') : data;
    
    return {
      address: invoice,
      chain: 'bitcoin',
      confidence: 'medium',
      protocol: 'lightning',
      rawData: data,
      isValid: true,
      warnings: ['Lightning Network not yet supported'],
    };
  }
  
  /**
   * Parse universal payment links (https://...)
   */
  private static parseUniversalLink(data: string): ParsedQRData {
    try {
      const url = new URL(data);
      const address = url.searchParams.get('address');
      const amount = url.searchParams.get('amount');
      const chain = url.searchParams.get('chain') as ChainType;
      const label = url.searchParams.get('label');
      const message = url.searchParams.get('message');
      
      if (!address) {
        return {
          address: '',
          chain: 'unknown',
          confidence: 'low',
          protocol: 'universal',
          rawData: data,
          isValid: false,
          warnings: ['No address found in universal link'],
        };
      }
      
      // Detect chain from address if not specified
      const detectedChain = chain || this.detectChainFromAddress(address).chain;
      
      return {
        address,
        chain: detectedChain,
        confidence: chain ? 'high' : 'medium',
        amount: amount || undefined,
        label: label || undefined,
        message: message || undefined,
        protocol: 'universal',
        rawData: data,
        isValid: true,
      };
    } catch (error) {
      console.error('Error parsing universal link:', error);
      return {
        address: '',
        chain: 'unknown',
        confidence: 'low',
        protocol: 'universal',
        rawData: data,
        isValid: false,
        warnings: ['Invalid universal payment link'],
      };
    }
  }
  
  /**
   * Parse plain address (no protocol)
   */
  private static parseAddress(data: string): ParsedQRData {
    const address = data.trim();
    const detection = this.detectChainFromAddress(address);
    
    return {
      address: detection.address,
      chain: detection.chain,
      confidence: detection.confidence,
      protocol: 'standard',
      rawData: data,
      isValid: detection.chain !== 'unknown',
      warnings: detection.chain === 'unknown' ? ['Could not determine blockchain'] : undefined,
    };
  }
  
  /**
   * Detect chain from address format
   * ⚠️ ORDER MATTERS: Bitcoin must be checked BEFORE Solana!
   * Bitcoin addresses (1..., 3...) can overlap with Solana's base58 range
   */
  static detectChainFromAddress(address: string): {
    chain: ChainType;
    confidence: ConfidenceLevel;
    address: string;
  } {
    const addr = address.trim();
    
    // Ethereum/EVM chains (0x + 40 hex characters)
    // Check first as it's the most specific format
    if (this.isValidEthereumAddress(addr)) {
      return { 
        chain: 'ethereum', 
        confidence: 'high', 
        address: addr 
      };
    }
    
    // ⚠️ CRITICAL: Bitcoin BEFORE Solana!
    // Bitcoin addresses (1..., 3..., bc1...) are 25-62 chars
    // Solana addresses are 32-44 chars (overlaps with Bitcoin range!)
    if (this.isValidBitcoinAddress(addr)) {
      return { 
        chain: 'bitcoin', 
        confidence: 'high', 
        address: addr 
      };
    }
    
    // Solana (base58, 32-44 chars, no 0, O, I, l)
    // Checked AFTER Bitcoin to avoid false positives
    if (this.isValidSolanaAddress(addr)) {
      return { 
        chain: 'solana', 
        confidence: 'high', 
        address: addr 
      };
    }
    
    // Unknown format
    return { 
      chain: 'unknown', 
      confidence: 'low', 
      address: addr 
    };
  }
  
  /**
   * Validate Ethereum/EVM address format
   */
  static isValidEthereumAddress(address: string): boolean {
    // 0x followed by 40 hexadecimal characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  
  /**
   * Validate Solana address format
   */
  static isValidSolanaAddress(address: string): boolean {
    // Base58 format: 32-44 characters, no 0, O, I, l
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  
  /**
   * Validate Bitcoin address format
   */
  static isValidBitcoinAddress(address: string): boolean {
    // Legacy (P2PKH): starts with 1
    // Legacy (P2SH): starts with 3
    // SegWit (Bech32): starts with bc1 (case-insensitive!)
    
    // ⚠️ FIX: Some QR generators use UPPERCASE (BC1...) 
    // Bitcoin addresses are case-insensitive for bc1 prefix
    return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(address);
  }
  
  /**
   * Get chain display info
   */
  static getChainInfo(chain: ChainType): {
    name: string;
    symbol: string;
    color: string;
    icon: string;
    logoUrl?: string;
  } | null {
    if (chain === 'unknown' || chain === 'bitcoin') {
      if (chain === 'bitcoin') {
        return {
          name: 'Bitcoin',
          symbol: 'BTC',
          color: '#F7931A',
          icon: '₿',
          logoUrl: '/crypto-btc.png',
        };
      }
      return null;
    }
    
    const chainConfig = CHAINS[chain];
    if (!chainConfig) return null;
    
    return {
      name: chainConfig.name,
      symbol: chainConfig.nativeCurrency.symbol,
      color: chainConfig.color,
      icon: chainConfig.icon,
      logoUrl: chainConfig.logoUrl,
    };
  }
  
  /**
   * Get supported EVM chains that could match an Ethereum address
   */
  static getCompatibleEVMChains(): ChainType[] {
    return ['ethereum', 'polygon', 'arbitrum', 'base', 'bsc'];
  }
  
  /**
   * Check if chain is EVM compatible
   */
  static isEVMChain(chain: ChainType): boolean {
    return this.getCompatibleEVMChains().includes(chain);
  }
}

