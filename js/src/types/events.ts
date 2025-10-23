/**
 * Event type definitions for SDK event system
 * @module types/events
 */

import type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  TokenPrice,
} from './models';
import type { ConnectionInfo } from './config';

// ============ Event Names ============

/**
 * SDK event names enumeration
 */
export enum EventName {
  // Connection events
  CONNECTION_STATE_CHANGED = 'connection:state-changed',
  CONNECTION_ERROR = 'connection:error',
  AUTHENTICATED = 'connection:authenticated',
  DISCONNECTED = 'connection:disconnected',

  // Data update events
  CHECKBOOKS_UPDATED = 'checkbooks:updated',
  CHECKBOOK_CREATED = 'checkbook:created',
  CHECKBOOK_UPDATED = 'checkbook:updated',

  ALLOCATIONS_UPDATED = 'allocations:updated',
  ALLOCATION_CREATED = 'allocation:created',
  ALLOCATION_UPDATED = 'allocation:updated',

  WITHDRAWALS_UPDATED = 'withdrawals:updated',
  WITHDRAWAL_CREATED = 'withdrawal:created',
  WITHDRAWAL_UPDATED = 'withdrawal:updated',

  PRICES_UPDATED = 'prices:updated',

  // WebSocket events
  WS_MESSAGE = 'ws:message',
  WS_CONNECTED = 'ws:connected',
  WS_DISCONNECTED = 'ws:disconnected',
  WS_ERROR = 'ws:error',

  // Store events
  STORE_ERROR = 'store:error',
  STORE_LOADING = 'store:loading',
  STORE_LOADED = 'store:loaded',

  // Action events
  ACTION_STARTED = 'action:started',
  ACTION_COMPLETED = 'action:completed',
  ACTION_FAILED = 'action:failed',
}

// ============ Event Payload Types ============

/**
 * Connection state changed event
 */
export interface ConnectionStateChangedEvent {
  /** Connection info */
  connection: ConnectionInfo;
  /** Previous state */
  previousState: string;
  /** New state */
  newState: string;
}

/**
 * Connection error event
 */
export interface ConnectionErrorEvent {
  /** Error object */
  error: Error;
  /** Error context */
  context?: string;
}

/**
 * Authenticated event
 */
export interface AuthenticatedEvent {
  /** User address */
  address: string;
  /** Authentication token */
  token: string;
  /** Token expiry */
  expiresAt: number;
}

/**
 * Checkbooks updated event
 */
export interface CheckbooksUpdatedEvent {
  /** Updated checkbooks */
  checkbooks: Checkbook[];
  /** Update source */
  source: 'api' | 'websocket';
}

/**
 * Checkbook created event
 */
export interface CheckbookCreatedEvent {
  /** Created checkbook */
  checkbook: Checkbook;
}

/**
 * Checkbook updated event
 */
export interface CheckbookUpdatedEvent {
  /** Updated checkbook */
  checkbook: Checkbook;
  /** Previous checkbook state (optional) */
  previous?: Checkbook;
  /** Changed fields */
  changes?: string[];
}

/**
 * Allocations updated event
 */
export interface AllocationsUpdatedEvent {
  /** Updated allocations */
  allocations: Allocation[];
  /** Update source */
  source: 'api' | 'websocket';
}

/**
 * Allocation created event
 */
export interface AllocationCreatedEvent {
  /** Created allocation */
  allocation: Allocation;
}

/**
 * Allocation updated event
 */
export interface AllocationUpdatedEvent {
  /** Updated allocation */
  allocation: Allocation;
  /** Previous allocation state (optional) */
  previous?: Allocation;
  /** Changed fields */
  changes?: string[];
}

/**
 * Withdrawals updated event
 */
export interface WithdrawalsUpdatedEvent {
  /** Updated withdrawal requests */
  withdrawals: WithdrawRequest[];
  /** Update source */
  source: 'api' | 'websocket';
}

/**
 * Withdrawal created event
 */
export interface WithdrawalCreatedEvent {
  /** Created withdrawal request */
  withdrawal: WithdrawRequest;
}

/**
 * Withdrawal updated event
 */
export interface WithdrawalUpdatedEvent {
  /** Updated withdrawal request */
  withdrawal: WithdrawRequest;
  /** Previous withdrawal state (optional) */
  previous?: WithdrawRequest;
  /** Changed fields */
  changes?: string[];
}

/**
 * Prices updated event
 */
export interface PricesUpdatedEvent {
  /** Updated token prices */
  prices: TokenPrice[];
  /** Update timestamp */
  timestamp: number;
}

/**
 * WebSocket message event
 */
export interface WebSocketMessageEvent {
  /** Message type */
  type: string;
  /** Message data */
  data: any;
  /** Message timestamp */
  timestamp: number;
}

/**
 * Store error event
 */
export interface StoreErrorEvent {
  /** Store name */
  store: string;
  /** Error object */
  error: Error;
  /** Error context */
  context?: string;
}

/**
 * Store loading event
 */
export interface StoreLoadingEvent {
  /** Store name */
  store: string;
  /** Loading state */
  loading: boolean;
}

/**
 * Action started event
 */
export interface ActionStartedEvent {
  /** Action type */
  action: string;
  /** Action parameters */
  params: any;
  /** Action ID */
  actionId: string;
}

/**
 * Action completed event
 */
export interface ActionCompletedEvent {
  /** Action type */
  action: string;
  /** Action result */
  result: any;
  /** Action ID */
  actionId: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Action failed event
 */
export interface ActionFailedEvent {
  /** Action type */
  action: string;
  /** Error object */
  error: Error;
  /** Action ID */
  actionId: string;
  /** Duration in milliseconds */
  duration: number;
}

// ============ Event Map ============

/**
 * Event map - maps event names to their payload types
 */
export interface EventMap {
  [EventName.CONNECTION_STATE_CHANGED]: ConnectionStateChangedEvent;
  [EventName.CONNECTION_ERROR]: ConnectionErrorEvent;
  [EventName.AUTHENTICATED]: AuthenticatedEvent;
  [EventName.DISCONNECTED]: void;

  [EventName.CHECKBOOKS_UPDATED]: CheckbooksUpdatedEvent;
  [EventName.CHECKBOOK_CREATED]: CheckbookCreatedEvent;
  [EventName.CHECKBOOK_UPDATED]: CheckbookUpdatedEvent;

  [EventName.ALLOCATIONS_UPDATED]: AllocationsUpdatedEvent;
  [EventName.ALLOCATION_CREATED]: AllocationCreatedEvent;
  [EventName.ALLOCATION_UPDATED]: AllocationUpdatedEvent;

  [EventName.WITHDRAWALS_UPDATED]: WithdrawalsUpdatedEvent;
  [EventName.WITHDRAWAL_CREATED]: WithdrawalCreatedEvent;
  [EventName.WITHDRAWAL_UPDATED]: WithdrawalUpdatedEvent;

  [EventName.PRICES_UPDATED]: PricesUpdatedEvent;

  [EventName.WS_MESSAGE]: WebSocketMessageEvent;
  [EventName.WS_CONNECTED]: void;
  [EventName.WS_DISCONNECTED]: void;
  [EventName.WS_ERROR]: Error;

  [EventName.STORE_ERROR]: StoreErrorEvent;
  [EventName.STORE_LOADING]: StoreLoadingEvent;
  [EventName.STORE_LOADED]: { store: string };

  [EventName.ACTION_STARTED]: ActionStartedEvent;
  [EventName.ACTION_COMPLETED]: ActionCompletedEvent;
  [EventName.ACTION_FAILED]: ActionFailedEvent;
}

