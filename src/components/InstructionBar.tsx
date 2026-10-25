import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  Sliders,
  ChevronDown,
  Layers,
  Sun,
  ShieldAlert,
  Tag,
  Maximize2,
  Box,
  Coffee,
  Moon,
  FlipVertical,
  Lightbulb,
  Shirt,
  Hand,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { PRESET_INSTRUCTIONS, PresetInstruction } from '../data/presetInstructions';

interface InstructionBarProps {
  instruction: string;
  onChangeInstruction: (val: string) => void;
  onSubmit: (customInstruction?: string) => void;
  isProcessing: boolean;
  onAnalyzeProduct: () => void;
  isAnalyzing: boolean;
  aspectRatio: string;
  onChangeAspectRatio: (ratio: string) => void;
  commercialOptimize: boolean;
  onToggleCommercialOptimize: (val: boolean) => void;
}

export const InstructionBar: React.FC<InstructionBarProps> = ({
  instruction,
  onChangeInstruction,
  onSubmit,
  isProcessing,
  onAnalyzeProduct,
  isAnalyzing,
  aspectRatio,
  onChangeAspectRatio,
  commercialOptimize,
  onToggleCommercialOptimize,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'background' | 'cleanup' | 'lighting' | 'staging'>('all');
  const [showPresets, setShowPresets] = useState<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [instruction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (instruction.trim() && !isProcessing) {
        onSubmit();
      }
    }
  };

  const filteredPresets = activeCategory === 'all'
    ? PRESET_INSTRUCTIONS
    : PRESET_INSTRUCTIONS.filter((p) => p.category === activeCategory);

  const getPresetIcon = (name: string) => {
    switch (name) {
      case 'Maximize2': return <Maximize2 className="w-3.5 h-3.5" />;
      case 'Layers': return <Layers className="w-3.5 h-3.5" />;
      case 'Box': return <Box className="w-3.5 h-3.5" />;
      case 'Coffee': return <Coffee className="w-3.5 h-3.5" />;
      case 'Moon': return <Moon className="w-3.5 h-3.5" />;
      case 'Sparkles': return <Sparkles className="w-3.5 h-3.5" />;
      case 'Sun': return <Sun className="w-3.5 h-3.5" />;
      case 'Tag': return <Tag className="w-3.5 h-3.5" />;
      case 'Wand2': return <Wand2 className="w-3.5 h-3.5" />;
      case 'ShieldAlert': return <ShieldAlert className="w-3.5 h-3.5" />;
      case 'FlipVertical': return <FlipVertical className="w-3.5 h-3.5" />;
      case 'Lightbulb': return <Lightbulb className="w-3.5 h-3.5" />;
      case 'Shirt': return <Shirt className="w-3.5 h-3.5" />;
      case 'Hand': return <Hand className="w-3.5 h-3.5" />;
      default: return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-lg space-y-3 z-20">
      {/* Category Filter Pills & Auto-Inspect Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1.5 hidden sm:inline">
            Presets:
          </span>
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('background')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'background'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
            }`}
          >
            Backgrounds
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('cleanup')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'cleanup'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            Retouch &amp; Clean
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('lighting')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'lighting'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            Lighting &amp; Shadows
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('staging')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'staging'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            Staging &amp; Mannequin
          </button>
        </div>

        {/* AI Inspector Button */}
        <button
          type="button"
          onClick={onAnalyzeProduct}
          disabled={isAnalyzing || isProcessing}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/10 to-indigo-500/10 dark:from-amber-500/20 dark:to-indigo-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
          title="Inspect product photo and suggest tailored cleanup instructions"
        >
          <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Inspecting photo...' : 'Analyze & Suggest Instructions'}</span>
        </button>
      </div>

      {/* Preset Chips Carousel */}
      {showPresets && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChangeInstruction(preset.instruction);
                textareaRef.current?.focus();
              }}
              className="flex-shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-all text-left"
              title={preset.description}
            >
              <span className="text-slate-400 dark:text-slate-500">{getPresetIcon(preset.iconName)}</span>
              <span className="font-medium whitespace-nowrap">{preset.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Instruction Input Container */}
      <div className="relative rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-900/60 bg-slate-50/50 dark:bg-slate-950/50 focus-within:border-indigo-600 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all p-2 sm:p-3">
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => onChangeInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type instructions to remove background, clean scratches, erase tags, or relight... (e.g. 'Remove background, place on pure Amazon white #FFFFFF with soft ground contact shadow, clean dust on surface')"
          rows={2}
          className="w-full bg-transparent resize-none border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base leading-relaxed pr-24"
        />

        {/* Action Bar Inside Input */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 mt-1">
          {/* Options: Aspect Ratio & E-commerce Enhance */}
          <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
            {/* Aspect Ratio Selector */}
            <div className="flex items-center space-x-1">
              <span className="hidden sm:inline">Ratio:</span>
              <select
                value={aspectRatio}
                onChange={(e) => onChangeAspectRatio(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer"
              >
                <option value="1:1">1:1 Square (Shopify/IG)</option>
                <option value="3:4">3:4 Portrait (Amazon)</option>
                <option value="4:3">4:3 Standard</option>
                <option value="16:9">16:9 Landscape Banner</option>
                <option value="9:16">9:16 Story/Mobile</option>
              </select>
            </div>

            {/* Commercial Sharpening Toggle */}
            <label className="hidden md:flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={commercialOptimize}
                onChange={(e) => onToggleCommercialOptimize(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>High Commercial Fidelity</span>
            </label>
          </div>

          {/* Submit Button & Shortcut Hint */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono">⌘+Enter</kbd>
            </span>
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={!instruction.trim() || isProcessing}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-95 disabled:pointer-events-none"
            >
              <Wand2 className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : 'Run Instruction'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
