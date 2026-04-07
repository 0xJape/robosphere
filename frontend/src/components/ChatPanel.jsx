import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const LoadingSteps = () => {
  const [step, setStep] = useState(0);
  const messages = [
    "Evaluating current system telemetry...",
    "Cross-referencing historical data models...",
    "Running predictive anomaly detection...",
    "Formulating an intelligent response..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, messages.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="chat-bubble thinking" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {messages.slice(0, step + 1).map((msg, idx) => (
        <span key={idx} className="thinking-dots" style={{ 
          opacity: idx === step ? 1 : 0.5,
          fontSize: '0.9em',
          transition: 'opacity 0.3s ease'
        }}>
          {msg}
        </span>
      ))}
    </div>
  );
};

const buildSeedMessage = (mode, seedMessage) => {
  if (seedMessage) return seedMessage;
  return mode === "risk"
    ? "Ask for a focused safety analysis of the latest readings."
    : "Ask for robotics ideas, materials, or step-by-step guidance.";
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
  fullHeight
}) {
  const seed = buildSeedMessage(mode, seedMessage);
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      text: seed
    }
  ]);
  const [input, setInput] = useState("");

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
      const response = await onSend({ message: trimmed, mode });
      setMessages((prev) => [...prev, { role: "assistant", text: response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: error.message || "Unable to respond." }
      ]);
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
          </div>
        ))}
        {loading && <LoadingSteps />}
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit} style={{ marginTop: '12px', flexShrink: 0 }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder || "Ask a question"}
        />
        <button type="submit" className="chat-send-btn" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
