/**
 * WebAuthn Service for Biometric Authentication
 * Provides secure biometric authentication using WebAuthn API
 * 
 * ✅ WALLET-SPECIFIC CREDENTIALS:
 * - Email wallets: userId = Supabase user_id (UUID)
 * - Seed wallets: userId = EVM address (0x...)
 * - Each wallet gets its own unique biometric credential
 */

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  createdAt: number;
  lastUsed: number;
  walletIdentifier: string; // ✅ NEW: Links credential to specific wallet
  walletType: 'email' | 'seed'; // ✅ NEW: Tracks wallet type
}

export interface WebAuthnResponse {
  success: boolean;
  credential?: WebAuthnCredential;
  error?: string;
}

export class WebAuthnService {
  private static instance: WebAuthnService;
  
  public static getInstance(): WebAuthnService {
    if (!WebAuthnService.instance) {
      WebAuthnService.instance = new WebAuthnService();
    }
    return WebAuthnService.instance;
  }

  /**
   * Check if WebAuthn is supported
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof window.navigator !== 'undefined' && 
           typeof window.navigator.credentials !== 'undefined' &&
           typeof window.PublicKeyCredential !== 'undefined';
  }

  /**
   * Check if we're on the production domain for biometric support
   * Biometric credentials are domain-specific, so we only allow them on production
   */
  public isOnProductionDomain(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname === 'my.blazewallet.io' || hostname === 'localhost';
  }

  /**
   * Check if platform authenticator (biometrics) is available
   */
  public async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (error) {
      console.error('Error checking platform authenticator:', error);
      return false;
    }
  }

  /**
   * Register a new biometric credential for a specific wallet
   * ✅ WALLET-SPECIFIC: Each wallet gets unique credential
   * 
   * @param walletIdentifier - Supabase user_id (email) or EVM address (seed)
   * @param displayName - Human-readable name for the credential
   * @param walletType - 'email' or 'seed'
   */
  public async register(
    walletIdentifier: string, 
    displayName: string,
    walletType: 'email' | 'seed'
  ): Promise<WebAuthnResponse> {
    if (!this.isSupported()) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    try {
      // Check if platform authenticator is available
      const isAvailable = await this.isPlatformAuthenticatorAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available on this device' };
      }

      // ✅ PRODUCTION DOMAIN: Always use my.blazewallet.io for WebAuthn
      // This ensures credentials work across all deployments
      const rpId = 'my.blazewallet.io';
      
      // Generate challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // ✅ WALLET-SPECIFIC: Use walletIdentifier as userId (unique per wallet!)
      const userId = new TextEncoder().encode(walletIdentifier);

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: "BLAZE Wallet",
            id: rpId, // ✅ FIXED: Always use production domain
          },
          user: {
            id: userId, // ✅ WALLET-SPECIFIC: Unique per wallet
            name: displayName,
            displayName: displayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Require platform authenticator (biometrics)
            userVerification: "required",
            residentKey: "preferred"
          },
          timeout: 60000,
          attestation: "direct"
        }
      }) as PublicKeyCredential;

      if (!credential) {
        return { success: false, error: 'Failed to create credential' };
      }

      // Convert to storage format
      const publicKeyCredential = credential.response as AuthenticatorAttestationResponse;
      const credentialData: WebAuthnCredential = {
        id: credential.id,
        publicKey: this.arrayBufferToBase64(publicKeyCredential.getPublicKey()!),
        counter: 0,
        createdAt: Date.now(),
        lastUsed: 0,
        walletIdentifier, // ✅ NEW: Store wallet identifier
        walletType // ✅ NEW: Store wallet type
      };

      return { success: true, credential: credentialData };

    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      
      // Handle specific error cases
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'Biometric registration was cancelled or not allowed' };
      } else if (error.name === 'NotSupportedError') {
        return { success: false, error: 'Biometric authentication not supported on this device' };
      } else if (error.name === 'SecurityError') {
        return { success: false, error: 'Security error occurred during registration' };
      }
      
      return { success: false, error: error.message || 'Unknown error during registration' };
    }
  }

  /**
   * Authenticate using biometric credential
   */
  public async authenticate(credentialId: string): Promise<WebAuthnResponse> {
    if (!this.isSupported()) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    try {
      console.log('🔐 [WebAuthnService] authenticate() called');
      console.log('🔍 [WebAuthnService] credentialId type:', typeof credentialId);
      console.log('🔍 [WebAuthnService] credentialId length:', credentialId?.length);
      console.log('🔍 [WebAuthnService] credentialId first 50 chars:', credentialId?.substring(0, 50));
      
      // Generate challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Convert credential ID
      console.log('🔐 [WebAuthnService] Converting credential ID to ArrayBuffer...');
      const credentialIdBuffer = this.base64ToArrayBuffer(credentialId);
      console.log('✅ [WebAuthnService] Credential ID converted, buffer length:', credentialIdBuffer.byteLength);

      // Authenticate
      console.log('🔐 [WebAuthnService] Calling navigator.credentials.get()...');
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key',
            transports: ['internal']
          }],
          timeout: 60000,
          userVerification: "required"
        }
      }) as PublicKeyCredential;

      if (!credential) {
        console.log('❌ [WebAuthnService] credentials.get() returned null');
        return { success: false, error: 'Authentication failed' };
      }

      console.log('✅ [WebAuthnService] credentials.get() succeeded!');
      
      // Update last used time
      const credentialData: WebAuthnCredential = {
        id: credential.id,
        publicKey: '', // Not needed for authentication
        counter: 0,
        createdAt: 0,
        lastUsed: Date.now(),
        walletIdentifier: '', // Will be updated in storeCredential
        walletType: 'email' // Will be updated in storeCredential
      };

      return { success: true, credential: credentialData };

    } catch (error: any) {
      console.error('❌ [WebAuthnService] authentication error:', error);
      console.error('❌ [WebAuthnService] error.name:', error.name);
      console.error('❌ [WebAuthnService] error.message:', error.message);
      
      // Handle specific error cases
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'Biometric authentication was cancelled or not allowed' };
      } else if (error.name === 'NotSupportedError') {
        return { success: false, error: 'Biometric authentication not supported' };
      } else if (error.name === 'SecurityError') {
        return { success: false, error: 'Security error during authentication' };
      }
      
      return { success: false, error: error.message || 'Authentication failed' };
    }
  }

  /**
   * Get available authenticator types
   */
  public async getAvailableAuthenticators(): Promise<string[]> {
    const authenticators = [];

    if (await this.isPlatformAuthenticatorAvailable()) {
      authenticators.push('biometric');
    }

    // Check for other authenticator types
    try {
      // Use get() instead of getAll() for WebAuthn compatibility
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 1000,
          allowCredentials: []
        }
      });
      if (credential) {
        authenticators.push('passkey');
      }
    } catch (error) {
      // Ignore errors
    }

    return authenticators;
  }

  /**
   * Check if user has registered biometric credentials for a specific wallet
   * ✅ WALLET-SPECIFIC: Checks for specific wallet only
   */
  public async hasRegisteredCredentials(walletIdentifier: string): Promise<boolean> {
    try {
      const credential = this.getStoredCredential(walletIdentifier);
      return credential !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store credential data for a specific wallet
   * ✅ WALLET-INDEXED: Each wallet has its own credential
   */
  public storeCredential(credential: WebAuthnCredential, walletIdentifier: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Get all biometric data
      const allData = this.getAllBiometricData();
      
      // Store credential indexed by wallet identifier
      allData[walletIdentifier] = {
        credential,
        enabled: true,
        setupAt: Date.now()
      };
      
      localStorage.setItem('biometric_data', JSON.stringify(allData));
      console.log(`✅ Biometric credential stored for wallet: ${walletIdentifier.substring(0, 8)}...`);
    } catch (error) {
      console.error('Error storing WebAuthn credential:', error);
    }
  }

  /**
   * Get stored credential for a specific wallet
   * ✅ WALLET-SPECIFIC: Returns only credential for this wallet
   */
  public getStoredCredential(walletIdentifier: string): WebAuthnCredential | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const allData = this.getAllBiometricData();
      const walletData = allData[walletIdentifier];
      
      if (!walletData || !walletData.credential) {
        return null;
      }
      
      return walletData.credential;
    } catch (error) {
      console.error('Error retrieving WebAuthn credential:', error);
      return null;
    }
  }

  /**
   * Get ALL biometric data (for migration and management)
   */
  private getAllBiometricData(): Record<string, any> {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem('biometric_data');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error retrieving biometric data:', error);
      return {};
    }
  }

  /**
   * Remove credential for a specific wallet
   * ✅ WALLET-SPECIFIC: Only removes credential for this wallet
   */
  public removeCredential(walletIdentifier: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const allData = this.getAllBiometricData();
      delete allData[walletIdentifier];
      localStorage.setItem('biometric_data', JSON.stringify(allData));
      console.log(`✅ Biometric credential removed for wallet: ${walletIdentifier.substring(0, 8)}...`);
    } catch (error) {
      console.error('Error removing WebAuthn credential:', error);
    }
  }

  /**
   * Remove ALL credentials (for wallet reset)
   */
  public removeAllCredentials(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('biometric_data');
    // Also remove old format for cleanup
    localStorage.removeItem('webauthn_credentials');
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   * Supports both base64 and base64url formats
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Convert base64url to base64 (replace - with + and _ with /)
    const base64Standard = base64.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64Standard);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
