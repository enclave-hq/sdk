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

The SDK includes **13 API client classes** providing **66 API methods**.

### API Client Categories

#### 1. 🔐 Authentication (AuthAPI) - 5 methods
- `authenticate()` - Wallet signature login
- `refreshToken()` - Refresh JWT Token
- `logout()` - Logout
- `verifyToken()` - Verify Token validity
- `getNonce()` - Get signature challenge Nonce

#### 2. 📝 Checkbook (CheckbooksAPI) - 4 methods
- `listCheckbooks()` - List user's Checkbooks
- `getCheckbookById()` - Get single Checkbook
- `getCheckbooksByOwner()` - Query Checkbooks by owner
- `deleteCheckbook()` - Delete Checkbook

#### 3. 💰 Allocation (AllocationsAPI) - 4 methods
- `listAllocations()` - List allocation records
- `createAllocations()` - Create allocation (Commitment)
- `getAllocationsByCheckbookId()` - Query allocations by Checkbook
- `getAllocationsByTokenIdAndStatus()` - Query allocations by Token and status

#### 4. 📤 Withdrawal (WithdrawalsAPI) - 7 methods
- `listWithdrawRequests()` - List withdrawal requests
- `getWithdrawRequestById()` - Get single withdrawal request
- `getWithdrawRequestByNullifier()` - Query by nullifier
- `createWithdrawRequest()` - Create withdrawal request
- `retryWithdrawRequest()` - Retry failed withdrawal
- `cancelWithdrawRequest()` - Cancel withdrawal request
- `getWithdrawStats()` - Get withdrawal statistics

#### 5. 👥 Beneficiary (BeneficiaryAPI) - 3 methods ⭐
- `listBeneficiaryWithdrawRequests()` - List withdrawal requests as beneficiary
- `requestPayoutExecution()` - Request payout execution
- `claimTimeout()` - Claim timeout

#### 6. 🏊 Pool & Token (PoolsAPI) - 5 methods
- `listPools()` - List all pools
- `getPoolById()` - Get pool details
- `listTokens()` - List tokens
- `getTokenById()` - Get token details
- `getActiveTokens()` - Get active tokens

#### 7. 💹 Price (PricesAPI) - 3 methods
- `getTokenPrices()` - Batch get token prices
- `getTokenPrice()` - Get single token price
- `getAllPrices()` - Get all prices

#### 8. 📊 Metrics (MetricsAPI) - 6 methods
- `getPoolMetrics()` - Get pool metrics
- `getTokenMetrics()` - Get token metrics
- `getPoolMetricsHistory()` - Get pool metrics history
- `getTokenMetricsHistory()` - Get token metrics history
- `getBatchPoolMetrics()` - Batch get pool metrics
- `getBatchTokenMetrics()` - Batch get token metrics

#### 9. 🛣️ Quote (QuoteAPI) - 2 methods
- `getRouteAndFees()` - Query route and fees
- `getHookAsset()` - Query Hook asset information

#### 10. 🔗 Chain Config (ChainConfigAPI) - 6 methods
- `getChainConfig()` - Get chain configuration
- `getTreasuryAddress()` - Get Treasury address
- `getIntentManagerAddress()` - Get IntentManager address
- `getRpcEndpoint()` - Get RPC endpoint
- `listChains()` - List all active chains
- `getAllTreasuryAddresses()` - Get all Treasury addresses

#### 11. 🔀 Token Routing (TokenRoutingAPI) - 3 methods ⭐
- `getAllowedTargets()` - Query allowed target chains and tokens (supports query all without parameters)
- `getAllPoolsAndTokens()` - Get all pools and tokens (convenience method)
- `getTargetsForSource()` - Get targets for specific source (convenience method)

#### 12. 🔑 KMS (KMSAPI) - 2 methods
- `sign()` - Sign data using KMS
- `getPublicKey()` - Get KMS-managed public key

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
| Checkbook | 4 | ✅ |
| Allocation | 4 | ✅ |
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
| **Total** | **66** | ✅ |

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
| `/difi` | Lending pools, RWA assets, withdrawal | `stores.pools`<br>`stores.allocations` | `useFeaturedPools()`<br>`useAllocationsData()`<br>`useQuoteRoute()` | `sdk.quote.getRouteAndFees()`<br>`sdk.withdraw()` |
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

