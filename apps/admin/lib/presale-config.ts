export const PRESALE_CONFIG = {
  // BSC TESTNET (voor testen)
  testnet: {
    chainId: 97,
    presaleAddress: '0x8321C862B49C4Ad9132e55c3B24Cb72772B30fdd',
    tokenAddress: '0x2C1421595151991ac3894943123d6c285bdF5116',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
  },
  
  // BSC MAINNET (voor echte launch)
  mainnet: {
    chainId: 56,
    presaleAddress: '', // Fill in after deployment
    tokenAddress: '', // Fill in after deployment
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    explorerUrl: 'https://bscscan.com',
  },
};

// Current environment - CHANGE THIS WHEN GOING TO MAINNET!
export const CURRENT_PRESALE = PRESALE_CONFIG.testnet; // Change to .mainnet for production

// Mainnet deployment checklist:
// 1. Deploy contracts to BSC mainnet
// 2. Update presaleAddress and tokenAddress in mainnet config
// 3. Change CURRENT_PRESALE to PRESALE_CONFIG.mainnet
// 4. Test with small amount first
// 5. Start presale with startPresale() function

// Presale constants
export const PRESALE_CONSTANTS = {
  hardCap: 1000000, // $1M
  softCap: 200000, // $200k
  minContribution: 100, // $100
  maxContribution: 10000, // $10,000
  tokenPrice: 0.008333, // $0.008333 per BLAZE
  launchPrice: 0.02, // $0.02 per BLAZE (2.4x gain)
  tokensForSale: 120000000, // 120M BLAZE (12% of supply)
  usdtWallet: '0x4d8eE58154eA6AFCdb52cB1B955A6dabf0A6E289', // USDT presale funds wallet
};





