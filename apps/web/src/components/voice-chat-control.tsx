'use client';
import { useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { marineApi } from '@/services/marine-api';

interface VoiceChatControlProps {
  onTranscript: (text: string) => void;
  languageHint?: string;
  disabled?: boolean;
}

export function VoiceChatControl({
  onTranscript,
  languageHint = 'en',
  disabled = false,
}: VoiceChatControlProps) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    if (disabled || recording) return;

    try {
      setStatus('Listening...');
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

        setStatus('Transcribing...');
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
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus('Voice input unavailable. Please type your query.');
      setTimeout(() => setStatus(''), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = languageHint === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setRecording(true);
        setStatus('Listening (Browser)...');
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          onTranscript(text);
        }
        setRecording(false);
        setStatus('');
      };

      recognition.onerror = () => {
        setRecording(false);
        setStatus('Voice recognition error. Please type your query.');
        setTimeout(() => setStatus(''), 4000);
      };

      recognition.onend = () => {
        setRecording(false);
        setStatus('');
      };

      recognition.start();
    } catch {
      setRecording(false);
      setStatus('Voice input not supported in this browser.');
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
        title={recording ? 'Click to stop recording' : 'Click to speak query'}
        aria-label={recording ? 'Stop voice recording' : 'Start voice input'}
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
      title={playing ? 'Stop reading' : 'Listen to answer (TTS)'}
      aria-label="Read answer out loud"
    >
      {playing ? <VolumeX size={14} /> : <Volume2 size={14} />}
      <span className="text-[11px]">{playing ? 'Stop' : 'Listen'}</span>
    </button>
  );
}
