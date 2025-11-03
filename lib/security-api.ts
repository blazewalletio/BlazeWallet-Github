import { ChainType } from './address-validator';

export interface SecurityCheckResult {
  isScam: boolean;
  riskScore: number; // 0-100, higher = safer
  warnings: string[];
  findings: {
    honeypot?: boolean;
    blacklisted?: boolean;
    highRisk?: boolean;
    contractVerified?: boolean;
    holderCount?: number;
    creationTime?: string;
    tradingCooldown?: boolean;
    transferPauseable?: boolean;
  };
  sources: string[];
}

/**
 * 🛡️ SECURITY API SERVICE
 * 
 * Integrates multiple security APIs for comprehensive scam detection:
 * - GoPlus Security API (token security, honeypot detection)
 * - Chainabuse.com (known scam addresses)
 * - Custom heuristics
 */
class SecurityAPIService {
  private readonly GOPLUS_API = 'https://api.gopluslabs.io/api/v1';
  private readonly CHAINABUSE_API = 'https://www.chainabuse.com/api';
  
  // GoPlus chain IDs
  private readonly CHAIN_IDS: Record<string, string> = {
    'ethereum': '1',
    'bsc': '56',
    'polygon': '137',
    'arbitrum': '42161',
    'optimism': '10',
    'avalanche': '43114',
    'fantom': '250',
    'cronos': '25',
    'base': '8453',
    'linea': '59144',
    'zkSync': '324',
  };
  
  /**
   * 🔍 CHECK TOKEN SECURITY (GoPlus API)
   * Free tier: 100 calls/day per IP
   */
  async checkTokenSecurity(address: string, chainType: ChainType): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      isScam: false,
      riskScore: 100,
      warnings: [],
      findings: {},
      sources: [],
    };
    
    // Only works for EVM chains
    if (chainType !== 'evm') {
      return this.checkNonEVMAddress(address, chainType);
    }
    
    try {
      // Determine chain ID (default to Ethereum)
      const chainId = this.CHAIN_IDS['ethereum'];
      
      const response = await fetch(
        `${this.GOPLUS_API}/token_security/${chainId}?contract_addresses=${address}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.warn('⚠️ GoPlus API error:', response.status);
        return this.fallbackCheck(address, chainType);
      }
      
      const data = await response.json();
      const tokenData = data?.result?.[address.toLowerCase()];
      
      if (!tokenData) {
        result.warnings.push('ℹ️ No security data available for this token');
        result.riskScore = 60;
        result.sources.push('GoPlus Security');
        return result;
      }
      
      result.sources.push('GoPlus Security');
      
      // 🔴 CRITICAL CHECKS
      
      // Honeypot detection
      if (tokenData.is_honeypot === '1') {
        result.isScam = true;
        result.riskScore = 0;
        result.warnings.push('🚨 HONEYPOT DETECTED - Cannot sell this token!');
        result.findings.honeypot = true;
      }
      
      // Blacklist check
      if (tokenData.is_blacklisted === '1') {
        result.isScam = true;
        result.riskScore -= 50;
        result.warnings.push('🚨 Token is BLACKLISTED');
        result.findings.blacklisted = true;
      }
      
      // Open source verification
      if (tokenData.is_open_source === '0') {
        result.riskScore -= 20;
        result.warnings.push('⚠️ Contract is NOT open source');
        result.findings.contractVerified = false;
      } else {
        result.findings.contractVerified = true;
      }
      
      // 🟡 HIGH RISK CHECKS
      
      // Can take back ownership
      if (tokenData.can_take_back_ownership === '1') {
        result.riskScore -= 30;
        result.warnings.push('⚠️ Owner can take back ownership');
        result.findings.highRisk = true;
      }
      
      // Owner can change balance
      if (tokenData.owner_change_balance === '1') {
        result.riskScore -= 40;
        result.warnings.push('🚨 Owner can change your balance!');
        result.findings.highRisk = true;
      }
      
      // Hidden owner
      if (tokenData.hidden_owner === '1') {
        result.riskScore -= 25;
        result.warnings.push('⚠️ Contract has hidden owner');
      }
      
      // Transfer pauseable
      if (tokenData.transfer_pausable === '1') {
        result.riskScore -= 15;
        result.warnings.push('⚠️ Transfers can be paused');
        result.findings.transferPauseable = true;
      }
      
      // Trading cooldown
      if (tokenData.trading_cooldown === '1') {
        result.riskScore -= 10;
        result.warnings.push('ℹ️ Trading has cooldown period');
        result.findings.tradingCooldown = true;
      }
      
      // 🟢 POSITIVE SIGNALS
      
      // High holder count
      const holderCount = parseInt(tokenData.holder_count || '0');
      result.findings.holderCount = holderCount;
      
      if (holderCount > 10000) {
        result.warnings.push('✅ High holder count (10,000+)');
      } else if (holderCount < 100) {
        result.riskScore -= 10;
        result.warnings.push('⚠️ Low holder count (<100)');
      }
      
      // Buy/sell tax
      const buyTax = parseFloat(tokenData.buy_tax || '0');
      const sellTax = parseFloat(tokenData.sell_tax || '0');
      
      if (buyTax > 0.1 || sellTax > 0.1) {
        result.riskScore -= 15;
        result.warnings.push(`⚠️ High taxes: ${(buyTax * 100).toFixed(1)}% buy / ${(sellTax * 100).toFixed(1)}% sell`);
      }
      
      // Ensure score doesn't go below 0
      result.riskScore = Math.max(0, result.riskScore);
      
      // If score is very low, mark as scam
      if (result.riskScore < 30) {
        result.isScam = true;
      }
      
    } catch (error) {
      console.error('❌ GoPlus API error:', error);
      return this.fallbackCheck(address, chainType);
    }
    
    return result;
  }
  
  /**
   * 🔍 CHECK CHAINABUSE DATABASE
   * Checks if address is reported as scam
   */
  async checkChainabuse(address: string): Promise<{
    isReported: boolean;
    reports: number;
    category?: string;
  }> {
    try {
      // Note: Chainabuse API has rate limits, this is a fallback check
      // In production, you might want to cache results or use a paid plan
      
      const response = await fetch(
        `${this.CHAINABUSE_API}/addresses/${address}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        return { isReported: false, reports: 0 };
      }
      
      const data = await response.json();
      
      if (data && data.reports && data.reports > 0) {
        return {
          isReported: true,
          reports: data.reports,
          category: data.category,
        };
      }
      
      return { isReported: false, reports: 0 };
    } catch (error) {
      console.warn('⚠️ Chainabuse API error:', error);
      return { isReported: false, reports: 0 };
    }
  }
  
  /**
   * 🔍 CHECK NON-EVM ADDRESS
   * For Solana, Bitcoin, etc.
   */
  private async checkNonEVMAddress(address: string, chainType: ChainType): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      isScam: false,
      riskScore: 80,
      warnings: [],
      findings: {},
      sources: ['Basic validation'],
    };
    
    // Known burn/null addresses
    const knownRiskyAddresses: Record<ChainType, string[]> = {
      'evm': ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead'],
      'solana': ['11111111111111111111111111111111'],
      'bitcoin': [],
      'litecoin': [],
      'dogecoin': [],
      'bitcoin-cash': [],
    };
    
    const riskyAddrs = knownRiskyAddresses[chainType] || [];
    if (riskyAddrs.some(risky => address.toLowerCase() === risky.toLowerCase())) {
      result.isScam = true;
      result.riskScore = 0;
      result.warnings.push('🚨 This is a burn/null address - tokens sent here are lost forever!');
      return result;
    }
    
    // For non-EVM chains, provide helpful info
    switch (chainType) {
      case 'solana':
        result.warnings.push('ℹ️ Solana address detected - limited security checks available');
        result.warnings.push('💡 Tip: Check token on Solscan.io for more info');
        break;
      case 'bitcoin':
      case 'litecoin':
      case 'dogecoin':
      case 'bitcoin-cash':
        result.warnings.push(`ℹ️ ${chainType} address detected - wallet addresses are generally safe`);
        result.warnings.push('💡 Tip: Double-check the address before sending funds');
        result.riskScore = 90; // Wallet addresses are generally safe
        break;
    }
    
    return result;
  }
  
  /**
   * 🔍 FALLBACK CHECK
   * When APIs are unavailable or rate-limited
   */
  private fallbackCheck(address: string, chainType: ChainType): SecurityCheckResult {
    const result: SecurityCheckResult = {
      isScam: false,
      riskScore: 60,
      warnings: [
        'ℹ️ Limited security check (API unavailable)',
        '💡 Proceed with caution and do your own research',
      ],
      findings: {},
      sources: ['Basic validation'],
    };
    
    // Check for obvious scam patterns
    const lowerAddr = address.toLowerCase();
    
    // Burn addresses
    if (lowerAddr.includes('0000000000000000000000000000000000') || 
        lowerAddr.includes('dead') ||
        lowerAddr === '11111111111111111111111111111111') {
      result.isScam = true;
      result.riskScore = 0;
      result.warnings = ['🚨 This is a burn address - funds will be lost!'];
      return result;
    }
    
    // Address checksum validation (EVM)
    if (chainType === 'evm') {
      const hasLowerCase = /[a-f]/.test(address.slice(2));
      const hasUpperCase = /[A-F]/.test(address.slice(2));
      
      if (!hasLowerCase && !hasUpperCase) {
        result.warnings.push('⚠️ Address has no checksum - increased risk of typos');
        result.riskScore -= 10;
      }
    }
    
    return result;
  }
  
  /**
   * 🎯 COMPREHENSIVE CHECK
   * Combines all security checks
   */
  async performComprehensiveCheck(
    address: string,
    chainType: ChainType,
    type: 'contract' | 'wallet' = 'contract'
  ): Promise<SecurityCheckResult> {
    console.log(`🔍 Starting comprehensive security check for ${chainType} ${type}:`, address);
    
    // Run primary check (GoPlus for EVM contracts)
    let result: SecurityCheckResult;
    
    if (chainType === 'evm' && type === 'contract') {
      result = await this.checkTokenSecurity(address, chainType);
    } else {
      result = await this.checkNonEVMAddress(address, chainType);
    }
    
    // Check Chainabuse database (only for EVM for now)
    if (chainType === 'evm') {
      try {
        const abuseCheck = await this.checkChainabuse(address);
        if (abuseCheck.isReported) {
          result.isScam = true;
          result.riskScore = Math.min(result.riskScore, 20);
          result.warnings.unshift(
            `🚨 REPORTED ${abuseCheck.reports} time(s) as ${abuseCheck.category || 'scam'}!`
          );
          result.sources.push('Chainabuse.com');
        }
      } catch (error) {
        console.warn('⚠️ Chainabuse check skipped:', error);
      }
    }
    
    console.log(`✅ Security check complete. Score: ${result.riskScore}/100`);
    return result;
  }
}

// Singleton export
export const securityAPI = new SecurityAPIService();

