'use client';

import { useEffect } from 'react';

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
        console.log('✅ CSRF token initialized');
      })
      .catch(err => {
        console.error('❌ Failed to initialize CSRF token:', err);
      });
  }, []);
  
  return null;
}

