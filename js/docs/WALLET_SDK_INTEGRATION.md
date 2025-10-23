# Wallet SDK 集成指南

## 📋 概述

本文档说明 `@enclave-hq/sdk` 如何集成 `@enclave-hq/wallet-sdk`，包括：
- Provider 访问策略
- 合约调用实现
- 职责分离原则

---

## 🏗️ 架构原则

### 职责分离

```
┌─────────────────────────────────────┐
│         应用层 (Application)         │
│  - UI/UX                             │
│  - 用户交互                          │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     @enclave-hq/sdk                 │
│  ✅ 后端通信（API调用）              │
│  ✅ 业务逻辑                         │
│  ✅ 认证管理（JWT token）            │
│  ✅ 合约调用（读写）                 │
│  ✅ 数据处理和状态管理               │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     @enclave-hq/wallet-sdk          │
│  ✅ 钱包连接                         │
│  ✅ 账户状态管理                     │
│  ✅ 签名（消息、交易）               │
│  ✅ Provider 访问                    │
│  ❌ 不包含业务逻辑                   │
│  ❌ 不直接与后端通信                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  钱包 (MetaMask/TronLink)           │
└─────────────────────────────────────┘
```

### 关键原则

1. **@wallet-sdk 提供能力**：
   - `getProvider()` - 获取钱包或 RPC Provider
   - `signMessage()` - 签名认证消息
   - `signTransaction()` - 签名交易（可选，通过 walletClient 自动处理）
   - 事件通知（账户切换、链切换等）

2. **@sdk 使用能力**：
   - 使用 `getProvider()` 创建 viem 客户端
   - 使用 `signMessage()` 完成认证流程
   - 封装所有合约调用（读写）
   - 管理业务逻辑和后端同步

---

## 🔗 Provider 集成

### 1. WalletManager 配置

```typescript
// @enclave-hq/sdk/src/client/EnclaveClient.ts
import type { WalletManager } from '@enclave-hq/wallet-sdk'
import { createPublicClient, createWalletClient, custom } from 'viem'

export interface EnclaveClientConfig {
  apiUrl: string
  wsUrl?: string
  walletManager: WalletManager  // 必须传入 walletManager
  chainId?: number
}

export class EnclaveClient {
  private walletManager: WalletManager
  private publicClient: PublicClient | null = null
  private walletClient: WalletClient | null = null
  
  constructor(config: EnclaveClientConfig) {
    this.validateConfig(config)
    this.walletManager = config.walletManager
    // ... 初始化其他组件
  }
}
```

### 2. 初始化 PublicClient（只读查询）

```typescript
/**
 * 初始化公共客户端（用于只读合约调用）
 * 特点：
 * - 不需要钱包连接
 * - 优先使用钱包 Provider，降级到公共 RPC
 * - 用于 balanceOf、allowance 等查询
 */
private async initPublicClient(): Promise<void> {
  if (this.publicClient) return
  
  try {
    // 从 wallet-sdk 获取 Provider
    const providerResult = await this.walletManager.getProvider()
    
    this.logger.info(
      `Initializing public client with ${providerResult.source} provider`
    )
    
    // 创建 viem publicClient
    this.publicClient = createPublicClient({
      transport: custom(providerResult.provider),
      chain: this.getViemChain(providerResult.chainId),
    })
    
    // 验证连接
    const blockNumber = await this.publicClient.getBlockNumber()
    this.logger.info(`Connected to chain, block: ${blockNumber}`)
    
  } catch (error) {
    this.logger.error('Failed to initialize public client', error)
    throw new Error('Unable to connect to blockchain')
  }
}
```

### 3. 初始化 WalletClient（需要签名）

```typescript
/**
 * 初始化钱包客户端（用于需要签名的操作）
 * 特点：
 * - 必须连接钱包
 * - 只能使用钱包 Provider（不能使用 RPC）
 * - 用于 approve、deposit、transfer 等交易
 */
private async initWalletClient(): Promise<void> {
  if (this.walletClient) return
  
  // 1. 检查钱包连接状态
  if (!this.walletManager.isConnected()) {
    throw new WalletNotConnectedError(
      'Wallet must be connected for signing operations. Please call walletManager.connect() first.'
    )
  }
  
  try {
    // 2. 获取 Provider
    const providerResult = await this.walletManager.getProvider()
    
    // 3. 验证 Provider 来源（必须是钱包）
    if (providerResult.source !== 'wallet') {
      throw new Error(
        'Wallet provider required for signing. Cannot use RPC provider.'
      )
    }
    
    const currentAccount = this.walletManager.getCurrentAccount()
    if (!currentAccount) {
      throw new Error('No account available')
    }
    
    // 4. 创建 viem walletClient
    this.walletClient = createWalletClient({
      transport: custom(providerResult.provider),
      chain: this.getViemChain(providerResult.chainId),
      account: currentAccount.address.address as `0x${string}`,
    })
    
    this.logger.info('Wallet client initialized', {
      address: currentAccount.address.displayAddress,
      chainId: currentAccount.chainId,
    })
    
  } catch (error) {
    this.logger.error('Failed to initialize wallet client', error)
    throw error
  }
}
```

### 4. Provider 健康检查

```typescript
/**
 * 检查 Provider 健康状态
 */
async checkProviderHealth(): Promise<{
  isHealthy: boolean
  source: 'wallet' | 'rpc'
  latency: number
  blockNumber?: bigint
}> {
  const startTime = Date.now()
  
  try {
    const providerResult = await this.walletManager.getProvider()
    
    // 创建临时客户端测试连接
    const testClient = createPublicClient({
      transport: custom(providerResult.provider),
    })
    
    const blockNumber = await testClient.getBlockNumber()
    const latency = Date.now() - startTime
    
    return {
      isHealthy: true,
      source: providerResult.source,
      latency,
      blockNumber,
    }
  } catch (error) {
    return {
      isHealthy: false,
      source: 'rpc', // 默认值
      latency: -1,
    }
  }
}
```

---

## 📜 合约调用实现

### 1. 只读合约调用（balanceOf）

```typescript
/**
 * 查询 ERC20 代币余额
 * 特点：
 * - 不需要钱包连接（可选）
 * - 使用 publicClient
 * - 自动降级到 RPC（如果钱包未连接）
 */
async getTokenBalance(
  tokenAddress: string,
  userAddress?: string
): Promise<{
  balance: bigint
  formatted: string
  decimals: number
}> {
  // 初始化 publicClient
  await this.initPublicClient()
  
  // 确定查询地址
  const targetAddress = userAddress || this.getCurrentAddress()
  if (!targetAddress) {
    throw new Error('No address available for balance query')
  }
  
  try {
    // 1. 查询余额
    const balance = await this.publicClient!.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [targetAddress as `0x${string}`],
    })
    
    // 2. 查询精度
    const decimals = await this.publicClient!.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'decimals',
    })
    
    // 3. 格式化
    const formatted = formatUnits(balance, decimals)
    
    this.logger.info('Token balance fetched', {
      token: tokenAddress,
      balance: balance.toString(),
      formatted,
    })
    
    return { balance, formatted, decimals }
    
  } catch (error) {
    this.logger.error('Failed to fetch token balance', error)
    throw new ContractCallError('Unable to fetch token balance', error)
  }
}
```

### 2. 需要签名的合约调用（approve）

```typescript
/**
 * 授权 ERC20 代币
 * 特点：
 * - 必须连接钱包
 * - 使用 walletClient
 * - 自动等待交易确认
 */
async approveToken(
  tokenAddress: string,
  spender: string,
  amount: bigint
): Promise<{
  hash: string
  receipt: TransactionReceipt
}> {
  // 初始化 walletClient（自动检查钱包连接）
  await this.initWalletClient()
  
  try {
    this.logger.info('Approving token', {
      token: tokenAddress,
      spender,
      amount: amount.toString(),
    })
    
    // 1. 发起交易
    const hash = await this.walletClient!.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, amount],
    })
    
    this.logger.info('Approval transaction sent', { hash })
    
    // 2. 等待确认（使用 publicClient，不消耗 gas）
    await this.initPublicClient()
    const receipt = await this.publicClient!.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })
    
    if (receipt.status !== 'success') {
      throw new Error('Approval transaction failed')
    }
    
    this.logger.info('Approval confirmed', {
      hash,
      blockNumber: receipt.blockNumber,
    })
    
    return { hash, receipt }
    
  } catch (error) {
    this.logger.error('Token approval failed', error)
    throw new ContractCallError('Unable to approve token', error)
  }
}
```

### 3. 复杂业务逻辑（deposit）

```typescript
/**
 * 存款到 Enclave 池
 * 特点：
 * - 多步骤操作（检查授权 -> 授权 -> 存款）
 * - 同时使用 publicClient 和 walletClient
 * - 后端同步
 */
async deposit(params: {
  tokenAddress: string
  amount: string
  poolId?: string
}): Promise<{
  txHash: string
  depositId: string
}> {
  await this.initPublicClient()
  await this.initWalletClient()
  
  const currentAccount = this.walletManager.getCurrentAccount()
  if (!currentAccount) {
    throw new Error('No account connected')
  }
  
  try {
    // 1. 获取池地址
    const poolAddress = params.poolId
      ? await this.getPoolAddressById(params.poolId)
      : await this.getDefaultPoolAddress(params.tokenAddress)
    
    const amountBigInt = parseUnits(params.amount, 18) // 假设 18 位精度
    
    // 2. 检查当前授权额度
    const allowance = await this.publicClient!.readContract({
      address: params.tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [
        currentAccount.address.address as `0x${string}`,
        poolAddress as `0x${string}`,
      ],
    })
    
    // 3. 如果授权不足，先授权
    if (allowance < amountBigInt) {
      this.logger.info('Insufficient allowance, requesting approval')
      
      const approvalResult = await this.approveToken(
        params.tokenAddress,
        poolAddress,
        amountBigInt
      )
      
      this.logger.info('Token approved', { hash: approvalResult.hash })
    }
    
    // 4. 执行存款
    this.logger.info('Executing deposit', {
      token: params.tokenAddress,
      amount: params.amount,
      pool: poolAddress,
    })
    
    const depositHash = await this.walletClient!.writeContract({
      address: poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'deposit',
      args: [
        params.tokenAddress as `0x${string}`,
        amountBigInt,
      ],
    })
    
    this.logger.info('Deposit transaction sent', { hash: depositHash })
    
    // 5. 通知后端（不等待链上确认，让后端监听）
    const depositId = await this.notifyBackendDeposit({
      txHash: depositHash,
      chainId: currentAccount.chainId,
      tokenAddress: params.tokenAddress,
      amount: params.amount,
      userAddress: currentAccount.address.address,
    })
    
    // 6. 发出事件
    this.emit('deposit:submitted', {
      depositId,
      txHash: depositHash,
      amount: params.amount,
    })
    
    // 7. 异步等待确认（不阻塞返回）
    this.waitForDepositConfirmation(depositHash, depositId).catch(error => {
      this.logger.error('Deposit confirmation failed', error)
      this.emit('deposit:failed', { depositId, error })
    })
    
    return {
      txHash: depositHash,
      depositId,
    }
    
  } catch (error) {
    this.logger.error('Deposit failed', error)
    throw new DepositError('Unable to complete deposit', error)
  }
}

/**
 * 异步等待存款确认
 */
private async waitForDepositConfirmation(
  txHash: string,
  depositId: string
): Promise<void> {
  try {
    const receipt = await this.publicClient!.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: 2, // 等待 2 个确认
    })
    
    if (receipt.status === 'success') {
      this.logger.info('Deposit confirmed', { txHash, depositId })
      
      // 通知后端确认
      await this.apiClient.post(`/deposits/${depositId}/confirm`, {
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      })
      
      this.emit('deposit:confirmed', {
        depositId,
        txHash,
        receipt,
      })
    } else {
      throw new Error('Transaction reverted')
    }
  } catch (error) {
    this.logger.error('Deposit confirmation error', error)
    throw error
  }
}
```

---

## 🔄 Tron 支持

### TronWeb 集成

```typescript
/**
 * Tron 合约调用（使用 TronWeb）
 */
private async callTronContract(
  method: 'read' | 'write',
  contractAddress: string,
  functionName: string,
  args: any[]
): Promise<any> {
  // 获取 TronWeb Provider
  const providerResult = await this.walletManager.getProvider()
  
  if (!this.isTronChain(providerResult.chainId)) {
    throw new Error('Not on Tron chain')
  }
  
  const tronWeb = providerResult.provider as TronWeb
  
  // 获取合约实例
  const contract = await tronWeb.contract().at(contractAddress)
  
  // 执行调用
  if (method === 'read') {
    const result = await contract[functionName](...args).call()
    return result
  } else {
    // 需要签名
    if (!this.walletManager.isConnected()) {
      throw new Error('Wallet not connected')
    }
    
    const tx = await contract[functionName](...args).send()
    return tx
  }
}

/**
 * Tron 存款示例
 */
async depositTron(params: {
  tokenAddress: string
  amount: string
}): Promise<string> {
  // 1. 检查授权
  const allowance = await this.callTronContract(
    'read',
    params.tokenAddress,
    'allowance',
    [this.userAddress, this.poolAddress]
  )
  
  // 2. 授权（如果需要）
  if (BigInt(allowance) < BigInt(params.amount)) {
    await this.callTronContract(
      'write',
      params.tokenAddress,
      'approve',
      [this.poolAddress, params.amount]
    )
  }
  
  // 3. 存款
  const tx = await this.callTronContract(
    'write',
    this.poolAddress,
    'deposit',
    [params.tokenAddress, params.amount]
  )
  
  return tx
}
```

---

## 🎯 最佳实践

### 1. 延迟初始化

```typescript
// ✅ 推荐：按需初始化，减少不必要的连接
async getBalance(tokenAddress: string): Promise<bigint> {
  await this.initPublicClient() // 只有在需要时才初始化
  return this.publicClient!.readContract(/* ... */)
}
```

### 2. 错误处理

```typescript
// ✅ 推荐：友好的错误提示
async deposit(params: DepositParams): Promise<string> {
  try {
    await this.initWalletClient()
  } catch (error) {
    if (error instanceof WalletNotConnectedError) {
      throw new UserFriendlyError(
        'Please connect your wallet first',
        'WALLET_NOT_CONNECTED',
        { action: 'connect_wallet' }
      )
    }
    throw error
  }
  // ... 执行存款
}
```

### 3. 事件通知

```typescript
// ✅ 推荐：监听 wallet-sdk 事件并传播
constructor(config: EnclaveClientConfig) {
  // ...
  
  // 监听账户切换
  this.walletManager.on('accountChanged', ({ newAccount }) => {
    this.handleAccountChanged(newAccount)
  })
  
  // 监听链切换
  this.walletManager.on('chainChanged', ({ newChainId }) => {
    this.handleChainChanged(newChainId)
  })
}

private async handleChainChanged(newChainId: number): Promise<void> {
  this.logger.info('Chain changed, reinitializing clients', { newChainId })
  
  // 重置客户端
  this.publicClient = null
  this.walletClient = null
  
  // 通知应用层
  this.emit('chain:changed', { chainId: newChainId })
}
```

### 4. 并发控制

```typescript
// ✅ 推荐：防止重复初始化
private initPublicClientPromise: Promise<void> | null = null

private async initPublicClient(): Promise<void> {
  if (this.publicClient) return
  
  // 防止并发调用导致多次初始化
  if (this.initPublicClientPromise) {
    return this.initPublicClientPromise
  }
  
  this.initPublicClientPromise = (async () => {
    try {
      // ... 初始化逻辑
    } finally {
      this.initPublicClientPromise = null
    }
  })()
  
  return this.initPublicClientPromise
}
```

---

## 📊 职责对照表

| 功能 | wallet-sdk | @sdk | 说明 |
|------|------------|------|------|
| **钱包连接** | ✅ | ❌ | wallet-sdk 负责 |
| **Provider 访问** | ✅ 提供 | ✅ 使用 | wallet-sdk 提供，@sdk 使用 |
| **签名消息（认证）** | ✅ | ❌ | wallet-sdk 提供签名能力 |
| **后端认证流程** | ❌ | ✅ | @sdk 调用 wallet-sdk 签名，完成认证 |
| **合约读操作** | ❌ | ✅ | @sdk 使用 publicClient |
| **合约写操作** | ❌ | ✅ | @sdk 使用 walletClient |
| **业务逻辑** | ❌ | ✅ | @sdk 独占 |
| **后端通信** | ❌ | ✅ | @sdk 独占 |
| **状态管理** | ✅ 钱包状态 | ✅ 业务状态 | 分层管理 |
| **事件系统** | ✅ 钱包事件 | ✅ 业务事件 | 分层传播 |

---

## 🚀 集成检查清单

在集成 wallet-sdk 时，请确保：

- [ ] `EnclaveClient` 构造函数接受 `walletManager` 参数
- [ ] 使用 `walletManager.getProvider()` 获取 Provider
- [ ] 区分 `publicClient`（只读）和 `walletClient`（签名）
- [ ] 在签名操作前检查 `walletManager.isConnected()`
- [ ] 监听 `walletManager` 的事件（`accountChanged`, `chainChanged`）
- [ ] 在链切换时重置客户端
- [ ] 使用 wallet-sdk 的 `signMessage()` 进行认证
- [ ] 所有合约调用在 @sdk 中实现
- [ ] 所有后端通信在 @sdk 中实现
- [ ] 提供友好的错误提示

---

## 📚 相关文档

- [Wallet SDK 设计文档](../../../docs/wallet-sdk/DESIGN.md)
- [Wallet SDK 架构文档](../../../docs/wallet-sdk/ARCHITECTURE.md)
- [Wallet SDK 集成指南](../../../docs/wallet-sdk/INTEGRATION.md)
- [SDK API 文档](./SDK_API_MAPPING.md)
- [SDK 设计文档](./SDK_JS_DESIGN.md)

