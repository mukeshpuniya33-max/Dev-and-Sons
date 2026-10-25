import { useEffect, useState } from 'react';
import { getLiveAppUrl } from '../utils/appUrl';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global variable to capture prompt event if it fires before React mount
let globalInstallPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? (window as any).__pwaInstallPrompt || null : null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalInstallPrompt = e as BeforeInstallPromptEvent;
    (window as any).__pwaInstallPrompt = e;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalInstallPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  useEffect(() => {
    // Detect standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect if embedded in iframe (e.g., Google AI Studio preview sandbox)
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // If global prompt already captured
    if (globalInstallPrompt) {
      setDeferredPrompt(globalInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalInstallPrompt = promptEvent;
      (window as any).__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      globalInstallPrompt = null;
      (window as any).__pwaInstallPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptToUse = deferredPrompt || globalInstallPrompt || (window as any).__pwaInstallPrompt;
    if (!promptToUse) return false;
    try {
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        globalInstallPrompt = null;
        (window as any).__pwaInstallPrompt = null;
        return true;
      }
    } catch (e) {
      console.warn('Install prompt error:', e);
    }
    return false;
  };

  const openStandalone = () => {
    const url = getLiveAppUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return {
    isInstallable: !!deferredPrompt || !!globalInstallPrompt,
    isInstalled,
    isIOS,
    isIframe,
    install,
    openStandalone,
  };
}
