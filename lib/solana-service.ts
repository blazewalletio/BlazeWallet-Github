import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction,
  clusterApiUrl,
  ParsedAccountData,
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import { getSPLTokenMetadata, SPLTokenMetadata } from './spl-token-metadata';

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

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
   * Get SOL balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      console.log('🔍 [SolanaService] Fetching balance for:', address);
      console.log('🔍 [SolanaService] Using RPC:', this.rpcUrl);
      
      const publicKey = new PublicKey(address);
      console.log('🔍 [SolanaService] PublicKey created:', publicKey.toBase58());
      
      const balance = await this.connection.getBalance(publicKey);
      console.log('🔍 [SolanaService] Raw balance (lamports):', balance);
      
      // Convert lamports to SOL
      const solBalance = (balance / LAMPORTS_PER_SOL).toString();
      console.log('✅ [SolanaService] Balance in SOL:', solBalance);
      
      return solBalance;
    } catch (error) {
      console.error('❌ [SolanaService] Error fetching Solana balance:', error);
      console.error('❌ [SolanaService] Error details:', {
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

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair]
      );

      return signature;
    } catch (error) {
      console.error('Error sending Solana transaction:', error);
      throw error;
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    try {
      const publicKey = new PublicKey(address);
      
      // Get confirmed signatures
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit }
      );

      // Fetch transaction details
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
            
            // Try to determine if this is a transfer
            let value = '0';
            let from = '';
            let to = '';
            
            if (instructions.length > 0 && accountKeys.length > 0) {
              // For system program transfers
              from = accountKeys[0]?.toBase58() || '';
              to = accountKeys.length > 1 ? accountKeys[1]?.toBase58() || '' : '';
              
              // Get pre and post balances to calculate transfer amount
              if (tx.meta?.postBalances && tx.meta?.preBalances) {
                const diff = Math.abs(
                  tx.meta.postBalances[0] - tx.meta.preBalances[0]
                );
                value = (diff / LAMPORTS_PER_SOL).toString();
              }
            }

            return {
              hash: sig.signature,
              from,
              to,
              value,
              timestamp: sig.blockTime || 0,
              status: tx.meta?.err ? 'failed' : 'success',
              blockNumber: sig.slot,
            };
          } catch (err) {
            console.error('Error parsing transaction:', err);
            return null;
          }
        })
      );

      // Filter out null transactions
      return transactions.filter((tx) => tx !== null);
    } catch (error) {
      console.error('Error fetching Solana transaction history:', error);
      return [];
    }
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
      // Get recent blockhash and fee calculator
      const { feeCalculator } = await this.connection.getRecentBlockhash();
      
      // Solana fees are typically very low (around 0.000005 SOL per signature)
      // Return in SOL
      return (feeCalculator.lamportsPerSignature / LAMPORTS_PER_SOL).toString();
    } catch (error) {
      console.error('Error fetching Solana fee:', error);
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
      console.error('Error fetching account info:', error);
      return null;
    }
  }

  /**
   * Get ALL SPL token accounts for a wallet address
   * Returns all tokens with non-zero balance
   */
  async getSPLTokenAccounts(address: string): Promise<any[]> {
    try {
      console.log('🪙 [SolanaService] Fetching SPL token accounts for:', address);
      
      const publicKey = new PublicKey(address);
      
      // Get all token accounts owned by this address
      const response = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`🪙 [SolanaService] Found ${response.value.length} SPL token accounts`);
      
      // Filter out accounts with zero balance
      const nonZeroAccounts = response.value.filter(account => {
        const info = account.account.data as ParsedAccountData;
        const tokenAmount = info.parsed?.info?.tokenAmount;
        return tokenAmount && parseFloat(tokenAmount.uiAmountString) > 0;
      });

      console.log(`🪙 [SolanaService] ${nonZeroAccounts.length} tokens with non-zero balance`);
      
      return nonZeroAccounts.map(account => {
        const info = account.account.data as ParsedAccountData;
        return {
          mint: info.parsed?.info?.mint,
          balance: info.parsed?.info?.tokenAmount?.uiAmountString,
          decimals: info.parsed?.info?.tokenAmount?.decimals,
          uiAmount: info.parsed?.info?.tokenAmount?.uiAmount,
        };
      });
    } catch (error) {
      console.error('❌ [SolanaService] Error fetching SPL token accounts:', error);
      return [];
    }
  }

  /**
   * Get SPL token balances with metadata
   * Returns: Token[] with balance, symbol, name, decimals, logo, price
   */
  async getSPLTokenBalances(address: string): Promise<any[]> {
    try {
      console.log('\n========== SPL TOKEN FETCH START ==========');
      
      // Step 1: Get all token accounts
      const tokenAccounts = await this.getSPLTokenAccounts(address);
      
      if (tokenAccounts.length === 0) {
        console.log('✅ [SolanaService] No SPL tokens found');
        return [];
      }

      console.log(`📊 [SolanaService] Processing ${tokenAccounts.length} SPL tokens...`);
      
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
            console.error(`Error fetching metadata for ${account.mint}:`, error);
            
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

      console.log(`✅ [SolanaService] Successfully processed ${tokensWithMetadata.length} SPL tokens`);
      console.log('========== SPL TOKEN FETCH COMPLETE ==========\n');
      
      return tokensWithMetadata;
    } catch (error) {
      console.error('❌ [SolanaService] Error in getSPLTokenBalances:', error);
      return [];
    }
  }
}


