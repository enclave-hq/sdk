/**
 * Configuration type definitions
 * @module types/config
 */

import type { UniversalAddress } from './models';

// ============ Signer Types ============

/**
 * Signature callback function type
 * Allows external signing (e.g., hardware wallet, remote service, Wallet SDK)
 *
 * @param message - Raw message string to sign (not hashed)
 *                  The callback should handle the appropriate signature standard:
 *                  - EIP-191 for EVM chains
 *                  - TIP-191 for TRON
 *                  - Other standards for other chains
 * @returns Signature (hex string with 0x prefix)
 */
export type SignerCallback = (message: string) => Promise<string>;

/**
 * Signer interface
 * Compatible with ethers.js Signer, Wallet SDK adapters, and similar abstractions
 *
 * Note: The signer should handle the appropriate signature standard:
 * - EIP-191 for EVM chains (ethers.js does this automatically)
 * - TIP-191 for TRON (Wallet SDK handles this)
 * - Other standards for other chains
 *
 * Wallet SDK adapters (e.g., EVMPrivateKeyAdapter, MetaMaskAdapter, TronLinkAdapter)
 * now implement this interface, so they can be used directly as signers.
 */
export interface ISigner {
  /**
   * Sign a message (raw message string, not hash)
   * @param message - Raw message string to sign
   *                  The signer should handle the appropriate signature standard
   * @returns Signature (hex string with 0x prefix)
   */
  signMessage(message: string): Promise<string>;

  /**
   * Get the signer's address
   * @returns Address (hex string with 0x prefix for EVM, Base58 for TRON)
   */
  getAddress(): Promise<string>;
}

/**
 * Signer input - flexible signature provider
 * Can be:
 * - Private key (string): For EVM chains, delegates to Wallet SDK's EVMPrivateKeyAdapter
 * - Callback function: For custom signing logic (e.g., Wallet SDK's signMessage callback)
 * - Signer object (ISigner): Any object implementing ISigner interface
 *   - Wallet SDK adapters (e.g., EVMPrivateKeyAdapter, MetaMaskAdapter, TronLinkAdapter)
 *   - Custom ISigner implementations
 *   - ethers.js Signer (if compatible)
 */
export type SignerInput = string | SignerCallback | ISigner;

// ============ Storage Types ============

/**
 * Storage adapter interface
 * Abstracts storage implementation (localStorage, AsyncStorage, etc.)
 */
export interface IStorageAdapter {
  /**
   * Get item from storage
   * @param key - Storage key
   * @returns Value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Set item in storage
   * @param key - Storage key
   * @param value - Value to store
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove item from storage
   * @param key - Storage key
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all items from storage
   */
  clear(): Promise<void>;
}

// ============ WebSocket Types ============

/**
 * WebSocket adapter interface
 * Abstracts WebSocket implementation (browser WebSocket, ws, etc.)
 */
export interface IWebSocketAdapter {
  /**
   * Connect to WebSocket server
   * @param url - WebSocket URL
   * @param protocols - Optional protocols
   */
  connect(url: string, protocols?: string[]): Promise<void>;

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void;

  /**
   * Send message to server
   * @param data - Data to send
   */
  send(data: string): void;

  /**
   * Register message handler
   * @param handler - Message handler function
   */
  onMessage(handler: (data: string) => void): void;

  /**
   * Register connection handler
   * @param handler - Connection handler function
   */
  onConnect(handler: () => void): void;

  /**
   * Register disconnection handler
   * @param handler - Disconnection handler function
   */
  onDisconnect(handler: (code: number, reason: string) => void): void;

  /**
   * Register error handler
   * @param handler - Error handler function
   */
  onError(handler: (error: Error) => void): void;

  /**
   * Check if connected
   */
  isConnected(): boolean;
}

// ============ Logger Types ============

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger interface
 */
export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void;

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void;

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void;

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void;
}

// ============ SDK Configuration ============

/**
 * SDK configuration options
 */
export interface EnclaveConfig {
  /**
   * Backend API base URL
   * @example 'https://api.enclave-hq.com'
   */
  apiUrl: string;

  /**
   * WebSocket URL
   * @example 'wss://api.enclave-hq.com/ws'
   */
  wsUrl: string;

  /**
   * Signer for authentication and signing operations
   * Can be: private key (string), signing callback, or Signer object
   */
  signer: SignerInput;

  /**
   * User's universal address (optional, will be derived from signer if not provided)
   */
  address?: UniversalAddress;

  /**
   * Enable automatic WebSocket reconnection
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Maximum reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Reconnection delay in milliseconds
   * @default 1000
   */
  reconnectDelay?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Log level
   * @default LogLevel.INFO
   */
  logLevel?: LogLevel;

  /**
   * Custom logger implementation
   */
  logger?: ILogger;

  /**
   * Custom storage adapter (optional, uses localStorage/AsyncStorage by default)
   */
  storageAdapter?: IStorageAdapter;

  /**
   * Custom WebSocket adapter (optional, uses native WebSocket by default)
   */
  wsAdapter?: IWebSocketAdapter;

  /**
   * Enable authentication caching
   * @default true
   */
  cacheAuth?: boolean;

  /**
   * Authentication token (optional, for existing session)
   */
  authToken?: string;

  /**
   * Additional headers for API requests
   */
  headers?: Record<string, string>;

  /**
   * Environment mode
   * @default 'production'
   */
  env?: 'development' | 'staging' | 'production';
}

/**
 * Partial configuration for updates
 */
export type PartialEnclaveConfig = Partial<EnclaveConfig>;

// ============ Connection State ============

/**
 * Connection state enumeration
 */
export enum ConnectionState {
  /** Not connected */
  DISCONNECTED = 'disconnected',
  /** Connecting in progress */
  CONNECTING = 'connecting',
  /** Connected and authenticated */
  CONNECTED = 'connected',
  /** Connection error */
  ERROR = 'error',
  /** Reconnecting */
  RECONNECTING = 'reconnecting',
}

/**
 * Connection info
 */
export interface ConnectionInfo {
  /** Current connection state */
  state: ConnectionState;
  /** Is authenticated */
  authenticated: boolean;
  /** Connection error (if any) */
  error?: Error;
  /** Reconnection attempt count */
  reconnectAttempts?: number;
  /** Last connection timestamp */
  lastConnected?: number;
  /** Last disconnection timestamp */
  lastDisconnected?: number;
}

// ============ Event Emitter Types ============

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (data: T) => void;

/**
 * Event unsubscribe function
 */
export type EventUnsubscribe = () => void;
