import React from 'react';
import { History, Sparkles, ArrowRight, X, Clock, Layers } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistorySidebarProps {
  history: HistoryItem[];
  currentIndex: number;
  onSelectHistoryIndex: (index: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history,
  currentIndex,
  onSelectHistoryIndex,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Edit History &amp; Iterations
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* History Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.map((item, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={item.id}
              onClick={() => onSelectHistoryIndex(index)}
              className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/50 flex-shrink-0">
                <img src={item.imageUrl} alt={item.label} className="w-full h-full object-contain" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {index === 0 ? 'Original Photo' : `Step ${index}: ${item.label}`}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded-md">
                      Active
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {item.instruction}
                </p>

                <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
