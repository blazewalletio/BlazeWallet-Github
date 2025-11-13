import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Block body scroll when a modal/overlay is open
 * @param isOpen - Whether the modal/overlay is currently open
 */
export function useBlockBodyScroll(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      // Save current overflow value
      const originalOverflow = document.body.style.overflow;
      
      // Block scroll
      document.body.style.overflow = 'hidden';
      
      // Cleanup: restore original overflow
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [isOpen]);
}

