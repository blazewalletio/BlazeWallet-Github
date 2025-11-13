'use client';

import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';

interface BlazeLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function BlazeLogo({ size = 48, animate = true, className = '' }: BlazeLogoProps) {
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
        <linearGradient id="blazeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Main Flame */}
      <motion.path
        d="M 50 20 L 50 75 M 35 40 L 50 60 M 65 40 L 50 60 M 40 55 L 50 70 M 60 55 L 50 70"
        stroke="url(#blazeGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow)"
        variants={animate ? pathVariants : undefined}
        initial={animate ? "hidden" : undefined}
        animate={animate ? "visible" : undefined}
      />
      
      {/* Secondary Flame (subtle) */}
      <motion.path
        d="M 50 25 L 50 70"
        stroke="url(#blazeGradient)"
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
export function BlazeIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
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
        <linearGradient id="blazeGradientStatic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path
        d="M 50 20 L 50 75 M 35 40 L 50 60 M 65 40 L 50 60"
        stroke="url(#blazeGradientStatic)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
