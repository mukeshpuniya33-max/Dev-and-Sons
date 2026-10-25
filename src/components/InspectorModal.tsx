import React from 'react';
import { Sparkles, X, AlertCircle, CheckCircle2, ArrowRight, Wand2 } from 'lucide-react';
import { ProductAnalysis } from '../types';

interface InspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ProductAnalysis | null;
  onSelectSuggestion: (instruction: string, runImmediately?: boolean) => void;
  isLoading: boolean;
}

export const InspectorModal: React.FC<InspectorModalProps> = ({
  isOpen,
  onClose,
  analysis,
  onSelectSuggestion,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                AI Product Photo Inspector
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated detection of background flaws and targeted cleanup instructions
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center animate-spin">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Inspecting Product Geometry &amp; Lighting...
                </p>
                <p className="text-xs text-slate-500">
                  Identifying surface reflections, dust particles, and background clutter
                </p>
              </div>
            </div>
          )}

          {!isLoading && analysis && (
            <>
              {/* Product Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {analysis.productType}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {analysis.productName}
                    </h4>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    {analysis.backgroundStatus}
                  </span>
                </div>

                {/* Detected Flaws */}
                {analysis.detectedFlaws && analysis.detectedFlaws.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Detected Issues to Clean Up:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.detectedFlaws.map((flaw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span>{flaw}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Tailored Instructions for This Photo</span>
                  <span className="text-xs font-normal text-slate-500">
                    Click to apply or run
                  </span>
                </h4>

                <div className="space-y-2.5">
                  {analysis.suggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/50">
                          {sug.category}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {sug.title}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        &ldquo;{sug.instruction}&rdquo;
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Expected: {sug.expectedOutcome}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSuggestion(sug.instruction, false);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          >
                            Fill Prompt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSuggestion(sug.instruction, true);
                              onClose();
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>Run Now</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
