/**
 * @module @enclave-hq/sdk
 * @description Enclave SDK - Privacy-preserving multi-chain DeFi protocol client library
 * @version 2.3.4
 */

// ============ Core Client ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ Status Enums (for client use) ============
export { CheckbookStatus, AllocationStatus, WithdrawRequestStatus } from './types/models';

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
  CommitmentResponse,
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
  APIError as APIErrorResponse,
  // KYT Oracle API Types
  GetFeeInfoRequest,
  GetFeeInfoResponse,
  FeeInfoData,
  AssociateAddressRequest,
  AssociateAddressResponse,
} from './types/api';

// ============ Event Types ============
export { EventName } from './types/events';

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
export { WSMessageType, WSChannel } from './types/websocket';

// ============ Utility Functions ============
export {
  // Address utilities
  toChecksumAddress,
  addressEquals,
  formatAddressShort,
  createUniversalAddress,
  parseUniversalAddress,
  formatUniversalAddress,
  extractAddress,
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

  // Chain utilities
  getSlip44FromChainId,
  getEvmChainIdFromSlip44,
  getChainName,
  getChainType,
  isEVMChain,
  isTronChain,
  ChainType,

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

  // Checkbook status utilities
  canCreateCommitment,
  canCreateAllocations,
  isRetryableFailure,
  isProcessing,
} from './utils';

// ============ Formatters ============
export { CommitmentFormatter, WithdrawFormatter } from './formatters';

// ============ Commitment Core ============
export { CommitmentCore } from './utils/CommitmentCore';
export type {
  Allocation as CommitmentAllocation,
  Credential as CommitmentCredential,
} from './utils/CommitmentCore';

// ============ Withdraw Input Builder ============
export { buildWithdrawInput, withdrawInputToZKVMFormat } from './utils/WithdrawInputBuilder';
export type {
  WithdrawInput,
  AllocationsFromCommitment,
  AllocationWithCredential,
  Credential as WithdrawCredential,
  BuildWithdrawInputOptions,
} from './utils/WithdrawInputBuilder';

// ============ Stores (for advanced usage) ============
export type {
  CheckbooksStore,
  AllocationsStore,
  WithdrawalsStore,
  PricesStore,
  PoolsStore,
} from './stores';

// ============ Providers ============
export { WalletSDKContractProvider } from './providers';

// ============ Version Info ============
export const SDK_VERSION = '2.3.11';
export const SDK_NAME = '@enclave-hq/sdk';
