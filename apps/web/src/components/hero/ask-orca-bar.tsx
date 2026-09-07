'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Waves } from 'lucide-react';
import dynamic from 'next/dynamic';

const GlassSurface = dynamic(() => import('@/components/ui/glass-surface'), {
  ssr: false,
});

const SUGGESTIONS = [
  'Where should I fish today?',
  'Is it safe to go tomorrow?',
  'Find the nearest fishing zone',
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
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    [],
  );

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }

    setNotice('Question captured. Marine reasoning connects after this hero is approved.');
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setNotice('Voice input is not supported by this browser.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      setQuery(event.results[0][0].transcript);
      setNotice('');
      inputRef.current?.focus();
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setNotice('Voice input could not start. Check microphone access and try again.');
    };

    recognitionRef.current = recognition;
    setNotice('');
    setListening(true);
    recognition.start();
  };

  return (
    <section className="ask-orca" id="ask-orca" aria-label="Ask ORCA">
      {notice ? (
        <div className="ask-orca__notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice('')}>
            Dismiss
          </button>
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
            <Waves size={19} strokeWidth={1.65} />
          </span>
          <label className="sr-only" htmlFor="orca-query">
            Ask ORCA about the sea
          </label>
          <input
            ref={inputRef}
            id="orca-query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setNotice('');
            }}
            placeholder="Ask ORCA about the sea..."
            autoComplete="off"
          />
          <button
            className="ask-orca__voice"
            type="button"
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={listening}
            onClick={toggleVoice}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
          <button className="ask-orca__send" type="submit" aria-label="Send question">
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
              inputRef.current?.focus();
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
