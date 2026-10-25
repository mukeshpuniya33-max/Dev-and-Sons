import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Globe,
  QrCode,
  Sparkles,
  Send,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getLiveAppUrl } from '../utils/appUrl';

interface ShareAppUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export const ShareAppUrlModal: React.FC<ShareAppUrlModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Permanent live accessible app URL
  const appUrl = React.useMemo(() => getLiveAppUrl(), []);

  useEffect(() => {
    if (!isOpen || !appUrl) return;

    // Generate crisp QR code locally
    QRCode.toDataURL(
      appUrl,
      {
        width: 320,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrCodeDataUrl(url);
        }
      }
    );
  }, [isOpen, appUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = appUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `📲 *Staff Attendance & Payroll App*\n\nOpen this link on your Mobile or Laptop to immediately access and install the app:\n👉 ${appUrl}\n\n✅ 100% Free & Standalone: Tap menu (⋮) > 'Install app' (or 'Add to Home screen') to add it to your device!`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Staff Attendance & Payroll App',
          text: 'Open this link on your phone or PC to install and use the app:',
          url: appUrl,
        });
      } catch {
        // Ignored if cancelled
      }
    } else {
      handleCopyUrl();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Share Live App Link
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open on mobile phone, tablet, laptop, or share with supervisors
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* App URL Bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Direct Web App Link</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Live &amp; Verified
              </span>
            </label>
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 px-2 flex-1 outline-none truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Share via WhatsApp</span>
            </button>

            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share App Link...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyUrl}
                className="py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Copy className="w-4 h-4 text-indigo-500" />
                <span>{copied ? 'Link Copied!' : 'Copy to Clipboard'}</span>
              </button>
            )}
          </div>

          {/* QR Code Section for Instant Phone Scan */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-slate-50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Scan QR Code on Mobile Phone
              </span>
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {showQr ? 'Hide QR' : 'Show QR'}
              </button>
            </div>

            {showQr && (
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200/80 inline-block">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="App QR Code"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-xs">
                    Generating QR...
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
              Point your phone camera at this QR code to immediately open the app on your mobile device.
            </p>
          </div>

          {/* Multi-Device Real-Time Sync Instructions */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Multi-Device Access &amp; Cloud Storage
            </div>
            <ul className="text-slate-600 dark:text-slate-300 space-y-1 text-[11px]">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">&bull;</span>
                <span>
                  Log in with <strong>{userEmail || 'your email'}</strong> on any phone, laptop, or tablet.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">&bull;</span>
                <span>
                  All attendance, overtime, staff details, and salary payouts stay synchronized and safely backed up.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
