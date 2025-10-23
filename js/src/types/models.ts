/**
 * Core data models and type definitions for Enclave SDK
 * @module types/models
 */

// ============ Status Enums ============

/**
 * Checkbook status enumeration
 * Represents the lifecycle of a checkbook from creation to completion
 */
export enum CheckbookStatus {
  /** Checkbook created, waiting for backend signature */
  Pending = 'pending',
  /** Backend signature missing, needs manual intervention */
  Unsigned = 'unsigned',
  /** Checkbook signed and ready, can create allocations */
  WithCheckbook = 'with_checkbook',
  /** All allocations created, checkbook fully allocated */
  AllocationsDone = 'allocations_done',
  /** All allocations withdrawn, checkbook lifecycle complete */
  Completed = 'completed',
  /** Checkbook creation or processing failed */
  Failed = 'failed',
}

/**
 * Allocation status enumeration
 * Determines if an allocation can be included in a new WithdrawRequest
 */
export enum AllocationStatus {
  /** Allocation available, can be included in a new WithdrawRequest */
  Idle = 'idle',
  /** Allocation is part of an active WithdrawRequest */
  Pending = 'pending',
  /** Allocation has been successfully withdrawn */
  Used = 'used',
}

/**
 * WithdrawRequest status enumeration
 * Two-stage architecture: Stage 1 (on-chain request), Stage 2 (cross-chain conversion)
 */
export enum WithdrawRequestStatus {
  /** On-chain withdrawal request is pending */
  Pending = 'pending',
  /** Stage 1 completed (on-chain request done), Stage 2 may be in progress for cross-chain */
  Completed = 'completed',
  /** Withdrawal request failed */
  Failed = 'failed',
}

// ============ Universal Address ============

/**
 * Universal address with chain ID
 */
export interface UniversalAddress {
  /** Chain ID (1=Ethereum, 56=BSC, 137=Polygon, etc.) */
  chainId: number;
  /** Chain name (e.g., 'ethereum', 'bsc', 'polygon') */
  chainName?: string;
  /** Address string */
  address: string;
  /** Universal format representation */
  universalFormat?: string;
  /** SLIP-44 ID (optional) */
  slip44?: number;
  /** Address data (20 bytes for EVM, variable for other chains) - legacy field */
  data?: string;
}

/**
 * Raw Token Intent - Direct native token transfer
 * For standard tokens like USDT, USDC, ETH, etc.
 */
export interface RawTokenIntent {
  /** Intent type identifier */
  type: 'RawToken';
  /** Beneficiary address with chain ID */
  beneficiary: UniversalAddress;
  /** ERC20/TRC20 token contract address (20 bytes, hex string) */
  tokenContract: string;
}

/**
 * Asset Token Intent - Derived/wrapped token transfer
 * For derivative tokens like aUSDT (Aave), stETH (Lido), jUSDT (Jupiter), etc.
 */
export interface AssetTokenIntent {
  /** Intent type identifier */
  type: 'AssetToken';
  /** Asset Token ID (bytes32, encoded as AdapterID || TokenID || Reserved) */
  assetId: string;
  /** Beneficiary address with chain ID */
  beneficiary: UniversalAddress;
  /** Optional preferred chain for multi-chain asset routing */
  preferredChain?: number;
}

/**
 * Union type for all Intent variants
 */
export type Intent = RawTokenIntent | AssetTokenIntent;

// ============ Token & Pool ============

/**
 * Token information
 */
export interface Token {
  /** Unique token ID */
  id: string;
  /** Token symbol (e.g., 'USDT', 'USDC') */
  symbol: string;
  /** Token full name */
  name: string;
  /** Decimal places */
  decimals: number;
  /** Contract address on source chain */
  contractAddress: string;
  /** Chain ID where token resides */
  chainId: number;
  /** Token icon URL */
  iconUrl?: string;
  /** Is token active */
  isActive: boolean;
}

/**
 * Pool information
 */
export interface Pool {
  /** Unique pool ID */
  id: string;
  /** Pool name */
  name: string;
  /** Associated token */
  token: Token;
  /** Total value locked in pool */
  tvl: string;
  /** Pool utilization rate (0-1) */
  utilizationRate: number;
  /** Pool APY */
  apy?: number;
  /** Is pool active */
  isActive: boolean;
}

// ============ Token Price ============

/**
 * Token price information
 */
export interface TokenPrice {
  /** Token symbol */
  symbol: string;
  /** Price in USD */
  price: number;
  /** 24h price change percentage */
  change24h?: number;
  /** Last update timestamp */
  timestamp: number;
}

// ============ User ============

/**
 * User information
 */
export interface User {
  /** User's universal address */
  address: UniversalAddress;
  /** User's public key (if available) */
  publicKey?: string;
  /** User's authentication token */
  authToken?: string;
  /** Token expiration time */
  tokenExpiry?: number;
}

// ============ Checkbook ============

/**
 * Checkbook represents a deposit and its associated allocations
 * Previously called "Deposit" - now merged with checkbook concept
 */
export interface Checkbook {
  /** Unique checkbook ID (also the deposit ID) */
  id: string;
  /** Owner's universal address */
  owner: UniversalAddress;
  /** Associated token */
  token: Token;
  /** Original deposit amount (in token's smallest unit) */
  depositAmount: string;
  /** Remaining amount available for allocation */
  remainingAmount: string;
  /** Deposit transaction hash */
  depositTxHash: string;
  /** Deposit block number */
  depositBlockNumber: number;
  /** Checkbook status */
  status: CheckbookStatus;
  /** Checkbook signature from backend (optional, present after signing) */
  signature?: string;
  /** Checkbook creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Number of allocations created */
  allocationCount?: number;
  /** Array of allocation IDs (optional, may be populated by store) */
  allocationIds?: string[];
}

// ============ Allocation ============

/**
 * Allocation represents a portion of a checkbook allocated for potential withdrawal
 * Previously called "Check" - renamed to "Allocation" with simplified states
 */
export interface Allocation {
  /** Unique allocation ID */
  id: string;
  /** Associated checkbook ID */
  checkbookId: string;
  /** Owner's universal address */
  owner: UniversalAddress;
  /** Associated token */
  token: Token;
  /** Allocation amount (in token's smallest unit) */
  amount: string;
  /** Allocation status (determines if can be included in WithdrawRequest) */
  status: AllocationStatus;
  /** Associated withdraw request ID (if pending or used) */
  withdrawRequestId?: string;
  /** Commitment hash for this allocation */
  commitment?: string;
  /** Nullifier for this allocation (generated when creating withdraw request) */
  nullifier?: string;
  /** Allocation creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// ============ WithdrawRequest ============

/**
 * WithdrawRequest represents a withdrawal request that can include multiple allocations
 * Previously called "Withdraw" - renamed to clarify it's a request with two-stage process
 * Stage 1: On-chain withdrawal request (pending -> completed/failed)
 * Stage 2: Cross-chain conversion (handled by separate service)
 */
export interface WithdrawRequest {
  /** Unique withdraw request ID */
  id: string;
  /** Owner's universal address */
  owner: UniversalAddress;
  /** Target chain for withdrawal */
  targetChain: number;
  /** Target address for receiving funds */
  targetAddress: string;
  /** Associated token */
  token: Token;
  /** Total withdrawal amount (sum of all allocations) */
  amount: string;
  /** Withdraw request status (two-stage) */
  status: WithdrawRequestStatus;
  /** Intent type ('withdraw', 'transfer', etc.) */
  intent: string;
  /** Array of allocation IDs included in this request */
  allocationIds: string[];
  /** Root hash for the merkle tree of allocations */
  root?: string;
  /** Nullifier hash for this withdraw request */
  nullifier?: string;
  /** ZK proof for this withdrawal */
  proof?: string;
  /** On-chain transaction hash (Stage 1) */
  txHash?: string;
  /** Transaction block number */
  blockNumber?: number;
  /** Cross-chain conversion status (Stage 2, optional) */
  conversionStatus?: 'pending' | 'completed' | 'failed';
  /** Error message if failed */
  errorMessage?: string;
  /** Request creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Stage 1 completion timestamp */
  completedAt?: number;
}

/**
 * Detailed withdraw request with populated allocation objects
 */
export interface WithdrawRequestDetail extends WithdrawRequest {
  /** Full allocation objects (not just IDs) */
  allocations: Allocation[];
}

// ============ Commitment ============

/**
 * Commitment creation parameters
 */
export interface CommitmentParams {
  /** Checkbook ID to create allocations from */
  checkbookId: string;
  /** Array of allocation amounts (in token's smallest unit) */
  amounts: string[];
  /** Target token */
  tokenId: string;
}

/**
 * Commitment data prepared for signing
 */
export interface CommitmentSignData {
  /** Checkbook ID */
  checkbookId: string;
  /** Array of amounts */
  amounts: string[];
  /** Token ID */
  tokenId: string;
  /** Message to sign (formatted according to spec) */
  message: string;
  /** Message hash (keccak256) */
  messageHash: string;
}

/**
 * Signed commitment ready for submission
 */
export interface SignedCommitment {
  /** Commitment sign data */
  data: CommitmentSignData;
  /** Signature (hex string) */
  signature: string;
}

// ============ Withdrawal ============

/**
 * Withdrawal creation parameters
 */
export interface WithdrawalParams {
  /** Array of allocation IDs to withdraw */
  allocationIds: string[];
  /** Target chain ID for withdrawal */
  targetChain: number;
  /** Target address for receiving funds */
  targetAddress: string;
  /** ⭐ Intent specification (RawToken or AssetToken) */
  intent: Intent;
  /** Additional metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Withdrawal data prepared for signing
 */
export interface WithdrawalSignData {
  /** Array of allocation IDs */
  allocationIds: string[];
  /** Target chain ID */
  targetChain: number;
  /** Target address */
  targetAddress: string;
  /** ⭐ Intent specification (RawToken or AssetToken) */
  intent: Intent;
  /** Message to sign (formatted according to spec) */
  message: string;
  /** Message hash (keccak256) */
  messageHash: string;
  /** Nullifier hash */
  nullifier: string;
}

/**
 * Signed withdrawal ready for submission
 */
export interface SignedWithdrawal {
  /** Withdrawal sign data */
  data: WithdrawalSignData;
  /** Signature (hex string) */
  signature: string;
}

// ============ Statistics ============

/**
 * User statistics
 */
export interface UserStats {
  /** Total deposited amount (across all tokens) */
  totalDeposited: string;
  /** Total withdrawn amount */
  totalWithdrawn: string;
  /** Current balance (deposited - withdrawn) */
  currentBalance: string;
  /** Number of active checkbooks */
  activeCheckbooks: number;
  /** Number of pending withdrawals */
  pendingWithdrawals: number;
}

/**
 * Token statistics
 */
export interface TokenStats {
  /** Token info */
  token: Token;
  /** Total deposited amount for this token */
  totalDeposited: string;
  /** Total withdrawn amount for this token */
  totalWithdrawn: string;
  /** Current balance for this token */
  currentBalance: string;
}

// ============ Pagination ============

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Data items */
  data: T[];
  /** Pagination info */
  pagination: {
    /** Current page */
    page: number;
    /** Items per page */
    limit: number;
    /** Total items */
    total: number;
    /** Total pages */
    totalPages: number;
    /** Has next page */
    hasNext: boolean;
    /** Has previous page */
    hasPrev: boolean;
  };
}

