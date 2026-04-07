import { useState } from "react";

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
  variant
}) {
  const seed = buildSeedMessage(mode, seedMessage);
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      text: seed
    }
  ]);
  const [input, setInput] = useState("");

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
    <div className="panel chat-panel">
    <div className={`panel chat-panel ${variant ? `chat-panel--${variant}` : ""}`.trim()}>
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
        <span className={`pill ${mode === "risk" ? "warning" : "safe"}`}>
          {mode === "risk" ? "Analysis" : "Guidance"}
        </span>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat ${message.role}`}>
            <span>{message.text}</span>
          </div>
        ))}
        {loading && <div className="chat assistant">Thinking...</div>}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder || "Ask a question"}
        />
        <button type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
