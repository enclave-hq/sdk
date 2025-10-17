/**
 * Browser WebSocket adapter implementation
 * @module adapters/websocket/BrowserWebSocketAdapter
 */

import type { IWebSocketAdapter } from '../../types/config';
import { WebSocketError } from '../../utils/errors';

/**
 * Browser-based WebSocket adapter using native WebSocket API
 */
export class BrowserWebSocketAdapter implements IWebSocketAdapter {
  private ws?: WebSocket;
  private messageHandlers: Set<(data: string) => void> = new Set();
  private connectHandlers: Set<() => void> = new Set();
  private disconnectHandlers: Set<(code: number, reason: string) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  /**
   * Connect to WebSocket server
   */
  async connect(url: string, protocols?: string[]): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      throw new WebSocketError('Already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, protocols);

        this.ws.onopen = () => {
          this.connectHandlers.forEach((handler) => handler());
          resolve();
        };

        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : String(event.data);
          this.messageHandlers.forEach((handler) => handler(data));
        };

        this.ws.onclose = (event) => {
          this.disconnectHandlers.forEach((handler) =>
            handler(event.code, event.reason)
          );
        };

        this.ws.onerror = (event) => {
          const error = new WebSocketError('WebSocket error', {
            event: event.type,
          });
          this.errorHandlers.forEach((handler) => handler(error));
          reject(error);
        };
      } catch (error) {
        reject(
          new WebSocketError(`Failed to create WebSocket: ${error.message}`)
        );
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Send message to server
   */
  send(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket not connected');
    }

    this.ws.send(data);
  }

  /**
   * Register message handler
   */
  onMessage(handler: (data: string) => void): void {
    this.messageHandlers.add(handler);
  }

  /**
   * Register connection handler
   */
  onConnect(handler: () => void): void {
    this.connectHandlers.add(handler);
  }

  /**
   * Register disconnection handler
   */
  onDisconnect(handler: (code: number, reason: string) => void): void {
    this.disconnectHandlers.add(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== undefined && this.ws.readyState === WebSocket.OPEN;
  }
}

