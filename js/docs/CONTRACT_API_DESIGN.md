# 合约调用 API 设计

## 📋 概述

本文档定义合约调用相关的 API 设计，包括：
- **@enclave-hq/wallet-sdk**：提供通用合约调用 API（`readContract`、`writeContract`等）
- **@enclave-hq/sdk**：提供高层业务 API（`deposit`、`withdraw` 等）

### 设计原则

1. **分层 API**：高层业务 API（@sdk）+ 通用合约 API（wallet-sdk）
2. **类型安全**：完整的 TypeScript 类型支持
3. **职责分离**：wallet-sdk 负责链上交互，@sdk 负责业务逻辑
4. **灵活性**：支持直接使用 wallet-sdk 或通过 @sdk 封装

---

## 🎯 API 层次

### 第一层：高层业务 API（@sdk，推荐）

封装好的业务逻辑，应用开发者首选。

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'

// 示例：存款
await enclaveClient.deposit({
  tokenAddress: '0xUSDT',
  amount: '100',
  poolId: 'pool-1',
})

// 内部自动处理：
// 1. 检查授权
// 2. 如果需要，先授权（调用 wallet-sdk.writeContract）
// 3. 执行存款（调用 wallet-sdk.writeContract）
// 4. 通知后端
// 5. 等待确认
```

### 第二层：通用合约 API（wallet-sdk，灵活）

由 **@enclave-hq/wallet-sdk** 提供的通用合约调用接口，适合：
- 调用自定义合约
- 不需要 Enclave 业务逻辑
- 其他项目复用

```typescript
import { WalletManager } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager()
await walletManager.connect(WalletType.METAMASK)

// 只读调用
const balance = await walletManager.readContract({
  address: '0xTokenAddress',
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: ['0xUserAddress'],
})

// 写入调用
const { hash } = await walletManager.writeContract({
  address: '0xTokenAddress',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 18)],
})
```

---

## 🔧 通用合约调用 API

### 1. readContract（只读查询）

**特点**：
- 不需要签名
- 不需要 gas
- 可以在未连接钱包时使用（自动降级到 RPC）
- 不会触发钱包弹窗

**类型定义**：

```typescript
interface ReadContractParams<TAbi extends Abi = Abi, TFunctionName extends string = string> {
  /** 合约地址 */
  address: string
  
  /** 合约 ABI */
  abi: TAbi
  
  /** 函数名 */
  functionName: TFunctionName
  
  /** 函数参数 */
  args?: readonly unknown[]
  
  /** 可选：指定链 ID（默认使用当前链） */
  chainId?: number
  
  /** 可选：区块号或区块标签 */
  blockNumber?: bigint
  blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'
}

interface ReadContractResult<TResult = unknown> {
  /** 返回值 */
  result: TResult
  
  /** 查询使用的链 ID */
  chainId: number
  
  /** 查询使用的区块号 */
  blockNumber: bigint
}
```

**使用示例**：

```typescript
// ERC20 余额查询
const { result: balance } = await enclaveClient.readContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: ['0xUserAddress'],
})

console.log('Balance:', formatUnits(balance, 18))

// 查询授权额度
const { result: allowance } = await enclaveClient.readContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: ['0xOwner', '0xSpender'],
})

// 查询历史区块数据
const { result: historicalBalance } = await enclaveClient.readContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: ['0xUserAddress'],
  blockNumber: 18000000n,
})
```

---

### 2. writeContract（需要签名的调用）

**特点**：
- 需要连接钱包
- 需要 gas
- 会触发钱包签名弹窗
- 返回交易哈希

**类型定义**：

```typescript
interface WriteContractParams<TAbi extends Abi = Abi, TFunctionName extends string = string> {
  /** 合约地址 */
  address: string
  
  /** 合约 ABI */
  abi: TAbi
  
  /** 函数名 */
  functionName: TFunctionName
  
  /** 函数参数 */
  args?: readonly unknown[]
  
  /** 可选：发送的 ETH 数量（payable 函数） */
  value?: bigint
  
  /** 可选：Gas 限制 */
  gas?: bigint
  
  /** 可选：Gas 价格 */
  gasPrice?: bigint
  
  /** 可选：最大费用（EIP-1559） */
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  
  /** 可选：是否等待确认 */
  waitForConfirmation?: boolean
  confirmations?: number
}

interface WriteContractResult {
  /** 交易哈希 */
  hash: string
  
  /** 交易链 ID */
  chainId: number
  
  /** 发送者地址 */
  from: string
  
  /** 合约地址 */
  to: string
  
  /** 如果 waitForConfirmation=true，包含收据 */
  receipt?: TransactionReceipt
}
```

**使用示例**：

```typescript
// ERC20 转账
const { hash, receipt } = await enclaveClient.writeContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 18)],
  waitForConfirmation: true,
  confirmations: 2,
})

console.log('Transaction hash:', hash)
console.log('Block number:', receipt?.blockNumber)

// ERC20 授权
await enclaveClient.writeContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'approve',
  args: ['0xSpender', parseUnits('1000', 18)],
})

// 调用 payable 函数
await enclaveClient.writeContract({
  address: '0xContractAddress',
  abi: CONTRACT_ABI,
  functionName: 'deposit',
  value: parseEther('1'), // 发送 1 ETH
})
```

---

### 3. multicall（批量调用）

**特点**：
- 一次性读取多个合约数据
- 减少 RPC 请求次数
- 提高性能

**类型定义**：

```typescript
interface MulticallParams {
  contracts: Array<{
    address: string
    abi: Abi
    functionName: string
    args?: readonly unknown[]
  }>
  
  /** 可选：允许部分失败 */
  allowFailure?: boolean
  
  /** 可选：指定区块 */
  blockNumber?: bigint
}

interface MulticallResult {
  results: Array<{
    status: 'success' | 'failure'
    result?: unknown
    error?: Error
  }>
  
  blockNumber: bigint
}
```

**使用示例**：

```typescript
// 批量查询多个代币余额
const { results } = await enclaveClient.multicall({
  contracts: [
    {
      address: '0xUSDT',
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0xUserAddress'],
    },
    {
      address: '0xUSDC',
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0xUserAddress'],
    },
    {
      address: '0xDAI',
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0xUserAddress'],
    },
  ],
  allowFailure: true,
})

results.forEach((result, index) => {
  if (result.status === 'success') {
    console.log(`Token ${index} balance:`, result.result)
  } else {
    console.error(`Token ${index} failed:`, result.error)
  }
})
```

---

### 4. estimateGas（估算 Gas）

**特点**：
- 在实际执行前估算 Gas 消耗
- 用于显示交易费用预估
- 不需要签名

**类型定义**：

```typescript
interface EstimateGasParams {
  address: string
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  from?: string
}

interface EstimateGasResult {
  /** 估算的 Gas */
  gasLimit: bigint
  
  /** 当前 Gas 价格 */
  gasPrice: bigint
  
  /** 预估费用（ETH） */
  estimatedFee: bigint
  
  /** 格式化的费用 */
  formattedFee: string
}
```

**使用示例**：

```typescript
const gasEstimate = await enclaveClient.estimateGas({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 18)],
})

console.log('Estimated gas:', gasEstimate.gasLimit.toString())
console.log('Estimated fee:', gasEstimate.formattedFee, 'ETH')

// 显示给用户确认
showConfirmDialog({
  message: `Transfer 100 USDT to ${recipient}`,
  fee: gasEstimate.formattedFee,
})
```

---

### 5. simulateContract（模拟执行）

**特点**：
- 模拟合约调用，但不实际执行
- 用于验证调用是否会成功
- 返回预期的结果和状态变化

**类型定义**：

```typescript
interface SimulateContractParams {
  address: string
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  from?: string
}

interface SimulateContractResult<TResult = unknown> {
  /** 是否会成功 */
  success: boolean
  
  /** 预期返回值 */
  result?: TResult
  
  /** 如果失败，错误原因 */
  revertReason?: string
  
  /** Gas 消耗 */
  gasUsed: bigint
}
```

**使用示例**：

```typescript
// 模拟转账，检查是否会成功
const simulation = await enclaveClient.simulateContract({
  address: '0xUSDTAddress',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 18)],
})

if (!simulation.success) {
  console.error('Transfer would fail:', simulation.revertReason)
  // 显示友好的错误提示
  if (simulation.revertReason?.includes('insufficient balance')) {
    alert('Insufficient balance')
  }
} else {
  // 继续执行实际转账
  await enclaveClient.writeContract({
    address: '0xUSDTAddress',
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: ['0xRecipient', parseUnits('100', 18)],
  })
}
```

---

## 🏗️ 实现示例

### EnclaveClient 中的实现

```typescript
// @enclave-hq/sdk/src/client/EnclaveClient.ts
import { createPublicClient, createWalletClient, custom, type Abi } from 'viem'
import type { WalletManager } from '@enclave-hq/wallet-sdk'

export class EnclaveClient {
  private walletManager: WalletManager
  private publicClient: PublicClient | null = null
  private walletClient: WalletClient | null = null
  
  /**
   * 只读合约调用
   */
  async readContract<TAbi extends Abi, TFunctionName extends string>(
    params: ReadContractParams<TAbi, TFunctionName>
  ): Promise<ReadContractResult> {
    // 初始化 publicClient（自动处理 Provider）
    await this.ensurePublicClient()
    
    try {
      const result = await this.publicClient!.readContract({
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        blockNumber: params.blockNumber,
        blockTag: params.blockTag,
      })
      
      const blockNumber = await this.publicClient!.getBlockNumber()
      
      return {
        result,
        chainId: await this.getChainId(),
        blockNumber,
      }
    } catch (error) {
      this.logger.error('Read contract failed', error)
      throw new ContractCallError('Failed to read contract', error)
    }
  }
  
  /**
   * 需要签名的合约调用
   */
  async writeContract<TAbi extends Abi, TFunctionName extends string>(
    params: WriteContractParams<TAbi, TFunctionName>
  ): Promise<WriteContractResult> {
    // 确保钱包已连接
    await this.ensureWalletClient()
    
    const currentAccount = this.walletManager.getCurrentAccount()
    if (!currentAccount) {
      throw new Error('No account connected')
    }
    
    try {
      // 发起交易
      const hash = await this.walletClient!.writeContract({
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
        gas: params.gas,
        gasPrice: params.gasPrice,
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      })
      
      this.logger.info('Transaction sent', { hash })
      
      // 如果需要等待确认
      let receipt: TransactionReceipt | undefined
      if (params.waitForConfirmation) {
        await this.ensurePublicClient()
        receipt = await this.publicClient!.waitForTransactionReceipt({
          hash: hash as `0x${string}`,
          confirmations: params.confirmations || 1,
        })
        
        this.logger.info('Transaction confirmed', {
          hash,
          blockNumber: receipt.blockNumber,
        })
      }
      
      return {
        hash,
        chainId: currentAccount.chainId,
        from: currentAccount.address.address,
        to: params.address,
        receipt,
      }
    } catch (error) {
      this.logger.error('Write contract failed', error)
      throw new ContractCallError('Failed to write contract', error)
    }
  }
  
  /**
   * 批量调用
   */
  async multicall(params: MulticallParams): Promise<MulticallResult> {
    await this.ensurePublicClient()
    
    try {
      const results = await this.publicClient!.multicall({
        contracts: params.contracts.map(contract => ({
          address: contract.address as `0x${string}`,
          abi: contract.abi,
          functionName: contract.functionName,
          args: contract.args,
        })),
        allowFailure: params.allowFailure ?? true,
        blockNumber: params.blockNumber,
      })
      
      const blockNumber = await this.publicClient!.getBlockNumber()
      
      return {
        results: results.map(result => ({
          status: result.status,
          result: result.result,
          error: result.error,
        })),
        blockNumber,
      }
    } catch (error) {
      this.logger.error('Multicall failed', error)
      throw new ContractCallError('Failed to execute multicall', error)
    }
  }
  
  /**
   * 估算 Gas
   */
  async estimateGas(params: EstimateGasParams): Promise<EstimateGasResult> {
    await this.ensurePublicClient()
    
    try {
      const gasLimit = await this.publicClient!.estimateContractGas({
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
        account: params.from as `0x${string}` | undefined,
      })
      
      const gasPrice = await this.publicClient!.getGasPrice()
      const estimatedFee = gasLimit * gasPrice
      const formattedFee = formatEther(estimatedFee)
      
      return {
        gasLimit,
        gasPrice,
        estimatedFee,
        formattedFee,
      }
    } catch (error) {
      this.logger.error('Gas estimation failed', error)
      throw new ContractCallError('Failed to estimate gas', error)
    }
  }
  
  /**
   * 模拟合约调用
   */
  async simulateContract<TAbi extends Abi>(
    params: SimulateContractParams
  ): Promise<SimulateContractResult> {
    await this.ensurePublicClient()
    
    try {
      const { result } = await this.publicClient!.simulateContract({
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
        account: params.from as `0x${string}` | undefined,
      })
      
      return {
        success: true,
        result,
        gasUsed: 0n, // TODO: 从模拟中获取
      }
    } catch (error: any) {
      // 解析 revert 原因
      const revertReason = this.parseRevertReason(error)
      
      return {
        success: false,
        revertReason,
        gasUsed: 0n,
      }
    }
  }
  
  /**
   * 解析 revert 原因
   */
  private parseRevertReason(error: any): string {
    if (error.message?.includes('execution reverted:')) {
      return error.message.split('execution reverted:')[1].trim()
    }
    return error.message || 'Unknown revert reason'
  }
  
  /**
   * 确保 publicClient 已初始化
   */
  private async ensurePublicClient(): Promise<void> {
    if (this.publicClient) return
    
    const { provider } = await this.walletManager.getProvider()
    this.publicClient = createPublicClient({
      transport: custom(provider),
    })
  }
  
  /**
   * 确保 walletClient 已初始化
   */
  private async ensureWalletClient(): Promise<void> {
    if (this.walletClient) return
    
    if (!this.walletManager.isConnected()) {
      throw new WalletNotConnectedError('Wallet must be connected')
    }
    
    const { provider } = await this.walletManager.getProvider()
    this.walletClient = createWalletClient({
      transport: custom(provider),
    })
  }
}
```

---

## 📚 使用场景示例

### 场景 1：查询代币余额（最简单）

```typescript
const balance = await enclaveClient.readContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: ['0xUserAddress'],
})

console.log('Balance:', balance.result)
```

### 场景 2：转账代币（带确认）

```typescript
const { hash, receipt } = await enclaveClient.writeContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', parseUnits('100', 6)],
  waitForConfirmation: true,
  confirmations: 2,
})

console.log('Transaction confirmed at block', receipt.blockNumber)
```

### 场景 3：批量查询（多个代币）

```typescript
const { results } = await enclaveClient.multicall({
  contracts: SUPPORTED_TOKENS.map(token => ({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  })),
})

const balances = results.map((r, i) => ({
  token: SUPPORTED_TOKENS[i],
  balance: r.result,
}))
```

### 场景 4：估算费用后再执行

```typescript
// 1. 估算费用
const gasEstimate = await enclaveClient.estimateGas({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', amount],
})

// 2. 显示给用户
const confirmed = await showConfirmDialog({
  message: 'Transfer USDT',
  estimatedFee: gasEstimate.formattedFee,
})

// 3. 用户确认后执行
if (confirmed) {
  await enclaveClient.writeContract({
    address: '0xUSDT',
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: ['0xRecipient', amount],
  })
}
```

### 场景 5：模拟 + 执行（安全模式）

```typescript
// 1. 先模拟
const simulation = await enclaveClient.simulateContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', amount],
})

if (!simulation.success) {
  // 显示错误
  alert(`Transaction would fail: ${simulation.revertReason}`)
  return
}

// 2. 模拟成功，执行实际交易
const { hash } = await enclaveClient.writeContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: ['0xRecipient', amount],
})
```

---

## 🔄 Tron 支持

对于 Tron 链，API 保持一致，内部自动处理差异：

```typescript
// Tron TRC20 转账（API 相同）
const { hash } = await enclaveClient.writeContract({
  address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT on Tron
  abi: TRC20_ABI,
  functionName: 'transfer',
  args: ['TRecipientAddress', amount],
})

// 内部：
// - 检测到 Tron 链
// - 使用 TronWeb 而非 viem
// - 自动处理 Base58 地址
```

---

## ✅ 总结

### API 设计原则

1. **统一接口**：EVM 和 Tron 使用相同 API
2. **类型安全**：完整的 TypeScript 支持
3. **自动处理**：Provider、Gas、确认等
4. **灵活性**：从高层 API 到底层合约调用

### 推荐使用顺序

1. **首选**：@sdk 高层业务 API（`deposit()`, `withdraw()`）
   - 自动处理授权、多步骤交易
   - 自动后端同步
   
2. **次选**：wallet-sdk 通用合约 API（`readContract()`, `writeContract()`）
   - 调用自定义合约
   - 更多控制权
   
3. **高级**：直接使用 Provider（特殊需求）
   - 通过 `walletManager.getProvider()` 获取

### 用户端代码示例

```typescript
import { EnclaveClient } from '@enclave-hq/sdk'
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

// 1. 初始化 wallet-sdk
const walletManager = new WalletManager()
await walletManager.connect(WalletType.METAMASK)

// 2a. 方式 1：直接使用 wallet-sdk（通用合约调用）
const balance = await walletManager.readContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: [userAddress],
})

await walletManager.writeContract({
  address: '0xUSDT',
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: [recipient, amount],
})

// 2b. 方式 2：使用 @sdk（推荐，业务逻辑封装）
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave.finance',
  walletManager,
})

// 高层业务 API（推荐）
await client.deposit({ amount: '100', token: '0xUSDT' })

// 内部使用 walletManager.readContract / writeContract
```

