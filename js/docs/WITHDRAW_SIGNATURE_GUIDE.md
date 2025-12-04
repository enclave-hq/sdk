# Withdraw 签名文本生成指南

## 概述

本文档说明如何生成和使用 Withdraw（提款）操作的签名文本。签名文本是用户需要签名的消息，用于验证提款请求的合法性。

## 快速开始

### 1. 生成签名数据

```typescript
import { EnclaveClient } from '@enclave/sdk';

const client = new EnclaveClient({ ... });

// 准备提款签名数据
const signData = await client.prepareWithdraw({
  allocationIds: ['alloc-1', 'alloc-2'],
  intent: {
    type: 'RawToken',
    beneficiary: {
      chainId: 714, // BSC (SLIP-44)
      universalFormat: '0x...', // 32-byte Universal Address
      address: '0x...' // 显示地址
    },
    tokenSymbol: 'USDT'
  }
}, 1); // lang = 1 (English), 2 (Chinese)
```

### 2. 获取签名文本

```typescript
// 签名文本在 signData.message 中
const message = signData.message;

// 显示给用户确认
console.log('签名消息：');
console.log(message);
```

### 3. 使用签名文本进行签名

```typescript
// 使用钱包签名（传入原始文本，不是哈希）
const signature = await wallet.signMessage(message);

// 钱包会自动：
// 1. 添加 EIP-191 前缀
// 2. 计算 keccak256 哈希
// 3. 使用私钥签名
```

### 4. 提交签名后的提款请求

```typescript
const withdrawal = await client.submitWithdraw({
  allocationIds: signData.allocationIds,
  intent: signData.intent,
  signature: signature,
  chainId: signData.targetChain,
  message: signData.message,
  nullifier: signData.nullifier
});
```

## 签名文本格式

签名文本是一个多语言、格式化的字符串，包含以下信息：

```
🔓 Enclave Private Withdrawal

Source Token: USDT on Ethereum (60)

📊 Allocations: 2 item(s)
  • Deposit 1 #0: 100.0 USDT
  • Deposit 1 #1: 50.0 USDT

Total Amount: 150.0 USDT

Target Token:
  On chain: BSC (714) get token USDT

Beneficiary: 0x1234...5678 on BSC

Min Output: 149.0 USDT
```

### 文本组成部分

1. **标题**：根据语言显示（英文/中文）
2. **源代币信息**：提取的代币和链信息
3. **分配列表**：按 depositId 和 seq 排序的 allocations
4. **总金额**：所有 allocations 的总和
5. **目标代币信息**：根据 Intent 类型显示（RawToken/AssetToken）
6. **受益人地址**：目标地址和链信息
7. **最小输出**：最小输出数量限制

## 数据结构

### WithdrawalSignData

```typescript
interface WithdrawalSignData {
  /** 排序后的 allocation ID 列表 */
  allocationIds: string[];
  
  /** 目标链 ID (SLIP-44) */
  targetChain: number;
  
  /** 目标地址（显示用） */
  targetAddress: string;
  
  /** Intent 对象（RawToken 或 AssetToken） */
  intent: Intent;
  
  /** 代币符号（如 "USDT", "USDC"） */
  tokenSymbol: string;
  
  /** ⭐ 签名文本（这就是用户需要签名的消息） */
  message: string;
  
  /** 消息哈希（keccak256） */
  messageHash: string;
  
  /** Nullifier 哈希值 */
  nullifier: string;
}
```

## 排序规则

Allocations 的排序规则（与 Rust 端和前端保持一致）：

1. **先按 CheckBook 的 depositId 排序**（升序）
2. **同一 CheckBook 内按 seq 排序**（升序）

```typescript
// 排序后的 allocations 示例：
// Deposit 1 #0
// Deposit 1 #1
// Deposit 2 #0
// Deposit 2 #1
```

## 多语言支持

支持的语言代码：

- `1` - English（英文）
- `2` - Chinese（中文）
- `3` - Spanish（西班牙文）
- `4` - French（法文）
- `5` - German（德文）
- `6` - Japanese（日文）
- `7` - Korean（韩文）
- `8` - Russian（俄文）
- `9` - Arabic（阿拉伯文）
- `10` - Portuguese（葡萄牙文）

```typescript
// 使用中文
const signData = await client.prepareWithdraw(params, 2);

// 使用英文（默认）
const signData = await client.prepareWithdraw(params, 1);
// 或
const signData = await client.prepareWithdraw(params); // 默认 LANG_EN
```

## 跨存款支持

支持从多个不同的 CheckBook（deposit）中提取 allocations：

```typescript
// 每个 allocation 可以来自不同的 checkbook
const signData = await client.prepareWithdraw({
  allocationIds: [
    'alloc-from-checkbook-1',
    'alloc-from-checkbook-2',  // 不同的 checkbook
    'alloc-from-checkbook-1'   // 同一个 checkbook
  ],
  intent: { ... }
});

// SDK 会自动：
// 1. 获取每个 allocation 的 checkbook 信息
// 2. 使用正确的 depositId 进行排序
// 3. 在签名文本中正确显示每个 allocation 的 depositId
```

## 完整示例

```typescript
import { EnclaveClient } from '@enclave/sdk';

async function withdrawExample() {
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave.io',
    wallet: walletManager
  });

  // 1. 准备签名数据
  const signData = await client.prepareWithdraw({
    allocationIds: ['alloc-1', 'alloc-2'],
    intent: {
      type: 'RawToken',
      beneficiary: {
        chainId: 714, // BSC
        universalFormat: '0x0000000000000000000000001234567890123456789012345678901234567890',
        address: '0x1234567890123456789012345678901234567890'
      },
      tokenSymbol: 'USDT'
    },
    minOutput: '0' // 可选，最小输出数量
  }, 2); // 使用中文

  // 2. 显示签名消息给用户
  console.log('═══════════════════════════════════════');
  console.log('提款签名消息：');
  console.log('═══════════════════════════════════════');
  console.log(signData.message);
  console.log('═══════════════════════════════════════');
  console.log(`消息哈希: ${signData.messageHash}`);
  console.log(`Nullifier: ${signData.nullifier}`);
  console.log('═══════════════════════════════════════');

  // 3. 用户确认后签名
  const signature = await wallet.signMessage(signData.message);

  // 4. 提交提款请求
  const withdrawal = await client.submitWithdraw({
    checkbookId: 'checkbook-id', // 从第一个 allocation 获取
    allocationIds: signData.allocationIds,
    intent: signData.intent,
    signature: signature,
    chainId: signData.targetChain,
    message: signData.message,
    nullifier: signData.nullifier
  });

  console.log(`提款请求已创建: ${withdrawal.id}`);
  return withdrawal;
}
```

## 注意事项

### ⚠️ 重要提示

1. **使用原始文本签名**
   ```typescript
   // ✅ 正确：传入原始文本
   const signature = await wallet.signMessage(signData.message);
   
   // ❌ 错误：不要传入哈希
   // const signature = await wallet.signMessage(signData.messageHash);
   ```
   钱包会自动添加 EIP-191 前缀并计算哈希。

2. **排序一致性**
   - SDK 会自动按 depositId 和 seq 排序
   - 确保与 Rust 端和前端保持一致
   - 不要手动修改排序后的 `allocationIds`

3. **金额精度**
   - 签名文本中的金额最多显示 6 位小数
   - 与 Rust 端格式化逻辑一致

4. **跨存款场景**
   - 确保每个 allocation 都有正确的 checkbook 信息
   - SDK 会自动处理不同 checkbook 的 depositId

## API 参考

### client.prepareWithdraw()

```typescript
async prepareWithdraw(
  params: WithdrawalParams,
  lang?: number
): Promise<WithdrawalSignData>
```

**参数：**
- `params.allocationIds`: string[] - Allocation ID 列表
- `params.intent`: Intent - Intent 对象（RawToken 或 AssetToken）
- `params.minOutput?`: string - 最小输出数量（可选，默认 "0"）
- `lang?`: number - 语言代码（可选，默认 1 = English）

**返回：**
- `WithdrawalSignData` 对象，包含 `message` 字段（签名文本）

### WithdrawalAction.prepareWithdraw()

```typescript
async prepareWithdraw(
  params: WithdrawalParams,
  lang?: number
): Promise<WithdrawalSignData>
```

与 `client.prepareWithdraw()` 相同，但直接使用 `WithdrawalAction` 实例。

## 内部实现

### 调用链

```
client.prepareWithdraw()
  ↓
WithdrawalAction.prepareWithdraw()
  ↓
WithdrawFormatter.prepareSignData()  [公共静态方法]
  ↓
  ├─ sortAllocationsByDepositIdAndSeq()  [排序]
  ├─ generateNullifier()  [生成 nullifier]
  ├─ formatMessage()  [生成签名文本] ⭐
  └─ computeMessageHash()  [计算哈希]
  ↓
返回 WithdrawalSignData
```

### formatMessage() 方法

`formatMessage()` 是 `WithdrawFormatter` 类的**私有静态方法**，外部不应直接调用。

- **位置**：`sdk/js/src/formatters/WithdrawFormatter.ts`
- **可见性**：`private static`
- **用途**：生成格式化的签名文本
- **调用**：由 `prepareSignData()` 内部调用

外部应通过 `prepareWithdraw()` 或 `prepareSignData()` 获取签名文本。

## 相关文档

- [SDK 完整指南](../SDK_COMPLETE_GUIDE.md)
- [API 映射文档](./SDK_API_MAPPING.md)
- [设计文档](./SDK_JS_DESIGN.md)

