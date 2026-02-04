import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  clusterApiUrl,
  ParsedAccountData,
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { getSPLTokenMetadata, SPLTokenMetadata } from './spl-token-metadata';
import { getCurrencyLogo } from './currency-logo-service';
import { logger } from '@/lib/logger';

// SPL Token Program IDs (support both legacy and Token-2022!)
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// 🛡️ WRAPPED SOL MINT ADDRESS - Exclude from SPL tokens to prevent double-counting!
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';

export class SolanaService {
  private connection: Connection;
  private rpcUrl: string;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Derive Solana keypair from BIP39 mnemonic
   * Uses Solana's standard derivation path: m/44'/501'/0'/0'
   */
  deriveKeypairFromMnemonic(mnemonic: string, accountIndex: number = 0): Keypair {
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic, ''); // Use empty passphrase

    // Solana derivation path: m/44'/501'/accountIndex'/0'
    const path = `m/44'/501'/${accountIndex}'/0'`;
    
    // Derive the key
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    
    // Create Keypair from derived seed
    return Keypair.fromSeed(derivedSeed);
  }

  /**
   * Get Solana address from mnemonic
   */
  getAddressFromMnemonic(mnemonic: string, accountIndex: number = 0): string {
    const keypair = this.deriveKeypairFromMnemonic(mnemonic, accountIndex);
    return keypair.publicKey.toBase58();
  }

  /**
   * Get SOL balance for an address (including wrapped SOL!)
   * ✅ FIX: Returns total SOL = native SOL + wrapped SOL to prevent double-counting
   */
  async getBalance(address: string): Promise<string> {
    try {
      logger.log('🔍 [SolanaService] Fetching balance for:', address);
      logger.log('🔍 [SolanaService] Using RPC:', this.rpcUrl);
      
      const publicKey = new PublicKey(address);
      logger.log('🔍 [SolanaService] PublicKey created:', publicKey.toBase58());
      
      // Get native SOL balance
      const nativeBalance = await this.connection.getBalance(publicKey);
      logger.log('🔍 [SolanaService] Raw native balance (lamports):', nativeBalance);
      
      const nativeSol = nativeBalance / LAMPORTS_PER_SOL;
      logger.log('✅ [SolanaService] Native SOL balance:', nativeSol);
      
      // 🛡️ ALSO get wrapped SOL balance to include in total
      let wrappedSol = 0;
      try {
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );
        
        // Find wrapped SOL account
        const wrappedSolAccount = tokenAccounts.value.find(account => {
          const info = account.account.data as ParsedAccountData;
          return info.parsed?.info?.mint === WRAPPED_SOL_MINT;
        });
        
        if (wrappedSolAccount) {
          const info = wrappedSolAccount.account.data as ParsedAccountData;
          wrappedSol = parseFloat(info.parsed?.info?.tokenAmount?.uiAmountString || '0');
          logger.log(`🛡️ [SolanaService] Found wrapped SOL: ${wrappedSol}`);
        }
      } catch (error) {
        logger.warn('⚠️ [SolanaService] Failed to fetch wrapped SOL, using native only:', error);
      }
      
      // Total SOL = native + wrapped
      const totalSol = nativeSol + wrappedSol;
      logger.log(`✅ [SolanaService] Total SOL balance: ${nativeSol} native + ${wrappedSol} wrapped = ${totalSol}`);
      
      return totalSol.toString();
    } catch (error) {
      logger.error('❌ [SolanaService] Error fetching Solana balance:', error);
      logger.error('❌ [SolanaService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        address,
        rpcUrl: this.rpcUrl
      });
      throw error;
    }
  }

  /**
   * Send SOL transaction
   */
  async sendTransaction(
    mnemonic: string,
    toAddress: string,
    amount: string, // in SOL
    accountIndex: number = 0
  ): Promise<string> {
    try {
      // Derive keypair from mnemonic
      const fromKeypair = this.deriveKeypairFromMnemonic(mnemonic, accountIndex);
      const toPublicKey = new PublicKey(toAddress);

      // Convert SOL to lamports
      const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports,
        })
      );

      // ✅ FIX: Use manual confirmation instead of WebSocket subscriptions
      // Some RPC nodes don't support signatureSubscribe (WebSocket)
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;
      
      // Sign transaction
      transaction.sign(fromKeypair);
      
      // Send transaction (don't wait for confirmation yet)
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      logger.log(`✅ Solana transaction sent: ${signature}`);
      logger.log(`⏳ Confirming transaction (polling method, no WebSocket)...`);
      
      // ✅ Confirm using polling instead of WebSocket subscription
      // This is more compatible with various RPC providers
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      logger.log(`✅ Solana transaction confirmed: ${signature}`);

      return signature;
    } catch (error) {
      logger.error('Error sending Solana transaction:', error);
      throw error;
    }
  }

  /**
   * Send SPL Token transaction
   */
  async sendSPLToken(
    mnemonic: string,
    tokenMintAddress: string,
    toAddress: string,
    amount: string,
    accountIndex: number = 0
  ): Promise<string> {
    try {
      logger.log('🪙 [SolanaService] Sending SPL token:', {
        tokenMint: tokenMintAddress,
        to: toAddress,
        amount,
      });

      // Derive keypair from mnemonic
      const fromKeypair = this.deriveKeypairFromMnemonic(mnemonic, accountIndex);
      const toPublicKey = new PublicKey(toAddress);
      const mintPublicKey = new PublicKey(tokenMintAddress);

      // Get token accounts
      const fromTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        fromKeypair.publicKey,
        { mint: mintPublicKey }
      );

      if (fromTokenAccounts.value.length === 0) {
        throw new Error('No token account found for this token');
      }

      const fromTokenAccount = fromTokenAccounts.value[0].pubkey;

      // Get or create destination token account
      const toTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        toPublicKey,
        { mint: mintPublicKey }
      );

      let toTokenAccount: PublicKey;
      const transaction = new Transaction();

      if (toTokenAccounts.value.length === 0) {
        // Create associated token account for recipient
        const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
        
        toTokenAccount = await getAssociatedTokenAddress(
          mintPublicKey,
          toPublicKey
        );

        transaction.add(
          createAssociatedTokenAccountInstruction(
            fromKeypair.publicKey, // payer
            toTokenAccount,
            toPublicKey, // owner
            mintPublicKey
          )
        );
        
        logger.log('🆕 Creating associated token account for recipient');
      } else {
        toTokenAccount = toTokenAccounts.value[0].pubkey;
      }

      // Get token decimals
      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

      // Convert amount to token units
      const amountInTokenUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

      // Add transfer instruction
      const { createTransferInstruction } = await import('@solana/spl-token');
      
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          amountInTokenUnits
        )
      );

      // ✅ FIX: Use manual confirmation instead of WebSocket subscriptions
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;
      
      // Sign transaction
      transaction.sign(fromKeypair);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      logger.log(`✅ SPL token transaction sent: ${signature}`);
      
      // Confirm using polling instead of WebSocket subscription
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      logger.log('✅ [SolanaService] SPL token transfer successful:', signature);
      return signature;
    } catch (error) {
      logger.error('❌ [SolanaService] Error sending SPL token:', error);
      throw error;
    }
  }

  /**
   * Get recent transactions for an address
   * ✅ Enhanced with SPL token detection and proper error handling
   */
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    try {
      const publicKey = new PublicKey(address);
      
      // Get confirmed signatures with retry
      const signatures = await this.getSignaturesWithRetry(publicKey, limit);

      // Fetch transaction details in parallel
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          try {
            const tx = await this.connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0
            });
            
            if (!tx) return null;

            // Parse transaction data
            const accountKeys = tx.transaction.message.staticAccountKeys || [];
            const instructions = tx.transaction.message.compiledInstructions || [];
            
            // Detect transaction type and extract details - ✅ NOW with await
            const txDetails = await this.parseTransaction(tx, accountKeys, instructions, address);
            
            // ✅ FIX 1: Convert blockTime from seconds to milliseconds
            // ✅ FIX 2: Handle null blockTime for very recent transactions
            const timestamp = sig.blockTime 
              ? sig.blockTime * 1000 
              : Date.now(); // Fallback to now for very recent tx

            return {
              hash: sig.signature,
              from: txDetails.from,
              to: txDetails.to,
              value: txDetails.value,
              timestamp, // ✅ Now in milliseconds
              isError: tx.meta?.err !== null, // ✅ FIX 3: Proper isError boolean
              blockNumber: sig.slot,
              tokenSymbol: txDetails.tokenSymbol,
              tokenName: txDetails.tokenName,  // ✅ FIX: Pass token name
              type: txDetails.type,
              mint: txDetails.mint,            // ✅ FIX: Pass mint address
              logoUrl: txDetails.logoUrl,      // ✅ FIX: Pass logo URL for watermark
            };
          } catch (err) {
            logger.error('Error parsing Solana transaction:', err);
            return null;
          }
        })
      );

      // Filter out null transactions
      return transactions.filter((tx) => tx !== null);
    } catch (error) {
      logger.error('Error fetching Solana transaction history:', error);
      throw error; // Propagate error for retry logic
    }
  }

  /**
   * Get signatures with retry logic
   */
  private async getSignaturesWithRetry(
    publicKey: PublicKey, 
    limit: number, 
    maxRetries = 3
  ): Promise<any[]> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.connection.getSignaturesForAddress(publicKey, { limit });
      } catch (error: any) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
          logger.log(`⏳ Solana RPC retry ${i + 1}/${maxRetries}, waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error('Failed to fetch Solana signatures');
  }

  /**
   * Parse transaction to detect type and extract details
   * ✅ NOW ASYNC to support metadata lookup in detectSPLTransfer()
   * Supports: Native SOL transfers, SPL token transfers, swaps, staking
   */
  private async parseTransaction(
    tx: any,
    accountKeys: PublicKey[],
    instructions: any[],
    userAddress: string
  ): Promise<{ from: string; to: string; value: string; tokenSymbol?: string; tokenName?: string; type?: string; mint?: string; logoUrl?: string }> {
    const userPubkey = new PublicKey(userAddress);

    // Default values
    let from = '';
    let to = '';
    let value = '0';
    let tokenSymbol: string | undefined;
    let tokenName: string | undefined;
    let type: string | undefined;
    let logoUrl: string | undefined;

    if (instructions.length === 0 || accountKeys.length === 0) {
      return { from, to, value };
    }

    // Check for SPL token transfer (Token Program) - ✅ NOW with await
    const splTransfer = await this.detectSPLTransfer(tx, instructions, accountKeys, userPubkey);
    if (splTransfer) {
      return splTransfer;
    }

    // Native SOL transfer (System Program) - ✅ NOW with await
    const solTransfer = await this.detectSOLTransfer(tx, accountKeys);
    if (solTransfer) {
      return solTransfer;
    }

    // Fallback: Use first two accounts
    from = accountKeys[0]?.toBase58() || '';
    to = accountKeys.length > 1 ? accountKeys[1]?.toBase58() || '' : '';
    
    return { from, to, value, tokenSymbol, tokenName, type, logoUrl };
  }

  /**
   * Detect native SOL transfer
   */
  private async detectSOLTransfer(
    tx: any,
    accountKeys: PublicKey[]
  ): Promise<{ from: string; to: string; value: string; type: string; tokenSymbol?: string; tokenName?: string; logoUrl?: string } | null> {
    // Get pre and post balances to calculate transfer amount
    if (tx.meta?.postBalances && tx.meta?.preBalances && accountKeys.length >= 2) {
      const diff = Math.abs(
        tx.meta.postBalances[0] - tx.meta.preBalances[0]
      );
      
      if (diff > 0) {
        // ✅ EXCLUSIVELY use CoinGecko Pro API for logo
        const logoUrl = await getCurrencyLogo('SOL', undefined, 'solana');
        
        return {
          from: accountKeys[0]?.toBase58() || '',
          to: accountKeys[1]?.toBase58() || '',
          value: (diff / LAMPORTS_PER_SOL).toString(),
          type: 'Transfer',
          tokenSymbol: 'SOL',  // ✅ Native SOL symbol
          tokenName: 'Solana',  // ✅ Native SOL name
          logoUrl, // ✅ ONLY from CoinGecko Pro API!
        };
      }
    }

    return null;
  }

  /**
   * Detect SPL token transfer
   * ✅ NOW WITH METADATA LOOKUP for correct token names/symbols
   * ✅ FIXED: Guaranteed logoUrl fallback to prevent undefined
   */
  private async detectSPLTransfer(
    tx: any,
    instructions: any[],
    accountKeys: PublicKey[],
    userPubkey: PublicKey
  ): Promise<{ from: string; to: string; value: string; tokenSymbol: string; tokenName?: string; type: string; mint?: string; logoUrl?: string } | null> {
    // ✅ FIX: Check if transaction involves EITHER Token Program (legacy or Token-2022)
    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const token2022ProgramId = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    
    for (const instruction of instructions) {
      const programId = accountKeys[instruction.programIdIndex];
      
      // ✅ FIX: Support BOTH token programs!
      if (programId?.equals(tokenProgramId) || programId?.equals(token2022ProgramId)) {
        // SPL token transfer detected (legacy or Token-2022)
        // Parse token balances from meta
        if (tx.meta?.preTokenBalances && tx.meta?.postTokenBalances) {
          for (let i = 0; i < tx.meta.preTokenBalances.length; i++) {
            const preBalance = tx.meta.preTokenBalances[i];
            const postBalance = tx.meta.postTokenBalances[i];
            
            if (preBalance && postBalance && preBalance.mint === postBalance.mint) {
              const diff = Math.abs(
                parseFloat(postBalance.uiTokenAmount.uiAmountString || '0') -
                parseFloat(preBalance.uiTokenAmount.uiAmountString || '0')
              );
              
              if (diff > 0) {
                // ✅ FIX: Extract mint and fetch metadata
                const mint = postBalance.mint || preBalance.mint;
                
                logger.log(`🔍 [SPL Transfer] Fetching metadata for mint: ${mint}`);
                
                let metadata;
                try {
                  // Fetch token metadata (uses 7-tier: hardcoded + Jupiter + DexScreener + CoinGecko + Metaplex + RPC!)
                  metadata = await getSPLTokenMetadata(mint);
                  
                  logger.log(`✅ [SPL Transfer] Got metadata:`, {
                    symbol: metadata.symbol,
                    name: metadata.name,
                    logoURI: metadata.logoURI
                  });
                } catch (metadataError) {
                  logger.error(`❌ [SPL Transfer] Metadata fetch failed for ${mint}:`, metadataError);
                  // Use fallback metadata
                  metadata = {
                    mint,
                    symbol: `${mint.slice(0, 6)}`,
                    name: `Token ${mint.slice(0, 8)}...`,
                    decimals: 9,
                    logoURI: '/crypto-solana.png',
                  };
                }
                
                // Determine from/to based on balance change
                const owner = preBalance.owner || postBalance.owner;
                const isSent = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0') < 
                               parseFloat(preBalance.uiTokenAmount.uiAmountString || '0');
                
                // ✅ EXCLUSIVELY use CoinGecko Pro API for logo (NO metadata.logoURI fallback!)
                const logoUrl = await getCurrencyLogo(
                  metadata.symbol,
                  mint, // SPL token mint address as contract
                  'solana'
                );
                
                return {
                  from: isSent ? owner : accountKeys[0]?.toBase58() || '',
                  to: isSent ? accountKeys[1]?.toBase58() || '' : owner,
                  value: diff.toString(),
                  tokenSymbol: metadata.symbol,  // ✅ Now gets "WIF", "NPCS", "ai16z" etc
                  tokenName: metadata.name,      // ✅ Full token name (e.g., "NPC Solana", "dogwifhat", "ai16z")
                  type: 'Token Transfer',
                  mint: mint,                    // ✅ Store mint for reference
                  logoUrl, // ✅ ONLY from CoinGecko Pro API!
                };
              }
            }
          }
        }
        
        // 🆕 FALLBACK: For failed transactions or those without balance changes,
        // try to extract mint from ANY token balance (pre OR post) and fetch metadata
        logger.log(`⚠️ [SPL Transfer] No balance diff found, trying fallback metadata fetch...`);
        
        if (tx.meta?.preTokenBalances && tx.meta.preTokenBalances.length > 0) {
          const firstBalance = tx.meta.preTokenBalances[0];
          const mint = firstBalance.mint;
          
          if (mint) {
            logger.log(`🔍 [SPL Transfer FALLBACK] Fetching metadata for mint: ${mint}`);
            
            try {
              const metadata = await getSPLTokenMetadata(mint);
              
              logger.log(`✅ [SPL Transfer FALLBACK] Got metadata:`, {
                symbol: metadata.symbol,
                name: metadata.name,
              });
              
              // ✅ EXCLUSIVELY use CoinGecko Pro API for logo
              const logoUrl = await getCurrencyLogo(
                metadata.symbol,
                mint,
                'solana'
              );
              
              return {
                from: accountKeys[0]?.toBase58() || '',
                to: accountKeys[1]?.toBase58() || '',
                value: '0',
                tokenSymbol: metadata.symbol,
                tokenName: metadata.name,
                type: 'Token Transfer',
                mint: mint,
                logoUrl, // ✅ ONLY from CoinGecko Pro API!
              };
            } catch (metadataError) {
              logger.error(`❌ [SPL Transfer FALLBACK] Metadata fetch failed for ${mint}:`, metadataError);
            }
          }
        }
        
        // Check postTokenBalances too
        if (tx.meta?.postTokenBalances && tx.meta.postTokenBalances.length > 0) {
          const firstBalance = tx.meta.postTokenBalances[0];
          const mint = firstBalance.mint;
          
          if (mint) {
            logger.log(`🔍 [SPL Transfer FALLBACK POST] Fetching metadata for mint: ${mint}`);
            
            try {
              const metadata = await getSPLTokenMetadata(mint);
              
              logger.log(`✅ [SPL Transfer FALLBACK POST] Got metadata:`, {
                symbol: metadata.symbol,
                name: metadata.name,
              });
              
              // ✅ EXCLUSIVELY use CoinGecko Pro API for logo
              const logoUrl = await getCurrencyLogo(
                metadata.symbol,
                mint,
                'solana'
              );
              
              return {
                from: accountKeys[0]?.toBase58() || '',
                to: accountKeys[1]?.toBase58() || '',
                value: '0',
                tokenSymbol: metadata.symbol,
                tokenName: metadata.name,
                type: 'Token Transfer',
                mint: mint,
                logoUrl, // ✅ ONLY from CoinGecko Pro API!
              };
            } catch (metadataError) {
              logger.error(`❌ [SPL Transfer FALLBACK POST] Metadata fetch failed for ${mint}:`, metadataError);
            }
          }
        }
        
        // Ultimate fallback if we really can't find any token info
        logger.warn(`⚠️ [SPL Transfer] No token balances found, using generic fallback`);
        
        // ✅ Even for unknown tokens, try CoinGecko Pro API with 'SPL' symbol
        const logoUrl = await getCurrencyLogo('SPL', undefined, 'solana');
        
        return {
          from: accountKeys[0]?.toBase58() || '',
          to: accountKeys[1]?.toBase58() || '',
          value: '0',
          tokenSymbol: 'SPL',
          tokenName: 'Unknown Token',
          type: 'Token Transfer',
          logoUrl, // ✅ From CoinGecko Pro API (will fallback to placeholder internally)
        };
      }
    }

    return null;
  }

  /**
   * Validate Solana address
   */
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get estimated transaction fee
   */
  async getTransactionFee(): Promise<string> {
    try {
      // ✅ Use new API: getFeeForMessage instead of deprecated getRecentBlockhash
      // Solana now requires creating a dummy transaction to estimate fees
      const latestBlockhash = await this.connection.getLatestBlockhash();
      
      // Solana fees are typically very low (around 0.000005 SOL per signature)
      // Return fixed fee estimate (Solana has predictable fees)
      return '0.000005';
    } catch (error) {
      logger.error('Error fetching Solana fee:', error);
      // Return default fee estimate
      return '0.000005';
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(address: string): Promise<any> {
    try {
      const publicKey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      return accountInfo;
    } catch (error) {
      logger.error('Error fetching account info:', error);
      return null;
    }
  }

  /**
   * Get ALL SPL token accounts for a wallet address
   * Returns all tokens with non-zero balance
   * ✅ SUPPORTS BOTH TOKEN_PROGRAM_ID AND TOKEN_2022_PROGRAM_ID!
   */
  async getSPLTokenAccounts(address: string): Promise<any[]> {
    try {
      logger.log('🪙 [SolanaService] Fetching SPL token accounts for:', address);
      
      const publicKey = new PublicKey(address);
      
      // ✅ FIX: Fetch BOTH token programs in parallel to support Token-2022!
      // Many new tokens (like ai16z) use Token-2022 standard
      logger.log('🪙 [SolanaService] Fetching TOKEN_PROGRAM_ID accounts...');
      logger.log('🪙 [SolanaService] Fetching TOKEN_2022_PROGRAM_ID accounts...');
      
      const [responseV1, responseV2] = await Promise.all([
        this.connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        ),
        this.connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_2022_PROGRAM_ID }
        ),
      ]);

      // Merge results from both programs
      const allAccounts = [
        ...responseV1.value,
        ...responseV2.value,
      ];

      logger.log(`🪙 [SolanaService] Found ${responseV1.value.length} legacy + ${responseV2.value.length} Token-2022 = ${allAccounts.length} total SPL token accounts`);
      
      // Filter out accounts with zero balance
      const nonZeroAccounts = allAccounts.filter(account => {
        const info = account.account.data as ParsedAccountData;
        const tokenAmount = info.parsed?.info?.tokenAmount;
        return tokenAmount && parseFloat(tokenAmount.uiAmountString) > 0;
      });

      logger.log(`🪙 [SolanaService] ${nonZeroAccounts.length} tokens with non-zero balance`);
      
      // 🛡️ FILTER OUT WRAPPED SOL to prevent double-counting!
      // Wrapped SOL should be counted as native SOL, not as SPL token
      const filteredAccounts = nonZeroAccounts.filter(account => {
        const info = account.account.data as ParsedAccountData;
        const mint = info.parsed?.info?.mint;
        
        if (mint === WRAPPED_SOL_MINT) {
          const wsolBalance = info.parsed?.info?.tokenAmount?.uiAmountString;
          logger.log(`🛡️ [SolanaService] FILTERED OUT Wrapped SOL (${wsolBalance}) to prevent double-counting`);
          return false; // Exclude wrapped SOL
        }
        
        return true;
      });
      
      logger.log(`🪙 [SolanaService] ${filteredAccounts.length} tokens after filtering wrapped SOL`);
      
      return filteredAccounts.map(account => {
        const info = account.account.data as ParsedAccountData;
        return {
          mint: info.parsed?.info?.mint,
          balance: info.parsed?.info?.tokenAmount?.uiAmountString,
          decimals: info.parsed?.info?.tokenAmount?.decimals,
          uiAmount: info.parsed?.info?.tokenAmount?.uiAmount,
        };
      });
    } catch (error) {
      logger.error('❌ [SolanaService] Error fetching SPL token accounts:', error);
      return [];
    }
  }

  /**
   * Get SPL token balances with metadata
   * Returns: Token[] with balance, symbol, name, decimals, logo, price
   */
  async getSPLTokenBalances(address: string): Promise<any[]> {
    try {
      logger.log('\n========== SPL TOKEN FETCH START ==========');
      
      // Step 1: Get all token accounts
      const tokenAccounts = await this.getSPLTokenAccounts(address);
      
      if (tokenAccounts.length === 0) {
        logger.log('✅ [SolanaService] No SPL tokens found');
        return [];
      }

      logger.log(`📊 [SolanaService] Processing ${tokenAccounts.length} SPL tokens...`);
      
      // Step 2: Get metadata for all tokens
      const tokensWithMetadata = await Promise.all(
        tokenAccounts.map(async (account) => {
          try {
            const metadata = await getSPLTokenMetadata(account.mint);
            
            return {
              address: account.mint, // Use mint as address for consistency with ERC20
              symbol: metadata.symbol,
              name: metadata.name,
              decimals: account.decimals,
              balance: account.balance || '0',
              logo: metadata.logoURI || '🪙', // Default emoji if no logo
              // priceUSD and balanceUSD will be added by Dashboard
            };
          } catch (error) {
            logger.error(`Error fetching metadata for ${account.mint}:`, error);
            
            // Return basic info even if metadata fetch fails
            return {
              address: account.mint,
              symbol: account.mint.slice(0, 4) + '...',
              name: 'Unknown Token',
              decimals: account.decimals,
              balance: account.balance || '0',
              logo: '🪙',
            };
          }
        })
      );

      logger.log(`✅ [SolanaService] Successfully processed ${tokensWithMetadata.length} SPL tokens`);
      logger.log('========== SPL TOKEN FETCH COMPLETE ==========\n');
      
      return tokensWithMetadata;
    } catch (error) {
      logger.error('❌ [SolanaService] Error in getSPLTokenBalances:', error);
      return [];
    }
  }
}


