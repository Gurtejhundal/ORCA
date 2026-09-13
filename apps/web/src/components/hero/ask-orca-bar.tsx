'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Mic, Waves } from 'lucide-react';
import { marineApi } from '@/services/marine-api';

export type AppLanguage = 'en' | 'hi';

const COPY = {
  en: {
    placeholder: 'Ask ORCA about fishing, safety, routes or sea conditions…',
    label: 'Ask ORCA about the sea',
    startVoice: 'Start voice input',
    stopVoice: 'Stop voice input',
    send: 'Send question',
    suggestionsLabel: 'Suggested questions',
    dismiss: 'Dismiss',
    listening: 'Listening…',
    transcribing: 'Transcribing speech…',
    unsupported: 'Voice input is not supported by this browser.',
    voiceError: 'Voice input could not start. Check microphone access and try again.',
    suggestions: ['Where should I fish tomorrow near Nagapattinam?', 'Is it safe to sail at 5 AM?', 'Find the safest route to PFZ-02', 'What is the wave height near Kochi?'],
  },
  hi: {
    placeholder: 'मत्स्य, सुरक्षा, मार्ग या समुद्री स्थिति के बारे में ORCA से पूछें…',
    label: 'समुद्र के बारे में ORCA से पूछें',
    startVoice: 'आवाज़ से पूछें',
    stopVoice: 'आवाज़ सुनना बंद करें',
    send: 'सवाल भेजें',
    suggestionsLabel: 'सुझाए गए सवाल',
    dismiss: 'बंद करें',
    listening: 'सुन रहा है…',
    transcribing: 'आवाज़ को लिखा जा रहा है…',
    unsupported: 'इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है।',
    voiceError: 'माइक्रोफ़ोन चालू नहीं हुआ। अनुमति जाँचें और फिर कोशिश करें।',
    suggestions: ['कल नागपट्टिनम के पास कहाँ मछली पकड़ूँ?', 'क्या सुबह 5 बजे निकलना सुरक्षित है?', 'PFZ-02 तक सबसे सुरक्षित मार्ग खोजें', 'कोच्चि के पास लहरों की ऊँचाई क्या है?'],
  },
} as const;

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

export function AskOrcaBar({
  language,
  onSubmitQuery,
}: {
  language: AppLanguage;
  onSubmitQuery: (query: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const copy = COPY[language];

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    },
    [],
  );

  const executeQuery = async (textToQuery: string) => {
    if (!textToQuery.trim() || loading) return;
    setLoading(true);
    setNotice('');
    try {
      setQuery('');
      await onSubmitQuery(textToQuery.trim());
    } finally {
      setVoiceStatus('');
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
    setVoiceStatus(copy.listening);
    setNotice('');

    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 1000) {
          setVoiceStatus(copy.transcribing);
          try {
            const tr = await marineApi.transcribeAudio(audioBlob, language);
            if (tr.text) {
              setQuery(tr.text);
              setVoiceStatus('');
              void executeQuery(tr.text);
              return;
            }
          } catch { /* Report transcription failure below, including empty results. */ }
        }
        setVoiceStatus('');
        setNotice(copy.voiceError);
      };

      recorder.start();
      setListening(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
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
      setNotice(copy.unsupported);
      setVoiceStatus('');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
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
      setNotice(copy.voiceError);
    };

    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus(copy.listening);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceStatus('');
      setNotice(copy.voiceError);
    }
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
    <section className="ask-orca" id="ask-orca" aria-label={copy.label}>
      {voiceStatus && (
        <div className="ask-orca__notice" role="status">
          {voiceStatus}
        </div>
      )}

      {notice ? <div className="ask-orca__notice" role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>{copy.dismiss}</button></div> : null}

      <div className="ask-orca__surface marine-glass marine-glass--search">
        <form className="ask-orca__form" onSubmit={submitQuery}>
          <span className="ask-orca__mark" aria-hidden="true">
            {loading ? <Loader2 size={19} className="animate-spin" /> : <Waves size={19} strokeWidth={1.65} />}
          </span>
          <label className="sr-only" htmlFor="orca-query">
            {copy.label}
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
            placeholder={copy.placeholder}
            autoComplete="off"
          />
          <button
            className="ask-orca__voice"
            type="button"
            disabled={loading}
            aria-label={listening ? copy.stopVoice : copy.startVoice}
            aria-pressed={listening}
            onClick={toggleVoice}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
          <button className="ask-orca__send" type="submit" disabled={loading} aria-label={copy.send}>
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
      </div>

      <div className="ask-orca__suggestions" aria-label={copy.suggestionsLabel}>
        {copy.suggestions.map((suggestion) => (
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
