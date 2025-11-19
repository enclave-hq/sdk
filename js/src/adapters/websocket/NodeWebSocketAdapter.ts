/**
 * Node.js WebSocket adapter implementation
 * @module adapters/websocket/NodeWebSocketAdapter
 */

import type { IWebSocketAdapter } from '../../types/config';
import { WebSocketError } from '../../utils/errors';

/**
 * Node.js WebSocket adapter using 'ws' library
 */
export class NodeWebSocketAdapter implements IWebSocketAdapter {
  private ws?: any; // WebSocket from 'ws' package
  private WebSocketClass?: any;
  private messageHandlers: Set<(data: string) => void> = new Set();
  private connectHandlers: Set<() => void> = new Set();
  private disconnectHandlers: Set<(code: number, reason: string) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  /**
   * Connect to WebSocket server
   */
  async connect(url: string, protocols?: string[]): Promise<void> {
    if (this.ws && this.ws.readyState === this.WebSocketClass?.OPEN) {
      throw new WebSocketError('Already connected');
    }

    // Dynamically import 'ws' package
    if (!this.WebSocketClass) {
      try {
        const wsModule = await import('ws');
        this.WebSocketClass = wsModule.default || wsModule.WebSocket;
      } catch (error) {
        throw new WebSocketError('Failed to load ws package. Please install: npm install ws');
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new this.WebSocketClass(url, protocols);

        this.ws.on('open', () => {
          this.connectHandlers.forEach(handler => handler());
          resolve();
        });

        this.ws.on('message', (data: any) => {
          const message = typeof data === 'string' ? data : data.toString();
          this.messageHandlers.forEach(handler => handler(message));
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.disconnectHandlers.forEach(handler => handler(code, reason.toString()));
        });

        this.ws.on('error', (error: Error) => {
          const wsError = new WebSocketError(`WebSocket error: ${error.message}`, {
            originalError: error,
          });
          this.errorHandlers.forEach(handler => handler(wsError));
          reject(wsError);
        });
      } catch (error) {
        reject(new WebSocketError(`Failed to create WebSocket: ${error.message}`));
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
    if (!this.ws || this.ws.readyState !== this.WebSocketClass?.OPEN) {
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
    return (
      this.ws !== undefined &&
      this.WebSocketClass &&
      this.ws.readyState === this.WebSocketClass.OPEN
    );
  }
}
