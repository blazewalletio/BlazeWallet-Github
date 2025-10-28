'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Sparkles, 
  Flame, 
  History, 
  Settings 
} from 'lucide-react';

export type TabType = 'wallet' | 'ai' | 'blaze' | 'history' | 'settings';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const [isPWA, setIsPWA] = useState(false);

  // Detect if running as PWA
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPWA(isStandalone);
    }
  }, []);

  const tabs = [
    {
      id: 'wallet' as TabType,
      label: 'Wallet',
      icon: Wallet,
    },
    {
      id: 'ai' as TabType,
      label: 'AI Tools',
      icon: Sparkles,
    },
    {
      id: 'blaze' as TabType,
      label: 'Blaze',
      icon: Flame,
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: History,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-lg ${
      isPWA ? 'pb-safe' : 'pb-2'
    }`}>
      <div className={`max-w-4xl mx-auto px-3 ${isPWA ? 'py-3' : 'py-2'}`}>
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center ${
                  isPWA ? 'py-3 px-4' : 'py-2 px-3'
                } rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                  isActive 
                    ? 'text-primary-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <Icon 
                    className={`${isPWA ? 'w-6 h-6' : 'w-5 h-5'} transition-colors duration-200 ${
                      isActive ? 'text-primary-600' : 'text-gray-500'
                    }`} 
                  />
                  
                  {/* Active indicator */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-1 -right-1 w-2 h-2 bg-primary-600 rounded-full"
                      />
                    )}
                  </AnimatePresence>
                </div>
                
                <span className={`${isPWA ? 'text-[11px] sm:text-xs' : 'text-[10px]'} font-medium ${
                  isPWA ? 'mt-1.5' : 'mt-1'
                } transition-colors duration-200 ${
                  isActive ? 'text-primary-600' : 'text-gray-500'
                }`}>
                  {tab.label}
                </span>
                
                {/* Active background */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 bg-primary-50 rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
