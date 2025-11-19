/**
 * Design System Constants
 * 
 * Centralized source of truth for spacing, colors, typography, shadows, etc.
 * Use these constants to ensure consistency across all components.
 */

// ========================================
// SPACING & LAYOUT
// ========================================

export const spacing = {
  // Gaps (for grids, flex containers)
  gap: {
    tight: 'gap-2',      // 8px - Inline elements, compact lists
    default: 'gap-3',    // 12px - Default cards, buttons
    loose: 'gap-4',      // 16px - Section spacing
    wide: 'gap-6',       // 24px - Major sections
    extraWide: 'gap-8',  // 32px - Page sections
  },
  
  // Padding (for containers, cards, modals)
  padding: {
    none: 'p-0',
    xs: 'p-2',           // 8px - Tight spacing
    sm: 'p-3',           // 12px - Compact cards
    md: 'p-4',           // 16px - Default cards
    lg: 'p-6',           // 24px - Modals, large cards
    xl: 'p-8',           // 32px - Page containers
  },
  
  // Button padding (standardized)
  buttonPadding: {
    sm: 'px-3 py-2',     // Small buttons
    md: 'px-4 py-3',     // Default buttons (mobile)
    lg: 'px-6 py-4',     // Large buttons (desktop CTAs)
  },
  
  // Modal padding (standardized)
  modalPadding: {
    header: 'px-6 py-4',  // Modal header
    body: 'p-6',          // Modal body
    footer: 'px-6 py-4',  // Modal footer
  },
} as const;

// ========================================
// COLORS & GRADIENTS
// ========================================

export const colors = {
  // Brand colors (Orange/Yellow primary)
  brand: {
    primary: 'from-orange-500 to-yellow-500',
    primaryHover: 'from-orange-600 to-yellow-600',
    secondary: 'from-rose-500 to-orange-500',
    secondaryHover: 'from-rose-600 to-orange-600',
    accent: 'from-orange-400 to-yellow-400',
  },
  
  // Semantic colors (actions, states)
  semantic: {
    // Financial/Money actions
    buy: 'from-emerald-500 to-teal-500',
    buyHover: 'from-emerald-600 to-teal-600',
    
    // Send/Outgoing (warm)
    send: 'from-rose-500 to-orange-500',
    sendHover: 'from-rose-600 to-orange-600',
    
    // Receive/Incoming (cool)
    receive: 'from-blue-500 to-cyan-500',
    receiveHover: 'from-blue-600 to-cyan-600',
    
    // Success
    success: 'bg-emerald-500',
    successText: 'text-emerald-600',
    successBg: 'bg-emerald-50',
    successBorder: 'border-emerald-200',
    
    // Warning
    warning: 'bg-amber-500',
    warningText: 'text-amber-600',
    warningBg: 'bg-amber-50',
    warningBorder: 'border-amber-200',
    
    // Error/Danger
    error: 'bg-red-500',
    errorText: 'text-red-600',
    errorBg: 'bg-red-50',
    errorBorder: 'border-red-200',
    
    // Info
    info: 'bg-blue-500',
    infoText: 'text-blue-600',
    infoBg: 'bg-blue-50',
    infoBorder: 'border-blue-200',
  },
  
  // Neutral colors
  neutral: {
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      tertiary: 'text-gray-500',
      disabled: 'text-gray-400',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-gray-50',
      tertiary: 'bg-gray-100',
    },
    border: {
      default: 'border-gray-200',
      light: 'border-gray-100',
      dark: 'border-gray-300',
    },
  },
} as const;

// ========================================
// TYPOGRAPHY
// ========================================

export const typography = {
  // Font sizes
  size: {
    xs: 'text-xs',       // 12px - Secondary info, captions
    sm: 'text-sm',       // 14px - Default body text
    base: 'text-base',   // 16px - Important body text
    lg: 'text-lg',       // 18px - Card titles, section headers
    xl: 'text-xl',       // 20px - Section titles
    '2xl': 'text-2xl',   // 24px - Modal titles
    '3xl': 'text-3xl',   // 30px - Page headers
    '4xl': 'text-4xl',   // 36px - Hero text
  },
  
  // Font weights
  weight: {
    normal: 'font-normal',     // 400
    medium: 'font-medium',     // 500
    semibold: 'font-semibold', // 600
    bold: 'font-bold',         // 700
  },
  
  // Common combinations
  heading: {
    page: 'text-3xl font-bold',       // Page headers
    modal: 'text-2xl font-bold',      // Modal titles
    section: 'text-xl font-semibold', // Section titles
    card: 'text-lg font-semibold',    // Card titles
  },
  
  body: {
    default: 'text-sm',               // Default body
    important: 'text-base',           // Important info
    secondary: 'text-xs',             // Secondary info
  },
} as const;

// ========================================
// BORDER RADIUS
// ========================================

export const radius = {
  none: 'rounded-none',
  sm: 'rounded-lg',      // 8px - Small elements
  md: 'rounded-xl',      // 12px - Default cards, buttons
  lg: 'rounded-2xl',     // 16px - Large cards, modals
  full: 'rounded-full',  // Pills, avatars
} as const;

// ========================================
// SHADOWS
// ========================================

export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-soft',       // Default cards - subtle
  md: 'shadow-soft-lg',    // Elevated cards
  lg: 'shadow-soft-xl',    // Modals, popovers
  xl: 'shadow-2xl',        // Maximum elevation
} as const;

// ========================================
// FOCUS STATES
// ========================================

export const focusRing = {
  default: 'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
  tight: 'focus:outline-none focus:ring-2 focus:ring-orange-500',
  none: 'focus:outline-none',
} as const;

// ========================================
// ANIMATIONS & TRANSITIONS
// ========================================

export const animations = {
  // Transition durations
  duration: {
    fast: 'duration-150',    // 150ms - Hovers, highlights
    normal: 'duration-200',  // 200ms - Buttons, toggles
    slow: 'duration-300',    // 300ms - Modals, page transitions
  },
  
  // Common transitions
  transition: {
    all: 'transition-all',
    colors: 'transition-colors',
    transform: 'transition-transform',
  },
  
  // Hover effects
  hover: {
    scale: 'hover:scale-105',
    scaleSmall: 'hover:scale-102',
    brightness: 'hover:brightness-110',
    opacity: 'hover:opacity-80',
  },
} as const;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Combine multiple class names, filtering out falsy values
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get responsive padding classes
 * Example: getResponsivePadding('sm', 'md') => 'p-3 md:p-4'
 */
export function getResponsivePadding(mobile: keyof typeof spacing.padding, desktop: keyof typeof spacing.padding): string {
  return `${spacing.padding[mobile]} md:${spacing.padding[desktop]}`;
}

/**
 * Get responsive button padding
 * Example: getButtonPadding('md', 'lg') => 'px-4 py-3 md:px-6 md:py-4'
 */
export function getButtonPadding(mobile: keyof typeof spacing.buttonPadding, desktop: keyof typeof spacing.buttonPadding): string {
  return `${spacing.buttonPadding[mobile]} md:${spacing.buttonPadding[desktop]}`;
}

// ========================================
// EXPORTS
// ========================================

export const designSystem = {
  spacing,
  colors,
  typography,
  radius,
  shadows,
  focusRing,
  animations,
  cn,
  getResponsivePadding,
  getButtonPadding,
} as const;

export default designSystem;

