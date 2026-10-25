import React, { useState } from 'react';
import {
  X,
  Download,
  Smartphone,
  Laptop,
  Apple,
  Check,
  Flame,
  FileJson,
  FileSpreadsheet,
  Share2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onExportPDF: () => void;
  onExportColorfulTable?: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({
  isOpen,
  onClose,
  onExportCSV,
  onExportJSON,
  onExportPDF,
  onExportColorfulTable,
}) => {

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop' | 'backup'>('mobile');
  const [installTriggered, setInstallTriggered] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstallTriggered(true);
    const success = await install();
    if (success) {
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Download &amp; Install App
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Install as a standalone app on your Mobile Phone or Computer
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

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'mobile'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile (Android / iPhone)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'desktop'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Desktop (PC / Laptop)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'backup'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Data Export / Backup</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1-Click Install Banner if available */}
          {isInstallable ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/10 border-2 border-orange-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-xs font-extrabold text-orange-800 dark:text-orange-300 flex items-center justify-center sm:justify-start gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Instant 1-Click Installation Ready
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Click below to install directly to your device home screen or desktop.
                </p>
              </div>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install App Now</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center justify-center sm:justify-start gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Standalone App (No Google AI Studio)
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Launch full screen outside Google AI Studio to trigger direct device installation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.open(window.location.origin, '_blank');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Clean App</span>
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>App is already running in standalone installed mode!</span>
            </div>
          )}

          {/* TAB 1: Mobile Guide */}
          {activeTab === 'mobile' && (
            <div className="space-y-4 text-xs">
              {/* Android Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    🤖
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Android Installation (Chrome, Samsung Internet, Edge)
                  </h4>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    Tap the <strong>three dots menu (⋮)</strong> at the top right of your browser.
                  </li>
                  <li>
                    Select <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                  </li>
                  <li>
                    Confirm <strong>Install</strong>. The Staff Attendance app icon will appear on your home screen and app drawer just like a native APK app!
                  </li>
                </ol>
              </div>

              {/* iOS Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Apple className="w-4 h-4 text-slate-800 dark:text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    iPhone &amp; iPad Installation (Safari)
                  </h4>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    Open this page in <strong>Safari</strong> on your iPhone or iPad.
                  </li>
                  <li>
                    Tap the <strong>Share button</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5" /> square with arrow pointing up) at the bottom bar.
                  </li>
                  <li>
                    Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> in the top right corner. The app will launch in full-screen standalone mode without any browser URL bars!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: Desktop Guide */}
          {activeTab === 'desktop' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Laptop className="w-5 h-5 text-indigo-500" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Windows &amp; Mac Desktop Installation (Chrome / Edge)
                  </h4>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    Look at the right side of the browser URL / address bar at the top of your screen.
                  </li>
                  <li>
                    Click the <strong>Install icon (computer with down arrow)</strong>.
                  </li>
                  <li>
                    Or click the <strong>three dots (⋮)</strong> menu &gt; <strong>Save and share</strong> &gt; <strong>Install Staff Attendance</strong>.
                  </li>
                  <li>
                    The app opens in its own clean desktop window with a desktop shortcut and taskbar pinning!
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-slate-700 dark:text-slate-300">
                <strong>Offline Ready:</strong> Once installed, you can launch the app anytime even if your factory or plant network has no internet connectivity.
              </div>
            </div>
          )}

          {/* TAB 3: Backup & Exports */}
          {activeTab === 'backup' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                You can also download and backup your attendance and salary records locally to your computer or phone:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export CSV for Excel */}
                <button
                  type="button"
                  onClick={onExportCSV}
                  className="p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 transition-all text-left flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <span>Excel Attendance Register (.csv)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Export full monthly table with Dates 1-31, working days, OT hours, and payout salary.
                    </p>
                  </div>
                  <span className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Sheet</span>
                  </span>
                </button>

                {/* Export JSON Backup */}
                <button
                  type="button"
                  onClick={onExportJSON}
                  className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 transition-all text-left flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-300 font-bold">
                      <FileJson className="w-5 h-5 text-indigo-600" />
                      <span>Full App Backup (.json)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Backup all staff profiles, plant units, and attendance history in a portable format.
                    </p>
                  </div>
                  <span className="mt-3 text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Backup File</span>
                  </span>
                </button>

                {/* Export PDF Report */}
                <button
                  type="button"
                  onClick={onExportPDF}
                  className="p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 transition-all text-left flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-bold">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <span>Monthly Report (.pdf)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Export a print-ready monthly attendance and payout summary report.
                    </p>
                  </div>
                  <span className="mt-3 text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Report</span>
                  </span>
                </button>

                {/* Export Full Colorful Table (PDF & Image) */}
                {onExportColorfulTable && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExportColorfulTable();
                    }}
                    className="p-4 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-900/40 hover:border-emerald-500 transition-all text-left flex flex-col justify-between shadow-xs col-span-1 sm:col-span-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 font-extrabold">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        <span>🎨 Full Colorful Attendance Table (PDF • Image • HTML)</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300">
                        Export complete colorful grid with exact green, amber, blue badges for days 1 to 31, worker details, and wage totals.
                      </p>
                    </div>
                    <span className="mt-3 text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <Download className="w-4 h-4" />
                      <span>Download Colorful Sheet</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            PWA Standalone &bull; Offline Storage &bull; Secure Local Data
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
