/**
 * Modal Component
 * 
 * Standardized modal wrapper with consistent styling and animations.
 * Provides proper accessibility attributes and keyboard handling.
 * 
 * @example
 * <Modal isOpen={isOpen} onClose={onClose} title="My Modal">
 *   <p>Modal content goes here</p>
 * </Modal>
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { designSystem } from '@/lib/design-system';

const { spacing, radius, shadows, focusRing, cn } = designSystem;

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Callback when modal should close
   */
  onClose: () => void;
  
  /**
   * Modal title
   */
  title?: string;
  
  /**
   * Modal subtitle/description
   */
  subtitle?: string;
  
  /**
   * Icon to display in header
   */
  icon?: ReactNode;
  
  /**
   * Modal content
   */
  children: ReactNode;
  
  /**
   * Footer content (buttons, actions)
   */
  footer?: ReactNode;
  
  /**
   * Maximum width of modal
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  
  /**
   * Custom className for modal container
   */
  className?: string;
  
  /**
   * Whether clicking backdrop closes modal
   */
  closeOnBackdropClick?: boolean;
  
  /**
   * Whether to show close button
   */
  showCloseButton?: boolean;
}

/**
 * Modal component
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'md',
  className,
  closeOnBackdropClick = true,
  showCloseButton = true,
}: ModalProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full',
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            aria-hidden="true"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full',
                maxWidthClasses[maxWidth],
                'max-h-[90vh]',
                'overflow-y-auto',
                'bg-white',
                radius.lg,
                'border border-gray-200',
                shadows.lg,
                'pointer-events-auto',
                className
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              aria-describedby={subtitle ? 'modal-description' : undefined}
            >
              {/* Header */}
              {(title || icon || showCloseButton) && (
                <div className={cn(
                  'sticky top-0',
                  'bg-white',
                  'border-b border-gray-200',
                  spacing.modalPadding.header,
                  'flex justify-between items-center',
                  radius.lg,
                  'rounded-b-none'
                )}>
                  <div className="flex items-center gap-3">
                    {icon && (
                      <div className="flex-shrink-0" aria-hidden="true">
                        {icon}
                      </div>
                    )}
                    <div>
                      {title && (
                        <h2 id="modal-title" className="text-2xl font-bold text-gray-900">
                          {title}
                        </h2>
                      )}
                      {subtitle && (
                        <p id="modal-description" className="text-sm text-gray-600 mt-1">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className={cn(
                        'text-gray-600 hover:text-gray-900',
                        'transition-colors',
                        focusRing.default,
                        'rounded-lg p-2'
                      )}
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Body */}
              <div className={spacing.modalPadding.body}>
                {children}
              </div>
              
              {/* Footer */}
              {footer && (
                <div className={cn(
                  'sticky bottom-0',
                  'bg-white',
                  'border-t border-gray-200',
                  spacing.modalPadding.footer,
                  radius.lg,
                  'rounded-t-none'
                )}>
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default Modal;

