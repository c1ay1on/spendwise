import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api/client.js";
import "./AIAssistant.css";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm your SpendWise AI assistant. I can help you understand your spending, review your budget, and find ways to save money. What would you like to know?",
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();

    if (!message || isLoading) return;

    const previousMessages = messages;
    const updatedMessages = [
      ...previousMessages,
      { role: "user", content: message },
    ];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const history = previousMessages
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));

      const result = await api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, history }),
      });

      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.reply },
      ]);
    } catch (err) {
      setError(err.message || "Unable to contact the assistant.");
    } finally {
      setIsLoading(false);
    }
  }

  function startNewChat() {
    if (isLoading) return;
    setMessages([WELCOME]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="ai-assistant">
      {isOpen && (
        <section
          className="ai-chat-panel"
          aria-label="SpendWise AI assistant"
        >
          <header className="ai-chat-header">
            <div className="ai-chat-heading">
              <span className="ai-status-dot" />
              <div>
                <strong>SpendWise AI</strong>
                <small>Your personal finance assistant</small>
              </div>
            </div>

            <div className="ai-header-actions">
              <button
                type="button"
                className="ai-icon-button"
                onClick={startNewChat}
                disabled={isLoading}
                aria-label="Start a new chat"
                title="New chat"
              >
                ↻
              </button>
              <button
                type="button"
                className="ai-icon-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                title="Close"
              >
                ×
              </button>
            </div>
          </header>

          <div className="ai-chat-messages" aria-live="polite">
            {messages.map((item, index) => (
              <div
                className={`ai-message ai-message-${item.role}`}
                key={`${index}-${item.role}`}
              >
                <div className="ai-message-bubble">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
			{item.content.replace(/\\\|/g, "|")}
		  </ReactMarkdown>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="ai-message ai-message-assistant">
                <div className="ai-message-bubble ai-typing">
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="ai-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="ai-chat-form" onSubmit={handleSubmit}>
            <label className="ai-sr-only" htmlFor="ai-chat-input">
              Ask SpendWise AI
            </label>
            <textarea
              id="ai-chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your spending…"
              rows={1}
              maxLength={1200}
              disabled={isLoading}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className="ai-send-button"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              Send
            </button>
          </form>

          <footer className="ai-chat-footer">
            AI-generated guidance can be imperfect. Your data stays in
            SpendWise; avoid sharing passwords or sensitive credentials.
          </footer>
        </section>
      )}

      <button
        type="button"
        className="ai-launcher"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close SpendWise AI" : "Open SpendWise AI"}
        aria-expanded={isOpen}
      >
        {isOpen ? "×" : "Ask AI"}
      </button>
    </div>
  );
}
