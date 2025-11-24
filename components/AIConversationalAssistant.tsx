'use client';

import { useState, useRef, useEffect } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Loader2, ArrowLeft } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIConversationalAssistantProps {
  onClose: () => void;
  context?: any;
}

export default function AIConversationalAssistant({ 
  onClose,
  context 
}: AIConversationalAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! 👋 I\'m your personal crypto expert. Ask me anything about crypto, DeFi, or your wallet!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickQuestions = [
    "What is gas?",
    "What is slippage?",
    "Explain impermanent loss",
    "What are smart contracts?",
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiService.chat(messageText, context);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearConversation = () => {
    aiService.clearConversation();
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared! How can I help you?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-hidden flex flex-col"
      >
        <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="flex-shrink-0 p-6 pb-4">
            <button
              onClick={onClose} aria-label="Close modal"
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-orange-500" />
                  Crypto Expert
                </h2>
                <p className="text-gray-600">24/7 AI support chat</p>
              </div>
              <button
                onClick={handleClearConversation}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-sm text-gray-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Clear chat
              </button>
            </div>
          </div>

          {/* Chat Container - FIXED: Removed overflow-hidden to allow scrolling */}
          <div className="flex-1 px-6 pb-6 flex flex-col">
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
              {/* Messages - Scrollable area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <AnimatePresence mode="popLayout">
                  {messages.map((message, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white'
                            : 'bg-gray-50 text-gray-900 border border-gray-200'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-orange-500 font-medium">Crypto Expert</span>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                          {message.timestamp.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                        <span className="text-sm text-gray-600">Typing...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length === 1 && (
                <div className="flex-shrink-0 px-6 pb-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-3 mt-4 font-medium">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(question)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 border border-gray-200 transition-colors disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex-shrink-0 p-4 border-t border-gray-200">
                <div className="relative">
                  <input aria-label="Text input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask me a question..."
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  💡 Press Enter to send
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
