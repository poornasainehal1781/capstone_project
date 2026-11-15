import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User, ArrowRight, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { aiApi } from '../../services/aiApi';

export const AICopilotDrawer = ({ isOpen, onClose, onNavigate }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: "Hello Store Manager! I am your SmartRetail AI Decision Assistant. I analyze your POS sales velocity, batch expiry dates, and supplier lead times in real-time. How can I assist floor operations today?",
      suggestions: [
        "Which products are low in stock?",
        "What were today's total sales?",
        "Which products sold the most this month?",
        "Which products need replenishment?",
        "How are sales performing?",
        "Which products are approaching expiry?"
      ],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [engineInfo, setEngineInfo] = useState(null);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    // Add user query
    const userMsg = { id: Date.now(), sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const history = messages.slice(-4).map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const res = await aiApi.sendChatMessage(query, history);
      setEngineInfo({ engine: res.engine, model: res.model_used, isFallback: res.is_fallback });

      // Determine navigation action from backend suggested actions
      let actionLabel = null;
      let actionPage = null;
      if (res.suggested_actions && res.suggested_actions.length > 0) {
        actionLabel = res.suggested_actions[0].label;
        actionPage = res.suggested_actions[0].target_page;
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: res.reply,
        actionLabel,
        actionPage,
        suggestions: [
          "What were today's total sales?",
          "Which products need replenishment?",
          "Which products are approaching expiry?"
        ].filter(s => s.toLowerCase() !== query.toLowerCase()),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          text: `⚠️ Query processing error: ${err.message}. Please verify staff login permissions.`,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 to-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-950/50">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">SmartRetail Copilot</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {engineInfo?.isFallback ? "RULE ENGINE" : "AI COPILOT"}
                  </span>
                </div>
                <p className="text-[11px] text-purple-300">Supermarket Floor Decision Advisor</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-purple-300" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-slate-800/80 border border-slate-700/80 text-slate-200 rounded-tl-none space-y-2.5'
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>

                  {msg.actionLabel && msg.actionPage && (
                    <button
                      onClick={() => {
                        onNavigate(msg.actionPage);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-semibold transition-colors mt-2"
                    >
                      <span>→ {msg.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Suggested queries:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSend(sug)}
                            className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-purple-950/60 hover:text-purple-200 border border-slate-700 text-slate-300 transition-colors"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-center text-xs text-purple-300">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Consulting retail intelligence telemetry...</span>
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputText);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about inventory, expiry markdowns, sales..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              Protected by RBAC • Grounded in real store PostgreSQL database
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
