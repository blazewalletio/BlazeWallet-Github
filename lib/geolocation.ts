// Geolocation Service
// Detects user's country for onramp provider selection

import { logger } from './logger';

export class GeolocationService {
  /**
   * Detect user's country using multiple methods
   * Priority:
   * 1. User's saved preference (localStorage)
   * 2. Cloudflare header (cf-ipcountry) - server-side only
   * 3. Let Onramper auto-detect via IP (no country parameter)
   */
  static async detectCountry(req?: { headers?: { get: (name: string) => string | null } }): Promise<string | null> {
    try {
      // Priority 1: User's saved preference (client-side)
      if (typeof window !== 'undefined') {
        const savedCountry = localStorage.getItem('user_country');
        if (savedCountry) {
          logger.log('✅ Using saved country preference:', savedCountry);
          return savedCountry;
        }
      }

      // Priority 2: Cloudflare header (server-side, most reliable)
      if (req?.headers) {
        const cfCountry = req.headers.get('cf-ipcountry');
        if (cfCountry) {
          logger.log('✅ Using Cloudflare detected country:', cfCountry);
          return cfCountry;
        }
      }

      // Priority 3: Let Onramper auto-detect via IP
      // Return null to let Onramper handle it
      logger.log('ℹ️ No country detected, letting Onramper auto-detect via IP');
      return null;
    } catch (error: any) {
      logger.error('❌ Error detecting country:', error);
      return null; // Fallback: let Onramper auto-detect
    }
  }

  /**
   * Store user's country preference
   */
  static saveCountryPreference(country: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_country', country);
      logger.log('✅ Saved country preference:', country);
    }
  }

  /**
   * Get saved country preference
   */
  static getSavedCountryPreference(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_country');
    }
    return null;
  }
}

