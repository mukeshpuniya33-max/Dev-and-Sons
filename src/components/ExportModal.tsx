import React, { useState } from 'react';
import { Download, Copy, Check, X, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  productTitle?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  productTitle = 'product-studio-photo',
}) => {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [fillBg, setFillBg] = useState<'transparent' | 'white' | 'black' | 'custom'>('white');
  const [customColor, setCustomColor] = useState<string>('#ffffff');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen || !imageUrl) return null;

  // Process image with background fill if requested onto a canvas, then export
  const generateExportBlob = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1024;
        canvas.height = img.naturalHeight || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Fill background if not transparent or if exporting to jpeg
        if (fillBg === 'white' || (format === 'jpeg' && fillBg === 'transparent')) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (fillBg === 'black') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (fillBg === 'custom') {
          ctx.fillStyle = customColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Export blob creation failed'));
          },
          mime,
          format === 'jpeg' ? 0.95 : undefined
        );
      };
      img.onerror = (e) => reject(e);
      img.src = imageUrl;
    });
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const blob = await generateExportBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedName = productTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `${sanitizedName}-cleaned.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error('Download error:', err);
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1024;
        canvas.height = img.naturalHeight || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (fillBg === 'white') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }
        }, 'image/png');
      };
      img.src = imageUrl;
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export Studio Photo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ready for Amazon, Shopify, marketing banners, and catalogs
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Preview Thumbnail */}
          <div className="aspect-video w-full rounded-2xl bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-checkerboard dark:bg-checkerboard-dark">
            <img src={imageUrl} alt="Export preview" className="h-full object-contain" />
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              File Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                  format === 'png'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>PNG</span>
                <span className="text-[10px] text-slate-400 font-normal">Alpha / Transparent</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('jpeg')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                  format === 'jpeg'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>JPEG</span>
                <span className="text-[10px] text-slate-400 font-normal">Amazon Standard</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('webp')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                  format === 'webp'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>WebP</span>
                <span className="text-[10px] text-slate-400 font-normal">Next-Gen Web</span>
              </button>
            </div>
          </div>

          {/* Background Fill */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Background Fill on Export
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFillBg('white')}
                className={`py-2 px-2.5 rounded-xl border font-medium transition-all ${
                  fillBg === 'white'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Amazon White (#FFF)
              </button>
              <button
                type="button"
                onClick={() => setFillBg('transparent')}
                className={`py-2 px-2.5 rounded-xl border font-medium transition-all ${
                  fillBg === 'transparent'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Transparent
              </button>
              <button
                type="button"
                onClick={() => setFillBg('custom')}
                className={`py-2 px-2.5 rounded-xl border font-medium transition-all flex items-center justify-center gap-1.5 ${
                  fillBg === 'custom'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>Custom</span>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setFillBg('custom');
                  }}
                  className="w-4 h-4 rounded cursor-pointer border-none bg-transparent"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Download Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
