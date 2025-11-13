'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { logger } from '@/lib/logger';

interface ParticleEffectProps {
  trigger: boolean;
  type?: 'success' | 'celebration' | 'error';
}

export default function ParticleEffect({ trigger, type = 'success' }: ParticleEffectProps) {
  useEffect(() => {
    if (!trigger) return;

    const duration = 2000;
    const animationEnd = Date.now() + duration;

    if (type === 'success') {
      // Success confetti - clean and elegant
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10B981', '#34D399', '#6EE7B7'],
        ticks: 200,
      });
    } else if (type === 'celebration') {
      // Epic celebration - more particles
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 0,
        colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
      };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    } else if (type === 'error') {
      // Error shake effect - no confetti
      const element = document.body;
      element.style.animation = 'shake 0.5s';
      setTimeout(() => {
        element.style.animation = '';
      }, 500);
    }
  }, [trigger, type]);

  return null;
}

// Add shake animation to globals.css




