# Contract Client 设计（基于 ABI 的通用接口）

## 📋 概述

本文档定义 `@enclave-hq/sdk` 中基于 ABI 的通用合约客户端，提供类型安全的合约调用接口。

### 设计目标

1. **类型安全**：根据 ABI 自动推断方法签名和返回类型
2. **开发体验**：类似 viem 的 `getContract`，提供智能提示
3. **灵活性**：支持任何合约，不限于 ERC20
4. **统一接口**：EVM 和 Tron 使用相同的 API

---

## 🎯 完整的 SDK 架构

### 三层并列设计

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

const client = new EnclaveClient({ apiUrl, walletManager })

// ===== 第一层：Enclave 业务 API =====
await client.deposit({ amount: '100', token: '0xUSDT' })
await client.withdraw({ amount: '50', token: '0xUSDT' })

// ===== 第二层：三个并列的客户端 =====

// 2a. Token 标准接口（ERC20/TRC20）
const balance = await client.token.balanceOf('0xUSDT')
await client.token.transfer('0xUSDT', recipient, '100')

// 2b. 通用合约接口（基于 ABI）✨
const pool = client.contract(POOL_ADDRESS, POOL_ABI)
const poolInfo = await pool.read.getPoolInfo()
const txHash = await pool.write.stake(['1000000000'])

// 2c. 原始合约调用（最底层）
const result = await client.readContract({
  address: POOL_ADDRESS,
  abi: POOL_ABI,
  functionName: 'getPoolInfo',
  args: [],
})
```

---

## 🔧 Contract Client 设计

### 1. 核心 API

```typescript
/**
 * 获取合约实例（类型安全）
 */
client.contract<TAbi>(
  address: string,
  abi: TAbi
): ContractInstance<TAbi>

/**
 * Contract Instance 接口
 */
interface ContractInstance<TAbi> {
  /** 合约地址 */
  address: string
  
  /** 合约 ABI */
  abi: TAbi
  
  /** 只读方法 */
  read: ReadMethods<TAbi>
  
  /** 需要签名的方法 */
  write: WriteMethods<TAbi>
  
  /** 估算 Gas */
  estimateGas: EstimateGasMethods<TAbi>
  
  /** 模拟执行 */
  simulate: SimulateMethods<TAbi>
}
```

### 2. 使用示例

#### 示例 1：自定义 Pool 合约

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

// Pool 合约 ABI
const POOL_ABI = [
  {
    name: 'getPoolInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalLiquidity', type: 'uint256' },
      { name: 'apr', type: 'uint256' },
    ],
  },
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'unstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

// 创建合约实例
const pool = client.contract('0xPoolAddress', POOL_ABI)

// 只读调用
const poolInfo = await pool.read.getPoolInfo()
console.log('Total Liquidity:', poolInfo.totalLiquidity)
console.log('APR:', poolInfo.apr)

// 需要签名的调用
const txHash = await pool.write.stake(['1000000000'])
console.log('Stake transaction:', txHash)

// 带选项的调用
const { hash, receipt } = await pool.write.unstake(['500000000'], {
  waitForConfirmation: true,
  gasLimit: 200000n,
})
console.log('Unstake confirmed:', hash)
```

#### 示例 2：NFT 合约（ERC721）

```typescript
const ERC721_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const nft = client.contract('0xNFTAddress', ERC721_ABI)

// 查询余额
const balance = await nft.read.balanceOf(['0xUserAddress'])
console.log('NFT Balance:', balance)

// 查询 NFT 拥有者
const owner = await nft.read.ownerOf(['123'])
console.log('Token #123 owner:', owner)

// 转移 NFT
await nft.write.transferFrom([
  '0xFromAddress',
  '0xToAddress',
  '123',
])
```

#### 示例 3：Enclave Pool 合约

```typescript
// Enclave Pool ABI
const ENCLAVE_POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    name: 'getUserBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// 创建 Pool 实例
const enclavePool = client.contract('0xEnclavePoolAddress', ENCLAVE_POOL_ABI)

// 查询用户余额
const userBalance = await enclavePool.read.getUserBalance([
  '0xUserAddress',
  '0xUSDT',
])
console.log('User balance in pool:', userBalance)

// 存款
await enclavePool.write.deposit([
  '0xUSDT',
  parseUnits('100', 6),
], {
  waitForConfirmation: true,
})

// 提款
await enclavePool.write.withdraw([
  '0xUSDT',
  parseUnits('50', 6),
  proof, // Merkle proof
], {
  waitForConfirmation: true,
})
```

---

## 🏗️ 实现设计

### 1. ContractClient 类

```typescript
// @enclave-hq/sdk/src/client/ContractClient.ts
import type { WalletManager } from '@enclave-hq/wallet-sdk'
import type { Abi } from 'abitype'

export class ContractClient {
  constructor(private walletManager: WalletManager) {}
  
  /**
   * 创建合约实例
   */
  contract<TAbi extends Abi>(
    address: string,
    abi: TAbi
  ): ContractInstance<TAbi> {
    return new ContractInstance(address, abi, this.walletManager)
  }
  
  /**
   * 原始读调用（透传到 wallet-sdk）
   */
  async readContract<TAbi extends Abi, TFunctionName extends string>(
    params: ReadContractParams<TAbi, TFunctionName>
  ): Promise<any> {
    return await this.walletManager.readContract(params)
  }
  
  /**
   * 原始写调用（透传到 wallet-sdk）
   */
  async writeContract<TAbi extends Abi, TFunctionName extends string>(
    params: WriteContractParams<TAbi, TFunctionName>
  ): Promise<{ hash: string; receipt?: TransactionReceipt }> {
    return await this.walletManager.writeContract(params)
  }
}
```

### 2. ContractInstance 类

```typescript
// @enclave-hq/sdk/src/client/ContractInstance.ts
export class ContractInstance<TAbi extends Abi> {
  public readonly address: string
  public readonly abi: TAbi
  
  constructor(
    address: string,
    abi: TAbi,
    private walletManager: WalletManager
  ) {
    this.address = address
    this.abi = abi
    
    // 动态生成 read/write 方法
    this.read = this.createReadProxy()
    this.write = this.createWriteProxy()
    this.estimateGas = this.createEstimateGasProxy()
    this.simulate = this.createSimulateProxy()
  }
  
  /**
   * 只读方法代理
   */
  public readonly read: ReadMethods<TAbi>
  
  private createReadProxy(): ReadMethods<TAbi> {
    return new Proxy({} as ReadMethods<TAbi>, {
      get: (target, prop: string) => {
        return async (args?: readonly unknown[]) => {
          return await this.walletManager.readContract({
            address: this.address,
            abi: this.abi,
            functionName: prop,
            args: args || [],
          })
        }
      },
    })
  }
  
  /**
   * 写入方法代理
   */
  public readonly write: WriteMethods<TAbi>
  
  private createWriteProxy(): WriteMethods<TAbi> {
    return new Proxy({} as WriteMethods<TAbi>, {
      get: (target, prop: string) => {
        return async (
          args?: readonly unknown[],
          options?: WriteOptions
        ) => {
          const result = await this.walletManager.writeContract({
            address: this.address,
            abi: this.abi,
            functionName: prop,
            args: args || [],
            value: options?.value,
            gas: options?.gasLimit,
            gasPrice: options?.gasPrice,
            waitForConfirmation: options?.waitForConfirmation,
          })
          
          // 如果只需要 hash，直接返回
          if (!options?.returnReceipt) {
            return result.hash
          }
          
          return result
        }
      },
    })
  }
  
  /**
   * Gas 估算代理
   */
  public readonly estimateGas: EstimateGasMethods<TAbi>
  
  private createEstimateGasProxy(): EstimateGasMethods<TAbi> {
    return new Proxy({} as EstimateGasMethods<TAbi>, {
      get: (target, prop: string) => {
        return async (args?: readonly unknown[]) => {
          return await this.walletManager.estimateGas({
            address: this.address,
            abi: this.abi,
            functionName: prop,
            args: args || [],
          })
        }
      },
    })
  }
  
  /**
   * 模拟执行代理
   */
  public readonly simulate: SimulateMethods<TAbi>
  
  private createSimulateProxy(): SimulateMethods<TAbi> {
    return new Proxy({} as SimulateMethods<TAbi>, {
      get: (target, prop: string) => {
        return async (args?: readonly unknown[]) => {
          // TODO: 实现模拟执行
          // 可以使用 eth_call 或 wallet-sdk 的 simulate 功能
          throw new Error('Simulate not implemented yet')
        }
      },
    })
  }
}
```

### 3. 类型定义

```typescript
// @enclave-hq/sdk/src/types/contract.ts
import type { Abi } from 'abitype'

/**
 * 写入选项
 */
export interface WriteOptions {
  /** 发送的 ETH/TRX */
  value?: bigint
  
  /** Gas 限制 */
  gasLimit?: bigint
  
  /** Gas 价格 */
  gasPrice?: bigint
  
  /** 是否等待确认 */
  waitForConfirmation?: boolean
  
  /** 是否返回完整的 receipt */
  returnReceipt?: boolean
}

/**
 * 只读方法类型（从 ABI 推断）
 */
export type ReadMethods<TAbi extends Abi> = {
  [K in ExtractReadableFunctions<TAbi>]: (
    args?: readonly unknown[]
  ) => Promise<any>
}

/**
 * 写入方法类型（从 ABI 推断）
 */
export type WriteMethods<TAbi extends Abi> = {
  [K in ExtractWritableFunctions<TAbi>]: (
    args?: readonly unknown[],
    options?: WriteOptions
  ) => Promise<string> // 默认返回 hash
}

/**
 * Gas 估算方法类型
 */
export type EstimateGasMethods<TAbi extends Abi> = {
  [K in ExtractWritableFunctions<TAbi>]: (
    args?: readonly unknown[]
  ) => Promise<{
    gasLimit: bigint
    gasPrice: bigint
    estimatedFee: bigint
  }>
}

/**
 * 模拟方法类型
 */
export type SimulateMethods<TAbi extends Abi> = {
  [K in ExtractWritableFunctions<TAbi>]: (
    args?: readonly unknown[]
  ) => Promise<{
    success: boolean
    result?: any
    revertReason?: string
  }>
}

/**
 * 从 ABI 中提取只读函数名
 */
type ExtractReadableFunctions<TAbi extends Abi> = Extract<
  TAbi[number],
  { type: 'function'; stateMutability: 'view' | 'pure' }
>['name']

/**
 * 从 ABI 中提取可写函数名
 */
type ExtractWritableFunctions<TAbi extends Abi> = Extract<
  TAbi[number],
  { type: 'function'; stateMutability: 'nonpayable' | 'payable' }
>['name']
```

---

## 📚 EnclaveClient 完整集成

```typescript
// @enclave-hq/sdk/src/client/EnclaveClient.ts
export class EnclaveClient {
  private walletManager: WalletManager
  private apiClient: APIClient
  
  // ===== 第一层：业务 API =====
  
  /**
   * 存款
   */
  async deposit(params: DepositParams): Promise<string> {
    // 实现...
  }
  
  /**
   * 提款
   */
  async withdraw(params: WithdrawParams): Promise<string> {
    // 实现...
  }
  
  // ===== 第二层：三个并列的客户端 =====
  
  /**
   * 2a. Token 标准接口
   */
  public readonly token: TokenClient
  
  /**
   * 2b. 通用合约接口（基于 ABI）
   */
  public readonly contracts: ContractClient
  
  constructor(config: EnclaveClientConfig) {
    this.walletManager = config.walletManager
    this.apiClient = new APIClient(config.apiUrl)
    
    // 初始化三个客户端
    this.token = new TokenClient(this.walletManager, this.apiClient)
    this.contracts = new ContractClient(this.walletManager)
  }
  
  /**
   * 2b. 创建合约实例（快捷方法）
   */
  contract<TAbi extends Abi>(
    address: string,
    abi: TAbi
  ): ContractInstance<TAbi> {
    return this.contracts.contract(address, abi)
  }
  
  /**
   * 2c. 原始合约调用（快捷方法）
   */
  async readContract<TAbi extends Abi, TFunctionName extends string>(
    params: ReadContractParams<TAbi, TFunctionName>
  ): Promise<any> {
    return await this.contracts.readContract(params)
  }
  
  async writeContract<TAbi extends Abi, TFunctionName extends string>(
    params: WriteContractParams<TAbi, TFunctionName>
  ): Promise<{ hash: string; receipt?: TransactionReceipt }> {
    return await this.contracts.writeContract(params)
  }
}
```

---

## 🎨 完整使用示例

### 场景 1：Enclave 业务（推荐）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

const client = new EnclaveClient({ apiUrl, walletManager })

// 直接使用高层 API
await client.deposit({
  tokenAddress: '0xUSDT',
  amount: '100',
})
```

### 场景 2：ERC20 代币操作

```typescript
// 使用 Token 客户端
const balance = await client.token.balanceOf('0xUSDT')
await client.token.transfer('0xUSDT', recipient, '100')
await client.token.approve('0xUSDT', spender, '1000')
```

### 场景 3：自定义合约（类型安全）

```typescript
// 使用 Contract 客户端
const pool = client.contract(POOL_ADDRESS, POOL_ABI)

// 只读调用
const info = await pool.read.getPoolInfo()

// 写入调用
await pool.write.stake(['1000000000'])

// Gas 估算
const gasEstimate = await pool.estimateGas.stake(['1000000000'])
console.log('Estimated gas:', gasEstimate.gasLimit)
```

### 场景 4：原始合约调用（最灵活）

```typescript
// 使用原始方法
const result = await client.readContract({
  address: POOL_ADDRESS,
  abi: POOL_ABI,
  functionName: 'getPoolInfo',
  args: [],
})

await client.writeContract({
  address: POOL_ADDRESS,
  abi: POOL_ABI,
  functionName: 'stake',
  args: ['1000000000'],
  waitForConfirmation: true,
})
```

---

## ✅ 总结

### 完整的三层架构

```typescript
// 第一层：Enclave 业务 API（最高层）
await client.deposit({ amount: '100', token: '0xUSDT' })

// 第二层：三个并列的客户端
// 2a. Token 标准接口
await client.token.balanceOf('0xUSDT')

// 2b. 通用合约接口（类型安全）✨
const pool = client.contract(POOL_ADDRESS, POOL_ABI)
await pool.read.getPoolInfo()
await pool.write.stake(['1000000000'])

// 2c. 原始合约调用
await client.readContract({ address, abi, functionName, args })
```

### 优势

1. ✅ **类型安全**：基于 ABI 自动推断类型
2. ✅ **智能提示**：IDE 自动补全方法名
3. ✅ **灵活性**：支持任何合约
4. ✅ **统一体验**：EVM 和 Tron 相同 API
5. ✅ **分层清晰**：业务 / 标准 / 通用 / 原始
6. ✅ **易于使用**：类似 viem 的开发体验

### 应用开发者选择指南

| 场景 | 推荐使用 | 示例 |
|------|---------|------|
| Enclave 存款/提款 | 业务 API | `client.deposit()` |
| ERC20 代币操作 | Token 客户端 | `client.token.transfer()` |
| 自定义合约（有 ABI） | Contract 客户端 | `client.contract(addr, abi).write.method()` |
| 特殊需求 | 原始调用 | `client.readContract()` |


