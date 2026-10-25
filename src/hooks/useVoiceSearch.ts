import { useState, useEffect, useRef, useCallback } from 'react';

const MIC_PREF_KEY = 'plant_mic_search_custom_enabled_v1';

export function useVoiceSearch(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(MIC_PREF_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const recognitionRef = useRef<any>(null);
  const isStoppingRef = useRef<boolean>(false);

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
          recognition.lang = 'en-IN'; // Optimized for Indian plant worker names and accents

          recognition.onstart = () => {
            isStoppingRef.current = false;
            setIsListening(true);
            setStatusMessage('Listening... Speak worker name now');
          };

          recognition.onresult = (event: any) => {
            try {
              let currentTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
              }
              if (currentTranscript.trim()) {
                onResult(currentTranscript.trim());
                setStatusMessage(`Recognized: "${currentTranscript.trim()}"`);
              }
            } catch (err) {
              console.warn('Speech result processing:', err);
            }
          };

          recognition.onerror = (event: any) => {
            setIsListening(false);
            if (event.error === 'not-allowed') {
              setStatusMessage('Microphone permission blocked. Please allow mic in browser.');
            } else if (event.error === 'no-speech') {
              setStatusMessage('No speech detected. Tap mic to try again.');
            } else if (event.error === 'network') {
              setStatusMessage('Network required for voice recognition.');
            } else {
              setStatusMessage(null);
            }
            setTimeout(() => setStatusMessage(null), 3000);
          };

          recognition.onend = () => {
            setIsListening(false);
            setTimeout(() => setStatusMessage(null), 1500);
          };

          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition initialization error:', e);
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
  }, [onResult]);

  const toggleListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      alert('Voice Search requires Google Chrome, Microsoft Edge, or Android Chrome.');
      return;
    }

    if (isListening) {
      isStoppingRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setIsListening(false);
      setStatusMessage(null);
    } else {
      // Prompt mic permission gracefully if needed
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        }
      } catch {}

      try {
        recognitionRef.current.abort();
      } catch {}

      try {
        recognitionRef.current.start();
        setIsListening(true);
        setStatusMessage('Listening... Speak worker name now');
      } catch (err: any) {
        if (err?.name !== 'InvalidStateError') {
          console.warn('Could not start recognition:', err);
        }
      }
    }
  }, [isListening, isSupported]);

  const setMicEnabled = useCallback((enabled: boolean) => {
    setIsMicEnabledState(enabled);
    try {
      localStorage.setItem(MIC_PREF_KEY, String(enabled));
    } catch {}
    if (!enabled && isListening && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      setIsListening(false);
      setStatusMessage(null);
    }
  }, [isListening]);

  return {
    isListening,
    isSupported,
    isMicEnabled,
    statusMessage,
    setMicEnabled,
    toggleListening,
  };
}
