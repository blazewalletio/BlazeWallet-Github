'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * CSRF Token Initializer
 * Fetches and initializes CSRF token on app load
 */
export default function CSRFTokenInitializer() {
  useEffect(() => {
    // Fetch CSRF token on app load
    fetch('/api/csrf-token')
      .then(res => res.json())
      .then(data => {
        logger.log('✅ CSRF token initialized');
      })
      .catch(err => {
        logger.error('❌ Failed to initialize CSRF token:', err);
      });
  }, []);
  
  return null;
}

