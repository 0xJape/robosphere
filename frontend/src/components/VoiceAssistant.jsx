import { useState, useRef, useEffect } from "react";
import { textToSpeech, speechToText } from "../api.js";

const IconMic = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const IconStop = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);

const IconSpinner = () => (
  <svg width="34" height="34" viewBox="0 0 50 50" style={{ animation: "vaSpin 1s linear infinite" }}>
    <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="3"
      strokeDasharray="90 130" strokeLinecap="round" />
  </svg>
);

const STATES = {
  IDLE:       "idle",
  LISTENING:  "listening",
  THINKING:   "thinking",
  SPEAKING:   "speaking",
};

const stripMarkdown = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .trim();

export default function VoiceAssistant({ onSend, readings = [], alerts = [], onStateChange }) {
  const [status, setStatus] = useState(STATES.IDLE);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [amplitude, setAmplitude] = useState(0); // 0..1, drives ring scale
  const [ttsLoading, setTtsLoading] = useState(false); // true while waiting for TTS audio
    const [typewriter, setTypewriter] = useState("");    // typewriter display text
    const twRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const audioRef         = useRef(null);
  const streamRef        = useRef(null);

  // Web Audio for live amplitude
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const sourceRef        = useRef(null);
  const rafRef           = useRef(null);

  useEffect(() => { onStateChange?.(status); }, [status, onStateChange]);

    // Typewriter: run while ttsLoading, show full text once done
    useEffect(() => {
      if (twRef.current) { clearInterval(twRef.current); twRef.current = null; }
      if (!response) { setTypewriter(""); return; }
      if (ttsLoading) {
        setTypewriter("");
        let i = 0;
        twRef.current = setInterval(() => {
          i++;
          setTypewriter(response.slice(0, i));
          if (i >= response.length) { clearInterval(twRef.current); twRef.current = null; }
        }, 22);
      } else {
        setTypewriter(response);
      }
      return () => { if (twRef.current) { clearInterval(twRef.current); twRef.current = null; } };
    }, [ttsLoading, response]);

  useEffect(() => () => {
    stopAudio();
    stopStream();
    stopAnalyser();
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const stopAnalyser = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setAmplitude(0);
  };

  // Hook a media node into Web Audio and start an RMS loop
  const startAnalyser = (node) => {
    stopAnalyser();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    analyserRef.current = analyser;
    node.connect(analyser);
    // Note: don't connect mic to destination (would echo). For audio element, also fine — Audio element plays separately.
    const buf = new Uint8Array(analyser.fftSize);
    let smooth = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      // RMS deviation from 128
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length); // 0..1
      // Boost low values, smooth
      const boosted = Math.min(1, rms * 3.2);
      smooth = smooth * 0.75 + boosted * 0.25;
      setAmplitude(smooth);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startListening = async () => {
    setError("");
    setTranscript("");
    setResponse("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stopAnalyser();
        stopStream();
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };
      mediaRecorder.start();
      setStatus(STATES.LISTENING);

      // Start mic analyser
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;
      startAnalyserFromCtx(ctx, src);
    } catch (e) {
      setError("Microphone access denied.");
      setStatus(STATES.IDLE);
    }
  };

  // Variant that reuses an existing context (avoids stopAnalyser closing what we just made)
  const startAnalyserFromCtx = (ctx, src) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    analyserRef.current = analyser;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let smooth = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const boosted = Math.min(1, rms * 3.2);
      smooth = smooth * 0.75 + boosted * 0.25;
      setAmplitude(smooth);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && status === STATES.LISTENING) {
      mediaRecorderRef.current.stop();
      setStatus(STATES.THINKING);
      setAmplitude(0);
    }
  };

  // Speak arbitrary text via TTS, hooking into the analyser so the orb still reacts.
  // Returns a Promise that resolves when playback ends (or fails silently).
  const speakText = async (text) => {
    if (!text || !text.trim()) return;
    try {
      const audioBlob = await textToSpeech(text);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setStatus(STATES.SPEAKING);

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(audio);
        sourceRef.current = src;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        analyserRef.current = analyser;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const buf = new Uint8Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          const boosted = Math.min(1, rms * 3.2);
          smooth = smooth * 0.75 + boosted * 0.25;
          setAmplitude(smooth);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Fallback: still play even if analyser fails
      }

      await new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          stopAnalyser();
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          stopAnalyser();
          resolve();
        };
        audio.play().catch(() => resolve());
      });
    } catch {
      // TTS itself failed — nothing more we can do; UI still shows the error text.
      stopAnalyser();
    }
  };

  const processAudio = async (blob) => {
    try {
      let text;
      try { text = await speechToText(blob); }
      catch (e) {
        const msg = "Sorry Jude, I couldn't hear that clearly. Mind trying again?";
        setError(msg);
        await speakText(msg);
        setStatus(STATES.IDLE);
        return;
      }

      if (!text || !text.trim()) {
        const msg = "Hmm, I didn't catch anything. Tap the orb and speak when you're ready, Jude.";
        setError(msg);
        await speakText(msg);
        setStatus(STATES.IDLE);
        return;
      }
      setTranscript(text);

      let aiResponse;
      try { aiResponse = await onSend({ message: text.trim(), mode: "guidance" }); }
      catch (e) {
        const msg = "I heard you, but I'm having trouble thinking right now. Give me a moment, Jude.";
        setError(msg);
        await speakText(msg);
        setStatus(STATES.IDLE);
        return;
      }
      const clean = stripMarkdown(aiResponse);


        // Reset typewriter and start interval BEFORE setting response
        // so the card never flashes the full text
        if (twRef.current) clearInterval(twRef.current);
        setTypewriter("");
        let twIndex = 0;
        twRef.current = setInterval(() => {
          twIndex++;
          setTypewriter(clean.slice(0, twIndex));
          if (twIndex >= clean.length) { clearInterval(twRef.current); twRef.current = null; }
        }, 22);

        setResponse(clean);
        setStatus(STATES.SPEAKING);
        setTtsLoading(true);

      let audioBlob;
      try { audioBlob = await textToSpeech(clean); }
      catch (e) {
          if (twRef.current) { clearInterval(twRef.current); twRef.current = null; }
          setTypewriter(clean);
        setTtsLoading(false);
        const msg = "My voice is offline, but I've shown my reply on screen, Jude.";
        setError(msg);
        setStatus(STATES.IDLE);
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Hook TTS into Web Audio analyser
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(audio);
        sourceRef.current = src;
        // Must connect to destination so we hear it
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        analyserRef.current = analyser;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const buf = new Uint8Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          const boosted = Math.min(1, rms * 3.2);
          smooth = smooth * 0.75 + boosted * 0.25;
          setAmplitude(smooth);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Fallback: just play
      }

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        stopAnalyser();
        setStatus(STATES.IDLE);
      };
        // TTS ready — stop typewriter and show full text
        if (twRef.current) { clearInterval(twRef.current); twRef.current = null; }
        setTypewriter(clean);
      setTtsLoading(false);
      await audio.play();
    } catch (e) {
        if (twRef.current) { clearInterval(twRef.current); twRef.current = null; }
        setTypewriter(clean);
      setTtsLoading(false);
      setError(e.message || "Something went wrong.");
      stopAnalyser();
      setStatus(STATES.IDLE);
    }
  };

  const handleMicClick = () => {
    if (status === STATES.IDLE)      return startListening();
    if (status === STATES.LISTENING) return stopListening();
    if (status === STATES.SPEAKING)  { stopAudio(); stopAnalyser(); setStatus(STATES.IDLE); }
  };

  const statusLabel = {
    [STATES.IDLE]:      "READY",
    [STATES.LISTENING]: "LISTENING",
    [STATES.THINKING]:  "PROCESSING",
    [STATES.SPEAKING]:  "RESPONDING",
  }[status];

  const subLabel = {
    [STATES.IDLE]:      "Tap the orb to speak",
    [STATES.LISTENING]: "Tap to stop",
    [STATES.THINKING]:  "Thinking…",
    [STATES.SPEAKING]:  "Tap to interrupt",
  }[status];

  // Reactive scales — base + amplitude-driven
  const ampScale = 1 + amplitude * 0.35;
  const ringScale1 = 1 + amplitude * 0.55;
  const ringScale2 = 1 + amplitude * 0.85;
  const ringScale3 = 1 + amplitude * 1.20;

  const isActive = status === STATES.LISTENING || status === STATES.SPEAKING;
  const isThinking = status === STATES.THINKING;

  return (
    <div className={`va-root va-${status}`}>
      {/* Status header */}
      <div className="va-status-bar">
        <span className="va-status-dot" />
        <span className="va-status-text">{statusLabel}</span>
        <span className="va-status-sub">{subLabel}</span>
      </div>

      {/* Orb */}
      <div className="va-orb-wrap">
        {/* Outer reactive rings */}
        <div className="va-ring va-ring-3" style={{ transform: `scale(${ringScale3})`, opacity: isActive ? 0.25 + amplitude * 0.4 : 0.15 }} />
        <div className="va-ring va-ring-2" style={{ transform: `scale(${ringScale2})`, opacity: isActive ? 0.40 + amplitude * 0.4 : 0.2 }} />
        <div className="va-ring va-ring-1" style={{ transform: `scale(${ringScale1})`, opacity: isActive ? 0.55 + amplitude * 0.35 : 0.3 }} />

        {/* Rotating gradient halo */}
        <div className="va-halo" />

        {/* Core button */}
        <button
          className="va-orb"
          onClick={handleMicClick}
          disabled={isThinking}
          aria-label={statusLabel}
          style={{ transform: `scale(${ampScale})` }}
        >
          {/* Inner glass + glow */}
          <div className="va-orb-glass" />
          <div className="va-orb-glow" />
          <div className="va-orb-icon">
            {isThinking ? <IconSpinner /> : status === STATES.LISTENING ? <IconStop /> : <IconMic />}
          </div>
        </button>

        {/* Orbiting particles */}
        <div className="va-orbit va-orbit-1"><span /></div>
        <div className="va-orbit va-orbit-2"><span /></div>
        <div className="va-orbit va-orbit-3"><span /></div>
      </div>

      {/* Equalizer bars when active */}
      {isActive && (
        <div className="va-eq">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} style={{
              height: `${10 + Math.abs(Math.sin((Date.now() / 200) + i * 0.7)) * (12 + amplitude * 40)}px`,
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      )}

      {/* Transcript card */}
      {transcript && (
        <div className="va-card va-card-user">
          <div className="va-card-head">
            <span className="va-tag">USER</span>
            <span className="va-card-bar" />
          </div>
          <p>{transcript}</p>
        </div>
      )}

      {/* AI response card */}
      {response && (
        <div className={`va-card va-card-ai${ttsLoading ? " va-card-loading" : ""}`}>
          <div className="va-card-head">
            <span className="va-tag va-tag-ai">KYLE</span>
            {ttsLoading && (
              <span className="va-card-loading-tag">
                <span className="va-load-dot" />
                <span className="va-load-dot" />
                <span className="va-load-dot" />
                <span className="va-load-text">VOICE INCOMING</span>
              </span>
            )}
            <span className="va-card-bar" />
          </div>
            <p className="va-typewriter-text">
              {typewriter}
              {ttsLoading && <span className="va-tw-cursor" />}
            </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="va-card va-card-err">
          <div className="va-card-head">
            <span className="va-tag va-tag-err">ERROR</span>
            <span className="va-card-bar" />
          </div>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
