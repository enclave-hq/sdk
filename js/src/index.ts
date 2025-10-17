/**
 * Enclave SDK v2.0 - Main Entry Point
 * @module @enclave/sdk
 * @see https://enclave-hq.com
 */

// ============ Core Client ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ Status Enums (for client use) ============
export {
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from './types/models';

// ============ Data Model Types ============
export type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  WithdrawRequestDetail,
  UniversalAddress,
  TokenPrice,
  Pool,
  Token,
  User,
  CommitmentParams,
  CommitmentSignData,
  SignedCommitment,
  WithdrawalParams,
  WithdrawalSignData,
  SignedWithdrawal,
  UserStats,
  TokenStats,
  PaginationParams,
  PaginatedResponse,
} from './types/models';

// ============ Configuration Types ============
export type {
  EnclaveConfig,
  SignerInput,
  ISigner,
  SignerCallback,
  ILogger,
  LogLevel,
  ConnectionInfo,
  ConnectionState,
} from './types/config';

// ============ API Types ============
export type {
  APIResponse,
  APIError,
} from './types/api';

// ============ Event Types ============
export {
  EventName,
} from './types/events';

export type {
  EventMap,
  ConnectionStateChangedEvent,
  CheckbookCreatedEvent,
  CheckbookUpdatedEvent,
  AllocationCreatedEvent,
  AllocationUpdatedEvent,
  WithdrawalCreatedEvent,
  WithdrawalUpdatedEvent,
  PricesUpdatedEvent,
} from './types/events';

// ============ WebSocket Types ============
export {
  WSMessageType,
  WSChannel,
} from './types/websocket';

// ============ Utility Functions ============
export {
  // Address utilities
  toChecksumAddress,
  addressEquals,
  formatAddressShort,
  createUniversalAddress,
  formatUniversalAddress,
  universalAddressEquals,

  // Amount utilities
  formatAmount,
  parseAmount,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  divideAmount,
  compareAmounts,
  isZeroAmount,
  formatAmountWithSeparators,

  // Crypto utilities
  keccak256,
  ensureHexPrefix,
  removeHexPrefix,
  isValidHex,
  isValidAddress,

  // Error classes
  EnclaveError,
  ConfigError,
  AuthError,
  NetworkError,
  APIError,
  WebSocketError,
  ValidationError,
  SignerError,
  StoreError,
  TransactionError,
  TimeoutError,
  NotFoundError,
  InsufficientBalanceError,
  InvalidStateError,
  isEnclaveError,
  formatError,
} from './utils';

// ============ Formatters ============
export {
  CommitmentFormatter,
  WithdrawFormatter,
} from './formatters';

// ============ Stores (for advanced usage) ============
export type {
  CheckbooksStore,
  AllocationsStore,
  WithdrawalsStore,
  PricesStore,
  PoolsStore,
} from './stores';

// ============ Version Info ============
export const SDK_VERSION = '2.0.0-alpha.1';
export const SDK_NAME = '@enclave/sdk';

