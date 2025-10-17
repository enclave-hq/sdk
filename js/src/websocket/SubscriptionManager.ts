/**
 * Subscription manager for WebSocket channels
 * @module websocket/SubscriptionManager
 */

import type { ILogger } from '../types/config';
import type { WSChannel, SubscriptionOptions } from '../types/websocket';
import { getLogger } from '../utils/logger';

/**
 * Subscription information
 */
export interface Subscription {
  /** Channel name */
  channel: WSChannel;
  /** Subscription filters */
  filters?: SubscriptionOptions;
  /** Subscription timestamp */
  subscribedAt: number;
}

/**
 * Manages WebSocket channel subscriptions
 */
export class SubscriptionManager {
  private readonly logger: ILogger;
  private subscriptions: Map<WSChannel, Subscription> = new Map();

  constructor(logger?: ILogger) {
    this.logger = logger || getLogger();
  }

  /**
   * Add subscription
   */
  addSubscription(channel: WSChannel, filters?: SubscriptionOptions): void {
    const subscription: Subscription = {
      channel,
      filters,
      subscribedAt: Date.now(),
    };

    this.subscriptions.set(channel, subscription);
    this.logger.debug(`Added subscription: ${channel}`);
  }

  /**
   * Remove subscription
   */
  removeSubscription(channel: WSChannel): void {
    this.subscriptions.delete(channel);
    this.logger.debug(`Removed subscription: ${channel}`);
  }

  /**
   * Check if subscribed to channel
   */
  isSubscribed(channel: WSChannel): boolean {
    return this.subscriptions.has(channel);
  }

  /**
   * Get subscription info
   */
  getSubscription(channel: WSChannel): Subscription | undefined {
    return this.subscriptions.get(channel);
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription filters
   */
  getFilters(channel: WSChannel): SubscriptionOptions | undefined {
    return this.subscriptions.get(channel)?.filters;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.logger.debug('Cleared all subscriptions');
  }

  /**
   * Get subscription count
   */
  getCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get list of subscribed channels
   */
  getChannels(): WSChannel[] {
    return Array.from(this.subscriptions.keys());
  }
}

