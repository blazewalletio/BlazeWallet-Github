'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { logger } from '@/lib/logger';

interface BlazeLogoImageProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function BlazeLogoImage({ size = 48, animate = true, className = '' }: BlazeLogoImageProps) {
  const containerVariants = {
    hidden: {
      scale: 0.8,
      opacity: 0,
      rotateY: -15,
    },
    visible: {
      scale: 1,
      opacity: 1,
      rotateY: 0,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20,
        duration: 0.8,
      },
    },
  };

  const glowVariants = {
    hidden: {
      scale: 0.9,
      opacity: 0,
    },
    visible: {
      scale: 1.1,
      opacity: 0.3,
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut",
      },
    },
  };

  const floatVariants = {
    hidden: {
      y: 0,
    },
    visible: {
      y: [-2, 2, -2],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Glow effect - positioned absolutely */}
      {animate && (
        <motion.div
          variants={glowVariants}
          initial="hidden"
          animate="visible"
          className="absolute bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-full blur-lg"
          style={{ 
            width: size + 30, 
            height: size + 30,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      )}
      
      {/* Main logo - NO BACKGROUND, NO CONTAINER */}
      <motion.div
        variants={animate ? containerVariants : undefined}
        initial={animate ? "hidden" : undefined}
        animate={animate ? "visible" : undefined}
        className="relative z-10"
      >
        <motion.div
          variants={animate ? floatVariants : undefined}
          initial={animate ? "hidden" : undefined}
          animate={animate ? "visible" : undefined}
          className="relative"
          style={{ width: size, height: size }}
        >
          <Image
            src="/blaze-logo.png"
            alt="Blaze Wallet Logo"
            width={size}
            height={size}
            className="rounded-xl shadow-2xl"
            priority
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
