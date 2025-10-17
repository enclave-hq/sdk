/**
 * WebSocket message type definitions
 * @module types/websocket
 */

import type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  TokenPrice,
} from './models';

// ============ WebSocket Message Types ============

/**
 * WebSocket message type enumeration
 */
export enum WSMessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PING = 'ping',

  // Server -> Client
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  PONG = 'pong',
  ERROR = 'error',

  // Data updates
  PRICE_UPDATE = 'price_update',
  CHECKBOOK_UPDATE = 'checkbook_update',
  ALLOCATION_UPDATE = 'allocation_update',
  WITHDRAWAL_UPDATE = 'withdrawal_update',
}

/**
 * Subscription channel enumeration
 */
export enum WSChannel {
  PRICES = 'prices',
  CHECKBOOKS = 'checkbooks',
  ALLOCATIONS = 'allocations',
  WITHDRAWALS = 'withdrawals',
}

// ============ Base Message Structure ============

/**
 * Base WebSocket message
 */
export interface WSMessage<T = any> {
  /** Message type */
  type: WSMessageType;
  /** Message data */
  data?: T;
  /** Message timestamp */
  timestamp?: number;
  /** Message ID (optional) */
  id?: string;
}

// ============ Client -> Server Messages ============

/**
 * Subscribe request
 */
export interface WSSubscribeMessage {
  type: WSMessageType.SUBSCRIBE;
  data: {
    /** Channel to subscribe */
    channel: WSChannel;
    /** Additional filters (optional) */
    filters?: {
      /** Owner address filter */
      owner?: string;
      /** Token ID filter */
      tokenId?: string;
      /** Status filter */
      status?: string;
    };
  };
}

/**
 * Unsubscribe request
 */
export interface WSUnsubscribeMessage {
  type: WSMessageType.UNSUBSCRIBE;
  data: {
    /** Channel to unsubscribe */
    channel: WSChannel;
  };
}

/**
 * Ping message
 */
export interface WSPingMessage {
  type: WSMessageType.PING;
  timestamp: number;
}

// ============ Server -> Client Messages ============

/**
 * Subscribed confirmation
 */
export interface WSSubscribedMessage {
  type: WSMessageType.SUBSCRIBED;
  data: {
    /** Subscribed channel */
    channel: WSChannel;
    /** Applied filters */
    filters?: Record<string, any>;
  };
}

/**
 * Unsubscribed confirmation
 */
export interface WSUnsubscribedMessage {
  type: WSMessageType.UNSUBSCRIBED;
  data: {
    /** Unsubscribed channel */
    channel: WSChannel;
  };
}

/**
 * Pong message
 */
export interface WSPongMessage {
  type: WSMessageType.PONG;
  timestamp: number;
}

/**
 * Error message
 */
export interface WSErrorMessage {
  type: WSMessageType.ERROR;
  data: {
    /** Error message */
    message: string;
    /** Error code */
    code: string;
    /** Error details */
    details?: Record<string, any>;
  };
}

// ============ Data Update Messages ============

/**
 * Price update message
 */
export interface WSPriceUpdateMessage {
  type: WSMessageType.PRICE_UPDATE;
  data: {
    /** Updated prices */
    prices: TokenPrice[];
    /** Update timestamp */
    timestamp: number;
  };
}

/**
 * Checkbook update message
 */
export interface WSCheckbookUpdateMessage {
  type: WSMessageType.CHECKBOOK_UPDATE;
  data: {
    /** Update action type */
    action: 'created' | 'updated' | 'deleted';
    /** Updated checkbook */
    checkbook: Checkbook;
    /** Previous checkbook state (for updates) */
    previous?: Checkbook;
  };
}

/**
 * Allocation update message
 */
export interface WSAllocationUpdateMessage {
  type: WSMessageType.ALLOCATION_UPDATE;
  data: {
    /** Update action type */
    action: 'created' | 'updated' | 'deleted';
    /** Updated allocation */
    allocation: Allocation;
    /** Previous allocation state (for updates) */
    previous?: Allocation;
  };
}

/**
 * Withdrawal update message
 */
export interface WSWithdrawalUpdateMessage {
  type: WSMessageType.WITHDRAWAL_UPDATE;
  data: {
    /** Update action type */
    action: 'created' | 'updated' | 'deleted';
    /** Updated withdrawal request */
    withdrawal: WithdrawRequest;
    /** Previous withdrawal state (for updates) */
    previous?: WithdrawRequest;
  };
}

// ============ Union Types ============

/**
 * All client message types
 */
export type WSClientMessage =
  | WSSubscribeMessage
  | WSUnsubscribeMessage
  | WSPingMessage;

/**
 * All server message types
 */
export type WSServerMessage =
  | WSSubscribedMessage
  | WSUnsubscribedMessage
  | WSPongMessage
  | WSErrorMessage
  | WSPriceUpdateMessage
  | WSCheckbookUpdateMessage
  | WSAllocationUpdateMessage
  | WSWithdrawalUpdateMessage;

/**
 * All message types
 */
export type WSAnyMessage = WSClientMessage | WSServerMessage;

// ============ Subscription Types ============

/**
 * Subscription info
 */
export interface SubscriptionInfo {
  /** Channel */
  channel: WSChannel;
  /** Is subscribed */
  subscribed: boolean;
  /** Applied filters */
  filters?: Record<string, any>;
  /** Subscription timestamp */
  subscribedAt?: number;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Owner address filter */
  owner?: string;
  /** Token ID filter */
  tokenId?: string;
  /** Status filter */
  status?: string;
}

