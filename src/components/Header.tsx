import React from 'react';
import {
  Sparkles,
  RotateCcw,
  RotateCw,
  Download,
  Image as ImageIcon,
  HelpCircle,
  Wand2,
} from 'lucide-react';

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSamples: () => void;
  onOpenExport: () => void;
  hasResult: boolean;
  isProcessing: boolean;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSamples,
  onOpenExport,
  hasResult,
  isProcessing,
  onOpenGuide,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              PureStudio
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                AI Photo Clean
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Remove backgrounds &amp; retouch product photos by typing instructions
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Try Samples */}
        <button
          type="button"
          onClick={onOpenSamples}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          title="Try with high-res sample product photos"
        >
          <ImageIcon className="w-4 h-4 text-indigo-500" />
          <span>Samples</span>
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isProcessing}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 disabled:opacity-35 disabled:hover:bg-transparent transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || isProcessing}
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 disabled:opacity-35 disabled:hover:bg-transparent transition-all"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Tips / Guide */}
        <button
          type="button"
          onClick={onOpenGuide}
          title="Prompting Guide & Tips"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-flex"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export / Download */}
        <button
          type="button"
          onClick={onOpenExport}
          disabled={!hasResult || isProcessing}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-sm transition-all shadow-indigo-600/20 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export Studio Image</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  );
};
