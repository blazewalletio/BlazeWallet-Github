import { useState, useEffect } from 'react';

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

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setState(prev => ({ ...prev, isInstalled: true }));
      return;
    }

    // Check localStorage for user preferences
    const dismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';
    const visitCount = parseInt(localStorage.getItem('pwa-prompt-visit-count') || '0');
    const lastShown = localStorage.getItem('pwa-prompt-last-shown');

    // Increment visit count
    localStorage.setItem('pwa-prompt-visit-count', (visitCount + 1).toString());

    // Don't show if permanently dismissed
    if (dismissed) {
      return;
    }

    // Show after 3 visits if "Later" was clicked
    const shouldShowBasedOnVisits = visitCount >= 2; // 0, 1, 2 = show on 3rd visit

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      
      setState(prev => ({
        ...prev,
        canInstall: true,
        promptEvent,
      }));

      // Show prompt after 3 seconds if conditions are met
      if (shouldShowBasedOnVisits || visitCount === 0) {
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
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

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
    // Reset visit count, will show again after 3 visits
    localStorage.setItem('pwa-prompt-visit-count', '0');
    localStorage.setItem('pwa-prompt-last-shown', Date.now().toString());
    setState(prev => ({ ...prev, showPrompt: false }));
  };

  const dismissPermanently = () => {
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

