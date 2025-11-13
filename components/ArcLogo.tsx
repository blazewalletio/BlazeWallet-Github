'use client';

import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';

interface ArcLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function ArcLogo({ size = 48, animate = true, className = '' }: ArcLogoProps) {
  const pathVariants = {
    hidden: {
      pathLength: 0,
      opacity: 0,
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          type: "spring",
          duration: 1.5,
          bounce: 0,
        },
        opacity: { duration: 0.5 },
      },
    },
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Main Arc */}
      <motion.path
        d="M 20 80 Q 50 20, 80 80"
        stroke="url(#arcGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow)"
        variants={animate ? pathVariants : undefined}
        initial={animate ? "hidden" : undefined}
        animate={animate ? "visible" : undefined}
      />
      
      {/* Secondary Arc (subtle) */}
      <motion.path
        d="M 25 75 Q 50 25, 75 75"
        stroke="url(#arcGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
        variants={animate ? pathVariants : undefined}
        initial={animate ? "hidden" : undefined}
        animate={animate ? "visible" : undefined}
        transition={animate ? { delay: 0.2 } : undefined}
      />
    </svg>
  );
}

// Simple static version for small icons
export function ArcIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="arcGradientStatic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M 20 80 Q 50 20, 80 80"
        stroke="url(#arcGradientStatic)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
