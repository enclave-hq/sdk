/**
 * WebSocket reconnection manager with exponential backoff
 * @module websocket/ReconnectionManager
 */

import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { ExponentialBackoff } from '../utils/retry';

/**
 * Reconnection manager configuration
 */
export interface ReconnectionConfig {
  /** Maximum reconnection attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Manages WebSocket reconnection logic with exponential backoff
 */
export class ReconnectionManager {
  private readonly logger: ILogger;
  private readonly backoff: ExponentialBackoff;
  private attemptCount: number = 0;

  constructor(config: ReconnectionConfig = {}) {
    this.logger = config.logger || getLogger();

    this.backoff = new ExponentialBackoff({
      maxAttempts: config.maxAttempts || 5,
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
    });
  }

  /**
   * Get next reconnection delay
   * @returns Delay in milliseconds, or null if max attempts reached
   */
  getNextDelay(): number | null {
    const delay = this.backoff.next();

    if (delay === null) {
      this.logger.warn('Max reconnection attempts reached');
      return null;
    }

    this.attemptCount++;
    this.logger.debug(`Reconnection attempt ${this.attemptCount}, delay: ${delay}ms`);

    return delay;
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.backoff.reset();
    this.attemptCount = 0;
    this.logger.debug('Reconnection state reset');
  }

  /**
   * Get current attempt count
   */
  getAttempt(): number {
    return this.attemptCount;
  }

  /**
   * Check if more reconnection attempts are available
   */
  hasAttemptsRemaining(): boolean {
    return this.backoff.hasNext();
  }

  /**
   * Get maximum attempts configured
   */
  getMaxAttempts(): number {
    return this.backoff.getAttempt();
  }
}

