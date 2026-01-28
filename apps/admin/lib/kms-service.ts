/**
 * 🔐 BLAZE WALLET - AWS KMS SERVICE
 * 
 * Handles encryption/decryption with AWS KMS
 * - Client-side: Encrypts ephemeral keys with KMS public key
 * - Server-side: Decrypts ephemeral keys with KMS private key
 */

import { KMSClient, GetPublicKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { logger } from '@/lib/logger';

export class KMSService {
  private client: KMSClient;
  private keyId: string;
  private region: string;

  constructor() {
    this.region = (process.env.AWS_REGION || 'us-east-1').trim();
    const accessKeyRaw = process.env.AWS_ACCESS_KEY_ID;
    const secretKeyRaw = process.env.AWS_SECRET_ACCESS_KEY;
    const aliasEnvRaw = process.env.AWS_KMS_KEY_ALIAS;
    const idEnvRaw = process.env.KMS_KEY_ID;

    const accessKey = accessKeyRaw?.trim();
    const secretKey = secretKeyRaw?.trim();
    const aliasEnv = aliasEnvRaw?.trim();
    const idEnv = idEnvRaw?.trim();

    this.keyId = aliasEnv || idEnv || 'alias/blaze-scheduled-tx';

    logger.log('[KMSService] Initializing KMS client with configuration:', {
      region: this.region,
      hasAccessKey: Boolean(accessKey),
      accessKeyPreview: accessKey ? `${accessKey.slice(0, 4)}…${accessKey.slice(-4)}` : null,
      hasSecretKey: Boolean(secretKey),
      keyId: this.keyId,
      aliasEnv,
      idEnv,
    });

    this.client = new KMSClient({
      region: this.region,
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
    });
  }

  /**
   * Get KMS public key for client-side encryption
   * ✅ Safe to expose to clients
   */
  async getPublicKey(): Promise<string> {
    try {
      logger.log('[KMSService] Calling GetPublicKeyCommand', {
        keyId: this.keyId,
        region: this.region,
      });

      const command = new GetPublicKeyCommand({ KeyId: this.keyId });
      const response = await this.client.send(command);

      if (!response.PublicKey) {
        throw new Error('Failed to retrieve public key');
      }

      logger.log('[KMSService] GetPublicKey response metadata:', {
        keyId: this.keyId,
        httpStatus: response.$metadata?.httpStatusCode,
        requestId: response.$metadata?.requestId,
      });

      // Convert to PEM format for client use
      const publicKeyBuffer = Buffer.from(response.PublicKey);
      const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBuffer.toString('base64')}\n-----END PUBLIC KEY-----`;

      return publicKeyPem;
    } catch (error: any) {
      logger.error('❌ Failed to get KMS public key:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        metadata: error?.$metadata,
        keyIdTried: this.keyId,
        region: this.region,
      });
      throw new Error('KMS public key retrieval failed');
    }
  }

  /**
   * Decrypt ephemeral key using KMS private key
   * ✅ ONLY runs on backend
   */
  async decryptEphemeralKey(encryptedEphemeralKey: string): Promise<Buffer> {
    try {
      const command = new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(encryptedEphemeralKey, 'base64'),
        EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
      });

      const response = await this.client.send(command);

      if (!response.Plaintext) {
        throw new Error('KMS decryption returned empty plaintext');
      }

      return Buffer.from(response.Plaintext);
    } catch (error: any) {
      logger.error('❌ KMS decryption failed:', error);
      throw new Error('Failed to decrypt ephemeral key');
    }
  }

  /**
   * Test KMS connectivity and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getPublicKey();
      logger.log('✅ KMS connection test passed');
      return true;
    } catch (error) {
      logger.error('❌ KMS connection test failed:', error);
      return false;
    }
  }
}

export const kmsService = new KMSService();

