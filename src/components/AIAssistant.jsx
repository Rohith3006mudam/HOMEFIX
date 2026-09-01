import { useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { askHomefixAI } from "../services/ai";

const GREETING = {
  customer: "Hi! Tell me what's wrong (e.g. \"my bathroom tap is leaking\") and I'll suggest a service and next steps.",
  employee: "Ask me for job guidance, service instructions, or how to summarize a customer issue.",
  admin: "Ask me for a summary of bookings, support tickets, or platform trends.",
};

// Calls the existing Supabase Edge Function (AI_EDGE_FUNCTION.ts). The AI
// provider secret never reaches the browser - see src/services/ai.js.
export default function AIAssistant({ role = "customer", profile }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: GREETING[role] || GREETING.customer },
  ]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      const reply = await askHomefixAI(text, { role, name: profile?.full_name || null });
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err.message || "AI assistant is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="ai-launcher" onClick={() => setOpen(true)}>
        <Bot size={18} /> HOMEFIX AI
      </button>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span><Bot size={16} /> HOMEFIX AI Assistant</span>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close AI assistant"><X size={16} color="#fff" /></button>
      </div>
      <div className="ai-panel-body">
        {messages.map((message, index) => (
          <div key={index} className={`ai-msg ${message.role}`}>{message.text}</div>
        ))}
        {error && <div className="ai-msg assistant">{error}</div>}
        {busy && <div className="ai-msg assistant">Thinking...</div>}
      </div>
      <div className="ai-panel-footer">
        <input
          value={input}
          placeholder="Describe your issue..."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && send()}
        />
        <button onClick={send} disabled={busy} aria-label="Send"><Send size={16} /></button>
      </div>
    </div>
  );
}
