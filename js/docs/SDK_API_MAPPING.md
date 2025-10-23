# Enclave SDK - API Mapping Documentation

**Languages**: English | [中文](./SDK_API_MAPPING.zh-CN.md) | [日本語](./SDK_API_MAPPING.ja.md) | [한국어](./SDK_API_MAPPING.ko.md)

## Overview

This document provides detailed mapping between Enclave JavaScript SDK API methods and backend REST API endpoints, as well as WebSocket subscription and message mappings.

## 📚 Table of Contents

- [Quick Reference](#quick-reference)
- [Status Enum Usage](#status-enum-usage)
- [SDK Configuration](#sdk-configuration)
- [Authentication](#authentication)
- [Signer Architecture](#signer-architecture)
- [Data Synchronization Mechanism](#data-synchronization-mechanism)
- [Store Method Classification](#store-method-classification)
- [Deposit Related](#deposit-related)
- [Checkbook Related](#checkbook-related)
- [Allocation Related](#allocation-related)
- [Commitment Related](#commitment-related)
- [Withdrawal Related](#withdrawal-related)
- [Pools & Tokens](#pools--tokens)
- [Token Prices](#token-prices)
- [WebSocket Subscriptions](#websocket-subscriptions)
- [SDK Internal Implementation vs Backend API](#sdk-internal-implementation-vs-backend-api)
- [Status System](#status-system)
- [Error Handling](#error-handling)

---

## Quick Reference

### SDK Initialization

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKeyOrSignerCallback,
});

await client.connect();
```

**Backend API**: None (client-side only)

### Common Operations

| SDK Method | Backend API | Description |
|------------|-------------|-------------|
| `client.connect()` | `POST /api/auth/login` | Authenticate and establish connection |
| `client.disconnect()` | `POST /api/auth/logout` | Disconnect and clean up |
| `client.stores.checkbooks.getByOwner()` | `GET /api/checkbooks` | Get user's checkbooks |
| `client.stores.allocations.getList()` | `GET /api/allocations` | Get allocations with filters |
| `client.stores.withdrawals.getList()` | `GET /api/withdrawals` | Get withdrawal requests |
| `client.prepareCommitment()` | None (SDK internal) | Prepare commitment signing data |
| `client.submitCommitment()` | `POST /api/commitments` | Submit signed commitment |
| `client.prepareWithdraw()` | None (SDK internal) | Prepare withdrawal signing data |
| `client.submitWithdraw()` | `POST /api/withdrawals` | Submit signed withdrawal |

---

## Status Enum Usage

The SDK exports status enums for type-safe status handling:

```typescript
import {
  EnclaveClient,
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave-hq/sdk';

// 1. Type-safe status comparisons
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook is active');
}

// 2. Filter by status
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

const pendingWithdrawals = client.stores.withdrawals.pending; // Computed property

// 3. Status flow control
function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 4. UI rendering
function WithdrawalStatusBadge({ status }: { status: WithdrawRequestStatus }) {
  const config = {
    [WithdrawRequestStatus.Pending]: { text: 'Processing', color: 'yellow' },
    [WithdrawRequestStatus.Completed]: { text: 'Completed', color: 'green' },
    [WithdrawRequestStatus.Failed]: { text: 'Failed', color: 'red' },
  };
  
  const { text, color } = config[status] || { text: 'Unknown', color: 'gray' };
  return <Badge color={color}>{text}</Badge>;
}

// 5. Switch statements with full type safety
function handleWithdrawStatus(status: WithdrawRequestStatus) {
  switch (status) {
    case WithdrawRequestStatus.Pending:
      return 'Please wait...';
    case WithdrawRequestStatus.Completed:
      return 'Withdrawal successful!';
    case WithdrawRequestStatus.Failed:
      return 'Withdrawal failed. You can retry.';
    default:
      // TypeScript ensures all cases are handled
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
```

### Status Enum Definitions

```typescript
// Checkbook Status
export enum CheckbookStatus {
  Pending = 'pending',                     // Proof generation in progress
  ReadyForCommitment = 'ready_for_commitment', // Proof ready, waiting for commitment
  WithCheckbook = 'with_checkbook',        // Checkbook activated (commitment completed)
  ProofFailed = 'proof_failed',            // Proof generation failed
}

// Allocation Status
export enum AllocationStatus {
  Idle = 'idle',       // Available for use in new WithdrawRequest
  Pending = 'pending', // Included in an active WithdrawRequest
  Used = 'used',       // Successfully withdrawn
}

// WithdrawRequest Status
export enum WithdrawRequestStatus {
  Pending = 'pending',       // Withdrawal processing
  Completed = 'completed',   // Withdrawal completed (on-chain stage 1 done)
  Failed = 'failed',         // Withdrawal failed
}
```

---

## SDK Configuration

### Configuration Options

```typescript
interface EnclaveConfig {
  // Required
  apiUrl: string;              // Backend API base URL
  wsUrl?: string;              // WebSocket URL (auto-generated if not provided)
  
  // Signer (choose one)
  signer?: SignerInput;        // Private key, callback function, or ethers.Signer
  
  // Optional
  autoRefreshInterval?: number;    // Auto-refresh interval (ms), default 30000
  storageAdapter?: IStorageAdapter; // Storage adapter (default: localStorage)
  websocketAdapter?: IWebSocketAdapter; // WebSocket adapter (auto-detected)
  
  // Advanced
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Log level
  timeout?: number;            // Request timeout (ms)
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}
```

### Usage Examples

```typescript
// 1. Basic configuration (browser with MetaMask)
import { BrowserProvider } from 'ethers';

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: signer,
});

// 2. Node.js backend with private key
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: process.env.PRIVATE_KEY,
  logLevel: 'info',
});

// 3. Custom signing service
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: async (message) => {
    const response = await fetch('https://my-signer.com/sign', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    const { signature } = await response.json();
    return signature;
  },
});

// 4. Custom storage adapter (e.g., for React Native)
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: privateKey,
  storageAdapter: {
    async get(key: string) {
      return AsyncStorage.getItem(key);
    },
    async set(key: string, value: string) {
      await AsyncStorage.setItem(key, value);
    },
    async remove(key: string) {
      await AsyncStorage.removeItem(key);
    },
  },
});
```

---

## Authentication

### `client.connect()`

**Description**: Authenticate and establish WebSocket connection

**Parameters**:
- `signer?: SignerInput` - Optional, overrides constructor signer

**Backend API Flow**:
1. `POST /api/auth/login`
   - Request: `{ address: string, signature: string, message: string }`
   - Response: `{ token: string, user: User }`

2. WebSocket connection: `wss://api.enclave-hq.com/ws?token={jwt_token}`

**SDK Internal Flow**:
```
1. Get user address from signer
2. Generate login message
3. Sign message with signer
4. POST /api/auth/login → receive JWT token
5. Store token in SDK
6. Establish WebSocket connection with token
7. Auto-subscribe to user data streams
8. Initial data synchronization
```

**Example**:
```typescript
await client.connect();
console.log('✅ Connected');
console.log('User address:', client.stores.user.address);
```

### `client.disconnect()`

**Description**: Disconnect and clean up resources

**Backend API**: `POST /api/auth/logout`

**SDK Internal Flow**:
```
1. Unsubscribe all WebSocket subscriptions
2. Close WebSocket connection
3. POST /api/auth/logout
4. Clear all Store data
5. Clear authentication token
6. Reset internal state
```

**Example**:
```typescript
await client.disconnect();
console.log('✅ Disconnected');
```

---

## Signer Architecture

The SDK supports multiple signing methods without exposing private keys.

### Signer Types

```typescript
// 1. Private key string
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: '0x1234567890abcdef...', // Private key (hex)
});

// 2. ethers.Signer (MetaMask, Ledger, etc.)
import { BrowserProvider } from 'ethers';
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: signer,
});

// 3. Custom signing callback
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: async (message: string | Uint8Array) => {
    // Custom signing logic (e.g., call remote service)
    const signature = await myCustomSigningService.sign(message);
    return signature;
  },
});

// 4. ISigner interface implementation
const customSigner: ISigner = {
  async getAddress() {
    return '0x...';
  },
  async signMessage(message: string | Uint8Array) {
    return '0xsignature...';
  },
};

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: customSigner,
});
```

### Security Best Practices

1. **Never hardcode private keys** - Use environment variables or secure vaults
2. **For web apps** - Use Web3 wallet providers (MetaMask, WalletConnect)
3. **For backends** - Use environment variables or KMS
4. **For mobile** - Use secure key storage (Keychain, KeyStore)

---

## Data Synchronization Mechanism

The SDK uses a **dual synchronization mechanism**:

### Primary: WebSocket Real-time Push

- Automatically pushes updates when backend data changes
- No manual refresh needed
- Real-time updates for checkbooks, allocations, withdrawals, prices

**How it works**:
```
1. Client connects → WebSocket established
2. SDK auto-subscribes to user data streams
3. Backend pushes updates → SDK updates Stores
4. MobX notifies observers → UI auto-updates
```

### Backup: Explicit Query Methods

- Manually fetch latest data when needed
- Useful for:
  - Initial data loading
  - Recovery from WebSocket disconnection
  - On-demand data refresh
  - Fetching specific items

**Query Methods**:
```typescript
// Query by owner (user address)
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();
await client.stores.withdrawals.getByOwner();

// Query by ID
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);
await client.stores.withdrawals.getById(withdrawalId);

// Query with filters
await client.stores.allocations.getList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});

await client.stores.withdrawals.getList({
  status: WithdrawRequestStatus.Pending,
  page: 1,
  page_size: 10,
});
```

### Removed Methods (Outdated Approach)

❌ The following generic refresh methods have been removed:
- `client.refresh()` - Too generic, unclear what's being refreshed
- `stores.*.refresh()` - Redundant, use specific query methods
- `stores.*.refreshOne(id)` - Use `getById(id)` instead
- `enableAutoRefresh()` / `disableAutoRefresh()` - WebSocket handles this
- `isStale` / `lastSyncTime` - Not needed with WebSocket

✅ Use explicit query methods instead:
- `getByOwner()` - Fetch all user data
- `getById(id)` - Fetch specific item
- `getList(filters)` - Fetch with filters

---

## Store Method Classification

Each Store has two types of methods:

### 1. Local (Memory) Queries

Access data already in Store (instant, no network call):

```typescript
// Get single item from Store
const checkbook = client.stores.checkbooks.get(checkbookId);
const allocation = client.stores.allocations.get(allocationId);
const withdrawal = client.stores.withdrawals.get(withdrawalId);

// Get all items from Store
const allCheckbooks = client.stores.checkbooks.all;
const allAllocations = client.stores.allocations.all;
const allWithdrawals = client.stores.withdrawals.all;

// Computed properties (filtered views)
const idleAllocations = client.stores.allocations.idle;
const pendingWithdrawals = client.stores.withdrawals.pending;
const completedWithdrawals = client.stores.withdrawals.completed;

// Filter by status
const allocations = client.stores.allocations.getByStatus(AllocationStatus.Idle);
```

### 2. Active (API) Queries

Fetch fresh data from backend (network call):

```typescript
// Fetch by owner
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();
await client.stores.withdrawals.getByOwner();

// Fetch by ID
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);
await client.stores.withdrawals.getById(withdrawalId);

// Fetch with filters and pagination
await client.stores.allocations.getList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});

await client.stores.withdrawals.getList({
  status: WithdrawRequestStatus.Pending,
  page: 1,
  page_size: 10,
});

// Fetch statistics
await client.stores.withdrawals.getStats();
```

**When to use each**:
- **Local queries**: For immediate access, UI rendering, computed values
- **Active queries**: For initial load, explicit refresh, fetching specific data

---

## Checkbook Related

### Backend API: Unified Checkbooks Endpoint

**Important**: The backend has merged deposit and checkbook information into a single `/api/checkbooks` endpoint.

### `client.stores.checkbooks.getByOwner()`

**Description**: Fetch all checkbooks for the current user (includes deposit info)

**Backend API**: `GET /api/checkbooks?user_address={address}`

**Response**:
```typescript
{
  checkbooks: [
    {
      id: number;
      user_address: string;
      chain_id: number;
      token_id: number;
      status: CheckbookStatus;
      checkbook_address: string | null;
      total_deposited: string;
      total_allocated: string;
      available_balance: string;
      created_at: string;
      updated_at: string;
    }
  ]
}
```

**Usage**:
```typescript
// Fetch checkbooks
await client.stores.checkbooks.getByOwner();

// Access from Store (observable)
const checkbooks = client.stores.checkbooks.all;
console.log('Checkbooks:', checkbooks);

// Get specific checkbook
const checkbook = client.stores.checkbooks.get(checkbookId);

// Computed properties
const totalDeposited = client.stores.checkbooks.totalDeposited; // BigInt
const activeCheckbooks = checkbooks.filter(c => 
  c.status === CheckbookStatus.WithCheckbook
);
```

### `client.stores.checkbooks.getById(id)`

**Description**: Fetch a specific checkbook by ID

**Backend API**: `GET /api/checkbooks/{id}`

**Usage**:
```typescript
const checkbook = await client.stores.checkbooks.getById(123);
console.log('Checkbook status:', checkbook.status);
```

### `client.stores.checkbooks.getList(filters)`

**Description**: Query checkbooks with filters

**Backend API**: `GET /api/checkbooks?token_id={token_id}&status={status}&...`

**Parameters**:
```typescript
{
  token_id?: number;
  status?: CheckbookStatus;
  chain_id?: number;
  page?: number;
  page_size?: number;
}
```

**Usage**:
```typescript
// Get all ETH checkbooks that are active
const ethCheckbooks = await client.stores.checkbooks.getList({
  token_id: 1,
  status: CheckbookStatus.WithCheckbook,
});
```

---

## Allocation Related

### `client.stores.allocations.getByOwner()`

**Description**: Fetch all allocations for the current user

**Backend API**: `GET /api/allocations?user_address={address}`

**Response**:
```typescript
{
  allocations: [
    {
      id: number;
      checkbook_id: number;
      token_id: number;
      value: string;      // BigInt as string
      salt: string;       // bytes32
      nullifier: string;  // bytes32
      status: AllocationStatus;
      withdraw_request_id: number | null;
      created_at: string;
      updated_at: string;
    }
  ]
}
```

**Usage**:
```typescript
// Fetch all allocations
await client.stores.allocations.getByOwner();

// Access from Store
const allocations = client.stores.allocations.all;

// Computed properties
const idleAllocations = client.stores.allocations.idle;
const pendingAllocations = client.stores.allocations.pending;
const usedAllocations = client.stores.allocations.used;

// Group by token
const allocationsByToken = client.stores.allocations.byToken; // Map<token_id, Allocation[]>
const ethAllocations = allocationsByToken.get(1); // Get ETH allocations
```

### `client.stores.allocations.getByTokenIdAndStatus(tokenId, status)`

**Description**: Get allocations filtered by token ID and status

**Backend API**: `GET /api/allocations?token_id={tokenId}&status={status}`

**Usage**:
```typescript
// Get all idle ETH allocations
const idleEth = await client.stores.allocations.getByTokenIdAndStatus(
  1, // ETH token_id
  AllocationStatus.Idle
);

console.log('Available ETH allocations:', idleEth.length);
console.log('Total value:', idleEth.reduce((sum, a) => sum + BigInt(a.value), 0n));
```

### `client.stores.allocations.getByCheckbookIdAndStatus(checkbookId, status)`

**Description**: Get allocations for a specific checkbook with status filter

**Backend API**: `GET /api/allocations?checkbook_id={checkbookId}&status={status}`

**Usage**:
```typescript
// Get all idle allocations for a specific checkbook
const checkbookAllocations = await client.stores.allocations.getByCheckbookIdAndStatus(
  123, // checkbook_id
  AllocationStatus.Idle
);
```

### `client.stores.allocations.getList(filters)`

**Description**: Query allocations with advanced filters

**Backend API**: `GET /api/allocations?{filters}`

**Parameters**:
```typescript
{
  checkbook_id?: number;
  token_id?: number;
  status?: AllocationStatus;
  withdraw_request_id?: number;
  page?: number;
  page_size?: number;
}
```

**Usage**:
```typescript
// Get page 1 of idle ETH allocations
const result = await client.stores.allocations.getList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});

console.log('Total:', result.total);
console.log('Allocations:', result.allocations);
```

### `client.stores.allocations.createAllocations(params)`

**Description**: Create new allocations (auto-generates salt and nullifier)

**Backend API**: `POST /api/allocations`

**Parameters**:
```typescript
{
  checkbook_id: number;
  allocations: Array<{
    token_id: number;
    value: string; // BigInt as string
  }>;
}
```

**Usage**:
```typescript
const newAllocations = await client.stores.allocations.createAllocations({
  checkbook_id: 123,
  allocations: [
    { token_id: 1, value: '1000000000000000000' }, // 1 ETH
    { token_id: 1, value: '500000000000000000' },  // 0.5 ETH
  ],
});

console.log('Created allocations:', newAllocations);
```

---

## Commitment Related

The SDK implements commitment data preparation internally for security and offline support.

### `client.prepareCommitment(allocations, checkbookAddress)`

**Description**: Prepare commitment signing data (SDK internal, no backend call)

**Backend API**: None (pure SDK operation)

**Parameters**:
- `allocations: Allocation[]` - List of allocations to commit
- `checkbookAddress: string` - Checkbook contract address

**Returns**:
```typescript
{
  message: string;              // Message to sign
  sortedAllocations: Allocation[]; // Allocations sorted by SDK rules
  commitmentsHash: string;      // Hash of commitments
}
```

**Usage**:
```typescript
const allocations = client.stores.allocations.idle;
const checkbookAddress = '0x...';

const preparedData = await client.prepareCommitment(allocations, checkbookAddress);
console.log('Message to sign:', preparedData.message);
```

### `client.submitCommitment(preparedData, checkbookAddress)`

**Description**: Sign and submit commitment to backend

**Backend API**: `POST /api/commitments`

**Request**:
```typescript
{
  checkbook_address: string;
  allocations: Array<{
    token_id: number;
    value: string;
    salt: string;
    nullifier: string;
  }>;
  signature: string;
}
```

**Usage**:
```typescript
const result = await client.submitCommitment(preparedData, checkbookAddress);
console.log('Commitment submitted:', result);
```

### `client.createCommitment(allocations, checkbookAddress)`

**Description**: Complete commitment process (prepare + sign + submit)

**Backend API**: `POST /api/commitments`

**Usage**:
```typescript
// One-step commitment
const result = await client.createCommitment(allocations, checkbookAddress);
console.log('✅ Commitment completed');
```

---

## Withdrawal Related

### Withdrawal Intent Types

```typescript
interface WithdrawIntent {
  target_address: string;      // Recipient address
  target_chain_id: number;     // Target chain ID
  token_id: number;            // Token ID
  min_amount_out: string;      // Minimum acceptable amount (slippage protection)
}
```

**Intent Examples**:

| Intent Type | Description | target_chain_id | Example |
|------------|-------------|-----------------|---------|
| Same-chain withdrawal | Withdraw to same chain | Same as source | `target_chain_id: 1` (on Ethereum) |
| Cross-chain bridge | Bridge to different chain | Different chain | `target_chain_id: 56` (to BSC) |
| Cross-chain swap | Bridge + token swap | Different chain | `target_chain_id: 137, token_id: 2` (to Polygon USDT) |

### `client.prepareWithdraw(allocations, intent)`

**Description**: Prepare withdrawal signing data (SDK internal, no backend call)

**Backend API**: None (pure SDK operation)

**Parameters**:
- `allocations: Allocation[]` - Allocations to withdraw (must be `idle` status)
- `intent: WithdrawIntent` - Withdrawal intent parameters

**Returns**:
```typescript
{
  message: string;          // Message to sign
  nullifiersHash: string;   // Hash of nullifiers
  merkleRoot: string;       // Merkle root of allocations
  intentHash: string;       // Hash of intent
}
```

**Usage**:
```typescript
const allocations = client.stores.allocations.idle.filter(a => a.token_id === 1);
const intent = {
  target_address: '0xYourAddress',
  target_chain_id: 1,
  token_id: 1,
  min_amount_out: '990000000000000000', // 0.99 ETH (1% slippage)
};

const preparedData = await client.prepareWithdraw(allocations, intent);
console.log('Message to sign:', preparedData.message);
```

### `client.submitWithdraw(allocations, intent, preparedData)`

**Description**: Sign and submit withdrawal to backend

**Backend API**: `POST /api/withdrawals`

**Request**:
```typescript
{
  allocation_ids: number[];
  intent: WithdrawIntent;
  merkle_root: string;
  nullifiers_hash: string;
  signature: string;
}
```

**Usage**:
```typescript
const result = await client.submitWithdraw(allocations, intent, preparedData);
console.log('Withdrawal submitted:', result);
```

### `client.withdraw(allocations, intent)`

**Description**: Complete withdrawal process (prepare + sign + submit)

**Backend API**: `POST /api/withdrawals`

**Usage**:
```typescript
// One-step withdrawal
const result = await client.withdraw(allocations, intent);
console.log('✅ Withdrawal request created');
```

### `client.stores.withdrawals.getList(filters)`

**Description**: Query withdrawal requests with filters and pagination

**Backend API**: `GET /api/withdrawals?{filters}`

**Parameters**:
```typescript
{
  status?: WithdrawRequestStatus;
  token_id?: number;
  page?: number;
  page_size?: number;
}
```

**Usage**:
```typescript
// Get pending withdrawals
const pending = await client.stores.withdrawals.getList({
  status: WithdrawRequestStatus.Pending,
  page: 1,
  page_size: 10,
});

console.log('Pending withdrawals:', pending.withdrawals);
console.log('Total:', pending.total);
```

### `client.stores.withdrawals.getById(id)`

**Description**: Get a specific withdrawal request by ID

**Backend API**: `GET /api/withdrawals/{id}`

**Usage**:
```typescript
const withdrawal = await client.stores.withdrawals.getById(123);
console.log('Withdrawal status:', withdrawal.status);
```

### `client.stores.withdrawals.getByNullifier(nullifier)`

**Description**: Get withdrawal request by nullifier

**Backend API**: `GET /api/withdrawals/by-nullifier/{nullifier}`

**Usage**:
```typescript
const withdrawal = await client.stores.withdrawals.getByNullifier('0x...');
```

### `client.stores.withdrawals.getStats()`

**Description**: Get withdrawal statistics for the current user

**Backend API**: `GET /api/withdrawals/stats`

**Response**:
```typescript
{
  total_withdrawals: number;
  pending_count: number;
  completed_count: number;
  failed_count: number;
  total_amount_withdrawn: string;
}
```

**Usage**:
```typescript
const stats = await client.stores.withdrawals.getStats();
console.log('Total withdrawals:', stats.total_withdrawals);
console.log('Pending:', stats.pending_count);
```

### `client.stores.withdrawals.retry(id)`

**Description**: Retry a failed withdrawal

**Backend API**: `POST /api/withdrawals/{id}/retry`

**Usage**:
```typescript
await client.stores.withdrawals.retry(123);
console.log('✅ Withdrawal retry initiated');
```

### `client.stores.withdrawals.cancel(id)`

**Description**: Cancel a pending withdrawal

**Backend API**: `POST /api/withdrawals/{id}/cancel`

**Usage**:
```typescript
await client.stores.withdrawals.cancel(123);
console.log('✅ Withdrawal cancelled');
```

---

## SDK Internal Implementation vs Backend API

| Operation | SDK Internal | Backend API | Reason |
|-----------|-------------|-------------|--------|
| Generate commitment message | ✅ `prepareCommitment()` | ❌ | Offline signing support |
| Sign commitment | ✅ `wallet.signMessage()` | ❌ | Private key never leaves client |
| Submit commitment | ❌ | ✅ `POST /api/commitments` | Backend verification & storage |
| Generate withdrawal message | ✅ `prepareWithdraw()` | ❌ | Offline signing support |
| Sign withdrawal | ✅ `wallet.signMessage()` | ❌ | Private key never leaves client |
| Submit withdrawal | ❌ | ✅ `POST /api/withdrawals` | Backend processing & on-chain execution |
| Calculate Merkle root | ✅ `calculateMerkleRoot()` | ❌ | Client verification (backend recalculates) |
| Hash allocations | ✅ `hashCommitments()` | ❌ | Transparent to user |
| Sort allocations | ✅ `sortAllocations()` | ❌ | Ensure consistency across SDKs |

**Design Trade-offs**:

1. **Offline Support**: Users can generate signing data without network
2. **Transparency**: Users see exactly what they're signing
3. **Security**: Private keys never transmitted to backend
4. **Verification**: Backend recalculates and verifies all hashes
5. **Consistency**: Standardized algorithms ensure cross-language SDK consistency

---

## Status System

### Checkbook Status Flow

```
┌─────────┐
│ Pending │ ──── Proof generation ────┐
└─────────┘                            │
                                       ▼
┌──────────────────────┐         ┌────────────┐
│ ReadyForCommitment   │◄────────│ ProofFailed│
└──────────────────────┘         └────────────┘
        │                              ▲
        │ User creates commitment      │
        ▼                              │
┌──────────────┐                       │
│WithCheckbook │───── If proof fails ──┘
└──────────────┘
```

### Allocation Status Flow

```
┌──────┐
│ Idle │ ──── Available for new WithdrawRequest
└──────┘
   │
   │ Included in WithdrawRequest
   ▼
┌─────────┐
│ Pending │ ──── Part of active WithdrawRequest
└─────────┘
   │
   │ WithdrawRequest completed
   ▼
┌──────┐
│ Used │ ──── Successfully withdrawn
└──────┘
```

**Note**: If WithdrawRequest fails, allocations revert from `pending` to `idle`.

### WithdrawRequest Two-Stage Architecture

**Stage 1: On-chain Withdrawal Request**
```
┌─────────┐
│ Pending │ ──── Processing on-chain
└─────────┘
   │
   ├──► Stage 1 successful ──► ┌───────────┐
   │                            │ Completed │
   │                            └───────────┘
   │
   └──► Stage 1 failed ──────► ┌────────┐
                                │ Failed │
                                └────────┘
```

**Stage 2: Cross-chain Conversion** (separate service, out of SDK scope)
- After `completed` status, cross-chain bridge/swap service takes over
- SDK only tracks Stage 1 status
- For same-chain withdrawals, `completed` means funds received
- For cross-chain, `completed` means on-chain request done (conversion pending)

---

## Status Definitions

### CheckbookStatus

| Status | Value | Description | Can Create Allocation? | Can Commit? |
|--------|-------|-------------|----------------------|-------------|
| Pending | `'pending'` | Proof generation in progress | ❌ | ❌ |
| ReadyForCommitment | `'ready_for_commitment'` | Proof ready, waiting for commitment | ✅ | ✅ |
| WithCheckbook | `'with_checkbook'` | Checkbook activated (commitment done) | ✅ | ❌ (already committed) |
| ProofFailed | `'proof_failed'` | Proof generation failed | ❌ | ❌ |

**Usage**:
```typescript
const checkbook = client.stores.checkbooks.get(id);

// Check if can create allocations
if (checkbook.status === CheckbookStatus.ReadyForCommitment ||
    checkbook.status === CheckbookStatus.WithCheckbook) {
  // Can create allocations
}

// Check if needs commitment
if (checkbook.status === CheckbookStatus.ReadyForCommitment) {
  // User needs to create commitment
}
```

### AllocationStatus

| Status | Value | Description | Can Include in Withdrawal? | Associated WithdrawRequest |
|--------|-------|-------------|---------------------------|---------------------------|
| Idle | `'idle'` | Available for use | ✅ | None |
| Pending | `'pending'` | Part of active WithdrawRequest | ❌ | Yes (active) |
| Used | `'used'` | Successfully withdrawn | ❌ | Yes (completed) |

**Purpose**: Allocation status primarily controls whether it can be included in a new WithdrawRequest.

**Lifecycle**:
```
idle → pending (when WithdrawRequest created)
     → used    (when WithdrawRequest completed)
     → idle    (when WithdrawRequest failed - allows retry)
```

**Usage**:
```typescript
// Get available allocations for withdrawal
const idleAllocations = client.stores.allocations.idle;

// Check if allocation can be withdrawn
function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// Get allocations by status
const idleEth = await client.stores.allocations.getByTokenIdAndStatus(
  1,
  AllocationStatus.Idle
);
```

### WithdrawRequestStatus

| Status | Value | Description | Stage | Can Retry? | Can Cancel? |
|--------|-------|-------------|-------|-----------|------------|
| Pending | `'pending'` | Processing on-chain | Stage 1 | ❌ | ✅ |
| Completed | `'completed'` | On-chain request done | Stage 1 done | ❌ | ❌ |
| Failed | `'failed'` | On-chain request failed | Stage 1 failed | ✅ | ❌ |

**Important Notes**:

1. **`completed` means Stage 1 complete**:
   - For same-chain: Funds received
   - For cross-chain: On-chain request done, conversion pending (Stage 2)
   - Stage 2 (cross-chain conversion) is handled by separate service

2. **Relationship with Allocations**:
   - When WithdrawRequest is `pending`: Associated allocations are `pending`
   - When WithdrawRequest is `completed`: Associated allocations become `used`
   - When WithdrawRequest is `failed`: Associated allocations revert to `idle`

**Usage**:
```typescript
// Get pending withdrawals
const pending = client.stores.withdrawals.pending;

// Check if can retry
if (withdrawal.status === WithdrawRequestStatus.Failed) {
  await client.stores.withdrawals.retry(withdrawal.id);
}

// Check if can cancel
if (withdrawal.status === WithdrawRequestStatus.Pending) {
  await client.stores.withdrawals.cancel(withdrawal.id);
}

// Monitor withdrawal status
switch (withdrawal.status) {
  case WithdrawRequestStatus.Pending:
    console.log('⏳ Withdrawal processing...');
    break;
  case WithdrawRequestStatus.Completed:
    console.log('✅ Withdrawal completed (on-chain)');
    if (withdrawal.target_chain_id !== withdrawal.source_chain_id) {
      console.log('💱 Cross-chain conversion in progress...');
    }
    break;
  case WithdrawRequestStatus.Failed:
    console.log('❌ Withdrawal failed, can retry');
    break;
}
```

---

## Pools & Tokens

### `client.stores.pools.getAll()`

**Description**: Get all pools from Store

**SDK API**:
```typescript
const pools = client.stores.pools.all;
```

**Backend API**: `GET /api/pools?page=1&size=100` (called during initial sync)

**Response**:
```typescript
{
  "pools": [
    {
      "id": 1,
      "name": "Aave V3",
      "protocol": "Aave V3",
      "featured": true,
      "chain_id": 714,
      "address": "0x...",
      "created_at": "2025-01-17T12:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "size": 100
}
```

### `client.stores.pools.getFeatured()`

**Description**: Get featured pools (computed value from Store)

**SDK API**:
```typescript
const featured = client.stores.pools.find(p => p.featured);
```

**Backend API**: `GET /api/pools/featured` (optional)

### `client.stores.pools.get(id)`

**Description**: Get a specific pool by ID

**SDK API**:
```typescript
const pool = client.stores.pools.get('1');
```

**Backend API**: `GET /api/pools/{id}` (optional, for detailed info)

**Response**:
```typescript
{
  "pool": {
    "id": 1,
    "name": "Aave V3",
    "protocol": "Aave V3",
    "featured": true,
    "chain_id": 714,
    "address": "0x...",
    "description": "Aave V3 lending pool"
  },
  "tokens": [
    {
      "id": 1,
      "asset_id": "0x000...",
      "symbol": "aUSDT",
      "name": "Aave USDT",
      "decimals": 6
    }
  ]
}
```

### `client.stores.pools.getTokens(poolId)`

**Description**: Get tokens for a specific pool

**Backend API**: `GET /api/pools/{id}/tokens`

**Usage**:
```typescript
const tokens = client.stores.pools.getTokens(1);
```

### `client.searchTokens(keyword)`

**Description**: Search tokens by keyword

**Backend API**: `GET /api/tokens/search?keyword={keyword}&limit=10`

**Usage**:
```typescript
const results = await client.searchTokens('USDT');
```

---

## Token Prices

### `client.subscribePrices(assetIds)`

**Description**: Subscribe to price updates via WebSocket

**SDK API**:
```typescript
await client.subscribePrices([
  '0x00000001000100000000000000000000000000000000000000000000000000000',
]);
```

**WebSocket Message**:
```json
// Subscribe request
{
  "action": "subscribe",
  "type": "prices",
  "asset_ids": ["0x00000001000100000000000000000000000000000000000000000000000000000"],
  "timestamp": 1705500000
}

// Price update (pushed every minute)
{
  "type": "price_update",
  "asset_id": "0x00000001000100000000000000000000000000000000000000000000000000000",
  "price": "1234.56",
  "change_24h": "+5.2%",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### `client.stores.prices.get(assetId)`

**Description**: Get price for a specific asset from Store

**SDK API**:
```typescript
const price = client.stores.prices.get('0x000...');
```

**Backend API**: `GET /api/tokens/{asset_id}/price` (optional, for initial price)

### `client.stores.prices.getBatch(assetIds)`

**Description**: Get prices for multiple assets (computed from Store)

**Backend API**: `POST /api/tokens/prices` (optional, for batch initial fetch)

**Request**:
```typescript
{
  "asset_ids": [
    "0x00000001000100000000000000000000000000000000000000000000000000000",
    "0x00000001000200000000000000000000000000000000000000000000000000000"
  ]
}
```

### `client.stores.prices.getHistory(assetId, days)`

**Description**: Get price history for an asset

**Backend API**: `GET /api/tokens/{asset_id}/price-history?days={days}&limit=100`

**Usage**:
```typescript
const history = await client.stores.prices.getHistory('0x000...', 30);
```

---

## WebSocket Subscriptions

### Connection Establishment

**SDK Internal**:
```typescript
const ws = new WebSocket(`wss://api.enclave-hq.com/api/ws?token=${JWT_TOKEN}`);

// Connection confirmation
{
  "type": "connected",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connected to WebSocket service",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### Subscription Types

| SDK Method | WebSocket Type | Message Type |
|---------|-------------------|---------|
| `client.connect()` | `deposits` | `deposit_update` |
| `client.connect()` | `checkbooks` | `checkbook_update` |
| `client.connect()` | `withdraw_requests` | `withdrawal_update` |
| `client.subscribePrices()` | `prices` | `price_update` |

### Subscribe to Deposit Updates

```json
// SDK sends
{
  "action": "subscribe",
  "type": "deposits",
  "address": "0x...",
  "timestamp": 1705500000
}

// Subscription confirmed
{
  "type": "subscription_confirmed",
  "sub_type": "deposits",
  "message": "Subscribed to deposits",
  "timestamp": "2025-01-17T12:00:00Z"
}

// Update pushed
{
  "type": "deposit_update",
  "data": {
    "id": 1,
    "chain_id": 714,
    "amount": "1000000",
    "status": "detected",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### Subscribe to Checkbook Updates

```json
// SDK sends
{
  "action": "subscribe",
  "type": "checkbooks",
  "address": "0x...",
  "timestamp": 1705500000
}

// Update pushed
{
  "type": "checkbook_update",
  "data": {
    "id": "uuid",
    "status": "with_checkbook",
    "commitment": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### Subscribe to Withdrawal Updates

```json
// SDK sends
{
  "action": "subscribe",
  "type": "withdraw_requests",
  "address": "0x...",
  "timestamp": 1705500000
}

// Update pushed
{
  "type": "withdrawal_update",
  "data": {
    "id": "uuid",
    "status": "completed",
    "execute_status": "success",
    "payout_status": "success",
    "execute_tx_hash": "0x...",
    "payout_tx_hash": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### Unsubscribe

```json
// SDK sends
{
  "action": "unsubscribe",
  "type": "prices",
  "timestamp": 1705500000
}

// Unsubscription confirmed
{
  "type": "unsubscription_confirmed",
  "sub_type": "prices",
  "message": "Unsubscribed from prices",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

---

## Error Handling

### HTTP Status Code Mapping

| HTTP Status | SDK Error Type | Handling |
|-----------|-------------|---------|
| 200/201 | - | Normal response |
| 400 | `ValidationError` | Parameter validation failed |
| 401 | `AuthenticationError` | Token expired, re-login required |
| 403 | `PermissionError` | Insufficient permissions |
| 404 | `NotFoundError` | Resource not found |
| 500 | `ServerError` | Server error, retry |
| 503 | `ServiceUnavailableError` | Service unavailable, retry |

### Error Handling Example

```typescript
try {
  await client.deposit(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Re-login
    await client.connect(privateKey);
    await client.deposit(params); // Retry
  } else if (error instanceof ValidationError) {
    // Parameter error, notify user
    console.error('Invalid parameters:', error.message);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

---

## Complete Flow Example

### Deposit to Withdrawal Complete Flow

```typescript
// 1. Connect
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});
await client.connect(privateKey);

// 2. Deposit
const depositResult = await client.deposit({
  chainId: 714,
  tokenAddress: '0x...',
  amount: '1000000',
});

// 3. Wait for deposit detection (automatic via WebSocket)
client.stores.deposits.on('added', (deposit) => {
  console.log('Deposit detected:', deposit);
});

// 4. Create allocation
const allocationResult = await client.createAllocation({
  checkbookId: depositResult.checkbookId,
  allocations: [
    {
      recipient_chain_id: 714,
      recipient_address: '0x...',
      amount: '500000',
    },
  ],
});

// 5. Wait for Checkbook status update (automatic via WebSocket)
client.stores.checkbooks.on('updated', (checkbook) => {
  if (checkbook.status === 'with_checkbook') {
    console.log('Checkbook ready');
  }
});

// 6. Withdraw
const withdrawalResult = await client.withdraw({
  allocationIds: ['uuid1'],
  recipient: {
    chain_id: 714,
    address: '0x...',
    amount: '500000',
    token_symbol: 'USDT',
  },
});

// 7. Monitor withdrawal status (automatic via WebSocket)
client.stores.withdrawals.on('updated', (withdrawal) => {
  console.log('Withdrawal status:', withdrawal.status);
  if (withdrawal.status === 'completed') {
    console.log('Withdrawal complete!', withdrawal.payout_tx_hash);
  }
});
```

---

**For additional technical details, please refer to**:
- **Complete Chinese Version**: [SDK_API_MAPPING.zh-CN.md](./SDK_API_MAPPING.zh-CN.md) - Full API mappings with all details
- **Technical Design**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md) - Internal architecture
- **SDK Overview**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md) - High-level introduction

---

**Version**: v2.0.0  
**Last Updated**: 2025-01-17  
**Status**: Complete ✅
