import React, { useState } from 'react';
import { Search, Mic, MicOff, X, Settings2, Sparkles } from 'lucide-react';
import { useVoiceSearch } from '../hooks/useVoiceSearch';

interface VoiceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md';
}

export const VoiceSearchInput: React.FC<VoiceSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search worker or role...',
  className = '',
  inputClassName = '',
  size = 'md',
}) => {
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const { isListening, isSupported, isMicEnabled, statusMessage, setMicEnabled, toggleListening } =
    useVoiceSearch((transcript) => {
      onChange(transcript);
    });

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Search Icon */}
      <Search
        className={`text-slate-400 absolute left-3 pointer-events-none ${
          size === 'sm' ? 'w-3.5 h-3.5 top-2' : 'w-4 h-4 top-2.5'
        }`}
      />

      {/* Text Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isListening ? '🎙️ Listening... Speak worker name' : placeholder}
        className={`w-full pl-9 pr-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
          isListening ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20' : ''
        } ${size === 'sm' ? 'py-1.5' : 'py-2'} ${inputClassName}`}
      />

      {/* Right Controls: Clear + Microphone + Customize Toggle */}
      <div className="absolute right-2 flex items-center space-x-1">
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Customizable Microphone Button */}
        {isMicEnabled && isSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isListening
                ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-600/30 ring-2 ring-red-400'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
            }`}
            title={isListening ? 'Click to stop listening' : 'Click microphone & speak worker name to search'}
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Customization Toggle Gear */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ${
            !isMicEnabled ? 'text-amber-500 dark:text-amber-400' : ''
          }`}
          title="Customize Voice Search Mic Button (Enable / Disable)"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      </div>

      {/* Listening Status Badge */}
      {statusMessage && (
        <div className="absolute -bottom-6 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-bold shadow-md border border-indigo-500/30">
          <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Microphone Customization Settings Popover */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-1.5 z-40 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl w-60 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
            <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 text-indigo-500" />
              Voice Search Mic
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Enable or disable the voice microphone button on search boxes across the app.
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Microphone Button:
            </span>
            <button
              type="button"
              onClick={() => setMicEnabled(!isMicEnabled)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isMicEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isMicEnabled ? 'YES (Enabled)' : 'NO (Hidden)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
