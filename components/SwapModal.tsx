'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: {
    fromToken?: string;
    toToken?: string;
    amount?: string;
  };
}

export default function SwapModal({ isOpen, onClose, prefillData }: SwapModalProps) {
  useBlockBodyScroll(isOpen);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Empty - Ready for implementation */}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
