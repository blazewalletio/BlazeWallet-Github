'use client';

import { useState, useEffect } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Key, CheckCircle, AlertCircle, Eye, EyeOff, Flame } from 'lucide-react';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { logger } from '@/lib/logger';

interface AISettingsModalProps {
  onClose: () => void;
}

export default function AISettingsModal({ onClose }: AISettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Block body scroll when overlay is open (always open when component renders)
  useBlockBodyScroll(true);

  useEffect(() => {
    const existingKey = aiService.getApiKey();
    if (existingKey) {
      setHasExistingKey(true);
      setApiKey(existingKey);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      aiService.setApiKey(apiKey.trim());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    }
  };

  const handleClear = () => {
    setApiKey('');
    aiService.setApiKey('');
    setHasExistingKey(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai_api_key');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Settings</h2>
                <p className="text-sm text-gray-600">
                  Configure your AI-powered features
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {/* API Key Section */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">OpenAI API Key</h3>
                  <p className="text-sm text-gray-600">
                    Enable advanced AI features
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 leading-relaxed">
                For advanced AI functions like conversational assistant and improved command parsing.
                Basic features work without an API key.
              </p>
              
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 pr-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center transition-colors border border-gray-200"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>

              {hasExistingKey && (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>API key is saved</span>
                </div>
              )}

              <div className="flex gap-3">
                {apiKey && (
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    Remove key
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  {saved ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    'Save API key'
                  )}
                </button>
              </div>
            </div>

            {/* How to get API key */}
            <div className="glass-card p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                How to get an API key
              </h4>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">platform.openai.com/api-keys</a></li>
                <li>Create an account or log in</li>
                <li>Click "Create new secret key"</li>
                <li>Copy the key and paste it above</li>
              </ol>
            </div>

            {/* AI Features Status */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 text-lg">AI Features</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Transaction Assistant</span>
                  <span className="text-xs text-green-600 font-semibold">✓ Active (offline mode)</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Scam Detector</span>
                  <span className="text-xs text-green-600 font-semibold">✓ Active (basic)</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Portfolio Advisor</span>
                  <span className="text-xs text-green-600 font-semibold">✓ Active</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Gas Optimizer</span>
                  <span className="text-xs text-green-600 font-semibold">✓ Active</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Conversational AI</span>
                  <span className={`text-xs font-semibold ${hasExistingKey ? 'text-green-600' : 'text-yellow-600'}`}>
                    {hasExistingKey ? '✓ Fully active' : '⚠ Basic mode (API key needed)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="glass-card p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-orange-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">🔒 Privacy & Security</h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                Your API key is only stored locally in your browser. 
                We never send your private keys or sensitive wallet data to AI services.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
