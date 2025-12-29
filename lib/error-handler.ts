/**
 * 🔒 ERROR HANDLER - Sanitization for production
 * 
 * Sanitizes error messages based on environment:
 * - Development: Full error details (for debugging)
 * - Production: Generic error messages (for security)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export interface SanitizedError {
  message: string;
  details?: any;
}

/**
 * Sanitize error for logging/response
 */
export function sanitizeError(error: any): SanitizedError {
  if (isDevelopment) {
    return {
      message: error?.message || 'Unknown error',
      details: error
    };
  }
  
  // Production: Generic messages
  const errorMessage = error?.message || 'Unknown error';
  
  // Categorize errors
  if (errorMessage.includes('database') || errorMessage.includes('supabase')) {
    return { message: 'Database error occurred' };
  }
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return { message: 'Network error occurred' };
  }
  if (errorMessage.includes('decrypt') || errorMessage.includes('encrypt')) {
    return { message: 'Encryption error occurred' };
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return { message: 'Authentication failed' };
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return { message: 'Rate limit exceeded' };
  }
  if (errorMessage.includes('too many decimals')) {
    return { message: 'Invalid amount format' };
  }
  if (errorMessage.includes('insufficient funds') || errorMessage.includes('balance')) {
    return { message: 'Insufficient funds' };
  }
  
  // Generic fallback
  return { message: 'An error occurred' };
}

/**
 * Create sanitized error response
 */
export function sanitizeErrorResponse(error: any): NextResponse {
  const { NextResponse } = require('next/server');
  const sanitized = sanitizeError(error);
  
  if (isDevelopment) {
    return NextResponse.json(
      { 
        error: sanitized.message,
        details: sanitized.details 
      },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: sanitized.message },
    { status: 500 }
  );
}
