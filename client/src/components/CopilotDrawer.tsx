import React, { useState } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Loader2,
  CornerDownLeft
} from 'lucide-react';
import { api } from '../api';

interface CopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  open,
  onClose,
  onNavigate
}) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'copilot'; text: string; data?: any }>>([
    {
      sender: 'copilot',
      text: "👋 Hi Sneha! I'm your SocialManager AI Copilot. I have live access to your database state, scheduled posts, comments, and calling leads. How can I assist your operations today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const samplePrompts = [
    "What happened today?",
    "Which posts failed?",
    "Show unanswered comments",
    "Which leads are most interested?"
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { sender: 'user' as const, text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askCopilot(text);
      setMessages(prev => [...prev, {
        sender: 'copilot',
        text: res.reply,
        data: res.groundedData
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        sender: 'copilot',
        text: `Error reaching Copilot: ${err.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200">
        {/* Header */}
        <div className="h-16 border-b border-slate-100 px-5 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Operations AI Copilot</h3>
              <p className="text-[10px] text-slate-500 font-medium">Grounded in verified SQLite data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m, idx) => (
            <div 
              key={idx} 
              className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'copilot' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div 
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Analyzing live database state...</span>
            </div>
          )}
        </div>

        {/* Suggested Quick Prompts */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Inquiries</p>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-slate-600 transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask Copilot anything about your channels, leads, or posts..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
