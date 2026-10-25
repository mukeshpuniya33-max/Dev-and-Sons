import React from 'react';
import { HelpCircle, X, CheckCircle, Sparkles, Copy, Check } from 'lucide-react';

interface PromptingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
}

export const PromptingGuideModal: React.FC<PromptingGuideModalProps> = ({
  isOpen,
  onClose,
  onUsePrompt,
}) => {
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const examples = [
    {
      title: 'Amazon & Shopify Pure White',
      category: 'Catalog Standard',
      prompt: 'Remove background completely. Isolate product on pure seamless studio white (#FFFFFF) with a soft natural ground contact shadow.',
      tip: 'Meets strict marketplace guidelines without making the product look cut-out or floating in a vacuum.',
    },
    {
      title: 'Jewelry & Watch Glare Cleanup',
      category: 'Reflection Retouch',
      prompt: 'Clean all dust specks and scratches on the metallic bezel and crystal glass. Remove harsh flash glare and replace with even studio softbox highlights.',
      tip: 'Preserves engraving, logo, and dial numbers while removing distracting mirror reflections.',
    },
    {
      title: 'Ghost Mannequin Garment Effect',
      category: 'Fashion & Apparel',
      prompt: 'Remove mannequin neck and plastic hanger. Reconstruct hollow inner lining of collar and create 3D floating garment effect on white.',
      tip: 'Standard e-commerce format for shirts, jackets, dresses, and sportswear.',
    },
    {
      title: 'Travertine Stone Pedestal Staging',
      category: 'Luxury Lifestyle',
      prompt: 'Place product on a minimalist warm beige travertine stone podium with gentle morning sunlight, soft organic shadows, and subtle bokeh.',
      tip: 'Ideal for social media ads, serum bottles, perfumes, and cosmetics branding.',
    },
    {
      title: 'Wrinkle Smoothing & Tag Removal',
      category: 'Surface Retouch',
      prompt: 'Remove barcode sticker and hanging tags. Smooth out wrinkles and fabric creasing while preserving the authentic weave texture.',
      tip: 'Saves hours of physical steaming and manual Photoshop stamp cloning.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                How to Write Studio Instructions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Natural language prompting formula for commercial product photography
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Formula Card */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/60 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              The 3-Part Studio Prompt Formula
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <strong>[Action on Background]</strong> (e.g., &ldquo;Remove background, isolate on pure white&rdquo;) +
              <strong> [Retouch Specifics]</strong> (e.g., &ldquo;Clean dust and remove sticker&rdquo;) +
              <strong> [Lighting/Shadow Anchor]</strong> (e.g., &ldquo;Add soft diffused ground contact shadow&rdquo;).
            </p>
          </div>

          {/* Example Prompts */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Ready-to-Use Studio Examples
            </h4>
            <div className="space-y-3">
              {examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-indigo-300 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {ex.title}
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      {ex.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    &ldquo;{ex.prompt}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 italic">
                      {ex.tip}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onUsePrompt(ex.prompt);
                        setCopiedIdx(idx);
                        setTimeout(() => setCopiedIdx(null), 2000);
                        onClose();
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition-colors"
                    >
                      {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Sparkles className="w-3 h-3" />}
                      <span>Use Prompt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
