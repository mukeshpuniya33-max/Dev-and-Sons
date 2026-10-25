import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  FileCode,
  Package,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getLiveAppUrl } from '../utils/appUrl';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadOfflineApp: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  onDownloadOfflineApp,
}) => {
  const { isInstallable, isIframe, install, openStandalone } = usePWAInstall();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'instant' | 'offline' | 'apk'>('instant');

  // Real verified permanent standalone app URL
  const appUrl = useMemo(() => getLiveAppUrl(), []);

  useEffect(() => {
    if (!isOpen || !appUrl) return;

    // Generate crisp QR code for real app URL
    QRCode.toDataURL(
      appUrl,
      {
        width: 340,
        margin: 2,
        color: {
          dark: '#0f172a',
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

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = appUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    'Staff Attendance & Payroll App (Direct Mobile Install Link): ' + appUrl
  )}`;

  const pwabuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(appUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/15 via-orange-500/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Install App on Device
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                  Android &bull; PC &bull; iOS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Install directly on your phone or laptop with no Google AI Studio frame
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={() => setActiveTab('instant')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'instant'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>1. Direct Device Install</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offline')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'offline'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>2. Offline App File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'apk'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>3. Signed Android APK</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: Direct Install */}
          {activeTab === 'instant' && (
            <div className="space-y-4">
              {/* Immediate Direct Action */}
              {isInstallable ? (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await install();
                    if (res) {
                      onClose();
                    }
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse cursor-pointer"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>📲 Click to Install Directly on this Device Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openStandalone()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 text-center cursor-pointer"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>📲 Open Full App to Install on Device (No AI Studio)</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </button>
              )}

              {/* Working QR Code Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 flex-shrink-0">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Scan to open on Android Phone"
                      className="w-32 h-32 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 text-xs">
                      Loading QR...
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-xs flex-1">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Direct App Link (No AI Studio Frame)
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    Share or open this link directly. It opens full screen with no Google AI Studio bar:
                  </p>
                  <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                    <input
                      type="text"
                      readOnly
                      value={appUrl}
                      className="flex-1 bg-transparent border-none text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none px-2 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send Link to Mobile via WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2: Install as Home Screen App */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    How to Add Icon to Phone Home Screen
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                    Instant App
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  When you open the direct link in Google Chrome, Samsung Internet, or Safari on your phone:
                </p>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <li>
                    A banner saying <strong>&ldquo;Install App&rdquo;</strong> will automatically appear, or tap browser menu (⋮) at top right.
                  </li>
                  <li>
                    Tap <strong>&ldquo;Install app&rdquo;</strong> (or <strong>&ldquo;Add to Home screen&rdquo;</strong>).
                  </li>
                  <li>
                    Tap <strong>Install</strong>. Android immediately creates an app icon on your home screen and in your apps list!
                  </li>
                  <li>
                    <strong>Result:</strong> Tapping the app icon launches the full Staff Attendance application with no browser bars and full offline capability!
                  </li>
                </ol>
              </div>

              {/* Direct Open Button */}
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => openStandalone()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 text-center transition-all cursor-pointer"
                >
                  <span>Open Full Clean App in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Standalone Offline File */}
          {activeTab === 'offline' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-900 dark:text-indigo-200 text-sm flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-indigo-600" />
                    Standalone Offline App File
                  </span>
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                    Runs 100% Offline
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Download this single self-contained application file. You can open it on your phone or laptop anytime, even without an internet connection:
                </p>
                <button
                  type="button"
                  onClick={onDownloadOfflineApp}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Staff-Attendance-App.html</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">How to run on Phone:</span>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Tap the download button above to save the file.</li>
                  <li>On your phone, open your <strong>Files</strong> or <strong>Downloads</strong> app and tap the file.</li>
                  <li>It opens immediately in your mobile browser with full staff attendance and salary calculation!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: Signed APK Package via PWABuilder */}
          {activeTab === 'apk' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex gap-2 text-amber-900 dark:text-amber-200 text-[11px]">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Official Signed Android APK:</strong> Generates a signed Android package (.apk) file ready to be installed directly on any Android smartphone or tablet.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                  Generate Signed Android APK Package
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  PWABuilder converts this web application into an official signed Android APK file ready to distribute to your staff and supervisors:
                </p>
                <a
                  href={pwabuilderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all text-center"
                >
                  <Package className="w-4 h-4" />
                  <span>Build Signed APK on PWABuilder</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                  Target URL: {appUrl}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Works on Android &bull; Furnace A &bull; Furnace B &bull; CCM
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
