import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { textToSpeech, speechToText } from "../api.js";

const IconMic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const IconVolume = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);



const buildSeedMessage = (mode, seedMessage) => {
  if (seedMessage) return seedMessage;
  return mode === "risk"
    ? "Hi! How can I assist you today?"
    : "Hello! Feel free to ask me anything about home safety or monitoring.";
};

export default function ChatPanel({
  onSend,
  loading,
  mode,
  title,
  subtitle,
  seedMessage,
  placeholder,
  variant,
  fullHeight,
  readings = [], // Default to empty array
  alerts = [],   // Default to empty array
    summary = null, // Default to null
    messages: messagesProp,
    onMessagesChange
}) {
  const seed = buildSeedMessage(mode, seedMessage);
    const [internalMessages, setInternalMessages] = useState(() => [
      {
        role: "assistant",
        text: seed
      }
    ]);
    const messages = messagesProp ?? internalMessages;
    const setMessages = onMessagesChange ?? setInternalMessages;
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const quickPrompts =
    mode === "risk"
      ? ["Summarize the current risk", "What should I check first?", "Is this safe to continue?"]
      : ["Suggest a beginner project", "List required materials", "Give me a step-by-step plan"];

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      // Always use AI with full sensor context - no hardcoded responses
      const response = await onSend({ message: trimmed, mode });

      const newMessage = { role: "assistant", text: response };
      setMessages((prev) => [...prev, newMessage]);

      // Automatically generate and play voice message
      const cleanResponse = stripMarkdown(response);
      const audioBlob = await textToSpeech(cleanResponse);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: error.message || "I'm sorry, Jude. I couldn't process that." }
      ]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        try {
          const transcription = await speechToText(audioBlob);
          setInput(transcription);
        } catch (error) {
          console.error("Speech-to-text error:", error);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stripMarkdown = (text) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** → bold
      .replace(/\*(.+?)\*/g, '$1')      // *italic* → italic
      .replace(/__(.+?)__/g, '$1')      // __bold__ → bold
      .replace(/_(.+?)_/g, '$1')        // _italic_ → italic
      .replace(/`(.+?)`/g, '$1')        // `code` → code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [link](url) → link
      .replace(/^#+\s+/gm, '')          // # headers → headers
      .trim();
  };

  const speakText = async (text) => {
    try {
      setIsSpeaking(true);
      const cleanText = stripMarkdown(text);
      const audioBlob = await textToSpeech(cleanText);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("Text-to-speech error:", error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  };

  return (
    <div className={`panel chat-panel`} style={fullHeight ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
      {variant && <div className={`chat-variant-bar ${variant}`}></div>}
      <div className="panel-header" style={{ paddingBottom: '12px', borderBottom: 'none', flexShrink: 0 }}>
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
        <span className={`pill ${mode === "risk" ? "warning" : "safe"}`}>
          {mode === "risk" ? "Analysis" : "Guidance"}
        </span>
      </div>
      <div className="quick-prompts" style={{ marginBottom: '12px', flexShrink: 0 }}>
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="quick-prompt"
            onClick={() => setInput(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="chat-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
            <ReactMarkdown>{message.text}</ReactMarkdown>
            {message.role === "assistant" && index > 0 && (
              <button
                onClick={() => isSpeaking ? stopSpeaking() : speakText(message.text)}
                className="voice-btn"
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: isSpeaking ? 'var(--danger)' : 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem'
                }}
                title={isSpeaking ? "Stop speaking" : "Read aloud"}
              >
                <IconVolume />
                {isSpeaking ? "Stop" : "Read aloud"}
              </button>
            )}
          </div>
        ))}
        {loading && <LoadingSteps />}
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit} style={{ marginTop: '12px', flexShrink: 0, display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className="voice-input-btn"
          style={{
            padding: '10px 14px',
            background: isRecording ? 'var(--danger)' : 'var(--panel-strong)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: isRecording ? 'white' : 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          <IconMic />
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder || "Ask a question"}
          style={{ flex: 1 }}
        />
        <button type="submit" className="chat-send-btn" disabled={loading}>
          Send
        </button>
      </form>
      <button
        type="button"
        className="mic-button"
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? "Stop" : "Record"}
      </button>
    </div>
  );
}
