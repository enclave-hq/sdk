# Enclave SDK Complete Guide

> **Last Updated**: 2025-01-XX  
> **SDK Version**: v2.0.2

**Languages**: English | [中文](./SDK_COMPLETE_GUIDE.md) | [日本語](./SDK_COMPLETE_GUIDE.ja.md) | [한국어](./SDK_COMPLETE_GUIDE.ko.md)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [SDK API Inventory](#sdk-api-inventory)
3. [WebFront Integration Guide](#webfront-integration-guide)
4. [Usage Examples](#usage-examples)
5. [Changelog](#changelog)

---

## Overview

Enclave SDK provides a complete JavaScript/TypeScript client library for interacting with the Enclave privacy-preserving multi-chain DeFi protocol.

### Core Features

- 🔄 **Reactive State Management** - Based on MobX, automatic data synchronization
- 🔌 **Real-time Push** - WebSocket automatic push updates, no polling required
- 🌐 **Universal Environment** - Supports Browser, Node.js, React Native, Electron
- ⚡ **TypeScript First** - Complete type definitions and inference
- 🎯 **Framework Integration** - React, Vue, Next.js out of the box

### Architecture Overview

```
WebFront Page Layer
  ↓ useHooks
Business Hooks Layer
  ↓ call
Store Layer (MobX)
  ↓ call
SDK Layer (@enclave-hq/sdk)
  ↓ call
Backend API / On-chain Contracts
```

---

## SDK API Inventory

### Overview

The SDK includes **13 API client classes** providing **68 API methods**.

### API Client Categories

#### 1. 🔐 Authentication (AuthAPI) - 5 methods

- **`authenticate(request: AuthRequest)`** - Wallet signature login
  ```typescript
  await client.auth.authenticate({
    address: { universalFormat: '0x...' },
    message: 'Sign this message...',
    signature: '0x...',
    chainId: 1
  });
  ```
- **`refreshToken(request: RefreshTokenRequest)`** - Refresh JWT Token
  ```typescript
  await client.auth.refreshToken({ token: 'old-token' });
  ```
- **`logout()`** - Logout
  ```typescript
  await client.auth.logout();
  ```
- **`verifyToken()`** - Verify Token validity
  ```typescript
  const isValid = await client.auth.verifyToken();
  ```
- **`getNonce(address?: string)`** - Get signature challenge Nonce
  ```typescript
  const { nonce, message } = await client.auth.getNonce('0x...');
  ```

#### 2. 📝 Checkbook (CheckbooksAPI) - 5 methods

- **`listCheckbooks(request?: ListCheckbooksRequest)`** - List user's Checkbooks
  ```typescript
  const checkbooks = await client.checkbooks.listCheckbooks({
    page: 1,
    limit: 10,
    status: 'active'
  });
  ```
- **`getCheckbookById(request: GetCheckbookRequest)`** - Get single Checkbook
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookById({ id: 'cb-123' });
  ```
- **`getCheckbookByDeposit(request: GetCheckbookByDepositRequest)`** - Get Checkbook by Deposit
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookByDeposit({
    chainId: 1,
    txHash: '0x...'
  });
  ```
- **`getCheckbooksByOwner(owner: string, ...)`** - (Deprecated) Query Checkbooks by owner
  ```typescript
  // Use listCheckbooks() instead
  ```
- **`deleteCheckbook(id: string)`** - Delete Checkbook
  ```typescript
  await client.checkbooks.deleteCheckbook('cb-123');
  ```

#### 3. 💰 Allocation (AllocationsAPI) - 5 methods

- **`listAllocations(request?: ListAllocationsRequest)`** - List allocation records
  ```typescript
  const allocations = await client.allocations.listAllocations({
    checkbookId: 'cb-123',
    status: 'active'
  });
  ```
- **`searchAllocations(request: SearchAllocationsRequest)`** - Batch search allocations
  ```typescript
  const results = await client.allocations.searchAllocations({
    chain_slip44_id: 60,
    addresses: ['0x...']
  });
  ```
- **`createAllocations(request: CreateAllocationsRequest)`** - Create allocation (Commitment)
  ```typescript
  await client.allocations.createAllocations({
    checkbookId: 'cb-123',
    amounts: ['1000'],
    tokenKey: 'USDT',
    signature: '0x...',
    message: '...'
  });
  ```
- **`getAllocationsByCheckbookId(checkbookId: string, status?: string)`** - Query allocations by Checkbook
  ```typescript
  const list = await client.allocations.getAllocationsByCheckbookId('cb-123');
  ```
- **`getAllocationsByTokenIdAndStatus(tokenId: string, status: string)`** - Query allocations by Token and status
  ```typescript
  const list = await client.allocations.getAllocationsByTokenIdAndStatus('token-1', 'active');
  ```

#### 4. 📤 Withdrawal (WithdrawalsAPI) - 7 methods

- **`listWithdrawRequests(request?: ListWithdrawRequestsRequest)`** - List withdrawal requests
  ```typescript
  const requests = await client.withdrawals.listWithdrawRequests({
    page: 1,
    limit: 20,
    status: 'pending'
  });
  ```
- **`getWithdrawRequestById(request: GetWithdrawRequestRequest)`** - Get single withdrawal request
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestById({ id: 'req-123' });
  ```
- **`getWithdrawRequestByNullifier(request: GetWithdrawRequestByNullifierRequest)`** - Query by nullifier
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestByNullifier({ nullifier: '0x...' });
  ```
- **`createWithdrawRequest(request: CreateWithdrawRequestRequest)`** - Create withdrawal request
  ```typescript
  await client.withdrawals.createWithdrawRequest({
    checkbookId: 'cb-123',
    allocationIds: ['alloc-1'],
    intent: { ... },
    signature: '0x...',
    chainId: 1
  });
  ```
- **`retryWithdrawRequest(request: RetryWithdrawRequestRequest)`** - Retry failed withdrawal
  ```typescript
  await client.withdrawals.retryWithdrawRequest({ id: 'req-123' });
  ```
- **`cancelWithdrawRequest(request: CancelWithdrawRequestRequest)`** - Cancel withdrawal request
  ```typescript
  await client.withdrawals.cancelWithdrawRequest({ id: 'req-123' });
  ```
- **`getWithdrawStats(request?: GetWithdrawStatsRequest)`** - Get withdrawal statistics
  ```typescript
  const stats = await client.withdrawals.getWithdrawStats();
  ```

#### 5. 👥 Beneficiary (BeneficiaryAPI) - 3 methods ⭐

- **`listBeneficiaryWithdrawRequests(request?: ListBeneficiaryWithdrawRequestsRequest)`** - List withdrawal requests as beneficiary
  ```typescript
  const requests = await client.beneficiary.listBeneficiaryWithdrawRequests({
    status: 'waiting_for_payout'
  });
  ```
- **`requestPayoutExecution(request: RequestPayoutExecutionRequest)`** - Request payout execution
  ```typescript
  await client.beneficiary.requestPayoutExecution({ id: 'req-123' });
  ```
- **`claimTimeout(request: ClaimTimeoutRequest)`** - Claim timeout
  ```typescript
  await client.beneficiary.claimTimeout({ id: 'req-123' });
  ```

#### 6. 🏊 Pool & Token (PoolsAPI) - 5 methods

- **`listPools(request?: ListPoolsRequest)`** - List all pools
  ```typescript
  const pools = await client.pools.listPools({ isActive: true });
  ```
- **`getPoolById(request: GetPoolRequest)`** - Get pool details
  ```typescript
  const pool = await client.pools.getPoolById({ id: 'pool-1' });
  ```
- **`listTokens(request?: ListTokensRequest)`** - List tokens
  ```typescript
  const tokens = await client.pools.listTokens({ chainId: 1 });
  ```
- **`getTokenById(request: GetTokenRequest)`** - Get token details
  ```typescript
  const token = await client.pools.getTokenById({ id: 'token-1' });
  ```
- **`getActiveTokens(chainId?: number)`** - Get active tokens
  ```typescript
  const tokens = await client.pools.getActiveTokens(1);
  ```

#### 7. 💹 Price (PricesAPI) - 3 methods

- **`getTokenPrices(request?: GetTokenPricesRequest)`** - Batch get token prices
  ```typescript
  const prices = await client.prices.getTokenPrices({ symbols: ['ETH', 'USDT'] });
  ```
- **`getTokenPrice(symbol: string)`** - Get single token price
  ```typescript
  const price = await client.prices.getTokenPrice('ETH');
  ```
- **`getAllPrices()`** - Get all prices
  ```typescript
  const allPrices = await client.prices.getAllPrices();
  ```

#### 8. 📊 Metrics (MetricsAPI) - 6 methods

- **`getPoolMetrics(poolId: number)`** - Get pool metrics
  ```typescript
  const metrics = await client.metrics.getPoolMetrics(1);
  ```
- **`getTokenMetrics(assetId: string)`** - Get token metrics
  ```typescript
  const metrics = await client.metrics.getTokenMetrics('0x...');
  ```
- **`getPoolMetricsHistory(poolId: number, metricType: string, days?: number)`** - Get pool metrics history
  ```typescript
  const history = await client.metrics.getPoolMetricsHistory(1, 'apy', 30);
  ```
- **`getTokenMetricsHistory(assetId: string, metricType: string, days?: number)`** - Get token metrics history
  ```typescript
  const history = await client.metrics.getTokenMetricsHistory('0x...', 'price', 7);
  ```
- **`getBatchPoolMetrics(poolIds: number[])`** - Batch get pool metrics
  ```typescript
  const batch = await client.metrics.getBatchPoolMetrics([1, 2]);
  ```
- **`getBatchTokenMetrics(assetIds: string[])`** - Batch get token metrics
  ```typescript
  const batch = await client.metrics.getBatchTokenMetrics(['0x...', '0x...']);
  ```

#### 9. 🛣️ Quote (QuoteAPI) - 2 methods

- **`getRouteAndFees(request: RouteAndFeesRequest)`** - Query route and fees
  ```typescript
  const quote = await client.quote.getRouteAndFees({
    amount: '1000',
    deposit_token: '0x...',
    owner_data: { ... },
    intent: { ... }
  });
  ```
- **`getHookAsset(request: HookAssetRequest)`** - Query Hook asset information
  ```typescript
  const info = await client.quote.getHookAsset({
    asset_id: '0x...',
    chain_id: 1,
    amount: '1000'
  });
  ```

#### 10. 🔗 Chain Config (ChainConfigAPI) - 6 methods

- **`getChainConfig(chainId: number)`** - Get chain configuration
  ```typescript
  const config = await client.chainConfig.getChainConfig(1);
  ```
- **`getTreasuryAddress(chainId: number)`** - Get Treasury address
  ```typescript
  const address = await client.chainConfig.getTreasuryAddress(1);
  ```
- **`getIntentManagerAddress(chainId: number)`** - Get IntentManager address
  ```typescript
  const address = await client.chainConfig.getIntentManagerAddress(1);
  ```
- **`getRpcEndpoint(chainId: number)`** - Get RPC endpoint
  ```typescript
  const rpc = await client.chainConfig.getRpcEndpoint(1);
  ```
- **`listChains()`** - List all active chains
  ```typescript
  const chains = await client.chainConfig.listChains();
  ```
- **`getAllTreasuryAddresses()`** - Get all Treasury addresses
  ```typescript
  const addresses = await client.chainConfig.getAllTreasuryAddresses();
  ```

#### 11. 🔀 Token Routing (TokenRoutingAPI) - 3 methods ⭐

- **`getAllowedTargets(request?: GetAllowedTargetsRequest)`** - Query allowed target chains and tokens (supports query all without parameters)
  ```typescript
  const targets = await client.tokenRouting.getAllowedTargets({
    source_chain_id: 1,
    source_token_key: 'USDT'
  });
  ```
- **`getAllPoolsAndTokens()`** - Get all pools and tokens (convenience method)
  ```typescript
  const all = await client.tokenRouting.getAllPoolsAndTokens();
  ```
- **`getTargetsForSource(sourceChainId: number, sourceTokenId: string)`** - Get targets for specific source (convenience method)
  ```typescript
  const targets = await client.tokenRouting.getTargetsForSource(1, 'USDT');
  ```

#### 12. 🔑 KMS (KMSAPI) - 2 methods

- **`sign(request: KMSSignRequest)`** - Sign data using KMS
  ```typescript
  const sig = await client.kms.sign({ data: '0x...', keyId: '...' });
  ```
- **`getPublicKey(request?: KMSPublicKeyRequest)`** - Get KMS-managed public key
  ```typescript
  const pk = await client.kms.getPublicKey({ keyId: '...' });
  ```

#### 13. 🎯 EnclaveClient High-level Methods - 16 methods

**Connection Management (5)**:
- `connect()` - Connect to Enclave service
- `disconnect()` - Disconnect
- `connection` (getter) - Get connection info
- `isConnected` (getter) - Check connection status
- `address` (getter) - Get current user address

**Commitment Operations (3)**:
- `createCommitment(params)` - Create Commitment (full flow)
- `prepareCommitment(params)` - Prepare Commitment signature data
- `submitCommitment(params, signature)` - Submit signed Commitment

**Withdrawal Operations (5)**:
- `withdraw(params)` - Create withdrawal (full flow)
- `prepareWithdraw(params)` - Prepare withdrawal signature data
- `submitWithdraw(params, signature)` - Submit signed withdrawal
- `retryWithdraw(withdrawalId)` - Retry failed withdrawal request
- `cancelWithdraw(withdrawalId)` - Cancel pending withdrawal request

**API Accessors (5)**:
- `quote` (getter) - Access QuoteAPI
- `metrics` (getter) - Access MetricsAPI
- `chainConfig` (getter) - Access ChainConfigAPI
- `beneficiary` (getter) - Access BeneficiaryAPI
- `tokenRouting` (getter) - Access TokenRoutingAPI

### API Statistics Summary

| API Category | Method Count | Status |
|-------------|--------------|--------|
| Authentication | 5 | ✅ |
| Checkbook | 5 | ✅ |
| Allocation | 5 | ✅ |
| Withdrawal | 7 | ✅ |
| Beneficiary | 3 | ⭐ New |
| Pool & Token | 5 | ✅ |
| Price | 3 | ✅ |
| Metrics | 6 | ✅ |
| Quote | 2 | ✅ |
| Chain Config | 6 | ✅ |
| Token Routing | 3 | ⭐ New |
| KMS | 2 | ✅ |
| EnclaveClient High-level | 16 | ✅ |
| **Total** | **68** | ✅ |

---

## WebFront Integration Guide

### Integration Architecture

```
WebFront Page Layer (React Components, Pages, Hooks)
  ↓ useHooks
SDKStore (MobX Store)
  ↓ call
EnclaveClient (SDK Main Client)
  ↓ call
13 API Client Classes
  ↓ call
Backend REST API
```

### Core Interfaces (Required)

1. **EnclaveClient High-level Methods** - 16 methods
   - Connection management: 5
   - Commitment operations: 3
   - Withdrawal operations: 5
   - API accessors: 5

2. **Reactive Stores** - 5 Stores
   - `stores.checkbooks` - Checkbook data
   - `stores.allocations` - Allocation data
   - `stores.withdrawals` - Withdrawal data
   - `stores.prices` - Price data
   - `stores.pools` - Pool data

3. **API Accessors** - 3
   - `quote` - Route and fees query
   - `chainConfig` - Chain configuration query
   - `tokenRouting` - Token routing rules query

### Page to SDK Mapping

| Page | Page Content | Store Read | Hook Usage | SDK Method Call |
|------|-------------|------------|------------|-----------------|
| `/home` | Featured products, total locked | `stores.pools`<br>`stores.prices` | `useFeaturedPools()`<br>`useUserAssets()` | - |
| `/deposit` | Deposit records, voucher allocation | `stores.checkbooks`<br>`stores.allocations` | `useCheckbooksData()`<br>`useDepositActions()` | `sdk.createCommitment()` |
| `/defi` | Lending pools, RWA assets, withdrawal | `stores.pools`<br>`stores.allocations` | `useFeaturedPools()`<br>`useAllocationsData()`<br>`useQuoteRoute()` | `sdk.quote.getRouteAndFees()`<br>`sdk.withdraw()` |
| `/records` | Transaction history | `stores.withdrawals` | - | - |

### Usage

#### 1. Via SDKStore (Recommended)

```typescript
const sdkStore = useSDKStore()

// Get data
await sdkStore.fetchCheckbooks()
await sdkStore.fetchAllocations()

// Business operations
await sdkStore.createCommitment({ ... })
await sdkStore.withdraw({ ... })
```

#### 2. Direct SDK Usage (Advanced)

```typescript
const sdk = sdkStore.sdk
if (sdk) {
  // Use reactive Stores
  const checkbooks = sdk.stores.checkbooks.all
  const allocations = sdk.stores.allocations.all
  
  // Use API clients
  const quote = await sdk.quote.getRouteAndFees({ ... })
  const chainConfig = await sdk.chainConfig.getChainConfig(714)
  
  // Use new APIs
  const pools = await sdk.tokenRouting.getAllPoolsAndTokens()
}
```

---

## Usage Examples

### Example 1: Deposit and Create Commitment

```typescript
// 1. Connect SDK
await client.connect()

// 2. Get deposit records
const checkbooks = await client.stores.checkbooks.fetchList()

// 3. Create Commitment
const allocations = await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000'],
  tokenId: 'token-id'
})

// 4. Reactive update
// stores.allocations will automatically update
```

### Example 2: Withdraw to Chain

```typescript
// 1. Query route and fees
const quote = await client.quote.getRouteAndFees({
  owner_data: { chain_id: 60, data: userAddress },
  deposit_token: tokenAddress,
  intent: { type: 'RawToken', ... },
  amount: amountInWei
})

// 2. Create withdrawal
const withdrawRequest = await client.withdraw({
  allocationIds: ['alloc-1', 'alloc-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: { type: 'RawToken', ... }
})

// 3. Reactive update
// stores.withdrawals will automatically update
```

### Example 3: Query Token Routing Rules

```typescript
// Query all pools and tokens
const allPools = await client.tokenRouting.getAllPoolsAndTokens()

// Query targets for specific source
const targets = await client.tokenRouting.getTargetsForSource(
  714, 
  '0x55d398326f99059fF775485246999027B3197955'
)
```

---

## Changelog

### v2.0.2 (Latest)

- ✅ Added `BeneficiaryAPI` - Beneficiary operations
- ✅ Added `TokenRoutingAPI` - Token routing rules query
- ✅ Unified all API endpoints to `/api/` format
- ✅ Updated `WithdrawalsAPI` to use new Intent format
- ✅ Fixed QuoteAPI path to `/api/v2/quote/...`
- ✅ Updated TokenRoutingAPI type definitions with complete Pool information

### v2.0.1

- ✅ Initial release
- ✅ Complete TypeScript type definitions
- ✅ MobX reactive state management
- ✅ WebSocket real-time synchronization

---

## Related Documentation

- [SDK API Mapping](./js/docs/SDK_API_MAPPING.md) - SDK API to Backend API mapping
- [Technical Design](./js/docs/SDK_JS_DESIGN.md) - Detailed technical design
- [Backend API Documentation](../backend/API_DOCUMENTATION.md) - Complete backend API documentation

---

**Documentation Maintained By**: SDK Team  
**Issue Reporting**: [GitHub Issues](https://github.com/enclave-hq/sdk/issues)

