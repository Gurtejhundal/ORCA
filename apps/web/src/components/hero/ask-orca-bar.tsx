'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Mic, Volume2, Waves } from 'lucide-react';
import dynamic from 'next/dynamic';
import { marineApi, type ChatResponsePayload } from '@/services/marine-api';

const GlassSurface = dynamic(() => import('@/components/ui/glass-surface'), {
  ssr: false,
});

const SUGGESTIONS = [
  'Where should I fish today?',
  'कल सुबह वेरावल से समुद्र में जाना सुरक्षित रहेगा?',
  'Find the nearest fishing zone',
  'What is wave height near Kochi?',
];

type SpeechResultEvent = {
  results: {
    0: {
      0: { transcript: string };
    };
  };
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function AskOrcaBar() {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatResult, setChatResult] = useState<ChatResponsePayload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    },
    [],
  );

  const speakText = async (text: string, language = 'hi') => {
    try {
      const tts = await marineApi.speakText(text, language);
      if (tts.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${tts.audio_base64}`);
        audio.play();
        return;
      }
    } catch {
      // Fallback to browser Web Speech synthesis
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const executeQuery = async (textToQuery: string) => {
    if (!textToQuery.trim() || loading) return;
    setLoading(true);
    setNotice('');
    setVoiceStatus('Consulting SamudraAI Agents…');

    try {
      const resp = await marineApi.chat({
        message: textToQuery,
      });
      setChatResult(resp);
      setNotice(resp.answer);
      setVoiceStatus('');

      // Autoplay voice response
      void speakText(resp.answer, resp.language);
    } catch (err) {
      setNotice(
        err instanceof Error
          ? `AI Orchestrator: ${err.message}`
          : 'Failed to communicate with marine intelligence agent.',
      );
      setVoiceStatus('');
    } finally {
      setLoading(false);
    }
  };

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }
    void executeQuery(query);
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setListening(false);
  };

  const startAudioRecording = async () => {
    audioChunksRef.current = [];
    setVoiceStatus('Listening (Bhashini/Voice)…');
    setNotice('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 1000) {
          setVoiceStatus('Transcribing speech…');
          try {
            const tr = await marineApi.transcribeAudio(audioBlob);
            if (tr.text) {
              setQuery(tr.text);
              setVoiceStatus('');
              void executeQuery(tr.text);
              return;
            }
          } catch {
            setVoiceStatus('');
          }
        }
      };

      recorder.start();
      setListening(true);
    } catch {
      // Fallback to browser SpeechRecognition if MediaRecorder or mic access fails
      fallbackBrowserSpeech();
    }
  };

  const fallbackBrowserSpeech = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setNotice('Voice input is not supported by this browser.');
      setVoiceStatus('');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'hi-IN';
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setQuery(text);
      setVoiceStatus('');
      setNotice('');
      void executeQuery(text);
    };
    recognition.onend = () => {
      setListening(false);
      setVoiceStatus('');
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceStatus('');
      setNotice('Voice input could not start. Check microphone access and try again.');
    };

    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus('Listening via browser speech…');
    recognition.start();
  };

  const toggleVoice = () => {
    if (listening) {
      stopAudioRecording();
      recognitionRef.current?.stop();
    } else {
      void startAudioRecording();
    }
  };

  return (
    <section className="ask-orca" id="ask-orca" aria-label="Ask ORCA">
      {voiceStatus && (
        <div className="ask-orca__notice" role="status" style={{ opacity: 0.9 }}>
          {voiceStatus}
        </div>
      )}

      {notice ? (
        <div className="ask-orca__notice" role="status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
            <span>{notice}</span>
            {chatResult && (
              <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                Confidence: {Math.round(chatResult.confidence * 100)}% · Intent: {chatResult.intent} · Sources: {chatResult.sources.join(', ')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void speakText(notice, chatResult?.language || 'hi')}
              title="Speak answer"
              aria-label="Speak response"
            >
              <Volume2 size={16} />
            </button>
            <button type="button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={25}
        borderWidth={0.065}
        brightness={58}
        opacity={0.76}
        blur={7}
        displace={0.45}
        backgroundOpacity={0.16}
        saturation={1.24}
        distortionScale={-105}
        redOffset={0}
        greenOffset={2}
        blueOffset={4}
        mixBlendMode="soft-light"
        className="ask-orca__glass"
      >
        <form className="ask-orca__form" onSubmit={submitQuery}>
          <span className="ask-orca__mark" aria-hidden="true">
            {loading ? <Loader2 size={19} className="animate-spin" /> : <Waves size={19} strokeWidth={1.65} />}
          </span>
          <label className="sr-only" htmlFor="orca-query">
            Ask ORCA about the sea
          </label>
          <input
            ref={inputRef}
            id="orca-query"
            value={query}
            disabled={loading}
            onChange={(event) => {
              setQuery(event.target.value);
              setNotice('');
            }}
            placeholder="Ask SamudraAI in Hindi or English (e.g. कल सुबह वेरावल से समुद्र में जाना सुरक्षित रहेगा?)..."
            autoComplete="off"
          />
          <button
            className="ask-orca__voice"
            type="button"
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={listening}
            style={listening ? { color: '#ff6b6b', animation: 'pulse 1.5s infinite' } : {}}
            onClick={toggleVoice}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
          <button className="ask-orca__send" type="submit" disabled={loading} aria-label="Send question">
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
      </GlassSurface>

      <div className="ask-orca__suggestions" aria-label="Suggested questions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuery(suggestion);
              setNotice('');
              void executeQuery(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
