/**
 * Custom error classes for Enclave SDK
 * @module utils/errors
 */

/**
 * Base error class for all Enclave SDK errors
 */
export class EnclaveError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'EnclaveError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Configuration error
 */
export class ConfigError extends EnclaveError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

/**
 * Authentication error
 */
export class AuthError extends EnclaveError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

/**
 * Network error
 */
export class NetworkError extends EnclaveError {
  public readonly statusCode?: number;

  constructor(
    message: string,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

/**
 * API error
 */
export class APIError extends EnclaveError {
  public readonly statusCode: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    endpoint?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * WebSocket error
 */
export class WebSocketError extends EnclaveError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'WEBSOCKET_ERROR', details);
    this.name = 'WebSocketError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends EnclaveError {
  public readonly field?: string;

  constructor(message: string, field?: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Signer error
 */
export class SignerError extends EnclaveError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SIGNER_ERROR', details);
    this.name = 'SignerError';
  }
}

/**
 * Store error
 */
export class StoreError extends EnclaveError {
  public readonly storeName?: string;

  constructor(
    message: string,
    storeName?: string,
    details?: Record<string, any>
  ) {
    super(message, 'STORE_ERROR', details);
    this.name = 'StoreError';
    this.storeName = storeName;
  }
}

/**
 * Transaction error
 */
export class TransactionError extends EnclaveError {
  public readonly txHash?: string;

  constructor(
    message: string,
    txHash?: string,
    details?: Record<string, any>
  ) {
    super(message, 'TRANSACTION_ERROR', details);
    this.name = 'TransactionError';
    this.txHash = txHash;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends EnclaveError {
  public readonly timeout: number;

  constructor(message: string, timeout: number, details?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Not found error
 */
export class NotFoundError extends EnclaveError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(
    message: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, any>
  ) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Insufficient balance error
 */
export class InsufficientBalanceError extends EnclaveError {
  public readonly required: string;
  public readonly available: string;

  constructor(
    message: string,
    required: string,
    available: string,
    details?: Record<string, any>
  ) {
    super(message, 'INSUFFICIENT_BALANCE', details);
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
  }
}

/**
 * Invalid state error
 */
export class InvalidStateError extends EnclaveError {
  public readonly currentState?: string;
  public readonly expectedState?: string;

  constructor(
    message: string,
    currentState?: string,
    expectedState?: string,
    details?: Record<string, any>
  ) {
    super(message, 'INVALID_STATE', details);
    this.name = 'InvalidStateError';
    this.currentState = currentState;
    this.expectedState = expectedState;
  }
}

/**
 * Helper to check if error is an Enclave SDK error
 */
export function isEnclaveError(error: any): error is EnclaveError {
  return error instanceof EnclaveError;
}

/**
 * Helper to format error for logging
 */
export function formatError(error: any): string {
  if (isEnclaveError(error)) {
    return `[${error.code}] ${error.message}${
      error.details ? ` | Details: ${JSON.stringify(error.details)}` : ''
    }`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

