export interface HistoryItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  instruction: string;
  model?: string;
  aspectRatio?: string;
  label: string;
}

export interface ProductAnalysis {
  productName: string;
  productType: string;
  backgroundStatus: string;
  detectedFlaws: string[];
  suggestions: {
    category: string;
    title: string;
    instruction: string;
    expectedOutcome: string;
  }[];
}

export type ViewMode = 'split' | 'side-by-side' | 'result-only' | 'original-only';

export type BackdropColor = 'checker' | '#ffffff' | '#f8fafc' | '#f4efea' | '#0f172a' | '#e9efe9' | 'custom';
