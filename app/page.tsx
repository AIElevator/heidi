'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Theme = 'linen' | 'rose' | 'light' | 'dark';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'linen', label: 'Warm Linen' },
  { value: 'rose', label: 'Dusky Rose' },
  { value: 'light', label: 'Soft Daylight' },
  { value: 'dark', label: 'Warm Dusk' },
];

const STARTERS = [
  "I'm not sure where to start. Things feel quite overwhelming right now.",
  "Something happened recently that I keep replaying in my mind.",
  "I feel as though I'm losing myself within this relationship.",
  "I've noticed a pattern in my life but I'm struggling to find the words for it.",
];

const MOODS: { emoji: string; label: string; message: string }[] = [
  { emoji: '😰', label: 'Overwhelmed', message: "I'm feeling completely overwhelmed right now and I'm not sure where to start." },
  { emoji: '😟', label: 'Anxious', message: "I've been feeling anxious about the situation and it's hard to think clearly." },
  { emoji: '😔', label: 'Sad', message: "I'm feeling really sad today. It's been sitting with me." },
  { emoji: '😕', label: 'Confused', message: "I feel confused and unsure about everything. Nothing makes sense." },
  { emoji: '😶', label: 'Numb', message: "I feel kind of numb, like I can't connect to my own feelings." },
  { emoji: '😠', label: 'Angry', message: "I'm feeling angry, though I'm not sure what to do with that anger." },
  { emoji: '💔', label: 'Hurt', message: "I'm feeling very hurt. I just wanted to name that first." },
  { emoji: '🌱', label: 'Hopeful', message: "I'm cautiously hopeful today, which feels different. I want to explore that." },
  { emoji: '💪', label: 'Stronger', message: "I'm feeling stronger than I have in a while, and I want to understand why." },
  { emoji: '😌', label: 'Okay', message: "I'm okay — not great, but okay. I wanted to talk some things through." },
];

const CRISIS_KEYWORDS = [
  'hurt myself', 'harm myself', 'kill myself', 'end it', "can't go on",
  'not safe', 'he hurts me', 'he hits me', 'scared of him', 'afraid of him',
  'trapped', "can't leave", 'controlling my money', "won't let me",
  'he threatens', 'suicide', 'self harm', 'self-harm', 'in danger',
];

function hasCrisisKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(k => lower.includes(k));
}

function formatContent(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;
    // Italic paragraph (Heidi's psychology note)
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      const inner = trimmed.slice(1, -1);
      return (
        <p key={i} style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', marginTop: '0.75rem', fontSize: '0.9375rem' }}>
          {inner}
        </p>
      );
    }
    // Handle single newlines within a paragraph
    const lines = trimmed.split('\n');
    return (
      <p key={i} style={{ marginBottom: i < paragraphs.length - 1 ? '0.75rem' : 0 }}>
        {lines.map((line, j) => (
          <span key={j}>
            {line}
            {j < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }).filter(Boolean) as React.ReactNode[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [theme, setTheme] = useState<Theme>('linen');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showMoodPanel, setShowMoodPanel] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasStarted = useRef(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Close theme picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const streamResponse = useCallback(async (messagesToSend: Message[]) => {
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      if (!response.ok || !response.body) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setStreamingContent(content);
      }

      setMessages(prev => [...prev, { role: 'assistant', content }]);
      setStreamingContent('');
    } catch {
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
    }
  }, []);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      streamResponse([]);
    }
  }, [streamResponse]);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;

    if (hasCrisisKeyword(messageText)) setShowCrisis(true);

    const userMessage: Message = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await streamResponse(newMessages);
  }, [input, isStreaming, messages, streamResponse]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const handleMoodConfirm = () => {
    if (selectedMood !== null) {
      setInput(MOODS[selectedMood].message);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
    setShowMoodPanel(false);
    setSelectedMood(null);
  };

  const quickExit = () => {
    window.location.replace('https://www.bbc.co.uk/weather');
  };

  const currentThemeLabel = THEMES.find(t => t.value === theme)?.label ?? 'Theme';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid var(--color-divider)',
          backgroundColor: 'var(--color-bg)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        {/* Brand */}
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-lora), Georgia, serif',
              fontSize: '1.375rem',
              color: 'var(--color-text)',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
            }}
          >
            Heidi
          </h1>
          <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '1px' }}>
            Private &amp; confidential
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Mood check-in */}
          <button
            onClick={() => setShowMoodPanel(true)}
            title="How are you feeling?"
            style={headerBtnStyle}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Theme picker */}
          <div ref={themePickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowThemePicker(v => !v)}
              title="Change theme"
              style={{ ...headerBtnStyle, fontSize: '0.6875rem', letterSpacing: '0.04em', width: 'auto', padding: '0 0.625rem', gap: '0.3rem', display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              {currentThemeLabel}
            </button>
            {showThemePicker && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-divider)',
                borderRadius: '0.625rem',
                overflow: 'hidden',
                minWidth: '160px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 30,
              }}>
                {THEMES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setTheme(t.value); setShowThemePicker(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      color: theme === t.value ? 'var(--color-accent)' : 'var(--color-text)',
                      fontWeight: theme === t.value ? 500 : 400,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick exit */}
          <button
            onClick={quickExit}
            title="Leave quickly"
            style={{
              ...headerBtnStyle,
              backgroundColor: 'var(--color-crisis-btn)',
              color: '#fff',
              fontSize: '0.6875rem',
              letterSpacing: '0.04em',
              width: 'auto',
              padding: '0 0.75rem',
              borderRadius: '9999px',
            }}
          >
            Leave quickly
          </button>
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Crisis banner */}
          {showCrisis && (
            <div style={{
              backgroundColor: 'var(--color-crisis-bg)',
              border: '1px solid var(--color-crisis-border)',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-crisis-text)', marginBottom: '0.375rem' }}>
                You are not alone
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-crisis-text)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                If you feel unsafe, support is available right now.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <a href="tel:08082000247" style={crisisLinkStyle}>National DA Helpline: 0808 2000 247</a>
                <a href="tel:116123" style={crisisLinkStyle}>Samaritans: 116 123</a>
                <a href="tel:999" style={crisisLinkStyle}>Emergency: 999</a>
              </div>
            </div>
          )}

          {/* Welcome state — shown before opening message arrives */}
          {messages.length === 0 && !isStreaming && (
            <div style={{ textAlign: 'center', paddingBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-lora), Georgia, serif', fontSize: '1.375rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                This is your space
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', lineHeight: 1.7, maxWidth: '38ch', margin: '0 auto' }}>
                Whatever brings you here, Heidi is here to listen — without judgment and in complete confidence.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '1.5rem',
              }}
            >
              {message.role === 'assistant' ? (
                <div
                  style={{
                    fontFamily: 'var(--font-lora), Georgia, serif',
                    fontSize: '1.0625rem',
                    lineHeight: 1.85,
                    color: 'var(--color-text)',
                    fontWeight: 400,
                    maxWidth: '100%',
                  }}
                >
                  {formatContent(message.content)}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--color-user-bubble)',
                    borderRadius: '1.125rem',
                    padding: '0.625rem 1rem',
                    maxWidth: 'min(480px, 85%)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.content}
                </div>
              )}
            </div>
          ))}

          {/* Starters — shown after Heidi's opening, before user has replied */}
          {messages.length === 1 && messages[0].role === 'assistant' && !isStreaming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '420px', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                Please click on one of the boxes or respond in the chat box at the bottom.
              </p>
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '0.75rem 1.125rem',
                    borderRadius: '9999px',
                    border: '1px solid var(--color-divider)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    lineHeight: 1.5,
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.borderColor = 'var(--color-accent)';
                    (e.target as HTMLButtonElement).style.color = 'var(--color-text)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.borderColor = 'var(--color-divider)';
                    (e.target as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  fontFamily: 'var(--font-lora), Georgia, serif',
                  fontSize: '1.0625rem',
                  lineHeight: 1.85,
                  color: 'var(--color-text)',
                  fontWeight: 400,
                }}
              >
                {formatContent(streamingContent)}
              </div>
            </div>
          )}

          {/* Thinking dots */}
          {isStreaming && !streamingContent && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', height: '1.75rem', marginBottom: '1.5rem' }}>
              {[0, 150, 300].map(delay => (
                <span
                  key={delay}
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-text-faint)',
                    animation: 'bounce 1.2s ease-in-out infinite',
                    animationDelay: `${delay}ms`,
                  }}
                />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input area */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'var(--color-bg)',
          borderTop: '1px solid var(--color-divider)',
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0.875rem 1.25rem 0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Whenever you're ready, share what's on your mind..."
              disabled={isStreaming}
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                borderRadius: '0.875rem',
                padding: '0.625rem 0.875rem',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1.5px solid transparent',
                outline: 'none',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--color-accent)';
                e.target.style.boxShadow = '0 0 0 3px var(--color-accent-focus)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'transparent';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isStreaming || !input.trim()}
              style={{
                borderRadius: '0.875rem',
                padding: '0.625rem 1.125rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isStreaming || !input.trim() ? 0.4 : 1,
                flexShrink: 0,
                transition: 'opacity 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              Send
            </button>
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-faint)', textAlign: 'center', marginTop: '0.5rem' }}>
            What you share here is entirely confidential and visible only to you &middot; Enter to send &middot; Shift+Enter for a new line
          </p>
        </div>
      </div>

      {/* Mood panel */}
      {showMoodPanel && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowMoodPanel(false); setSelectedMood(null); } }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              borderRadius: '1.25rem',
              padding: '2rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-lora), Georgia, serif',
                fontSize: '1.25rem',
                color: 'var(--color-text)',
                marginBottom: '0.375rem',
              }}
            >
              How are you feeling right now?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              There is no right answer. This helps Heidi meet you where you are.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {MOODS.map((mood, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMood(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.625rem 0.25rem',
                    borderRadius: '0.625rem',
                    border: `1.5px solid ${selectedMood === i ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                    backgroundColor: selectedMood === i ? 'var(--color-surface)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>{mood.emoji}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{mood.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleMoodConfirm}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                fontSize: '0.9375rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {selectedMood !== null ? 'Use this to start' : 'Skip'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        textarea::placeholder { color: var(--color-text-faint); }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
      `}</style>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.5rem',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, color 0.15s ease',
  fontFamily: 'inherit',
};

const crisisLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.375rem 0.75rem',
  borderRadius: '9999px',
  backgroundColor: 'var(--color-crisis-btn)',
  color: '#fff',
  fontSize: '0.8125rem',
  fontWeight: 500,
};
