import { useState, useEffect } from 'react';
import { useWalletStore } from '@/lib/wallet-store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  showPrompt: boolean;
  promptEvent: BeforeInstallPromptEvent | null;
}

export function usePWAInstall() {
  const [state, setState] = useState<PWAInstallState>({
    canInstall: false,
    isInstalled: false,
    showPrompt: false,
    promptEvent: null,
  });

  const { isLocked, address } = useWalletStore();

  useEffect(() => {
    // Only show if wallet is unlocked (user is logged in)
    // Wallet is unlocked when: isLocked = false AND address exists
    if (isLocked || !address) {
      return;
    }

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setState(prev => ({ ...prev, isInstalled: true }));
      return;
    }

    // Check localStorage for user preferences
    const dismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';
    const installed = localStorage.getItem('pwa-installed') === 'true';

    // Don't show if permanently dismissed or already installed
    if (dismissed || installed) {
      return;
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      
      setState(prev => ({
        ...prev,
        canInstall: true,
        promptEvent,
      }));

      // Show prompt after 3 seconds (user is logged in, let them see dashboard first)
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          showPrompt: true,
        }));

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            showPrompt: false,
          }));
        }, 8000);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isLocked, address]); // Re-run when wallet unlocks

  const install = async () => {
    if (!state.promptEvent) return;

    try {
      await state.promptEvent.prompt();
      const { outcome } = await state.promptEvent.userChoice;

      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
        setState(prev => ({
          ...prev,
          showPrompt: false,
          isInstalled: true,
        }));
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const dismissLater = () => {
    // Just hide for this session, will show again on next login
    setState(prev => ({ ...prev, showPrompt: false }));
  };

  const dismissPermanently = () => {
    // Permanently dismiss - never show again
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    setState(prev => ({ ...prev, showPrompt: false }));
  };

  return {
    ...state,
    install,
    dismissLater,
    dismissPermanently,
  };
}

