import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  threshold?: number; // Distance in pixels to trigger refresh
  disabled?: boolean; // Disable when already refreshing
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
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const scrollElement = useRef<HTMLElement | null>(null);
  const isAtTop = useRef<boolean>(true);

  // Check if we're at the top of the scrollable container
  const checkScrollPosition = useCallback(() => {
    if (!scrollElement.current) {
      // Check window scroll if no specific element
      isAtTop.current = window.scrollY === 0;
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
    if (!enabled || disabled || state.isRefreshing) return;

    checkScrollPosition();
    
    // Only start if we're at the top
    if (!isAtTop.current) return;

    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
  }, [enabled, disabled, state.isRefreshing, checkScrollPosition]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || disabled || state.isRefreshing || touchStartY.current === null) return;

    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow pull down (positive deltaY) when at top
    if (deltaY > 0 && isAtTop.current) {
      // Prevent default scroll behavior
      e.preventDefault();

      // Calculate pull distance with resistance (ease out)
      const resistance = 0.5; // Makes it harder to pull further
      const pullDistance = Math.min(deltaY * resistance, threshold * 1.5);

      setState((prev: PullToRefreshState) => ({
        ...prev,
        isPulling: true,
        pullDistance,
      }));

      // Trigger haptic at threshold
      if (pullDistance >= threshold && !state.isPulling) {
        triggerHaptic();
      }
    } else if (deltaY < 0) {
      // User is scrolling up, reset
      touchStartY.current = null;
      setState({
        isPulling: false,
        pullDistance: 0,
        isRefreshing: false,
      });
    }
  }, [enabled, disabled, state.isRefreshing, state.isPulling, threshold, triggerHaptic, checkScrollPosition]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!enabled || disabled || touchStartY.current === null) {
      touchStartY.current = null;
      return;
    }

    const pullDistance = state.pullDistance;
    const shouldRefresh = pullDistance >= threshold;

    // Reset touch state
    touchStartY.current = null;
    touchStartTime.current = null;

    if (shouldRefresh && !state.isRefreshing) {
      // Trigger refresh
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
        // Reset after a short delay for smooth animation
        setTimeout(() => {
          setState({
            isPulling: false,
            pullDistance: 0,
            isRefreshing: false,
          });
        }, 300);
      }
    } else {
      // Reset without refresh
      setState({
        isPulling: false,
        pullDistance: 0,
        isRefreshing: false,
      });
    }
  }, [enabled, disabled, state.pullDistance, state.isRefreshing, threshold, onRefresh, triggerHaptic]);

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

    const scrollTarget = scrollElement.current || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false }); // Need preventDefault
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, checkScrollPosition]);

  // Calculate progress (0 to 1)
  const progress = Math.min(state.pullDistance / threshold, 1);

  return {
    isPulling: state.isPulling,
    pullDistance: state.pullDistance,
    isRefreshing: state.isRefreshing,
    progress,
    threshold,
  };
}

