import { useState, useEffect, useRef, useCallback } from 'react';

const VOICE_SETTINGS_KEY = 'plant_worker_form_voice_settings_v1';

export interface VoiceSettings {
  enabled: boolean;
  language: string;
  autoFormatCaps: boolean;
  autoCleanNumbers: boolean;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: true,
  language: 'en-IN',
  autoFormatCaps: true,
  autoCleanNumbers: true,
};

export function useFieldSpeech() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const recognitionRef = useRef<any>(null);
  const currentCallbackRef = useRef<((text: string) => void) | null>(null);
  const currentFieldTypeRef = useRef<string>('text');

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist voice settings:', e);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSupported(true);
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = settings.language;

          recognition.onstart = () => {
            setStatusText('🎙️ Listening... Speak now');
          };

          recognition.onresult = (event: any) => {
            try {
              let transcript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
              }

              let cleaned = transcript.trim();

              // Formatting according to field type
              const fieldType = currentFieldTypeRef.current;
              if (fieldType === 'number' || fieldType === 'account' || fieldType === 'phone' || fieldType === 'aadhar') {
                // Convert spoken digits or remove non-numeric
                cleaned = cleaned.replace(/[^0-9]/g, '');
              } else if (fieldType === 'ifsc' || fieldType === 'pan' || fieldType === 'uppercase') {
                cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              } else if (fieldType === 'name') {
                // Title case for names
                cleaned = cleaned
                  .toLowerCase()
                  .split(' ')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              }

              if (cleaned && currentCallbackRef.current) {
                currentCallbackRef.current(cleaned);
                setStatusText(`Captured: "${cleaned}"`);
              }
            } catch (err) {
              console.warn('Speech onresult error:', err);
            }
          };

          recognition.onerror = (event: any) => {
            setActiveField(null);
            if (event.error === 'not-allowed') {
              setStatusText('Mic access denied. Please allow microphone in browser.');
            } else if (event.error === 'no-speech') {
              setStatusText('No speech heard. Please tap mic and speak again.');
            } else {
              setStatusText(null);
            }
            setTimeout(() => setStatusText(null), 3500);
          };

          recognition.onend = () => {
            setActiveField(null);
            setTimeout(() => setStatusText(null), 1500);
          };

          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition init error:', e);
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [settings.language]);

  const startListening = useCallback(
    (
      fieldName: string,
      fieldType: 'text' | 'name' | 'number' | 'account' | 'ifsc' | 'pan' | 'phone' | 'aadhar' | 'uppercase',
      onCaptured: (text: string) => void
    ) => {
      if (!isSupported || !recognitionRef.current) {
        alert('Voice microphone input requires Chrome, Edge, or Android Chrome browser.');
        return;
      }

      if (activeField === fieldName) {
        try {
          recognitionRef.current.stop();
        } catch {}
        setActiveField(null);
        return;
      }

      try {
        if (activeField) {
          recognitionRef.current.abort();
        }
      } catch {}

      currentCallbackRef.current = onCaptured;
      currentFieldTypeRef.current = fieldType;
      setActiveField(fieldName);

      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
        try {
          recognitionRef.current.abort();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch {}
          }, 150);
        } catch {}
      }
    },
    [activeField, isSupported]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current && activeField) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setActiveField(null);
    }
  }, [activeField]);

  return {
    isSupported,
    activeField,
    statusText,
    settings,
    updateSettings,
    startListening,
    stopListening,
  };
}
