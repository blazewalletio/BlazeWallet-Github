/**
 * Smart Contract Addresses Configuration
 * All BLAZE ecosystem contracts on BSC Testnet and Mainnet
 */

export interface ContractAddresses {
  blazeToken: string;
  presale: string;
  governance: string;
  launchpad: string;
  nftSkins: string;
  vesting: string;
  treasury: string;
}

export const BSC_TESTNET_CONTRACTS: ContractAddresses = {
  // Token & Presale (already deployed)
  blazeToken: '0x2C1421595151991ac3894943123d6c285bdF5116',
  presale: '0x8321C862B49C4Ad9132e55c3B24Cb72772B30fdd',
  
  // New features (just deployed!)
  governance: '0x004652F1476f8AD0036717b3BAd74220944E19e2',
  launchpad: '0x0d87956B481B0E9f614503036e7B7476e7f9B65e',
  nftSkins: '0xCE90Bf8C7f4769eC2658440d969ac54bB8e94f19',
  
  // To be deployed
  vesting: '', // Will deploy when needed
  
  // Treasury
  treasury: '0x18347D3bcb33721e0C603BeFD2ffAC8762D5A24D',
};

export const BSC_MAINNET_CONTRACTS: ContractAddresses = {
  blazeToken: '', // Deploy to mainnet later
  presale: '',
  governance: '',
  launchpad: '',
  nftSkins: '',
  vesting: '',
  treasury: '', // Set production treasury wallet
};

// Current network (change for production)
export const CURRENT_NETWORK = 'testnet'; // 'testnet' | 'mainnet'

export const CONTRACTS = CURRENT_NETWORK === 'testnet' 
  ? BSC_TESTNET_CONTRACTS 
  : BSC_MAINNET_CONTRACTS;

// Alias for backward compatibility
export const CONTRACT_ADDRESSES = CONTRACTS;

// Contract ABIs will be imported from the artifacts
export { default as BlazeTokenABI } from '../contracts/artifacts/contracts/BlazeToken.sol/BlazeToken.json';
export { default as BlazePresaleABI } from '../contracts/artifacts/contracts/BlazePresale.sol/BlazePresale.json';
export { default as BlazeGovernanceABI } from '../contracts/artifacts/contracts/BlazeGovernance.sol/BlazeGovernance.json';
export { default as BlazeChainLaunchpadABI } from '../contracts/artifacts/contracts/BlazeChainLaunchpad.sol/BlazeChainLaunchpad.json';
export { default as BlazeWalletSkinsABI } from '../contracts/artifacts/contracts/BlazeWalletSkins.sol/BlazeWalletSkins.json';

// Network configurations
export const NETWORK_CONFIG = {
  testnet: {
    chainId: 97,
    name: 'BSC Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
  mainnet: {
    chainId: 56,
    name: 'BSC Mainnet',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
};

export const CURRENT_NETWORK_CONFIG = CURRENT_NETWORK === 'testnet'
  ? NETWORK_CONFIG.testnet
  : NETWORK_CONFIG.mainnet;

// Feature flags
export const FEATURES = {
  staking: true,
  governance: true,
  launchpad: true,
  nftSkins: true,
  cashback: true, // Off-chain
  referrals: true, // Off-chain
  vesting: true, // Only for founders
  presale: true,
};

// Constants
export const CONSTANTS = {
  governance: {
    proposalThreshold: '10000', // 10k BLAZE
    votingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
    executionDelay: 2 * 24 * 60 * 60, // 2 days in seconds
    quorumPercentage: 51,
  },
  launchpad: {
    platformFee: 2, // 2%
    earlyAccessThreshold: '5000', // 5k BLAZE
    earlyAccessDuration: 60 * 60, // 1 hour in seconds
  },
  nftSkins: {
    premiumThreshold: '1000', // 1k BLAZE
    premiumDiscount: 50, // 50%
  },
  staking: {
    flexibleAPY: 8,
    sixMonthAPY: 15,
    oneYearAPY: 20,
  },
};

