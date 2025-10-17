/**
 * Retry mechanism utilities
 * @module utils/retry
 */

import { TimeoutError } from './errors';
import type { ILogger } from '../types/config';
import { getLogger } from './logger';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay between retries in milliseconds */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  timeout: 30000,
  shouldRetry: () => true,
  logger: getLogger(),
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for next retry with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Execute function with timeout
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Operation timed out after ${timeout}ms`, timeout)),
        timeout
      )
    ),
  ]);
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of successful function execution
 * @throws Last error if all retry attempts fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      opts.logger.debug(`Retry attempt ${attempt}/${opts.maxAttempts}`);

      // Execute function with timeout
      const result = await withTimeout(fn, opts.timeout);

      if (attempt > 1) {
        opts.logger.info(`Retry succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      opts.logger.warn(
        `Retry attempt ${attempt} failed: ${lastError.message}`
      );

      // Check if we should retry
      const isLastAttempt = attempt === opts.maxAttempts;
      const shouldRetry = opts.shouldRetry(lastError, attempt);

      if (isLastAttempt || !shouldRetry) {
        opts.logger.error(
          `All retry attempts exhausted. Last error: ${lastError.message}`
        );
        throw lastError;
      }

      // Calculate delay and wait before next attempt
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      );

      opts.logger.debug(`Waiting ${delay}ms before next retry attempt`);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

/**
 * Create a retryable function
 * @param fn - Function to make retryable
 * @param options - Default retry options for this function
 * @returns Retryable function
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) =>
    retry(() => fn(...args), options)) as T;
}

/**
 * Default shouldRetry function for network errors
 */
export function shouldRetryNetworkError(error: Error): boolean {
  // Retry on network errors, timeouts, and 5xx status codes
  const retryableErrors = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
  ];

  const errorMessage = error.message.toUpperCase();
  return retryableErrors.some((code) => errorMessage.includes(code));
}

/**
 * Default shouldRetry function for HTTP status codes
 */
export function shouldRetryHttpStatus(statusCode?: number): boolean {
  if (!statusCode) return false;

  // Retry on 5xx server errors and 429 (Too Many Requests)
  return statusCode >= 500 || statusCode === 429;
}

/**
 * Exponential backoff iterator
 * Useful for manual retry logic
 */
export class ExponentialBackoff {
  private attempt: number = 0;
  private readonly maxAttempts: number;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly multiplier: number;

  constructor(options: RetryOptions = {}) {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    this.maxAttempts = opts.maxAttempts;
    this.initialDelay = opts.initialDelay;
    this.maxDelay = opts.maxDelay;
    this.multiplier = opts.backoffMultiplier;
  }

  /**
   * Get next delay value
   * @returns Delay in milliseconds, or null if max attempts reached
   */
  next(): number | null {
    if (this.attempt >= this.maxAttempts) {
      return null;
    }

    const delay = calculateDelay(
      this.attempt,
      this.initialDelay,
      this.maxDelay,
      this.multiplier
    );

    this.attempt++;
    return delay;
  }

  /**
   * Reset the backoff counter
   */
  reset(): void {
    this.attempt = 0;
  }

  /**
   * Get current attempt number
   */
  getAttempt(): number {
    return this.attempt;
  }

  /**
   * Check if more attempts are available
   */
  hasNext(): boolean {
    return this.attempt < this.maxAttempts;
  }
}

