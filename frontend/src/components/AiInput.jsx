import { useState, useRef, useEffect } from 'react';

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
);

export function AiInput({ messages, onSendMessage, backgroundText = "AI Input", placeholder = "Ask me anything..." }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, 'default_model');
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[60vh] bg-white relative rounded-b-2xl overflow-hidden border-t border-[var(--border-color)]">

      {/* Massive subtle watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
        <h1 className="text-[8vw] sm:text-[100px] font-black text-black opacity-[0.03] text-center leading-none tracking-tighter mix-blend-multiply whitespace-nowrap">
          {backgroundText}
        </h1>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <p>Super AI initialized. Ask a question regarding the context.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                <div
                  className={`max-w-[85%] px-5 py-3.5 text-[15px] leading-relaxed shadow-sm
                    ${isUser
                      ? 'bg-[var(--action-primary)] text-white rounded-2xl rounded-br-sm'
                      : 'bg-white border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl rounded-bl-sm'
                    }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Input Bar */}
      <div className="p-4 bg-white border-t border-[var(--border-color)] relative z-10">
        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-full px-4 py-2 focus-within:border-[var(--action-primary)] transition-colors shadow-sm">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-30 disabled:bg-[var(--border-color)] transition-all shrink-0 hover:scale-105"
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center mt-3 text-[11px] text-[var(--text-tertiary)]">
          AI may produce inaccurate information about the context.
        </p>
      </div>
    </div>
  );
}
