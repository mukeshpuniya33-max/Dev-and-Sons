import React from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface VoiceMicButtonProps {
  fieldName: string;
  isActive: boolean;
  onToggle: () => void;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  fieldName,
  isActive,
  onToggle,
  title = 'Tap microphone to speak into this field',
  size = 'sm',
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`relative inline-flex items-center justify-center rounded-lg transition-all cursor-pointer ${
        isActive
          ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/40 ring-2 ring-red-400 scale-105'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
      } ${size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'} ${className}`}
      title={isActive ? `Listening for ${fieldName}... Tap to finish` : title}
    >
      <Mic className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {isActive && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
    </button>
  );
};
