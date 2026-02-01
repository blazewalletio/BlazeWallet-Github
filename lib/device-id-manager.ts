/**
 * Device ID Manager
 * Manages persistent device identification via localStorage UUID
 * Primary identifier for device verification (more stable than fingerprint)
 */

import { logger } from './logger';
import { debugLogger } from './debug-logger';

export class DeviceIdManager {
  private static readonly STORAGE_KEY = 'blaze_device_id';
  private static readonly DEVICE_NAME_KEY = 'blaze_device_name';
  
  /**
   * Get or create persistent device ID
   * Returns: { deviceId: string, isNew: boolean }
   */
  static getOrCreateDeviceId(): { deviceId: string; isNew: boolean } {
    if (typeof window === 'undefined') {
      throw new Error('DeviceIdManager can only run in browser');
    }
    
    // 🔧 DEBUG: Log localStorage state BEFORE reading
    debugLogger.debug('localStorage', '🔍 READING localStorage for device_id', {
      storageKey: this.STORAGE_KEY,
      allKeys: Object.keys(localStorage),
      localStorageLength: localStorage.length,
      url: window.location.href,
    });
    
    // Check if device ID already exists
    const existing = localStorage.getItem(this.STORAGE_KEY);
    
    // 🔧 DEBUG: Log the result
    debugLogger.info('localStorage', existing ? '✅ Device ID found in localStorage' : '❌ Device ID NOT found in localStorage', {
      deviceId: existing ? existing.substring(0, 12) + '...' : 'null',
      isValid: existing ? this.isValidUUID(existing) : false,
      rawValue: existing,
    });
    
    if (existing && this.isValidUUID(existing)) {
      logger.log('✅ [DeviceID] Found existing device ID:', existing.substring(0, 8) + '...');
      return { deviceId: existing, isNew: false };
    }
    
    // Generate NEW device ID (UUID v4)
    const newDeviceId = this.generateUUID();
    
    // 🔧 DEBUG: Log BEFORE writing to localStorage
    debugLogger.warn('localStorage', '🆕 CREATING NEW device ID', {
      newDeviceId: newDeviceId.substring(0, 12) + '...',
      reason: existing ? 'Invalid UUID format' : 'No existing device ID',
      existingValue: existing,
    });
    
    localStorage.setItem(this.STORAGE_KEY, newDeviceId);
    
    // 🔧 DEBUG: Verify write was successful
    const verification = localStorage.getItem(this.STORAGE_KEY);
    debugLogger.info('localStorage', verification === newDeviceId ? '✅ Device ID written successfully' : '❌ Device ID write FAILED', {
      written: newDeviceId.substring(0, 12) + '...',
      readBack: verification ? verification.substring(0, 12) + '...' : 'null',
      writeSuccessful: verification === newDeviceId,
    });
    
    logger.log('🆕 [DeviceID] Generated NEW device ID:', newDeviceId.substring(0, 8) + '...');
    
    return { deviceId: newDeviceId, isNew: true };
  }
  
  /**
   * Get device ID (without creating)
   * Returns null if not found
   */
  static getDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.STORAGE_KEY);
  }
  
  /**
   * Get or generate device name
   */
  static getDeviceName(): string {
    if (typeof window === 'undefined') return 'Unknown Device';
    
    const cached = localStorage.getItem(this.DEVICE_NAME_KEY);
    if (cached) return cached;
    
    const name = this.generateDeviceName();
    localStorage.setItem(this.DEVICE_NAME_KEY, name);
    return name;
  }
  
  /**
   * Set device ID manually (for recovery)
   */
  static setDeviceId(deviceId: string): void {
    if (typeof window === 'undefined') return;
    
    if (!this.isValidUUID(deviceId)) {
      throw new Error('Invalid device ID format (must be UUID v4)');
    }
    
    localStorage.setItem(this.STORAGE_KEY, deviceId);
    logger.log('✅ [DeviceID] Device ID set manually:', deviceId.substring(0, 8) + '...');
  }
  
  /**
   * Clear device ID (for logout/reset)
   */
  static clearDeviceId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.DEVICE_NAME_KEY);
    logger.log('🗑️ [DeviceID] Device ID cleared');
  }
  
  /**
   * Rotate device ID (security - force re-verification)
   */
  static rotateDeviceId(): string {
    this.clearDeviceId();
    const { deviceId } = this.getOrCreateDeviceId();
    logger.log('🔄 [DeviceID] Device ID rotated');
    return deviceId;
  }
  
  /**
   * Check if device ID exists in localStorage
   */
  static hasDeviceId(): boolean {
    if (typeof window === 'undefined') return false;
    const deviceId = localStorage.getItem(this.STORAGE_KEY);
    return deviceId !== null && this.isValidUUID(deviceId);
  }
  
  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================
  
  /**
   * Generate UUID v4
   */
  private static generateUUID(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback: Manual UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  /**
   * Validate UUID format
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
  
  /**
   * Generate human-readable device name
   */
  private static generateDeviceName(): string {
    const ua = navigator.userAgent;
    
    // iOS
    if (/iPhone/.test(ua)) {
      const match = ua.match(/iPhone OS (\d+_\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `iPhone (iOS ${version})`;
    }
    
    if (/iPad/.test(ua)) {
      const match = ua.match(/OS (\d+_\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `iPad (iPadOS ${version})`;
    }
    
    // Android
    if (/Android/.test(ua)) {
      const match = ua.match(/Android (\d+\.?\d*)/);
      const version = match ? match[1] : 'Unknown';
      return `Android Device (${version})`;
    }
    
    // Desktop - Mac
    if (/Mac/.test(ua)) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `Mac (macOS ${version})`;
    }
    
    // Desktop - Windows
    if (/Windows NT/.test(ua)) {
      const match = ua.match(/Windows NT (\d+\.\d+)/);
      const versionMap: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
      };
      const version = match ? (versionMap[match[1]] || match[1]) : 'Unknown';
      return `Windows PC (${version})`;
    }
    
    // Linux
    if (/Linux/.test(ua)) {
      return 'Linux PC';
    }
    
    return 'Unknown Device';
  }
}

// Convenience exports
export const getOrCreateDeviceId = () => DeviceIdManager.getOrCreateDeviceId();
export const getDeviceId = () => DeviceIdManager.getDeviceId();
export const getDeviceName = () => DeviceIdManager.getDeviceName();
export const clearDeviceId = () => DeviceIdManager.clearDeviceId();
export const hasDeviceId = () => DeviceIdManager.hasDeviceId();

