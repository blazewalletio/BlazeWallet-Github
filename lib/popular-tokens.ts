/**
 * 🎯 POPULAR TOKENS - Curated Lists per Chain
 * 
 * These are handpicked popular tokens that appear by default in the TO dropdown.
 * Ordering is based on:
 * 1. Market cap
 * 2. Trading volume
 * 3. User preference (stablecoins first, then major tokens)
 * 
 * Li.Fi API is used for search (3000+ tokens searchable)
 * This curated list ensures INSTANT load and good UX
 */

export interface PopularToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
  isStablecoin?: boolean;
}

export const POPULAR_TOKENS: Record<string, PopularToken[]> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ETHEREUM (1) - 3459 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ethereum: [
    // Native
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    // Stablecoins (most traded)
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      isStablecoin: true,
    },
    // Wrapped assets
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      decimals: 8,
    },
    // Major DeFi tokens
    {
      symbol: 'LINK',
      name: 'ChainLink Token',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
    },
    {
      symbol: 'AAVE',
      name: 'Aave Token',
      address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      decimals: 18,
    },
    {
      symbol: 'MKR',
      name: 'Maker',
      address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      decimals: 18,
    },
    {
      symbol: 'CRV',
      name: 'Curve DAO Token',
      address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POLYGON (137) - 1397 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  polygon: [
    {
      symbol: 'POL',
      name: 'Polygon Ecosystem Token',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      decimals: 18,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      decimals: 18,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      decimals: 8,
    },
    {
      symbol: 'WMATIC',
      name: 'Wrapped Matic',
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
    },
    {
      symbol: 'LINK',
      name: 'ChainLink Token',
      address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
      decimals: 18,
    },
    {
      symbol: 'AAVE',
      name: 'Aave',
      address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ARBITRUM (42161) - 1137 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  arbitrum: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      decimals: 8,
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      decimals: 18,
    },
    {
      symbol: 'LINK',
      name: 'ChainLink Token',
      address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BASE (8453) - 612 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  base: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      decimals: 18,
      isStablecoin: true,
    },
    {
      symbol: 'USDC.e',
      name: 'USD Coin (Bridged)',
      address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      decimals: 6,
      isStablecoin: true,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OPTIMISM (10) - 326 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  optimism: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      decimals: 8,
    },
    {
      symbol: 'OP',
      name: 'Optimism',
      address: '0x4200000000000000000000000000000000000042',
      decimals: 18,
    },
    {
      symbol: 'LINK',
      name: 'ChainLink Token',
      address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BSC (56) - 686 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bsc: [
    {
      symbol: 'BNB',
      name: 'BNB',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
      logoURI: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
    },
    {
      symbol: 'BUSD',
      name: 'Binance USD',
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/9576/standard/BUSD.png',
    },
    {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/12591/standard/binance-coin-logo.png',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum Token',
      address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
    },
    {
      symbol: 'BTCB',
      name: 'BTCB Token',
      address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/14108/standard/Binance-bitcoin.png',
    },
    {
      symbol: 'CAKE',
      name: 'PancakeSwap Token',
      address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/12632/standard/pancakeswap-cake-logo.png',
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AVALANCHE (43114) - 388 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  avalanche: [
    {
      symbol: 'AVAX',
      name: 'Avalanche',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'WAVAX',
      name: 'Wrapped AVAX',
      address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      decimals: 18,
    },
    {
      symbol: 'WETH.e',
      name: 'Wrapped Ether',
      address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      decimals: 18,
    },
    {
      symbol: 'WBTC.e',
      name: 'Wrapped BTC',
      address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
      decimals: 8,
    },
    {
      symbol: 'DAI.e',
      name: 'Dai Stablecoin',
      address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
      decimals: 18,
      isStablecoin: true,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CRONOS (25) - 25 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cronos: [
    {
      symbol: 'CRO',
      name: 'Cronos',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x66e428c3f67a68878562e79A0234c1F83c208770',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'WCRO',
      name: 'Wrapped CRO',
      address: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ZKSYNC ERA (324) - 73 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  zksync: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LINEA (59144) - 108 tokens available via Li.Fi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  linea: [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
      decimals: 18,
    },
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FANTOM (250) - NOT supported by Li.Fi
  // Fallback to Supabase token_registry
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fantom: [
    {
      symbol: 'FTM',
      name: 'Fantom',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      isNative: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
      decimals: 6,
      isStablecoin: true,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
      decimals: 18,
      isStablecoin: true,
    },
    {
      symbol: 'WFTM',
      name: 'Wrapped Fantom',
      address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
      decimals: 18,
    },
  ],
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SOLANA (solana) - SPL tokens
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  solana: [
    // Native
    {
      symbol: 'SOL',
      name: 'Solana',
      address: '0x0000000000000000000000000000000000000000', // Special marker for native
      decimals: 9,
      isNative: true,
      logoURI: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
    },
    // Stablecoins (most traded)
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
    },
    {
      symbol: 'PYUSD',
      name: 'PayPal USD',
      address: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
      decimals: 6,
      isStablecoin: true,
      logoURI: 'https://assets.coingecko.com/coins/images/31212/standard/PYUSD_Logo_%282%29.png',
    },
    // Wrapped assets
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
      decimals: 8,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/standard/weth.png',
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
      decimals: 8,
      logoURI: 'https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png',
    },
    {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      address: '9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa',
      decimals: 8,
      logoURI: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
    },
    // Major Solana DeFi tokens
    {
      symbol: 'JUP',
      name: 'Jupiter',
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/32875/standard/jup.png',
    },
    {
      symbol: 'RAY',
      name: 'Raydium',
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/13928/standard/PSigc4ie_400x400.jpg',
    },
    {
      symbol: 'BONK',
      name: 'Bonk',
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      decimals: 5,
      logoURI: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
    },
    {
      symbol: 'WIF',
      name: 'dogwifhat',
      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
    },
    {
      symbol: 'TRUMP',
      name: 'OFFICIAL TRUMP',
      address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/44832/standard/trump.png',
    },
    {
      symbol: 'POPCAT',
      name: 'Popcat',
      address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      decimals: 9,
      logoURI: 'https://assets.coingecko.com/coins/images/38763/standard/new_logo.png',
    },
    {
      symbol: 'BOME',
      name: 'BOOK OF MEME',
      address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/36079/standard/BOOK_OF_MEME_LOGO_200.png',
    },
  ],
};

/**
 * Get popular tokens for a chain
 */
export const getPopularTokens = (chainKey: string): PopularToken[] => {
  return POPULAR_TOKENS[chainKey] || [];
};

/**
 * Check if chain is supported by Li.Fi (for search functionality)
 */
export const isLiFiSupported = (chainKey: string): boolean => {
  const lifiChains = [
    'ethereum',
    'polygon',
    'arbitrum',
    'base',
    'optimism',
    'bsc',
    'avalanche',
    'cronos',
    'zksync',
    'linea',
  ];
  return lifiChains.includes(chainKey);
};

