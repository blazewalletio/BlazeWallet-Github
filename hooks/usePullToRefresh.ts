import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  threshold?: number; // Distance in pixels to trigger refresh
  disabled?: boolean; // Disable when already refreshing
  externalIsRefreshing?: boolean; // External refresh state (from Dashboard)
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Custom hook for pull-to-refresh functionality on mobile
 * Detects pull-down gesture and triggers refresh callback
 */
export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 80,
  disabled = false,
  externalIsRefreshing = false,
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  // Use external refresh state if provided, otherwise use internal
  const isRefreshing = externalIsRefreshing || state.isRefreshing;

  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const scrollElement = useRef<HTMLElement | null>(null);
  const isAtTop = useRef<boolean>(true);

  // Check if we're at the top of the scrollable container
  const checkScrollPosition = useCallback(() => {
    if (!scrollElement.current) {
      // Check multiple scroll sources for mobile compatibility
      const windowScroll = window.scrollY || window.pageYOffset || 0;
      const bodyScroll = document.body.scrollTop || 0;
      const documentScroll = document.documentElement.scrollTop || 0;
      isAtTop.current = windowScroll === 0 && bodyScroll === 0 && documentScroll === 0;
      return;
    }
    isAtTop.current = scrollElement.current.scrollTop === 0;
  }, []);

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || disabled || isRefreshing) {
      logger.log(`🚫 [PullToRefresh] Disabled - enabled: ${enabled}, disabled: ${disabled}, isRefreshing: ${isRefreshing}`);
      return;
    }

    checkScrollPosition();
    
    // Only start if we're at the top
    if (!isAtTop.current) {
      logger.log(`🚫 [PullToRefresh] Not at top - scrollY: ${window.scrollY}, body.scrollTop: ${document.body.scrollTop}`);
      return;
    }

    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    logger.log(`👆 [PullToRefresh] Touch start at Y: ${touch.clientY}`);
  }, [enabled, disabled, isRefreshing, checkScrollPosition]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || disabled || isRefreshing || touchStartY.current === null) return;

    // Re-check scroll position during move
    checkScrollPosition();
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow pull down (positive deltaY) when at top
    if (deltaY > 0 && isAtTop.current) {
      // Prevent default scroll behavior
      e.preventDefault();
      e.stopPropagation();

      // Calculate pull distance with resistance (ease out)
      const resistance = 0.5; // Makes it harder to pull further
      const pullDistance = Math.min(deltaY * resistance, threshold * 1.5);

      const wasPulling = state.isPulling;
      
      setState((prev: PullToRefreshState) => ({
        ...prev,
        isPulling: true,
        pullDistance,
      }));

      // Trigger haptic at threshold (only once)
      if (pullDistance >= threshold && !wasPulling) {
        triggerHaptic();
        logger.log(`🎯 [PullToRefresh] Threshold reached: ${pullDistance}px`);
      }
    } else if (deltaY < 0 || !isAtTop.current) {
      // User is scrolling up or not at top, reset
      touchStartY.current = null;
      setState({
        isPulling: false,
        pullDistance: 0,
        isRefreshing: false,
      });
    }
  }, [enabled, disabled, isRefreshing, state.isPulling, threshold, triggerHaptic, checkScrollPosition]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!enabled || disabled || touchStartY.current === null) {
      touchStartY.current = null;
      return;
    }

    const pullDistance = state.pullDistance;
    const shouldRefresh = pullDistance >= threshold;

    logger.log(`👋 [PullToRefresh] Touch end - distance: ${pullDistance}px, threshold: ${threshold}px, shouldRefresh: ${shouldRefresh}`);

    // Reset touch state
    touchStartY.current = null;
    touchStartTime.current = null;

    if (shouldRefresh && !isRefreshing) {
      // Trigger refresh
      logger.log('🔄 [PullToRefresh] Starting refresh...');
      setState((prev: PullToRefreshState) => ({
        ...prev,
        isRefreshing: true,
        isPulling: false,
      }));

      triggerHaptic();

      try {
        await onRefresh();
        logger.log('✅ [PullToRefresh] Refresh completed');
      } catch (error) {
        logger.error('❌ [PullToRefresh] Refresh failed:', error);
      } finally {
        // Reset after a short delay for smooth animation (only if not using external state)
        if (!externalIsRefreshing) {
          setTimeout(() => {
            setState({
              isPulling: false,
              pullDistance: 0,
              isRefreshing: false,
            });
          }, 300);
        } else {
          // If using external state, just reset pulling state
          setState({
            isPulling: false,
            pullDistance: 0,
            isRefreshing: false,
          });
        }
      }
    } else {
      // Reset without refresh
      logger.log(`🚫 [PullToRefresh] Not refreshing - distance too small or already refreshing`);
      setState({
        isPulling: false,
        pullDistance: 0,
        isRefreshing: false,
      });
    }
  }, [enabled, disabled, state.pullDistance, isRefreshing, threshold, onRefresh, triggerHaptic, externalIsRefreshing]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    // Find scrollable container (the main content area)
    const findScrollContainer = () => {
      // Try to find the main content div or the body
      const contentDiv = document.querySelector('.max-w-4xl.mx-auto');
      if (contentDiv) {
        scrollElement.current = contentDiv as HTMLElement;
      } else {
        // Fallback to window scroll (body)
        scrollElement.current = null;
      }
    };

    findScrollContainer();
    
    // Re-check container on resize (for dynamic content)
    const handleResize = () => {
      findScrollContainer();
      checkScrollPosition();
    };
    
    window.addEventListener('resize', handleResize);

    // Add scroll listener to track position
    const handleScroll = () => {
      checkScrollPosition();
    };

    // Add scroll listeners to multiple targets for mobile compatibility
    const scrollTargets = [
      scrollElement.current,
      window,
      document.body,
      document.documentElement,
    ].filter(Boolean) as (HTMLElement | Window)[];

    scrollTargets.forEach(target => {
      target.addEventListener('scroll', handleScroll, { passive: true });
    });

    // Use document instead of window for better mobile compatibility
    // Capture phase ensures we catch events before they bubble
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true }); // Need preventDefault
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    
    logger.log('✅ [PullToRefresh] Event listeners attached', { enabled });

    return () => {
      scrollTargets.forEach(target => {
        target.removeEventListener('scroll', handleScroll);
      });
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, checkScrollPosition]);

  // Calculate progress (0 to 1)
  const progress = Math.min(state.pullDistance / threshold, 1);

  return {
    isPulling: state.isPulling,
    pullDistance: state.pullDistance,
    isRefreshing: isRefreshing,
    progress,
    threshold,
  };
}

