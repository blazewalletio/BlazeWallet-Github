'use client';

import { useState, useRef, useEffect } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2, AlertCircle, CheckCircle, ArrowLeft, Info, TrendingUp, Zap, AlertTriangle, Trash2, Mic, MessageCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AITransactionAssistantProps {
  onClose: () => void;
  context: {
    balance: string;
    tokens: any[];
    address: string;
    chain: string;
  };
  onExecuteAction?: (action: any) => void;
}

interface ConversationMessage {
  type: 'user' | 'assistant';
  content: string;
  response?: any;
  timestamp: Date;
}

export default function AITransactionAssistant({ 
  onClose, 
  context,
  onExecuteAction 
}: AITransactionAssistantProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const examples = [
    `Send 50 USDC to [address]`,
    `Swap 1 ${context.chain === 'ethereum' ? 'ETH' : context.chain === 'solana' ? 'SOL' : 'BTC'} to USDC`,
    `What is my portfolio worth?`,
    `Send all my USDT`,
  ];

  // Proactive warnings check
  const getProactiveWarnings = (response: any): string[] => {
    const warnings: string[] = [];
    
    // Check balance warnings
    if (response.action?.type === 'send' && response.action?.params?.amount) {
      const token = response.action.params.token || context.chain.toUpperCase();
      const tokenBalance = context.tokens.find(t => 
        t.symbol?.toLowerCase() === token.toLowerCase()
      );
      
      if (tokenBalance) {
        const amount = parseFloat(response.action.params.amount);
        const balance = parseFloat(tokenBalance.balance);
        
        if (amount > balance) {
          warnings.push(`⚠️ Insufficient balance! You have ${balance} ${token}, trying to send ${amount} ${token}`);
        } else if (amount > balance * 0.9) {
          warnings.push(`💡 You're sending ${((amount / balance) * 100).toFixed(0)}% of your ${token} balance`);
        }
      }
    }

    // Check gas fee warnings for expensive chains
    if (['ethereum', 'base', 'arbitrum'].includes(context.chain.toLowerCase())) {
      warnings.push(`⛽ Gas fees may be high on ${context.chain}. Consider using Polygon or Base for lower fees.`);
    }

    // Add any warnings from AI response
    if (response.warnings && Array.isArray(response.warnings)) {
      warnings.push(...response.warnings);
    }

    return warnings;
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const userMessage: ConversationMessage = {
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMessage]);
    setLoading(true);
    setCurrentResponse(null);
    setInput('');

    try {
      // Build conversation history for API (last 5 exchanges = 10 messages)
      const conversationHistory = conversation
        .slice(-10)
        .map(msg => ({
          role: msg.type,
          content: msg.content
        }));

      const result = await aiService.processTransactionCommand(input, {
        ...context,
        conversationHistory
      } as any); // ✅ Pass conversation history
      
      // Add proactive warnings
      const warnings = getProactiveWarnings(result);
      if (warnings.length > 0 && result.success) {
        result.warnings = warnings;
      }

      const assistantMessage: ConversationMessage = {
        type: 'assistant',
        content: result.message,
        response: result,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, assistantMessage]);
      setCurrentResponse(result);
    } catch (error) {
      const errorMessage: ConversationMessage = {
        type: 'assistant',
        content: 'Something went wrong. Please try again.',
        response: {
          success: false,
          message: 'Something went wrong. Please try again.',
          confidence: 0,
        },
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      // ✅ Auto-focus input after submit (mobile-friendly)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleExecute = async () => {
    if (currentResponse?.action && onExecuteAction) {
      setIsExecuting(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UX
        onExecuteAction(currentResponse.action);
        // onClose() is called in Dashboard after modal opens
      } catch (error) {
        logger.error('❌ [AI Assistant] Execute error:', error);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  const handleClearConversation = () => {
    setConversation([]);
    setCurrentResponse(null);
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6 pb-32">
          {/* Back Button */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
            >
              ← Back to Dashboard
            </button>

            {/* Clear conversation button (only show if there's conversation) */}
            {conversation.length > 0 && (
              <button
                onClick={handleClearConversation}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Clear conversation history"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Assistant</h2>
                <p className="text-sm text-gray-600">
                  Natural language transactions • Powered by GPT-4o-mini
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Welcome / Examples */}
            {conversation.length === 0 && (
              <>
                {/* Info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6"
                  >
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Zap className="w-5 h-5" />
                      <span className="text-sm font-semibold">Fast & Smart</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">90%</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Cached responses
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-card p-6"
                  >
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <TrendingUp className="w-5 h-5" />
                      <span className="text-sm font-semibold">18 Chains</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">All</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Addresses supported
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-6"
                  >
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                      <Info className="w-5 h-5" />
                      <span className="text-sm font-semibold">Proactive</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">AI</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Warns about risks
                    </div>
                  </motion.div>
                </div>

                {/* Examples */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Try these examples:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {examples.map((example, i) => (
                      <button
                        key={i}
                        onClick={() => handleExampleClick(example)}
                        className="text-left px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 border border-gray-200 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <MessageCircle className="w-4 h-4 mt-0.5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                          <span className="flex-1 group-hover:text-purple-600 transition-colors font-medium">
                            {example}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* How it Works */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-6 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">How AI Assistant Works</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Type natural language commands like "Send 50 USDC to 0x..." or "Swap 1 ETH to USDC". 
                    The AI will understand your intent, validate the transaction, warn you about potential risks, 
                    and help you execute it safely. Powered by GPT-4o-mini.
                  </p>
                </motion.div>
              </>
            )}

            {/* Conversation History */}
            {conversation.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'user' ? (
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white break-words overflow-wrap-anywhere shadow-lg shadow-purple-500/20">
                    {message.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] bg-white rounded-2xl rounded-tl-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {message.response?.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                        </div>
                      </div>

                      {/* Warnings */}
                      {message.response?.warnings && message.response.warnings.length > 0 && (
                        <div className="space-y-2">
                          {message.response.warnings.map((warning: string, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200"
                            >
                              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-yellow-900">{warning}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Confidence */}
                      {message.response?.confidence !== undefined && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>Confidence:</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all duration-300"
                              style={{ width: `${message.response.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-medium">
                            {(message.response.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* Execute button for last message */}
                      {index === conversation.length - 1 &&
                        message.response?.success &&
                        message.response?.action &&
                        message.response.action.type !== 'none' &&
                        message.response.action.type !== 'info' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleExecute}
                            disabled={isExecuting}
                            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Opening...
                              </>
                            ) : (
                              <>
                                Execute {message.response.action.type === 'send' ? 'Send' : 'Swap'}
                              </>
                            )}
                          </motion.button>
                        )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Fixed input at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto flex gap-3">
            {/* Voice button - Coming Soon */}
            <div className="relative group">
              <button
                disabled={true}
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-gray-300 cursor-not-allowed shadow-sm"
                title="Voice input coming soon"
              >
                <Mic className="w-5 h-5 text-gray-500" />
              </button>
              {/* Coming Soon Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Voice input coming soon
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                placeholder="Type your command..."
                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
