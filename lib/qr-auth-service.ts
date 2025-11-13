/**
 * QR Code Authentication Service
 * Handles cross-device authentication using QR codes
 */

import QRCode from 'qrcode';
import { logger } from '@/lib/logger';

export interface QRLoginSession {
  id: string;
  challenge: string;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  deviceInfo: {
    userAgent: string;
    platform: string;
    timestamp: number;
  };
}

export interface QRLoginRequest {
  sessionId: string;
  challenge: string;
  address: string;
  timestamp: number;
}

export class QRAuthService {
  private static instance: QRAuthService;
  private sessions: Map<string, QRLoginSession> = new Map();
  private sessionTimeout = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): QRAuthService {
    if (!QRAuthService.instance) {
      QRAuthService.instance = new QRAuthService();
    }
    return QRAuthService.instance;
  }

  /**
   * Generate a new QR login session
   */
  public async createLoginSession(deviceInfo?: any): Promise<{ sessionId: string; qrCode: string }> {
    const sessionId = this.generateSessionId();
    const challenge = this.generateChallenge();
    const expiresAt = Date.now() + this.sessionTimeout;

    const session: QRLoginSession = {
      id: sessionId,
      challenge,
      expiresAt,
      status: 'pending',
      deviceInfo: {
        userAgent: deviceInfo?.userAgent || navigator.userAgent,
        platform: deviceInfo?.platform || navigator.platform,
        timestamp: Date.now()
      }
    };

    this.sessions.set(sessionId, session);

    // Create QR code data
    const qrData = JSON.stringify({
      type: 'blaze-login',
      sessionId,
      challenge,
      timestamp: Date.now(),
      url: window.location.origin
    });

    const qrCode = await QRCode.toDataURL(qrData, {
      width: 256,
      margin: 2,
      color: {
        dark: '#f97316', // Orange
        light: '#ffffff'
      }
    });

    // Cleanup expired sessions
    this.cleanupExpiredSessions();

    return { sessionId, qrCode };
  }

  /**
   * Check session status
   */
  public checkSessionStatus(sessionId: string): QRLoginSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      session.status = 'expired';
      this.sessions.delete(sessionId);
      return session;
    }

    return session;
  }

  /**
   * Approve login session (called from mobile app)
   */
  public approveSession(sessionId: string, walletAddress: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.status !== 'pending') {
      return false;
    }

    // Update session with approval
    session.status = 'approved';
    
    // Store additional session data
    (session as any).walletAddress = walletAddress;
    (session as any).approvedAt = Date.now();

    return true;
  }

  /**
   * Reject login session
   */
  public rejectSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.status !== 'pending') {
      return false;
    }

    session.status = 'rejected';
    return true;
  }

  /**
   * Wait for session approval
   */
  public async waitForApproval(sessionId: string, timeout: number = 300000): Promise<QRLoginSession | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkStatus = () => {
        const session = this.checkSessionStatus(sessionId);
        
        if (!session) {
          resolve(null);
          return;
        }

        if (session.status === 'approved') {
          resolve(session);
          return;
        }

        if (session.status === 'rejected' || session.status === 'expired') {
          resolve(session);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          resolve(null);
          return;
        }

        // Check again in 1 second
        setTimeout(checkStatus, 1000);
      };

      checkStatus();
    });
  }

  /**
   * Parse QR code data
   */
  public parseQRCode(qrData: string): QRLoginRequest | null {
    try {
      const data = JSON.parse(qrData);
      
      if (data.type !== 'blaze-login') {
        return null;
      }

      // Validate required fields
      if (!data.sessionId || !data.challenge || !data.timestamp) {
        return null;
      }

      // Check if QR code is not too old (max 5 minutes)
      if (Date.now() - data.timestamp > this.sessionTimeout) {
        return null;
      }

      return {
        sessionId: data.sessionId,
        challenge: data.challenge,
        address: '', // Will be filled by mobile app
        timestamp: data.timestamp
      };
    } catch (error) {
      logger.error('Error parsing QR code:', error);
      return null;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `blaze_${timestamp}_${random}`;
  }

  /**
   * Generate secure challenge
   */
  private generateChallenge(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): QRLoginSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Remove session
   */
  public removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): QRLoginSession[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(session => 
      session.status === 'pending' && now < session.expiresAt
    );
  }
}
