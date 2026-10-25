import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Split,
  Columns,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sparkles,
  Palette,
  Check,
  Layers,
  FileImage,
} from 'lucide-react';
import { ViewMode, BackdropColor } from '../types';

interface ImageWorkspaceProps {
  originalImage: string | null;
  currentImage: string | null;
  isProcessing: boolean;
  processingStage?: string;
  onUploadImage: (file: File) => void;
  onOpenSamples: () => void;
  onChangeImage: () => void;
  lastInstruction?: string;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  originalImage,
  currentImage,
  isProcessing,
  processingStage = 'Generating studio cleanup...',
  onUploadImage,
  onOpenSamples,
  onChangeImage,
  lastInstruction,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [backdrop, setBackdrop] = useState<BackdropColor>('checker');
  const [customBackdropColor, setCustomBackdropColor] = useState<string>('#ffffff');
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle slider mouse / touch drag
  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 100);
    setSliderPos(percentage);
  }, []);

  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleMouseUp = () => setIsDraggingSlider(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingSlider) handleSliderMove(e.clientX);
    };
    const onMouseUpGlobal = () => setIsDraggingSlider(false);

    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingSlider && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => setIsDraggingSlider(false);

    if (isDraggingSlider) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUpGlobal);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUpGlobal);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDraggingSlider, handleSliderMove]);

  // Spacebar to hold-to-view-original
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingOriginal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Drag and drop image files
  const onDropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onUploadImage(file);
      }
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0]);
    }
  };

  // Get background style based on selector
  const getBackdropClassOrStyle = () => {
    if (backdrop === 'checker') {
      return { className: 'bg-checkerboard dark:bg-checkerboard-dark', style: {} };
    }
    if (backdrop === 'custom') {
      return { className: '', style: { backgroundColor: customBackdropColor } };
    }
    return { className: '', style: { backgroundColor: backdrop } };
  };

  const backdropConfig = getBackdropClassOrStyle();

  // Empty state: Upload or Choose Sample
  if (!originalImage) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDropHandler}
        className={`flex-1 flex flex-col items-center justify-center p-6 sm:p-12 transition-all ${
          isDragOver
            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-dashed border-indigo-500'
            : 'bg-slate-50/50 dark:bg-slate-950/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
        />

        <div className="max-w-xl w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 text-white">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Drop your product photo here
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Remove backgrounds, erase dust, clean glare, or stage on luxury podiums just by typing what you want.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Select Product Photo</span>
            </button>
            <button
              type="button"
              onClick={onOpenSamples}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Try With Sample Products</span>
            </button>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Pure White #FFFFFF</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Amazon &amp; Shopify ready</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Remove Clutter</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Erase tags, cords, dust</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Clean Glare</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Softbox studio lighting</span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Ghost Mannequin</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Hollow floating garment</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active workspace with image
  const displayImage = isHoldingOriginal ? originalImage : (currentImage || originalImage);
  const hasResult = Boolean(currentImage && currentImage !== originalImage);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-100 dark:bg-slate-950 select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
      />

      {/* Top Workspace Toolbar */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm px-4 flex items-center justify-between z-10">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {hasResult && (
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                title="Split Comparison Slider"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                title="Side by Side Comparison"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'side-by-side'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Side-by-Side</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('result-only')}
                title="Result only (Press spacebar to compare)"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'result-only'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Result</span>
              </button>
            </div>
          )}

          {/* Quick hold-to-compare button */}
          {hasResult && (
            <button
              type="button"
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
              title="Hold to see original photo (or hold Spacebar)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                isHoldingOriginal
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isHoldingOriginal ? 'Showing Original' : 'Hold to View Original'}</span>
            </button>
          )}
        </div>

        {/* Center / Right: Zoom & Backdrop Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Backdrop preview switcher for cutouts */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 px-1 hidden md:inline">Backdrop:</span>
            <button
              type="button"
              onClick={() => setBackdrop('checker')}
              title="Transparent Grid"
              className={`w-6 h-6 rounded flex items-center justify-center bg-checkerboard border ${
                backdrop === 'checker' ? 'ring-2 ring-indigo-500' : 'border-slate-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setBackdrop('#ffffff')}
              title="Pure Studio White (#FFFFFF)"
              className={`w-6 h-6 rounded flex items-center justify-center bg-white border ${
                backdrop === '#ffffff' ? 'ring-2 ring-indigo-500' : 'border-slate-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setBackdrop('#f4efea')}
              title="Warm Linen Studio"
              className={`w-6 h-6 rounded flex items-center justify-center bg-[#f4efea] border ${
                backdrop === '#f4efea' ? 'ring-2 ring-indigo-500' : 'border-slate-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setBackdrop('#0f172a')}
              title="Dark Cyber Slate"
              className={`w-6 h-6 rounded flex items-center justify-center bg-[#0f172a] border ${
                backdrop === '#0f172a' ? 'ring-2 ring-indigo-500' : 'border-slate-300'
              }`}
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
              title="Zoom Out"
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 px-1.5 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
              title="Zoom In"
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom to 100%"
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Change Photo Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Upload different photo"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className={`flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden ${backdropConfig.className}`}
        style={backdropConfig.style}
      >
        {/* VIEW MODE 1: Split Slider View */}
        {hasResult && viewMode === 'split' && (
          <div
            className="relative max-w-full max-h-[75vh] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 transition-transform"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* Background Layer: Cleaned Result */}
            <img
              src={currentImage!}
              alt="Cleaned product"
              className="w-full h-full object-contain pointer-events-none select-none"
            />

            {/* Foreground Layer (Clipped): Original photo */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={originalImage}
                alt="Original photo"
                className="absolute top-0 left-0 max-w-none h-full object-contain pointer-events-none select-none"
                style={{
                  width: containerRef.current ? `${containerRef.current.clientHeight}px` : '100%',
                }}
              />
            </div>

            {/* Draggable Divider Line & Handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize flex items-center justify-center group z-20"
              style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
            >
              <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl flex items-center justify-center border-2 border-indigo-600 group-hover:scale-110 transition-transform">
                <Split className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rotate-90" />
              </div>
            </div>

            {/* Badges */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none border border-white/20">
              Original
            </div>
            <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none border border-indigo-400/30 flex items-center gap-1 shadow-md">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Cleaned Studio
            </div>
          </div>
        )}

        {/* VIEW MODE 2: Side-by-Side Dual View */}
        {hasResult && viewMode === 'side-by-side' && (
          <div
            className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8 max-w-5xl w-full transition-transform"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* Original Card */}
            <div className="flex-1 max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-2 px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Before (Original)</span>
                <span className="text-[11px] text-slate-400">Raw photo</span>
              </div>
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Result Card */}
            <div className="flex-1 max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-xl border-2 border-indigo-500/50">
              <div className="flex items-center justify-between pb-2 px-1">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  After (AI Cleaned)
                </span>
                <span className="text-[11px] text-indigo-500 font-medium">Studio Grade</span>
              </div>
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <img src={currentImage!} alt="Cleaned" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 3: Result Only (or Default Single Image) */}
        {(!hasResult || viewMode === 'result-only') && (
          <div
            className="relative max-w-full max-h-[75vh] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 transition-transform"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={displayImage}
              alt="Product photo"
              className="w-full h-full object-contain pointer-events-none"
            />
            {hasResult && !isHoldingOriginal && (
              <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none border border-indigo-400/30 flex items-center gap-1 shadow-md">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Cleaned Result
              </div>
            )}
            {isHoldingOriginal && (
              <div className="absolute top-3 left-3 bg-amber-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none border border-amber-400/30">
                Viewing Original (Hold Spacebar)
              </div>
            )}
          </div>
        )}

        {/* Processing State Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 text-white animate-fadeIn">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-amber-400 flex items-center justify-center shadow-2xl shadow-indigo-500/50 animate-pulse">
                <Sparkles className="w-10 h-10 text-white animate-spin" />
              </div>
              <div className="absolute -inset-2 rounded-2xl border-2 border-indigo-400/40 animate-ping pointer-events-none" />
            </div>

            <div className="text-center max-w-md space-y-2">
              <h3 className="text-lg font-bold tracking-tight text-white flex items-center justify-center gap-2">
                <span>Refining Product Photo</span>
              </h3>
              <p className="text-sm text-indigo-200/80">
                {processingStage}
              </p>
              {lastInstruction && (
                <div className="mt-3 px-3.5 py-2 rounded-xl bg-white/10 text-xs text-indigo-100 border border-white/15 italic">
                  &ldquo;{lastInstruction}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
