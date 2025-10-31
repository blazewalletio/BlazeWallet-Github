/**
 * 🔧 Centralized Error Handling
 * 
 * Provides consistent error handling across the wallet
 * - User-friendly messages
 * - Technical details for debugging
 * - Error categorization
 * - Secure logging
 */

import { secureLog } from './secure-log';

export enum ErrorCode {
  // Wallet Errors
  WALLET_LOCKED = 'WALLET_LOCKED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  
  // Transaction Errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  
  // Blockchain Errors
  NONCE_TOO_LOW = 'NONCE_TOO_LOW',
  GAS_TOO_LOW = 'GAS_TOO_LOW',
  REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED',
  
  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export class WalletError extends Error {
  constructor(
    public userMessage: string,
    public technicalMessage: string,
    public code: ErrorCode,
    public originalError?: unknown
  ) {
    super(userMessage);
    this.name = 'WalletError';
    
    // Log technical details securely
    secureLog.error(`[${code}] ${userMessage}`, {
      technical: technicalMessage,
      original: originalError
    });
  }
}

/**
 * Parse common error patterns and return user-friendly messages
 */
export function parseErrorMessage(error: unknown): { userMessage: string; code: ErrorCode; technical: string } {
  // Handle null/undefined
  if (!error) {
    return {
      userMessage: 'Er is een onbekende fout opgetreden',
      code: ErrorCode.UNKNOWN_ERROR,
      technical: 'Error is null or undefined'
    };
  }

  // Handle WalletError (already processed)
  if (error instanceof WalletError) {
    return {
      userMessage: error.userMessage,
      code: error.code,
      technical: error.technicalMessage
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Insufficient balance patterns
    if (message.includes('insufficient funds') || 
        message.includes('insufficient balance') ||
        message.includes('exceeds balance')) {
      return {
        userMessage: 'Insufficient balance for this transaction + gas fees',
        code: ErrorCode.INSUFFICIENT_BALANCE,
        technical: error.message
      };
    }
    
    // Network/RPC errors
    if (message.includes('no response') || 
        message.includes('failed to send tx') ||
        message.includes('network error') ||
        message.includes('fetch failed')) {
      return {
        userMessage: 'Network error. RPC temporarily unavailable. Please try again in a moment.',
        code: ErrorCode.NETWORK_ERROR,
        technical: error.message
      };
    }
    
    // Rate limiting
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        message.includes('429')) {
      return {
        userMessage: 'Te veel verzoeken. Wacht even en probeer opnieuw.',
        code: ErrorCode.RATE_LIMIT,
        technical: error.message
      };
    }
    
    // Transaction rejected
    if (message.includes('user rejected') || 
        message.includes('user denied') ||
        message.includes('cancelled')) {
      return {
        userMessage: 'Transaction cancelled',
        code: ErrorCode.TRANSACTION_REJECTED,
        technical: error.message
      };
    }
    
    // Invalid address
    if (message.includes('invalid address') || 
        message.includes('invalid recipient')) {
      return {
        userMessage: 'Invalid wallet address',
        code: ErrorCode.INVALID_ADDRESS,
        technical: error.message
      };
    }
    
    // Gas errors
    if (message.includes('gas too low') || 
        message.includes('intrinsic gas too low')) {
      return {
        userMessage: 'Gas te laag. Verhoog de gas limiet en probeer opnieuw.',
        code: ErrorCode.GAS_TOO_LOW,
        technical: error.message
      };
    }
    
    // Nonce errors
    if (message.includes('nonce too low') || 
        message.includes('nonce has already been used')) {
      return {
        userMessage: 'Transaction conflict. Please wait a moment and try again.',
        code: ErrorCode.NONCE_TOO_LOW,
        technical: error.message
      };
    }
    
    // Replacement underpriced
    if (message.includes('replacement transaction underpriced')) {
      return {
        userMessage: 'Gas price too low for replacement transaction. Please increase gas price.',
        code: ErrorCode.REPLACEMENT_UNDERPRICED,
        technical: error.message
      };
    }
    
    // Wallet errors
    if (message.includes('invalid password') || 
        message.includes('incorrect password')) {
      return {
        userMessage: 'Ongeldig wachtwoord',
        code: ErrorCode.INVALID_PASSWORD,
        technical: 'Password verification failed'
      };
    }
    
    if (message.includes('invalid mnemonic') || 
        message.includes('invalid recovery phrase')) {
      return {
        userMessage: 'Invalid recovery phrase. Please check your words.',
        code: ErrorCode.INVALID_MNEMONIC,
        technical: 'BIP39 validation failed'
      };
    }
    
    // Generic error with message
    return {
      userMessage: `Er is een fout opgetreden: ${error.message}`,
      code: ErrorCode.UNKNOWN_ERROR,
      technical: error.message
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      userMessage: error,
      code: ErrorCode.UNKNOWN_ERROR,
      technical: error
    };
  }

  // Handle unknown error types
  return {
    userMessage: 'Er is een onbekende fout opgetreden',
    code: ErrorCode.UNKNOWN_ERROR,
    technical: String(error)
  };
}

/**
 * Handle an error and return a WalletError with user-friendly message
 */
export function handleError(error: unknown): WalletError {
  const { userMessage, code, technical } = parseErrorMessage(error);
  return new WalletError(userMessage, technical, code, error);
}

/**
 * Try-catch wrapper that returns WalletError
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorContext?: string
): Promise<{ success: true; data: T } | { success: false; error: WalletError }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const walletError = handleError(error);
    if (errorContext) {
      walletError.userMessage = `${errorContext}: ${walletError.userMessage}`;
    }
    return { success: false, error: walletError };
  }
}

