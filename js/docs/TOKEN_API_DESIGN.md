# Token API 设计（ERC20/TRC20）

## 📋 概述

本文档定义 `@enclave-hq/sdk` 中提供的 Token 标准接口封装，简化应用开发者对 ERC20/TRC20 代币的操作。

### 设计目标

1. **简化调用**：提供类型安全的 Token 接口，无需手动管理 ABI
2. **统一体验**：EVM 和 Tron 使用相同的 API
3. **业务增强**：支持后端同步、事件通知、错误处理
4. **灵活性**：同时支持标准接口和通用合约调用

---

## 🎯 API 层次

### 第一层：Token 标准接口（推荐）

封装好的 ERC20/TRC20 标准方法，应用开发者首选。

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

const client = new EnclaveClient({ apiUrl, walletManager })

// ERC20 标准方法
const balance = await client.token.balanceOf('0xUSDT', '0xUserAddress')
const allowance = await client.token.allowance('0xUSDT', '0xOwner', '0xSpender')
const decimals = await client.token.decimals('0xUSDT')
const symbol = await client.token.symbol('0xUSDT')
const totalSupply = await client.token.totalSupply('0xUSDT')

// 需要签名的方法
await client.token.transfer('0xUSDT', '0xRecipient', '100000000')
await client.token.approve('0xUSDT', '0xSpender', '1000000000')
```

### 第二层：通用合约接口（灵活）

直接调用 wallet-sdk，适合非标准合约。

```typescript
// 透传到 wallet-sdk
const result = await client.contracts.read({
  address: '0xCustomContract',
  abi: CUSTOM_ABI,
  functionName: 'customFunction',
  args: [],
})
```

---

## 🔧 Token API 详细设计

### 1. TokenClient 类

**核心接口**：

```typescript
export class TokenClient {
  constructor(
    private walletManager: WalletManager,
    private apiClient?: APIClient  // 可选：用于后端同步
  ) {}
  
  // ===== 只读方法（不需要签名）=====
  
  /**
   * 查询代币余额
   */
  async balanceOf(
    tokenAddress: string,
    ownerAddress?: string
  ): Promise<TokenAmount>
  
  /**
   * 查询授权额度
   */
  async allowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<TokenAmount>
  
  /**
   * 查询代币精度
   */
  async decimals(tokenAddress: string): Promise<number>
  
  /**
   * 查询代币符号
   */
  async symbol(tokenAddress: string): Promise<string>
  
  /**
   * 查询代币名称
   */
  async name(tokenAddress: string): Promise<string>
  
  /**
   * 查询总供应量
   */
  async totalSupply(tokenAddress: string): Promise<TokenAmount>
  
  // ===== 写入方法（需要签名）=====
  
  /**
   * 转账代币
   */
  async transfer(
    tokenAddress: string,
    to: string,
    amount: string | bigint,
    options?: TransactionOptions
  ): Promise<TransactionResult>
  
  /**
   * 授权代币
   */
  async approve(
    tokenAddress: string,
    spender: string,
    amount: string | bigint,
    options?: TransactionOptions
  ): Promise<TransactionResult>
  
  /**
   * 从授权地址转账
   */
  async transferFrom(
    tokenAddress: string,
    from: string,
    to: string,
    amount: string | bigint,
    options?: TransactionOptions
  ): Promise<TransactionResult>
  
  // ===== 便捷方法 =====
  
  /**
   * 批量查询余额
   */
  async getBalances(
    tokenAddresses: string[],
    ownerAddress?: string
  ): Promise<Record<string, TokenAmount>>
  
  /**
   * 获取代币完整信息
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo>
  
  /**
   * 检查并授权（如果需要）
   */
  async ensureAllowance(
    tokenAddress: string,
    spender: string,
    requiredAmount: string | bigint
  ): Promise<void>
}
```

---

### 2. 类型定义

```typescript
/**
 * 代币数量（带精度）
 */
export interface TokenAmount {
  /** 原始值（bigint） */
  raw: bigint
  
  /** 格式化值（字符串） */
  formatted: string
  
  /** 精度 */
  decimals: number
  
  /** 代币地址 */
  token: string
}

/**
 * 代币信息
 */
export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: TokenAmount
  
  /** 可选：链 ID */
  chainId?: number
  
  /** 可选：用户余额 */
  balance?: TokenAmount
}

/**
 * 交易选项
 */
export interface TransactionOptions {
  /** 是否等待确认 */
  waitForConfirmation?: boolean
  
  /** 确认数 */
  confirmations?: number
  
  /** Gas 限制 */
  gasLimit?: bigint
  
  /** Gas 价格 */
  gasPrice?: bigint
  
  /** 是否通知后端 */
  notifyBackend?: boolean
}

/**
 * 交易结果
 */
export interface TransactionResult {
  /** 交易哈希 */
  hash: string
  
  /** 交易收据（如果等待确认） */
  receipt?: TransactionReceipt
  
  /** 链 ID */
  chainId: number
  
  /** 发送者 */
  from: string
  
  /** 接收者 */
  to: string
  
  /** Gas 使用量 */
  gasUsed?: bigint
  
  /** 是否成功 */
  success: boolean
}
```

---

### 3. 实现示例

```typescript
// @enclave-hq/sdk/src/client/TokenClient.ts
import type { WalletManager } from '@enclave-hq/wallet-sdk'
import { ERC20_ABI, TRC20_ABI } from '../constants/abis'
import { formatUnits, parseUnits } from '../utils/amount'

export class TokenClient {
  constructor(
    private walletManager: WalletManager,
    private apiClient?: APIClient
  ) {}
  
  /**
   * 查询余额
   */
  async balanceOf(
    tokenAddress: string,
    ownerAddress?: string
  ): Promise<TokenAmount> {
    // 1. 确定查询地址
    const owner = ownerAddress || this.walletManager.getCurrentAccount()?.address.address
    if (!owner) {
      throw new Error('No address available')
    }
    
    // 2. 获取精度
    const decimals = await this.decimals(tokenAddress)
    
    // 3. 调用 wallet-sdk 的 readContract
    const raw = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'balanceOf',
      args: [owner],
    }) as bigint
    
    // 4. 格式化
    const formatted = formatUnits(raw, decimals)
    
    return {
      raw,
      formatted,
      decimals,
      token: tokenAddress,
    }
  }
  
  /**
   * 查询授权额度
   */
  async allowance(
    tokenAddress: string,
    owner: string,
    spender: string
  ): Promise<TokenAmount> {
    const decimals = await this.decimals(tokenAddress)
    
    const raw = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint
    
    return {
      raw,
      formatted: formatUnits(raw, decimals),
      decimals,
      token: tokenAddress,
    }
  }
  
  /**
   * 查询精度
   */
  async decimals(tokenAddress: string): Promise<number> {
    const result = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'decimals',
      args: [],
    })
    
    return Number(result)
  }
  
  /**
   * 查询符号
   */
  async symbol(tokenAddress: string): Promise<string> {
    const result = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'symbol',
      args: [],
    })
    
    return result as string
  }
  
  /**
   * 查询名称
   */
  async name(tokenAddress: string): Promise<string> {
    const result = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'name',
      args: [],
    })
    
    return result as string
  }
  
  /**
   * 查询总供应量
   */
  async totalSupply(tokenAddress: string): Promise<TokenAmount> {
    const decimals = await this.decimals(tokenAddress)
    
    const raw = await this.walletManager.readContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'totalSupply',
      args: [],
    }) as bigint
    
    return {
      raw,
      formatted: formatUnits(raw, decimals),
      decimals,
      token: tokenAddress,
    }
  }
  
  /**
   * 转账
   */
  async transfer(
    tokenAddress: string,
    to: string,
    amount: string | bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    // 1. 解析金额
    const amountBigInt = typeof amount === 'string'
      ? await this.parseAmount(tokenAddress, amount)
      : amount
    
    // 2. 调用 wallet-sdk 的 writeContract
    const { hash, receipt } = await this.walletManager.writeContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'transfer',
      args: [to, amountBigInt],
      waitForConfirmation: options.waitForConfirmation,
      gas: options.gasLimit,
      gasPrice: options.gasPrice,
    })
    
    const account = this.walletManager.getCurrentAccount()!
    
    // 3. 可选：通知后端
    if (options.notifyBackend && this.apiClient) {
      await this.apiClient.post('/transactions/notify', {
        type: 'transfer',
        hash,
        chainId: account.chainId,
        token: tokenAddress,
        from: account.address.address,
        to,
        amount: amountBigInt.toString(),
      })
    }
    
    return {
      hash,
      receipt,
      chainId: account.chainId,
      from: account.address.address,
      to,
      gasUsed: receipt?.gasUsed,
      success: receipt ? receipt.status === 'success' : true,
    }
  }
  
  /**
   * 授权
   */
  async approve(
    tokenAddress: string,
    spender: string,
    amount: string | bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    const amountBigInt = typeof amount === 'string'
      ? await this.parseAmount(tokenAddress, amount)
      : amount
    
    const { hash, receipt } = await this.walletManager.writeContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'approve',
      args: [spender, amountBigInt],
      waitForConfirmation: options.waitForConfirmation,
      gas: options.gasLimit,
      gasPrice: options.gasPrice,
    })
    
    const account = this.walletManager.getCurrentAccount()!
    
    if (options.notifyBackend && this.apiClient) {
      await this.apiClient.post('/transactions/notify', {
        type: 'approve',
        hash,
        chainId: account.chainId,
        token: tokenAddress,
        owner: account.address.address,
        spender,
        amount: amountBigInt.toString(),
      })
    }
    
    return {
      hash,
      receipt,
      chainId: account.chainId,
      from: account.address.address,
      to: tokenAddress,
      gasUsed: receipt?.gasUsed,
      success: receipt ? receipt.status === 'success' : true,
    }
  }
  
  /**
   * 从授权地址转账
   */
  async transferFrom(
    tokenAddress: string,
    from: string,
    to: string,
    amount: string | bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    const amountBigInt = typeof amount === 'string'
      ? await this.parseAmount(tokenAddress, amount)
      : amount
    
    const { hash, receipt } = await this.walletManager.writeContract({
      address: tokenAddress,
      abi: this.getTokenABI(),
      functionName: 'transferFrom',
      args: [from, to, amountBigInt],
      waitForConfirmation: options.waitForConfirmation,
      gas: options.gasLimit,
      gasPrice: options.gasPrice,
    })
    
    const account = this.walletManager.getCurrentAccount()!
    
    return {
      hash,
      receipt,
      chainId: account.chainId,
      from: account.address.address,
      to: tokenAddress,
      gasUsed: receipt?.gasUsed,
      success: receipt ? receipt.status === 'success' : true,
    }
  }
  
  /**
   * 批量查询余额
   */
  async getBalances(
    tokenAddresses: string[],
    ownerAddress?: string
  ): Promise<Record<string, TokenAmount>> {
    const owner = ownerAddress || this.walletManager.getCurrentAccount()?.address.address
    if (!owner) {
      throw new Error('No address available')
    }
    
    // 使用 multicall 批量查询
    const { results } = await this.walletManager.multicall({
      contracts: tokenAddresses.map(address => ({
        address,
        abi: this.getTokenABI(),
        functionName: 'balanceOf',
        args: [owner],
      })),
      allowFailure: true,
    })
    
    // 转换结果
    const balances: Record<string, TokenAmount> = {}
    
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]
      const result = results[i]
      
      if (result.status === 'success') {
        const decimals = await this.decimals(tokenAddress)
        const raw = result.result as bigint
        
        balances[tokenAddress] = {
          raw,
          formatted: formatUnits(raw, decimals),
          decimals,
          token: tokenAddress,
        }
      }
    }
    
    return balances
  }
  
  /**
   * 获取代币完整信息
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    // 使用 multicall 一次性获取所有信息
    const { results } = await this.walletManager.multicall({
      contracts: [
        { address: tokenAddress, abi: this.getTokenABI(), functionName: 'name', args: [] },
        { address: tokenAddress, abi: this.getTokenABI(), functionName: 'symbol', args: [] },
        { address: tokenAddress, abi: this.getTokenABI(), functionName: 'decimals', args: [] },
        { address: tokenAddress, abi: this.getTokenABI(), functionName: 'totalSupply', args: [] },
      ],
      allowFailure: false,
    })
    
    const name = results[0].result as string
    const symbol = results[1].result as string
    const decimals = Number(results[2].result)
    const totalSupplyRaw = results[3].result as bigint
    
    const totalSupply: TokenAmount = {
      raw: totalSupplyRaw,
      formatted: formatUnits(totalSupplyRaw, decimals),
      decimals,
      token: tokenAddress,
    }
    
    // 可选：查询当前用户余额
    const account = this.walletManager.getCurrentAccount()
    let balance: TokenAmount | undefined
    
    if (account) {
      balance = await this.balanceOf(tokenAddress, account.address.address)
    }
    
    return {
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply,
      chainId: account?.chainId,
      balance,
    }
  }
  
  /**
   * 检查并授权（如果需要）
   */
  async ensureAllowance(
    tokenAddress: string,
    spender: string,
    requiredAmount: string | bigint
  ): Promise<void> {
    const account = this.walletManager.getCurrentAccount()
    if (!account) {
      throw new Error('No account connected')
    }
    
    // 1. 检查当前授权额度
    const currentAllowance = await this.allowance(
      tokenAddress,
      account.address.address,
      spender
    )
    
    const requiredBigInt = typeof requiredAmount === 'string'
      ? await this.parseAmount(tokenAddress, requiredAmount)
      : requiredAmount
    
    // 2. 如果授权不足，发起授权
    if (currentAllowance.raw < requiredBigInt) {
      console.log(`Approving ${tokenAddress} for ${spender}...`)
      
      await this.approve(
        tokenAddress,
        spender,
        requiredBigInt,
        { waitForConfirmation: true }
      )
      
      console.log('✅ Approval confirmed')
    } else {
      console.log('✅ Allowance sufficient, no approval needed')
    }
  }
  
  /**
   * 解析金额（字符串 -> bigint）
   */
  private async parseAmount(
    tokenAddress: string,
    amount: string
  ): Promise<bigint> {
    const decimals = await this.decimals(tokenAddress)
    return parseUnits(amount, decimals)
  }
  
  /**
   * 获取 Token ABI（根据链类型）
   */
  private getTokenABI(): any {
    const account = this.walletManager.getCurrentAccount()
    if (!account) {
      throw new Error('No account connected')
    }
    
    // EVM 使用 ERC20_ABI，Tron 使用 TRC20_ABI
    return account.chainType === 'evm' ? ERC20_ABI : TRC20_ABI
  }
}
```

---

## 🔗 在 EnclaveClient 中集成

```typescript
// @enclave-hq/sdk/src/client/EnclaveClient.ts
export class EnclaveClient {
  private walletManager: WalletManager
  private apiClient: APIClient
  
  // Token 客户端
  public readonly token: TokenClient
  
  // 通用合约客户端（可选）
  public readonly contracts: ContractClient
  
  constructor(config: EnclaveClientConfig) {
    this.walletManager = config.walletManager
    this.apiClient = new APIClient(config.apiUrl)
    
    // 初始化 Token 客户端
    this.token = new TokenClient(this.walletManager, this.apiClient)
    
    // 初始化通用合约客户端
    this.contracts = new ContractClient(this.walletManager)
  }
  
  /**
   * 高层业务 API：存款
   */
  async deposit(params: DepositParams): Promise<string> {
    // 1. 获取池地址
    const poolAddress = await this.apiClient.getPoolAddress(params.tokenAddress)
    
    // 2. 使用 token.ensureAllowance 检查并授权
    await this.token.ensureAllowance(
      params.tokenAddress,
      poolAddress,
      params.amount
    )
    
    // 3. 执行存款（使用 walletManager.writeContract）
    const { hash } = await this.walletManager.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'deposit',
      args: [params.tokenAddress, parseUnits(params.amount, 18)],
    })
    
    // 4. 通知后端
    await this.apiClient.post('/deposits', {
      txHash: hash,
      token: params.tokenAddress,
      amount: params.amount,
    })
    
    return hash
  }
}
```

---

## 📚 使用示例

### 场景 1：查询余额

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

const client = new EnclaveClient({ apiUrl, walletManager })

// 查询单个代币余额
const balance = await client.token.balanceOf('0xUSDT')
console.log(`Balance: ${balance.formatted} USDT`)

// 批量查询余额
const balances = await client.token.getBalances([
  '0xUSDT',
  '0xUSDC',
  '0xDAI',
])

Object.entries(balances).forEach(([token, balance]) => {
  console.log(`${token}: ${balance.formatted}`)
})
```

### 场景 2：转账

```typescript
// 简单转账
await client.token.transfer(
  '0xUSDT',
  '0xRecipient',
  '100', // 自动根据精度转换
  { waitForConfirmation: true }
)

// 获取交易详情
const result = await client.token.transfer(
  '0xUSDT',
  '0xRecipient',
  '100',
  { waitForConfirmation: true, notifyBackend: true }
)

console.log('Transaction hash:', result.hash)
console.log('Gas used:', result.gasUsed)
console.log('Success:', result.success)
```

### 场景 3：授权和转账

```typescript
// 手动授权
await client.token.approve(
  '0xUSDT',
  '0xPoolAddress',
  '1000',
  { waitForConfirmation: true }
)

// 或使用便捷方法（自动检查是否需要授权）
await client.token.ensureAllowance(
  '0xUSDT',
  '0xPoolAddress',
  '1000'
)
```

### 场景 4：获取代币信息

```typescript
const tokenInfo = await client.token.getTokenInfo('0xUSDT')

console.log('Name:', tokenInfo.name)
console.log('Symbol:', tokenInfo.symbol)
console.log('Decimals:', tokenInfo.decimals)
console.log('Total Supply:', tokenInfo.totalSupply.formatted)
console.log('My Balance:', tokenInfo.balance?.formatted)
```

### 场景 5：高层业务 API（推荐）

```typescript
// 存款（自动处理授权）
await client.deposit({
  tokenAddress: '0xUSDT',
  amount: '100',
})

// 内部自动：
// 1. 检查授权（使用 client.token.allowance）
// 2. 如果需要，授权（使用 client.token.approve）
// 3. 执行存款
// 4. 通知后端
```

---

## ✅ 总结

### 三层 API 设计

```typescript
// 第一层：Enclave 业务 API（最高层，推荐）
await client.deposit({ amount: '100', token: '0xUSDT' })

// 第二层：ERC20 标准接口（常用）
await client.token.balanceOf('0xUSDT')
await client.token.transfer('0xUSDT', '0xRecipient', '100')

// 第三层：通用合约接口（灵活）
await client.contracts.read({
  address: '0xCustomContract',
  abi: CUSTOM_ABI,
  functionName: 'customFunction',
  args: [],
})
```

### 优势

1. ✅ **类型安全**：无需手动管理 ABI
2. ✅ **自动格式化**：自动处理精度转换
3. ✅ **批量查询**：使用 multicall 优化性能
4. ✅ **便捷方法**：如 `ensureAllowance` 自动检查授权
5. ✅ **业务增强**：支持后端通知、事件系统
6. ✅ **统一体验**：EVM 和 Tron 使用相同 API

### 应用开发者使用建议

- **日常开发**：使用 `client.token.*` 的标准接口
- **业务功能**：使用 `client.deposit()` 等高层 API
- **特殊需求**：使用 `client.contracts.*` 或直接使用 `walletManager`


