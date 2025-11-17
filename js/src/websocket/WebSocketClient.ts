/**
 * WebSocket client for real-time updates
 * @module websocket/WebSocketClient
 */

import type { IWebSocketAdapter, ILogger } from '../types/config';
import type {
  WSMessage,
  WSClientMessage,
  WSServerMessage,
  WSMessageType,
  WSChannel,
  SubscriptionOptions,
} from '../types/websocket';
import { WebSocketError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import { ExponentialBackoff } from '../utils/retry';
import { SubscriptionManager } from './SubscriptionManager';
import { MessageHandler } from './MessageHandler';
import { ReconnectionManager } from './ReconnectionManager';

/**
 * WebSocket client configuration
 */
export interface WebSocketClientConfig {
  /** WebSocket URL */
  url: string;
  /** WebSocket adapter (optional, uses native WebSocket by default) */
  adapter?: IWebSocketAdapter;
  /** Authentication token */
  authToken?: string;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Logger instance */
  logger?: ILogger;
  /** Ping interval in milliseconds (0 to disable) */
  pingInterval?: number;
  /** Ping timeout in milliseconds */
  pingTimeout?: number;
}

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * WebSocket event handler types
 */
export type WSEventHandler = (data?: any) => void;

/**
 * WebSocket client for real-time updates
 */
export class WebSocketClient {
  private readonly config: Required<Omit<WebSocketClientConfig, 'adapter' | 'authToken'>>;
  private readonly logger: ILogger;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly messageHandler: MessageHandler;
  private readonly reconnectionManager: ReconnectionManager;

  private adapter?: IWebSocketAdapter;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private authToken?: string;
  private pingIntervalId?: any;
  private lastPongTimestamp?: number;
  private lastPingTimestamp?: number; // Track when we sent the last ping
  private eventHandlers: Map<string, Set<WSEventHandler>> = new Map();

  constructor(config: WebSocketClientConfig) {
    this.logger = config.logger || getLogger();

    // Merge config with defaults
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      logger: this.logger,
      pingInterval: config.pingInterval ?? 30000, // 30 seconds
      pingTimeout: config.pingTimeout ?? 10000, // 10 seconds
    };

    this.authToken = config.authToken;
    this.adapter = config.adapter;

    // Initialize managers
    this.subscriptionManager = new SubscriptionManager(this.logger);
    this.messageHandler = new MessageHandler(this.logger);
    this.reconnectionManager = new ReconnectionManager({
      maxAttempts: this.config.maxReconnectAttempts,
      initialDelay: this.config.reconnectDelay,
      logger: this.logger,
    });

    // Set up message handler
    this.messageHandler.on('*', (message) => {
      this.emit('message', message);
    });
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      this.logger.warn('Already connected or connecting');
      return;
    }

    this.setState(WebSocketState.CONNECTING);
    this.logger.info(`Connecting to WebSocket: ${this.config.url}`);

    try {
      // Create adapter if not provided
      if (!this.adapter) {
        this.adapter = await this.createDefaultAdapter();
      }

      // Set up event handlers
      this.setupAdapterHandlers();

      // Build WebSocket URL with auth token if available
      let wsUrl = this.config.url;
      if (this.authToken) {
        // Add token as query parameter or in URL
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(this.authToken)}`;
      }

      // Connect
      await this.adapter.connect(wsUrl);

      // Mark as connected
      this.setState(WebSocketState.CONNECTED);
      this.reconnectionManager.reset();

      // Start ping
      if (this.config.pingInterval > 0) {
        this.startPing();
      }

      this.logger.info('WebSocket connected');
      this.emit('connected');

      // Resubscribe to channels if reconnecting
      await this.resubscribeAll();
    } catch (error) {
      this.logger.error('WebSocket connection failed:', error);
      this.setState(WebSocketState.ERROR);
      this.emit('error', error);

      // Attempt reconnection if enabled
      if (this.config.autoReconnect) {
        await this.attemptReconnection();
      } else {
        throw new WebSocketError(
          `Failed to connect: ${error.message}`,
          { originalError: error }
        );
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.logger.info('Disconnecting WebSocket');

    this.stopPing();

    if (this.adapter) {
      this.adapter.disconnect();
    }

    this.setState(WebSocketState.DISCONNECTED);
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED && this.adapter?.isConnected() === true;
  }

  /**
   * Get current state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: WSChannel, options?: SubscriptionOptions): Promise<void> {
    if (!this.isConnected()) {
      throw new WebSocketError('Cannot subscribe: not connected');
    }

    this.logger.info(`Subscribing to channel: ${channel}`);

    // Backend expects: { action: "subscribe", type: "checkbooks", address: "0x...", timestamp: 1234567890 }
    // Map SDK channel names to backend subscription types
    const backendTypeMap: Record<WSChannel, string> = {
      [WSChannel.CHECKBOOKS]: 'checkbooks',
      [WSChannel.ALLOCATIONS]: 'allocations',
      [WSChannel.WITHDRAWALS]: 'withdraw_requests',
      [WSChannel.PRICES]: 'prices',
    };

    const backendType = backendTypeMap[channel] || channel;
    
    // Send message in backend format
    const message = {
      action: 'subscribe',
      type: backendType,
      address: options?.owner || '',
      asset_ids: options?.tokenId ? [options.tokenId] : undefined,
      timestamp: Date.now(),
    };

    this.send(message as any);
    this.subscriptionManager.addSubscription(channel, options);
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: WSChannel): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn('Cannot unsubscribe: not connected');
      return;
    }

    this.logger.info(`Unsubscribing from channel: ${channel}`);

    // Backend expects: { action: "unsubscribe", type: "checkbooks", timestamp: 1234567890 }
    const backendTypeMap: Record<WSChannel, string> = {
      [WSChannel.CHECKBOOKS]: 'checkbooks',
      [WSChannel.ALLOCATIONS]: 'allocations',
      [WSChannel.WITHDRAWALS]: 'withdraw_requests',
      [WSChannel.PRICES]: 'prices',
    };

    const backendType = backendTypeMap[channel] || channel;
    
    // Send message in backend format
    const message = {
      action: 'unsubscribe',
      type: backendType,
      timestamp: Date.now(),
    };

    this.send(message as any);
    this.subscriptionManager.removeSubscription(channel);
  }

  /**
   * Send message to server
   */
  send(message: WSClientMessage): void {
    if (!this.isConnected() || !this.adapter) {
      throw new WebSocketError('Cannot send message: not connected');
    }

    try {
      const json = JSON.stringify(message);
      this.adapter.send(json);
      this.logger.debug('Sent WebSocket message:', message.type);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw new WebSocketError(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Register event handler
   */
  on(event: string, handler: WSEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: WSEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Set state
   */
  private setState(state: WebSocketState): void {
    const previousState = this.state;
    this.state = state;
    this.logger.debug(`WebSocket state: ${previousState} -> ${state}`);
    this.emit('stateChanged', { previousState, newState: state });
  }

  /**
   * Create default WebSocket adapter
   */
  private async createDefaultAdapter(): Promise<IWebSocketAdapter> {
    const { BrowserWebSocketAdapter } = await import('../adapters/websocket/BrowserWebSocketAdapter');
    return new BrowserWebSocketAdapter();
  }

  /**
   * Set up adapter event handlers
   */
  private setupAdapterHandlers(): void {
    if (!this.adapter) return;

    this.adapter.onMessage((data) => {
      try {
        const message = JSON.parse(data) as WSServerMessage;
        this.handleMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message:', error);
      }
    });

    this.adapter.onConnect(() => {
      this.logger.debug('Adapter connected');
    });

    this.adapter.onDisconnect((code, reason) => {
      this.logger.warn(`WebSocket disconnected: ${code} - ${reason}`);
      this.handleDisconnect();
    });

    this.adapter.onError((error) => {
      this.logger.error('WebSocket adapter error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WSServerMessage): void {
    this.logger.debug('Received message:', message.type);

    // Update last pong timestamp
    if (message.type === 'pong') {
      this.lastPongTimestamp = Date.now();
      this.lastPingTimestamp = undefined; // Reset ping timestamp after receiving pong
    }

    // Process message through handler
    this.messageHandler.handle(message);
  }

  /**
   * Handle disconnection
   */
  private async handleDisconnect(): void {
    this.stopPing();

    if (this.state !== WebSocketState.DISCONNECTED) {
      this.setState(WebSocketState.DISCONNECTED);
      this.emit('disconnected');

      // Attempt reconnection if enabled
      if (this.config.autoReconnect) {
        await this.attemptReconnection();
      }
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private async attemptReconnection(): Promise<void> {
    const delay = this.reconnectionManager.getNextDelay();

    if (delay === null) {
      this.logger.error('Max reconnection attempts reached');
      this.setState(WebSocketState.ERROR);
      return;
    }

    this.setState(WebSocketState.RECONNECTING);
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectionManager.getAttempt()})`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Reconnection failed:', error);
      // Will retry again due to autoReconnect setting
    }
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    const subscriptions = this.subscriptionManager.getAllSubscriptions();

    if (subscriptions.length === 0) return;

    this.logger.info(`Resubscribing to ${subscriptions.length} channels`);

    for (const subscription of subscriptions) {
      try {
        await this.subscribe(subscription.channel, subscription.filters);
      } catch (error) {
        this.logger.error(`Failed to resubscribe to ${subscription.channel}:`, error);
      }
    }
  }

  /**
   * Start ping interval
   */
  private startPing(): void {
    this.stopPing(); // Clear any existing interval

    this.pingIntervalId = setInterval(() => {
      if (!this.isConnected()) return;

      const now = Date.now();

      // Check if last pong is too old (if we've received at least one pong)
      if (this.lastPongTimestamp) {
        const timeSinceLastPong = now - this.lastPongTimestamp;
        if (timeSinceLastPong > this.config.pingTimeout) {
          this.logger.warn('Ping timeout, disconnecting');
          this.handleDisconnect();
          return;
        }
      }

      // Check if we sent a ping but haven't received a pong within timeout
      // This handles the case where we've never received a pong
      if (this.lastPingTimestamp) {
        const timeSinceLastPing = now - this.lastPingTimestamp;
        if (timeSinceLastPing > this.config.pingTimeout) {
          this.logger.warn('No pong received after ping timeout, disconnecting');
          this.handleDisconnect();
          return;
        }
      }

      // Send ping
      try {
        this.lastPingTimestamp = now;
        this.send({
          type: 'ping' as WSMessageType.PING,
          timestamp: now,
        });
      } catch (error) {
        this.logger.error('Failed to send ping:', error);
      }
    }, this.config.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
    // Reset ping/pong timestamps
    this.lastPingTimestamp = undefined;
    this.lastPongTimestamp = undefined;
  }
}

