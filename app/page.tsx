'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const streamResponse = useCallback(async (messagesToSend: Message[]) => {
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Request failed');
      }

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F3EE' }}>

      {/* Header */}
      <header className="text-center pt-10 pb-6 px-6 shrink-0">
        <h1
          className="text-3xl tracking-wide"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif', color: '#2E2A28' }}
        >
          Heidi
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7A726D' }}>
          A private space, just for you
        </p>
        <p
          className="text-xs mt-3 max-w-sm mx-auto leading-relaxed"
          style={{ color: '#7A726D' }}
        >
          This conversation is private. Heidi won&apos;t remember it after you close the window.
        </p>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-4 pb-8 space-y-8">

          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : ''}>
              {message.role === 'assistant' ? (
                <p
                  className="text-lg leading-relaxed whitespace-pre-wrap"
                  style={{
                    fontFamily: 'var(--font-lora), Georgia, serif',
                    color: '#2E2A28',
                  }}
                >
                  {message.content}
                </p>
              ) : (
                <div
                  className="rounded-2xl px-5 py-3 max-w-xs sm:max-w-sm md:max-w-md"
                  style={{ backgroundColor: '#EDE8E1' }}
                >
                  <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#2E2A28' }}>
                    {message.content}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Streaming assistant message */}
          {isStreaming && streamingContent && (
            <p
              className="text-lg leading-relaxed whitespace-pre-wrap"
              style={{
                fontFamily: 'var(--font-lora), Georgia, serif',
                color: '#2E2A28',
              }}
            >
              {streamingContent}
            </p>
          )}

          {/* Thinking dots */}
          {isStreaming && !streamingContent && (
            <div className="flex gap-1.5 items-center h-7">
              <span
                className="inline-block w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: '#7A726D', animationDelay: '0ms' }}
              />
              <span
                className="inline-block w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: '#7A726D', animationDelay: '150ms' }}
              />
              <span
                className="inline-block w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: '#7A726D', animationDelay: '300ms' }}
              />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div
        className="sticky bottom-0 shrink-0"
        style={{ backgroundColor: '#F7F3EE', borderTop: '1px solid #EDE8E1' }}
      >
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Tell Heidi what's on your mind…"
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-xl px-4 py-3 leading-relaxed focus:outline-none disabled:opacity-50"
              style={{
                backgroundColor: '#EDE8E1',
                color: '#2E2A28',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="rounded-xl px-5 py-3 font-medium transition-opacity shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7B9E87', color: '#ffffff' }}
            >
              Send
            </button>
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: '#7A726D' }}>
            Enter to send &middot; Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
