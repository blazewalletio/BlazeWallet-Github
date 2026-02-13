'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function ServiceWorkerBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((error) => {
        logger.warn('[PWA] Service worker registration failed:', error);
      });
  }, []);

  return null;
}


