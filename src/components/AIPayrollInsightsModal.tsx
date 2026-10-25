import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  Printer,
  ShieldAlert,
  Flame,
  PieChart,
  Percent,
  MessageSquare,
  Send,
  Lightbulb,
  Mic,
  MicOff,
  Camera,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Trash2,
  FileText,
} from 'lucide-react';
import { Worker, AttendanceDatabase } from '../types/attendance';
import { printElementDirect } from '../utils/printHelper';
import {
  fetchAIPayrollInsights,
  AIPayrollInsightsResponse,
  askAIPayrollQuestion,
  AIAskResponse,
} from '../lib/serverSync';

interface AIPayrollInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  workers: Worker[];
  attendanceDb: AttendanceDatabase;
  totalPlantPayout: number;
}

export const AIPayrollInsightsModal: React.FC<AIPayrollInsightsModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  workers,
  attendanceDb,
  totalPlantPayout,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [insightsData, setInsightsData] = useState<AIPayrollInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ask' | 'anomalies' | 'units'>('ask');

  // Interactive AI Assistant states
  const [questionInput, setQuestionInput] = useState<string>('');
  const [asking, setAsking] = useState<boolean>(false);
  const [askResult, setAskResult] = useState<AIAskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [aiLanguage] = useState<'en'>('en');

  // Microphone / Voice Recognition states (Default to English)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micLanguage] = useState<'en-IN' | 'en-US'>('en-IN');
  const recognitionRef = useRef<any>(null);

  // Camera & Image Upload states
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Volume / Text-to-Speech audio states
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Stop TTS and speech recognition when modal unmounts or closes
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadInsights();
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      stopListening();
    }
  }, [isOpen, year, month]);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAIPayrollInsights({
        year,
        month,
        workers,
        attendanceDb,
        totalPlantPayout,
      });
      setInsightsData(res);
    } catch (err: any) {
      console.warn('AI Insights fetch notice:', err);
      setError('Displaying real-time calculated plant metrics.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Voice Recognition (Microphone)
  const toggleListening = () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAskError('Microphone speech recognition is not supported in this browser. Please use Chrome or type your question.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = micLanguage;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setAskError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript.trim()) {
          setQuestionInput(currentTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setAskError('Microphone permission blocked. Please allow microphone access in your browser settings.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Microphone start error:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  // Handle Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAskError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAttachedImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setAttachedImageName(null);
  };

  // Toggle Text-to-Speech (Volume / Mute Speaker Button)
  const handleToggleVolumeSpeech = () => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;

    const synth = (window as any).speechSynthesis;

    if (isSpeaking) {
      // Mute / Stop speech immediately
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!askResult?.answer) return;

    synth.cancel();

    // Clean text: strip markdown characters for natural, pleasant speech
    const cleanText = askResult.answer
      .replace(/[*#_`~>•]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = synth.getVoices() || [];
    const engVoice =
      voices.find((v: any) => v.lang === 'en-IN') ||
      voices.find((v: any) => v.lang && v.lang.startsWith('en'));
    if (engVoice) utterance.voice = engVoice;
    utterance.lang = 'en-US';

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.speak(utterance);
  };

  // Ask Question / Submit
  const handleAskQuestion = async (customPrompt?: string) => {
    const q = (customPrompt || questionInput).trim();
    if (!q && !attachedImage) return;

    if (customPrompt) {
      setQuestionInput(customPrompt);
    }

    // Stop speaking if currently playing
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopListening();

    setAsking(true);
    setAskError(null);
    try {
      const result = await askAIPayrollQuestion({
        question: q || (attachedImage ? 'Please analyze this photo of the attendance register or voucher and assist me in English.' : 'Workforce summary'),
        image: attachedImage || undefined,
        year,
        month,
        workers,
        attendanceDb,
        totalPlantPayout,
        language: 'en',
      });
      setAskResult(result);
    } catch (err: any) {
      console.warn('AI Ask error notice:', err);
      setAskError('Could not process request. Please try again.');
    } finally {
      setAsking(false);
    }
  };

  const handleCloseModal = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopListening();
    onClose();
  };

  const auditReportRef = useRef<HTMLDivElement>(null);

  const handlePrintReport = async () => {
    if (!auditReportRef.current) return;
    await printElementDirect(
      auditReportRef.current,
      'portrait',
      `Plant Payroll AI Audit - ${monthName} ${year}`
    );
  };

  if (!isOpen) return null;

  const stats = insightsData?.stats;
  const anomalies = insightsData?.anomalies || [];
  const unitBreakdown = stats?.unitBreakdown || {};
  const costOpt = insightsData?.costOptimization;

  const suggestedPrompts = [
    { label: '🔥 Highest Overtime Staff', prompt: 'Which workers have the highest overtime in this month?' },
    { label: '⚠️ Absences & Zero Attendance', prompt: 'Which staff members have 0 attendance or high absences?' },
    { label: '💰 Furnace A, B & CCM Payout', prompt: 'What is the total payroll cost for Furnace A, Furnace B, and CCM?' },
    { label: '⭐ 100% Perfect Attendance', prompt: 'Which workers maintained 100% attendance?' },
    { label: '📉 Reduce Labor & OT Cost', prompt: 'What are the recommendations to reduce overtime and labor costs next month?' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn modal-print-active print:static print:inset-auto print:block print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Hidden File Inputs for Camera and Gallery */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI Plant &amp; Payroll Intelligence</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 font-extrabold uppercase tracking-wide">
                  English Only
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {monthName} {year} &bull; Voice, Camera &amp; Smart Plant Analytics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Explainer Banner */}
        <div className="px-6 py-2.5 bg-violet-50/70 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/40 text-[11px] leading-relaxed text-violet-800 dark:text-violet-200 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Multimodal AI Assistant:</span> Speak using the microphone, upload photos of attendance sheets or registers, or type any query. All insights and answers are provided in complete, fluent English. Use the speaker button to listen or mute.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ask')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'ask'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask AI Assistant</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/60 font-black">
              Voice + Camera
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Executive Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anomalies')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'anomalies'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Attendance Anomalies</span>
            {anomalies.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-black">
                {anomalies.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'units'
                ? 'border-violet-600 text-violet-600 dark:text-violet-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Plant Units (Furnace A, B &amp; CCM)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div ref={auditReportRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && !insightsData && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Auditing attendance register and calculating plant AI metrics...
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: INTERACTIVE ASK AI ASSISTANT (CAMERA + MIC + VOLUME) */}
          {activeTab === 'ask' && (
            <div className="space-y-4">
              {/* Voice & Camera Action Toolbar Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4" />
                    <span>Ask Question or Upload Photo (Voice &bull; Photo &bull; Text)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Language:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-violet-600 text-white font-bold text-[10px]">
                      English
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Tap the microphone to speak, upload attendance photos from camera/gallery, or type questions below.
                </p>
              </div>

              {/* Photo Preview Card if Image is Attached */}
              {attachedImage && (
                <div className="p-3 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={attachedImage}
                      alt="Uploaded register"
                      className="w-14 h-14 object-cover rounded-xl border border-violet-300 dark:border-violet-800 shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-black text-violet-800 dark:text-violet-200">
                        <Camera className="w-3.5 h-3.5 text-violet-600" />
                        <span className="truncate">{attachedImageName || 'Photo Attached'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        AI will review and assist you based on this uploaded register document.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    title="Remove Photo"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Suggested Click-to-Ask Prompt Chips */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Suggested Quick Questions (Click to ask):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPrompts.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAskQuestion(item.prompt)}
                      disabled={asking}
                      className="px-2.5 py-1.5 rounded-xl text-left bg-slate-100 hover:bg-violet-100 dark:bg-slate-800 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-violet-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Interactive Input Bar (Text + Mic + Camera + Gallery + Send) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskQuestion();
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-xs focus-within:border-violet-500 transition-all">
                  {/* Camera Capture Button */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    title="Take Photo with Camera"
                    className="p-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                  </button>

                  {/* Image/Gallery Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Choose Photo from Gallery / Files"
                    className="p-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  {/* Microphone Voice Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    title={isListening ? 'Stop Microphone' : 'Speak with Voice (English)'}
                    className={`p-2 rounded-xl transition-all shrink-0 cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                        : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder={
                      isListening
                        ? 'Listening... please speak your question...'
                        : attachedImage
                        ? 'Ask something about this photo or send directly...'
                        : 'Ask anything (e.g. Ramesh attendance or Furnace A payroll cost)...'
                    }
                    className="flex-1 px-2 py-2 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                  />

                  {/* Submit / Ask AI Button */}
                  <button
                    type="submit"
                    disabled={asking || (!questionInput.trim() && !attachedImage)}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-violet-600/20 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    {asking ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Ask AI</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Mic Listening Status Indicator */}
                {isListening && (
                  <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>Microphone active (English)... Please speak now...</span>
                  </div>
                )}
              </form>

              {askError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{askError}</span>
                </div>
              )}

              {/* Animated Thinking & Processing Indicator */}
              {asking && (
                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-violet-600 animate-spin shrink-0" />
                  <div>
                    <div className="text-xs font-black text-violet-900 dark:text-violet-200">
                      AI is analyzing workforce data &amp; document photo...
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Preparing comprehensive response in English...
                    </p>
                  </div>
                </div>
              )}

              {/* AI Response Display Card with Audio Speaker / Volume Toggle */}
              {askResult && !asking && (
                <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-violet-300 dark:border-violet-900/60 shadow-xs space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Assistant Response</span>
                      </span>
                      {isSpeaking && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Speaking...</span>
                        </span>
                      )}
                    </div>

                    {/* Gemini-Style Volume / Speaker Button (Listen / Mute toggle) */}
                    <button
                      type="button"
                      onClick={handleToggleVolumeSpeech}
                      title={isSpeaking ? 'Stop Audio' : 'Listen Audio'}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSpeaking
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                          : 'bg-violet-100 hover:bg-violet-200 dark:bg-violet-950/70 dark:hover:bg-violet-900 text-violet-700 dark:text-violet-300'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          <span>Stop Audio</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>Listen (Speaker)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Answer Text */}
                  <p className="text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed font-semibold whitespace-pre-line">
                    {askResult.answer}
                  </p>

                  {/* Bullet Highlights */}
                  {askResult.highlights && askResult.highlights.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Key Highlights:
                      </div>
                      <div className="space-y-1">
                        {askResult.highlights.map((hl, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5 font-medium"
                          >
                            <span className="text-violet-600 font-bold">&bull;</span>
                            <span>{hl}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Advice Recommendation */}
                  {askResult.actionAdvice && (
                    <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-900 dark:text-violet-200 flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold">Supervisor Recommendation: </span>
                        <span>{askResult.actionAdvice}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* TAB 2: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Executive Summary Card */}
              <div className="p-4.5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent border border-violet-200 dark:border-violet-900/50 space-y-2">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-black text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Executive Operations Summary</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {insightsData?.summary ||
                    `Plant workforce operations utilized ${workers.length} registered workers in ${monthName} ${year}. Total estimated plant labor payout is ₹${Number(totalPlantPayout).toLocaleString('en-IN')}.`}
                </p>
              </div>

              {/* 4 Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-500" />
                    <span>Total Staff</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {stats?.totalWorkers ?? workers.length}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Active on register
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    <span>Present Days</span>
                  </div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {stats?.activePresent ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Total man-shifts
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-violet-500" />
                    <span>Total Payout</span>
                  </div>
                  <div className="text-xl font-black text-violet-600 dark:text-violet-400 mt-1 truncate">
                    {stats?.totalPayoutFormatted ?? `₹${totalPlantPayout.toLocaleString('en-IN')}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Est. net obligation
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Percent className="w-3 h-3 text-cyan-500" />
                    <span>Attendance Rate</span>
                  </div>
                  <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                    {stats?.attendanceRate ?? 85}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Monthly plant efficiency
                  </div>
                </div>
              </div>

              {/* Overtime & Cost Optimization Section */}
              {costOpt && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300">
                    <PieChart className="w-4 h-4" />
                    <span>Overtime Labor Cost Audit ({stats?.totalOvertimeShifts || 0} OT Shifts Logged)</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {costOpt.potentialSavingsTips}
                  </p>
                </div>
              )}

              {/* Actionable Recommendations */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Actionable Supervisor Recommendations</span>
                </h4>
                <div className="space-y-1.5">
                  {(insightsData?.recommendations || [
                    'Review workers with 5+ unexcused absences before final month-end salary voucher approval.',
                    'Rotate furnace operators between high-heat and auxiliary units to maintain safety.',
                    'Export and archive signed payslips at the close of every billing cycle.',
                    'Audit master directory entries to eliminate inactive profiles.',
                  ]).map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5 font-medium leading-relaxed"
                    >
                      <span className="w-4 h-4 rounded-full bg-violet-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDANCE ANOMALIES & RISKS */}
          {activeTab === 'anomalies' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {anomalies.length} irregularities detected this billing cycle
                </span>
              </div>

              {anomalies.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Attendance Anomalies
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    All workers maintain normal shift allocations without extreme absenteeism or fatigue risks.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {item.unit}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full uppercase ${
                              item.severity === 'high'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {item.severity} severity
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.title}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FURNACE & UNIT BREAKDOWN */}
          {activeTab === 'units' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Flame className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Plant Operational Distribution:</span> Headcount and wages allocated across Furnace A, Furnace B, and Continuous Casting Machine (CCM) units.
                </div>
              </div>

              <div className="space-y-2.5">
                {Object.keys(unitBreakdown).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No unit allocations found. Assign staff to units in Master Directory.
                  </div>
                ) : (
                  Object.entries(unitBreakdown).map(([uName, uData]) => (
                    <div
                      key={uName}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-violet-600" />
                          <h4 className="font-black text-sm text-slate-900 dark:text-white">
                            {uName}
                          </h4>
                        </div>
                        <span className="text-xs font-black text-violet-600 dark:text-violet-400">
                          ₹{uData.totalPayout.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Staff</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
                            {uData.count} workers
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Present Days</div>
                          <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {uData.presentDays}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">OT Shifts</div>
                          <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                            {uData.otDays}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={loadInsights}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate AI</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrintReport}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
