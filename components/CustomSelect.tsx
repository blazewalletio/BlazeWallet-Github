'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  accentColor?: 'indigo' | 'blue' | 'orange' | 'green';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select...',
  className = '',
  accentColor = 'indigo'
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const accentColors = {
    indigo: {
      border: 'border-indigo-300',
      focusBorder: 'border-indigo-500',
      focusRing: 'ring-indigo-500/20',
      text: 'text-indigo-600',
      bg: 'bg-indigo-50',
      hoverBg: 'hover:bg-indigo-50'
    },
    blue: {
      border: 'border-blue-300',
      focusBorder: 'border-blue-500',
      focusRing: 'ring-blue-500/20',
      text: 'text-blue-600',
      bg: 'bg-blue-50',
      hoverBg: 'hover:bg-blue-50'
    },
    orange: {
      border: 'border-orange-300',
      focusBorder: 'border-orange-500',
      focusRing: 'ring-orange-500/20',
      text: 'text-orange-600',
      bg: 'bg-orange-50',
      hoverBg: 'hover:bg-orange-50'
    },
    green: {
      border: 'border-green-300',
      focusBorder: 'border-green-500',
      focusRing: 'ring-green-500/20',
      text: 'text-green-600',
      bg: 'bg-green-50',
      hoverBg: 'hover:bg-green-50'
    }
  };

  const colors = accentColors[accentColor];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-white border-2 rounded-xl text-sm font-semibold text-left
          transition-all cursor-pointer focus:outline-none focus:ring-2
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-50' : 'hover:border-gray-300'}
          ${isOpen ? `${colors.focusBorder} ${colors.focusRing}` : 'border-gray-200'}
          flex items-center justify-between gap-2
        `}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`
                      w-full px-4 py-3 text-left text-sm font-medium transition-colors
                      flex items-center justify-between gap-2
                      ${isSelected 
                        ? `${colors.bg} ${colors.text}` 
                        : `text-gray-900 ${colors.hoverBg}`
                      }
                    `}
                  >
                    <span>{option.label}</span>
                    {isSelected && (
                      <Check className={`w-4 h-4 ${colors.text}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

