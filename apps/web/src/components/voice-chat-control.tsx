'use client';
import { useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { marineApi } from '@/services/marine-api';

interface VoiceChatControlProps {
  onTranscript: (text: string) => void;
  languageHint?: string;
  disabled?: boolean;
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
const VOICE_COPY = {
  en: {
    listening: 'Listening...', transcribing: 'Transcribing...', browserListening: 'Listening (Browser)...',
    unavailable: 'Voice input unavailable. Please type your query.', recognitionError: 'Voice recognition error. Please type your query.', unsupported: 'Voice input not supported in this browser.',
    stopRecording: 'Click to stop recording', speakQuery: 'Click to speak query', stopInput: 'Stop voice recording', startInput: 'Start voice input',
    stopReading: 'Stop reading', listenAnswer: 'Listen to answer (TTS)', readAloud: 'Read answer out loud', stop: 'Stop', listen: 'Listen',
  },
  hi: {
    listening: 'सुना जा रहा है…', transcribing: 'लिखित रूप बनाया जा रहा है…', browserListening: 'ब्राउज़र सुन रहा है…',
    unavailable: 'आवाज़ इनपुट उपलब्ध नहीं है। कृपया सवाल लिखें।', recognitionError: 'आवाज़ पहचानने में त्रुटि हुई। कृपया सवाल लिखें।', unsupported: 'यह ब्राउज़र आवाज़ इनपुट का समर्थन नहीं करता।',
    stopRecording: 'रिकॉर्डिंग रोकें', speakQuery: 'सवाल बोलें', stopInput: 'आवाज़ रिकॉर्डिंग रोकें', startInput: 'आवाज़ इनपुट शुरू करें',
    stopReading: 'पढ़ना रोकें', listenAnswer: 'उत्तर सुनें', readAloud: 'उत्तर सुनाएँ', stop: 'रोकें', listen: 'सुनें',
  },
} as const;

export function VoiceChatControl({
  onTranscript,
  languageHint = 'en',
  disabled = false,
}: VoiceChatControlProps) {
  const copy = VOICE_COPY[languageHint === 'hi' ? 'hi' : 'en'];
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    if (disabled || recording) return;

    try {
      setStatus(copy.listening);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size < 500) {
          setStatus('');
          return;
        }

        setStatus(copy.transcribing);
        try {
          // 1. Try Bhashini / backend transcribe
          const res = await marineApi.transcribeAudio(audioBlob, languageHint);
          if (res.text && res.text.trim()) {
            onTranscript(res.text.trim());
            setStatus('');
            return;
          }
        } catch {
          // Backend transcribe unconfigured or error -> fallback below
        }

        setStatus('');
      };

      mediaRecorder.start(250);
      setRecording(true);
    } catch {
      // Browser Web Speech Recognition fallback
      startBrowserRecognitionFallback();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  function startBrowserRecognitionFallback() {
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus(copy.unavailable);
      setTimeout(() => setStatus(''), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = languageHint === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setRecording(true);
        setStatus(copy.browserListening);
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (text) {
          onTranscript(text);
        }
        setRecording(false);
        setStatus('');
      };

      recognition.onerror = () => {
        setRecording(false);
        setStatus(copy.recognitionError);
        setTimeout(() => setStatus(''), 4000);
      };

      recognition.onend = () => {
        setRecording(false);
        setStatus('');
      };

      recognition.start();
    } catch {
      setRecording(false);
      setStatus(copy.unsupported);
      setTimeout(() => setStatus(''), 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stopRecording : startRecording}
        className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
          recording
            ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30'
            : 'bg-white/10 hover:bg-white/20 text-white/90'
        }`}
        title={recording ? copy.stopRecording : copy.speakQuery}
        aria-label={recording ? copy.stopInput : copy.startInput}
      >
        {recording ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {status && (
        <span className="text-xs text-sky-300 animate-pulse flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" />
          {status}
        </span>
      )}
    </div>
  );
}

export function AudioPlayer({
  text,
  language = 'en',
}: {
  text: string;
  language?: string;
}) {
  const copy = VOICE_COPY[language === 'hi' ? 'hi' : 'en'];
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak() {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis?.cancel();
      setPlaying(false);
      return;
    }

    try {
      setPlaying(true);
      // Try backend TTS (Bhashini)
      const res = await marineApi.speakText(text, language);
      if (res.audio_base64) {
        const audio = new Audio(`data:${res.audio_format};base64,${res.audio_base64}`);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => fallbackSpeak();
        await audio.play();
        return;
      }
    } catch {
      fallbackSpeak();
    }
  }

  function fallbackSpeak() {
    if (!('speechSynthesis' in window)) {
      setPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={() => void speak()}
      className={`p-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
        playing
          ? 'bg-sky-500/20 text-sky-300'
          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
      }`}
      title={playing ? copy.stopReading : copy.listenAnswer}
      aria-label={copy.readAloud}
    >
      {playing ? <VolumeX size={14} /> : <Volume2 size={14} />}
      <span className="text-[11px]">{playing ? copy.stop : copy.listen}</span>
    </button>
  );
}
