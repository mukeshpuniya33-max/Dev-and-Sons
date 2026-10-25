import React from 'react';
import { Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenDownloadModal?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenDownloadModal }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // If already installed in standalone mode
  if (isInstalled) {
    return (
      <button
        type="button"
        onClick={onOpenDownloadModal}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-colors"
        title="App Installed & Running in Standalone Mode"
      >
        <Check className="w-3.5 h-3.5 text-emerald-600" />
        <span className="hidden sm:inline">Installed App</span>
      </button>
    );
  }

  // If browser has the native beforeinstallprompt ready
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          const success = await install();
          if (!success && onOpenDownloadModal) {
            onOpenDownloadModal();
          }
        }}
        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 animate-pulse cursor-pointer"
        title="Install directly to your Mobile Phone or Desktop Laptop"
      >
        <Smartphone className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  }

  // Fallback button when prompt is not yet ready or in iframe
  return (
    <button
      type="button"
      onClick={onOpenDownloadModal}
      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
      title="Install directly to your Mobile Phone or Desktop Laptop"
    >
      <Smartphone className="w-4 h-4" />
      <span>Install App</span>
    </button>
  );
};
