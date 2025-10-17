/**
 * WebSocket message handler
 * @module websocket/MessageHandler
 */

import type { ILogger } from '../types/config';
import type { WSServerMessage, WSMessageType } from '../types/websocket';
import { getLogger } from '../utils/logger';

/**
 * Message event handler type
 */
export type MessageEventHandler = (message: WSServerMessage) => void;

/**
 * Handles incoming WebSocket messages and dispatches to appropriate handlers
 */
export class MessageHandler {
  private readonly logger: ILogger;
  private handlers: Map<WSMessageType | '*', Set<MessageEventHandler>> = new Map();

  constructor(logger?: ILogger) {
    this.logger = logger || getLogger();
  }

  /**
   * Register message handler for specific type
   * @param type - Message type or '*' for all messages
   * @param handler - Handler function
   */
  on(type: WSMessageType | '*', handler: MessageEventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    this.logger.debug(`Registered handler for: ${type}`);
  }

  /**
   * Unregister message handler
   * @param type - Message type or '*' for all messages
   * @param handler - Handler function to remove
   */
  off(type: WSMessageType | '*', handler: MessageEventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      this.logger.debug(`Unregistered handler for: ${type}`);
    }
  }

  /**
   * Handle incoming message
   * @param message - WebSocket message
   */
  handle(message: WSServerMessage): void {
    const { type } = message;

    // Execute wildcard handlers
    this.executeHandlers('*', message);

    // Execute type-specific handlers
    if (type) {
      this.executeHandlers(type, message);
    }
  }

  /**
   * Execute handlers for message type
   * @param type - Message type
   * @param message - Message to handle
   */
  private executeHandlers(type: WSMessageType | '*', message: WSServerMessage): void {
    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) return;

    handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        this.logger.error(`Error in message handler for ${type}:`, error);
      }
    });
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.logger.debug('Cleared all message handlers');
  }

  /**
   * Get handler count for type
   * @param type - Message type or '*' for all
   * @returns Number of registered handlers
   */
  getHandlerCount(type: WSMessageType | '*'): number {
    return this.handlers.get(type)?.size || 0;
  }

  /**
   * Get all registered message types
   * @returns Array of message types
   */
  getRegisteredTypes(): (WSMessageType | '*')[] {
    return Array.from(this.handlers.keys());
  }
}

