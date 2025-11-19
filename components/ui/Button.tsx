/**
 * Button Component
 * 
 * Standardized button with consistent styling, variants, and accessibility.
 * Use this instead of raw <button> elements for consistency.
 * 
 * @example
 * <Button variant="primary">Click me</Button>
 * <Button variant="secondary" size="sm">Small button</Button>
 * <Button variant="success" icon={<Check />}>Success</Button>
 */

'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { designSystem } from '@/lib/design-system';

const { colors, spacing, radius, focusRing, animations, cn } = designSystem;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant of the button
   */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'buy' | 'send' | 'receive';
  
  /**
   * Size of the button
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Icon to display before the text
   */
  icon?: ReactNode;
  
  /**
   * Icon to display after the text
   */
  iconAfter?: ReactNode;
  
  /**
   * Loading state
   */
  isLoading?: boolean;
  
  /**
   * Full width button
   */
  fullWidth?: boolean;
  
  /**
   * Custom className to override/extend styles
   */
  className?: string;
  
  /**
   * Button content
   */
  children?: ReactNode;
}

/**
 * Get variant-specific classes
 */
function getVariantClasses(variant: ButtonProps['variant']): string {
  const variants = {
    primary: `bg-gradient-to-r ${colors.brand.primary} hover:${colors.brand.primaryHover} text-white shadow-lg hover:shadow-xl`,
    secondary: `bg-gradient-to-r ${colors.brand.secondary} hover:${colors.brand.secondaryHover} text-white shadow-lg hover:shadow-xl`,
    success: `${colors.semantic.success} hover:bg-emerald-600 text-white shadow-md hover:shadow-lg`,
    warning: `${colors.semantic.warning} hover:bg-amber-600 text-white shadow-md hover:shadow-lg`,
    danger: `${colors.semantic.error} hover:bg-red-600 text-white shadow-md hover:shadow-lg`,
    ghost: `bg-transparent hover:bg-gray-100 ${colors.neutral.text.primary} border-2 border-gray-200 hover:border-gray-300`,
    buy: `bg-gradient-to-br ${colors.semantic.buy} hover:${colors.semantic.buyHover} text-white shadow-lg hover:shadow-xl`,
    send: `bg-gradient-to-br ${colors.semantic.send} hover:${colors.semantic.sendHover} text-white shadow-lg hover:shadow-xl`,
    receive: `bg-gradient-to-br ${colors.semantic.receive} hover:${colors.semantic.receiveHover} text-white shadow-lg hover:shadow-xl`,
  };
  
  return variants[variant || 'primary'];
}

/**
 * Get size-specific classes
 */
function getSizeClasses(size: ButtonProps['size']): string {
  const sizes = {
    sm: `${spacing.buttonPadding.sm} text-sm`,
    md: `${spacing.buttonPadding.md} text-sm md:text-base`,
    lg: `${spacing.buttonPadding.lg} text-base md:text-lg`,
  };
  
  return sizes[size || 'md'];
}

/**
 * Button component
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconAfter,
      isLoading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      // Layout
      'inline-flex items-center justify-center gap-2',
      fullWidth && 'w-full',
      
      // Shape & spacing
      radius.md,
      getSizeClasses(size),
      
      // Typography
      'font-semibold',
      
      // Interactions
      focusRing.default,
      animations.transition.all,
      animations.duration.normal,
      animations.hover.brightness,
      
      // States
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'active:scale-95',
      
      // Variant
      getVariantClasses(variant),
      
      // Custom
      className
    );
    
    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        ) : icon ? (
          <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
        ) : null}
        
        {children}
        
        {iconAfter && !isLoading && (
          <span className="flex-shrink-0" aria-hidden="true">{iconAfter}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

