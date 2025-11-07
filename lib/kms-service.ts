/**
 * 🔐 BLAZE WALLET - AWS KMS SERVICE
 * 
 * Handles encryption/decryption with AWS KMS
 * - Client-side: Encrypts ephemeral keys with KMS public key
 * - Server-side: Decrypts ephemeral keys with KMS private key
 */

import { KMSClient, GetPublicKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

export class KMSService {
  private client: KMSClient;
  private keyId: string;

  constructor() {
    this.client = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.keyId = process.env.AWS_KMS_KEY_ALIAS || 'alias/blaze-scheduled-tx';
  }

  /**
   * Get KMS public key for client-side encryption
   * ✅ Safe to expose to clients
   */
  async getPublicKey(): Promise<string> {
    try {
      const command = new GetPublicKeyCommand({ KeyId: this.keyId });
      const response = await this.client.send(command);

      if (!response.PublicKey) {
        throw new Error('Failed to retrieve public key');
      }

      // Convert to PEM format for client use
      const publicKeyBuffer = Buffer.from(response.PublicKey);
      const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBuffer.toString('base64')}\n-----END PUBLIC KEY-----`;

      return publicKeyPem;
    } catch (error: any) {
      console.error('❌ Failed to get KMS public key:', error);
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
      console.error('❌ KMS decryption failed:', error);
      throw new Error('Failed to decrypt ephemeral key');
    }
  }

  /**
   * Test KMS connectivity and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getPublicKey();
      console.log('✅ KMS connection test passed');
      return true;
    } catch (error) {
      console.error('❌ KMS connection test failed:', error);
      return false;
    }
  }
}

export const kmsService = new KMSService();

