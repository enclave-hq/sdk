# Enclave SDK 完整指南

> **最后更新**: 2025-01-XX  
> **SDK 版本**: v2.0.2

**Languages**: [English](./SDK_COMPLETE_GUIDE.en.md) | 中文 | [日本語](./SDK_COMPLETE_GUIDE.ja.md) | [한국어](./SDK_COMPLETE_GUIDE.ko.md)

---

## 📋 目录

1. [概述](#概述)
2. [SDK API 接口清单](#sdk-api-接口清单)
3. [WebFront 集成指南](#webfront-集成指南)
4. [使用示例](#使用示例)
5. [更新日志](#更新日志)

---

## 概述

Enclave SDK 提供完整的 JavaScript/TypeScript 客户端库，用于与 Enclave 隐私保护多链 DeFi 协议交互。

### 核心特性

- 🔄 **响应式状态管理** - 基于 MobX，自动数据同步
- 🔌 **实时推送** - WebSocket 自动推送更新，无需轮询
- 🌐 **通用环境** - 支持 Browser、Node.js、React Native、Electron
- ⚡ **TypeScript First** - 完整的类型定义和推断
- 🎯 **框架集成** - React、Vue、Next.js 开箱即用

### 架构概览

```
WebFront 页面层
  ↓ useHooks
业务 Hooks 层
  ↓ 调用
Store 层 (MobX)
  ↓ 调用
SDK 层 (@enclave-hq/sdk)
  ↓ 调用
后端 API / 链上合约
```

---

## SDK API 接口清单

### 总览

SDK 共包含 **13 个 API 客户端类**，提供 **66 个 API 方法**。

### API 客户端分类

#### 1. 🔐 认证相关 (AuthAPI) - 5个
- `authenticate()` - 钱包签名登录
- `refreshToken()` - 刷新 JWT Token
- `logout()` - 登出
- `verifyToken()` - 验证 Token 有效性
- `getNonce()` - 获取签名挑战 Nonce

#### 2. 📝 Checkbook 相关 (CheckbooksAPI) - 4个
- `listCheckbooks()` - 列出用户的 Checkbooks
- `getCheckbookById()` - 查询单个 Checkbook
- `getCheckbooksByOwner()` - 按所有者查询 Checkbooks
- `deleteCheckbook()` - 删除 Checkbook

#### 3. 💰 Allocation 相关 (AllocationsAPI) - 4个
- `listAllocations()` - 列出分配记录
- `createAllocations()` - 创建分配（Commitment）
- `getAllocationsByCheckbookId()` - 按 Checkbook 查询分配
- `getAllocationsByTokenIdAndStatus()` - 按 Token 和状态查询分配

#### 4. 📤 Withdrawal 相关 (WithdrawalsAPI) - 7个
- `listWithdrawRequests()` - 列出提款请求
- `getWithdrawRequestById()` - 查询单个提款请求
- `getWithdrawRequestByNullifier()` - 按 nullifier 查询
- `createWithdrawRequest()` - 创建提款请求
- `retryWithdrawRequest()` - 重试失败的提款
- `cancelWithdrawRequest()` - 取消提款请求
- `getWithdrawStats()` - 获取提款统计

#### 5. 👥 Beneficiary 相关 (BeneficiaryAPI) - 3个 ⭐
- `listBeneficiaryWithdrawRequests()` - 列出作为受益人的提款请求
- `requestPayoutExecution()` - 请求执行 Payout
- `claimTimeout()` - 超时领取

#### 6. 🏊 Pool & Token 相关 (PoolsAPI) - 5个
- `listPools()` - 列出所有池
- `getPoolById()` - 获取池详情
- `listTokens()` - 列出代币
- `getTokenById()` - 获取代币详情
- `getActiveTokens()` - 获取活跃代币

#### 7. 💹 价格相关 (PricesAPI) - 3个
- `getTokenPrices()` - 批量获取代币价格
- `getTokenPrice()` - 获取单个代币价格
- `getAllPrices()` - 获取所有价格

#### 8. 📊 指标相关 (MetricsAPI) - 6个
- `getPoolMetrics()` - 获取池指标
- `getTokenMetrics()` - 获取代币指标
- `getPoolMetricsHistory()` - 获取池指标历史
- `getTokenMetricsHistory()` - 获取代币指标历史
- `getBatchPoolMetrics()` - 批量获取池指标
- `getBatchTokenMetrics()` - 批量获取代币指标

#### 9. 🛣️ 报价相关 (QuoteAPI) - 2个
- `getRouteAndFees()` - 查询路由和费用
- `getHookAsset()` - 查询 Hook 资产信息

#### 10. 🔗 链配置相关 (ChainConfigAPI) - 6个
- `getChainConfig()` - 获取链配置
- `getTreasuryAddress()` - 获取 Treasury 地址
- `getIntentManagerAddress()` - 获取 IntentManager 地址
- `getRpcEndpoint()` - 获取 RPC 端点
- `listChains()` - 列出所有活跃链
- `getAllTreasuryAddresses()` - 获取所有 Treasury 地址

#### 11. 🔀 Token 路由规则相关 (TokenRoutingAPI) - 3个 ⭐
- `getAllowedTargets()` - 查询允许的目标链和代币（支持无参数查询所有）
- `getAllPoolsAndTokens()` - 获取所有池和代币（便捷方法）
- `getTargetsForSource()` - 获取特定源的目标（便捷方法）

#### 12. 🔑 KMS 相关 (KMSAPI) - 2个
- `sign()` - 使用 KMS 对数据进行签名
- `getPublicKey()` - 获取 KMS 管理的公钥

#### 13. 🎯 EnclaveClient 高级方法 - 16个

**连接管理 (5个)**:
- `connect()` - 连接到 Enclave 服务
- `disconnect()` - 断开连接
- `connection` (getter) - 获取连接信息
- `isConnected` (getter) - 检查是否已连接
- `address` (getter) - 获取当前用户地址

**Commitment 操作 (3个)**:
- `createCommitment(params)` - 创建 Commitment 完整流程
- `prepareCommitment(params)` - 准备 Commitment 签名数据
- `submitCommitment(params, signature)` - 提交已签名的 Commitment

**Withdrawal 操作 (5个)**:
- `withdraw(params)` - 创建提款完整流程
- `prepareWithdraw(params)` - 准备提款签名数据
- `submitWithdraw(params, signature)` - 提交已签名的提款
- `retryWithdraw(withdrawalId)` - 重试失败的提款请求
- `cancelWithdraw(withdrawalId)` - 取消待处理的提款请求

**API 访问器 (5个)**:
- `quote` (getter) - 访问 QuoteAPI
- `metrics` (getter) - 访问 MetricsAPI
- `chainConfig` (getter) - 访问 ChainConfigAPI
- `beneficiary` (getter) - 访问 BeneficiaryAPI
- `tokenRouting` (getter) - 访问 TokenRoutingAPI

### 接口统计汇总

| API 类别 | 接口数量 | 状态 |
|---------|---------|------|
| 认证 | 5 | ✅ |
| Checkbook | 4 | ✅ |
| Allocation | 4 | ✅ |
| Withdrawal | 7 | ✅ |
| Beneficiary | 3 | ⭐ 新增 |
| Pool & Token | 5 | ✅ |
| 价格 | 3 | ✅ |
| 指标 | 6 | ✅ |
| 报价 | 2 | ✅ |
| 链配置 | 6 | ✅ |
| Token 路由 | 3 | ⭐ 新增 |
| KMS | 2 | ✅ |
| EnclaveClient 高级方法 | 16 | ✅ |
| **总计** | **66** | ✅ |

---

## WebFront 集成指南

### 对接架构

```
WebFront 页面层 (React Components, Pages, Hooks)
  ↓ useHooks
SDKStore (MobX Store)
  ↓ 调用
EnclaveClient (SDK 主客户端)
  ↓ 调用
13 个 API 客户端类
  ↓ 调用
Backend REST API
```

### 核心接口（必需）

1. **EnclaveClient 高级方法** - 16 个方法
   - 连接管理：5 个
   - Commitment 操作：3 个
   - Withdrawal 操作：5 个
   - API 访问器：5 个

2. **响应式 Stores** - 5 个 Store
   - `stores.checkbooks` - Checkbook 数据
   - `stores.allocations` - Allocation 数据
   - `stores.withdrawals` - Withdrawal 数据
   - `stores.prices` - 价格数据
   - `stores.pools` - Pool 数据

3. **API 访问器** - 3 个
   - `quote` - 路由和费用查询
   - `chainConfig` - 链配置查询
   - `tokenRouting` - Token 路由规则查询

### 页面与 SDK 映射

| 页面 | 页面内容 | Store 读取 | Hook 使用 | SDK 方法调用 |
|------|---------|-----------|-----------|-------------|
| `/home` | 推荐理财产品、总锁仓量 | `stores.pools`<br>`stores.prices` | `useFeaturedPools()`<br>`useUserAssets()` | - |
| `/deposit` | 存款记录、凭证分配 | `stores.checkbooks`<br>`stores.allocations` | `useCheckbooksData()`<br>`useDepositActions()` | `sdk.createCommitment()` |
| `/defi` | 借贷池、RWA 资产、提取 | `stores.pools`<br>`stores.allocations` | `useFeaturedPools()`<br>`useAllocationsData()`<br>`useQuoteRoute()` | `sdk.quote.getRouteAndFees()`<br>`sdk.withdraw()` |
| `/records` | 交易历史 | `stores.withdrawals` | - | - |

### 使用方式

#### 1. 通过 SDKStore（推荐）

```typescript
const sdkStore = useSDKStore()

// 获取数据
await sdkStore.fetchCheckbooks()
await sdkStore.fetchAllocations()

// 业务操作
await sdkStore.createCommitment({ ... })
await sdkStore.withdraw({ ... })
```

#### 2. 直接使用 SDK（高级用法）

```typescript
const sdk = sdkStore.sdk
if (sdk) {
  // 使用响应式 Stores
  const checkbooks = sdk.stores.checkbooks.all
  const allocations = sdk.stores.allocations.all
  
  // 使用 API 客户端
  const quote = await sdk.quote.getRouteAndFees({ ... })
  const chainConfig = await sdk.chainConfig.getChainConfig(714)
  
  // 使用新增的 API
  const pools = await sdk.tokenRouting.getAllPoolsAndTokens()
}
```

---

## 使用示例

### 示例 1: 存款并生成凭证

```typescript
// 1. 连接 SDK
await client.connect()

// 2. 获取存款记录
const checkbooks = await client.stores.checkbooks.fetchList()

// 3. 创建 Commitment
const allocations = await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000'],
  tokenId: 'token-id'
})

// 4. 响应式更新
// stores.allocations 会自动更新
```

### 示例 2: 提取凭证到链

```typescript
// 1. 查询路由和费用
const quote = await client.quote.getRouteAndFees({
  owner_data: { chain_id: 60, data: userAddress },
  deposit_token: tokenAddress,
  intent: { type: 'RawToken', ... },
  amount: amountInWei
})

// 2. 创建提款
const withdrawRequest = await client.withdraw({
  allocationIds: ['alloc-1', 'alloc-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: { type: 'RawToken', ... }
})

// 3. 响应式更新
// stores.withdrawals 会自动更新
```

### 示例 3: 查询 Token 路由规则

```typescript
// 查询所有池和代币
const allPools = await client.tokenRouting.getAllPoolsAndTokens()

// 查询特定源的目标
const targets = await client.tokenRouting.getTargetsForSource(
  714, 
  '0x55d398326f99059fF775485246999027B3197955'
)
```

---

## 更新日志

### v2.0.2 (最新)

- ✅ 新增 `BeneficiaryAPI` - 受益人操作
- ✅ 新增 `TokenRoutingAPI` - Token 路由规则查询
- ✅ 统一所有 API 端点为 `/api/` 格式
- ✅ 更新 `WithdrawalsAPI` 使用新的 Intent 格式
- ✅ 修复 QuoteAPI 路径为 `/api/v2/quote/...`
- ✅ 更新 TokenRoutingAPI 类型定义，包含完整的 Pool 信息

### v2.0.1

- ✅ 初始版本发布
- ✅ 完整的 TypeScript 类型定义
- ✅ MobX 响应式状态管理
- ✅ WebSocket 实时同步

---

## 相关文档

- [SDK API 映射](./js/docs/SDK_API_MAPPING.md) - SDK API 到后端 API 映射
- [技术设计](./js/docs/SDK_JS_DESIGN.md) - 详细技术设计
- [后端 API 文档](../backend/API_DOCUMENTATION.md) - 后端 API 完整文档

---

**文档维护**: SDK 团队  
**问题反馈**: [GitHub Issues](https://github.com/enclave-hq/sdk/issues)

