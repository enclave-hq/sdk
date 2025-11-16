/**
 * Core data models and type definitions for Enclave SDK
 * @module types/models
 */

// ============ Metrics ============

/**
 * Single metric value
 * Used for dynamic metrics like APY, TVL, Yield, Price Changes, etc.
 */
export interface Metric {
  /** Display name (e.g., "年化收益率", "APY", "24h 涨跌幅") */
  name: string;
  /** Metric value (as string for precision) */
  value: string;
  /** Unit (e.g., "%", "USD", "ETH") */
  unit: string;
  /** When this metric was recorded (ISO 8601 timestamp) */
  recorded_at?: string;
  /** Data source (e.g., "api", "contract", "oracle", "manual") */
  source?: string;
}

/**
 * Map of metric types to metric values
 * @example
 * ```typescript
 * const metrics: MetricsMap = {
 *   apy: { name: "年化收益率", value: "4.25", unit: "%" },
 *   tvl: { name: "总锁仓价值", value: "1250000000", unit: "USD" }
 * };
 * ```
 */
export type MetricsMap = Record<string, Metric>;

// ============ Status Enums ============

/**
 * Checkbook status enumeration
 * Represents the lifecycle of a checkbook from creation to completion
 * Matches backend CheckbookStatus enum in backend/internal/models/models.go
 * All status values must match backend exactly (no aliases)
 */
export enum CheckbookStatus {
  /** Deposit submitted, processing */
  Pending = 'pending',
  /** Deposit confirmed, encrypting securely */
  Unsigned = 'unsigned',
  /** Deposit recorded, ready for commitment creation (set by DepositRecorded event) */
  ReadyForCommitment = 'ready_for_commitment',
  /** Generating exclusive privacy transfer credential (proof) */
  GeneratingProof = 'generating_proof',
  /** Submitting commitment to blockchain */
  SubmittingCommitment = 'submitting_commitment',
  /** Commitment submitted, waiting for blockchain confirmation */
  CommitmentPending = 'commitment_pending',
  /** Commitment confirmed, can create allocations */
  WithCheckbook = 'with_checkbook',
  /** Proof generation failed */
  ProofFailed = 'proof_failed',
  /** Commitment submission failed */
  SubmissionFailed = 'submission_failed',
  /** Checkbook record deleted */
  Deleted = 'DELETED',
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
 * WithdrawRequest Backend Status - Complete 18-state system
 * Four-stage architecture: Proof Generation → On-chain Verification → Payout Execution → Hook Purchase
 */
export enum WithdrawRequestStatus {
  // Stage 1: Proof Generation
  Created = 'created',
  Proving = 'proving',
  ProofFailed = 'proof_failed',
  ProofGenerated = 'proof_generated',
  
  // Stage 2: On-chain Verification
  Submitting = 'submitting',
  SubmitFailed = 'submit_failed',        // RPC/Network error - Can retry
  VerifyFailed = 'verify_failed',        // Proof invalid/Nullifier used - Cannot retry, must cancel
  Submitted = 'submitted',
  ExecuteConfirmed = 'execute_confirmed',
  
  // Stage 3: Intent Execution (Payout)
  WaitingForPayout = 'waiting_for_payout',
  PayoutProcessing = 'payout_processing',
  PayoutFailed = 'payout_failed',
  PayoutCompleted = 'payout_completed',
  
  // Stage 4: Hook Purchase (Optional)
  HookProcessing = 'hook_processing',
  HookFailed = 'hook_failed',
  
  // Terminal States
  Completed = 'completed',
  CompletedWithHookFailed = 'completed_with_hook_failed',
  FailedPermanent = 'failed_permanent',
  ManuallyResolved = 'manually_resolved',  // ⭐ Manually resolved by admin
  Cancelled = 'cancelled',
}

/**
 * WithdrawRequest Frontend Status - Simplified 7-state system for UI
 */
export enum WithdrawRequestFrontendStatus {
  /** Generating proof */
  Proving = 'proving',
  /** Submitting to blockchain */
  Submitting = 'submitting',
  /** Waiting for on-chain confirmation */
  Pending = 'pending',
  /** Processing payout/hook */
  Processing = 'processing',
  /** Successfully completed */
  Completed = 'completed',
  /** Failed (can retry or cancel) */
  Failed = 'failed',
  /** Permanently failed (cannot retry) */
  FailedPermanent = 'failed_permanent',
}

/**
 * Proof generation sub-status
 */
export enum ProofStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * On-chain execution sub-status
 */
export enum ExecuteStatus {
  Pending = 'pending',
  Submitted = 'submitted',
  Success = 'success',
  SubmitFailed = 'submit_failed',    // Can retry
  VerifyFailed = 'verify_failed',    // Cannot retry
}

/**
 * Payout execution sub-status
 */
export enum PayoutStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Hook purchase sub-status
 */
export enum HookStatus {
  NotRequired = 'not_required',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

// ============ Universal Address ============

/**
 * Universal address with SLIP-44 chain ID
 * Note: chainId field stores SLIP-44 chain ID (e.g., 714 for BSC, 60 for Ethereum, 195 for TRON)
 * For EVM chains: BSC=714, Ethereum=60, Polygon=966, etc.
 * For non-EVM chains: TRON=195
 */
export interface UniversalAddress {
  /** SLIP-44 chain ID (e.g., 714 for BSC, 60 for Ethereum, 195 for TRON) */
  chainId: number;
  /** Chain name (e.g., 'ethereum', 'bsc', 'polygon') */
  chainName?: string;
  /** Address string */
  address: string;
  /** Universal format representation */
  universalFormat?: string;
  /** SLIP-44 ID (deprecated, use chainId instead - kept for backward compatibility) */
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
  /** Token symbol (e.g., "USDT", "USDC", "ETH") - used for signature display and on-chain verification */
  tokenSymbol: string;
}

/**
 * Asset Token Intent - Derived/wrapped token transfer
 * For derivative tokens like aUSDT (Aave), stETH (Lido), jUSDT (Jupiter), etc.
 */
export interface AssetTokenIntent {
  /** Intent type identifier */
  type: 'AssetToken';
  /** Asset Token ID (bytes32, encoded as ChainID || AdapterID || TokenID || Reserved) */
  assetId: string;
  /** Beneficiary address with chain ID */
  beneficiary: UniversalAddress;
  /** Asset token symbol (e.g., "aUSDT", "stETH") - used for signature display and on-chain verification */
  assetTokenSymbol: string;
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
  /** Dynamic metrics (Yield, Price Change, etc.) */
  metrics?: MetricsMap;
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
  /** Dynamic metrics (APY, TVL, Volume, etc.) */
  metrics?: MetricsMap;
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
  /** Unique checkbook ID (UUID) */
  id: string;
  /** Local deposit ID (uint64, used for commitment generation) - from backend local_deposit_id */
  localDepositId?: number;
  /** SLIP-44 Chain ID (e.g., 714 for BSC, 60 for Ethereum) - from backend slip44_chain_id */
  slip44ChainId?: number;
  /** Owner's universal address */
  owner: UniversalAddress;
  /** Associated token */
  token: Token;
  /** Original deposit amount (in token's smallest unit) */
  depositAmount: string;
  /** Gross amount before fees (from DepositRecorded event) - from backend gross_amount */
  grossAmount?: string;
  /** Amount available for allocation (after fees) - from backend allocatable_amount */
  allocatableAmount?: string;
  /** Total fees locked - from backend fee_total_locked */
  feeTotalLocked?: string;
  /** Remaining amount available for allocation */
  remainingAmount: string;
  /** Deposit transaction hash */
  depositTxHash: string;
  /** Deposit block number */
  depositBlockNumber: number;
  /** Checkbook status */
  status: CheckbookStatus;
  /** Commitment hash (shared by all allocations in this checkbook) */
  commitment?: string;
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
  /** Sequence number (0-255, unique within checkbook) - matching lib.rs Allocation.seq */
  seq: number;
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
 * WithdrawRequest represents a withdrawal request with four-stage process
 * Stage 1: Proof Generation → Stage 2: On-chain Verification → Stage 3: Payout → Stage 4: Hook (optional)
 */
export interface WithdrawRequest {
  /** Unique withdraw request ID */
  id: string;
  
  // ============ Main Status ============
  /** Backend status (18 states) */
  status: WithdrawRequestStatus;
  /** Frontend display status (7 states, computed from backend status) */
  frontendStatus: WithdrawRequestFrontendStatus;
  
  // ============ Stage 1: Proof Generation ============
  proofStatus: ProofStatus;
  proof?: string;
  publicValues?: string;
  commitmentRoot?: string;
  proofGeneratedAt?: number;
  
  // ============ Stage 2: On-chain Verification ============
  executeStatus: ExecuteStatus;
  executeTxHash?: string;
  executeBlockNumber?: number;
  executeConfirmedAt?: number;
  
  // ============ Stage 3: Intent Execution (Payout) ============
  payoutStatus: PayoutStatus;
  payoutTxHash?: string;
  payoutMethod?: 'direct' | 'lifi' | 'adapter';
  payoutCompletedAt?: number;
  
  // ============ Stage 4: Hook Purchase (Optional) ============
  hookStatus: HookStatus;
  hookTxHash?: string;
  hookCompletedAt?: number;
  
  // ============ Retry Mechanism ============
  proofRetryCount: number;
  executeRetryCount: number;
  payoutRetryCount: number;
  hookRetryCount: number;
  maxRetries: number;
  lastRetryAt?: number;
  nextRetryAfter?: number;
  
  // ============ Related Data ============
  /** On-chain request ID (first nullifier) */
  onChainRequestId?: string;
  
  /** Intent information */
  intent: Intent;
  
  /** Beneficiary address */
  beneficiary: UniversalAddress;
  
  /** Owner's universal address */
  owner: UniversalAddress;
  
  /** Total withdrawal amount */
  amount: string;
  
  /** Array of allocation IDs included in this request */
  allocationIds: string[];
  
  // ============ Timestamps ============
  /** Request creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Completion timestamp */
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
  /** Target token key (e.g., 'USDT', 'USDC') - replaces tokenId */
  tokenKey: string;
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
  /** ⭐ Intent specification (RawToken or AssetToken)
   * Note: intent.beneficiary contains both chainId and address
   */
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
  /** Token symbol (e.g., "USDT", "aUSDT") - required for backend API */
  tokenSymbol: string;
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

