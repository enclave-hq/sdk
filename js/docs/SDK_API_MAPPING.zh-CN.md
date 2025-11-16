# Enclave SDK API 映射文档

**Languages**: [English](./SDK_API_MAPPING.md) | 中文 | [日本語](./SDK_API_MAPPING.ja.md) | [한국어](./SDK_API_MAPPING.ko.md)

## 概述

本文档详细说明 Enclave JavaScript SDK 的 API 方法与后端 REST API 端点的对应关系，以及 WebSocket 订阅与消息的映射。

## 📚 目录

- [认证相关](#认证相关)
- [签名器架构](#签名器架构)
- [存款相关](#存款相关)
- [Checkbook 相关](#checkbook-相关)
- [Commitment 相关](#commitment-相关)
- [提现相关](#提现相关)
- [Pool & Token 相关](#pool--token-相关)
- [价格相关](#价格相关)
- [WebSocket 订阅](#websocket-订阅)
- [KMS 相关](#kms-相关)
- [SDK 内部实现 vs 后端 API](#sdk-内部实现-vs-后端-api)

## 状态枚举使用

SDK 导出了所有状态枚举，供客户端代码使用：

```typescript
import { 
  EnclaveClient,
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave-hq/sdk';

// ============ CheckbookStatus ============
CheckbookStatus.Pending              // 'pending'
CheckbookStatus.Unsigned             // 'unsigned'
CheckbookStatus.ReadyForCommitment   // 'ready_for_commitment'
CheckbookStatus.GeneratingProof      // 'generating_proof'
CheckbookStatus.SubmittingCommitment // 'submitting_commitment'
CheckbookStatus.CommitmentPending    // 'commitment_pending'
CheckbookStatus.WithCheckbook        // 'with_checkbook'
CheckbookStatus.ProofFailed          // 'proof_failed'
CheckbookStatus.SubmissionFailed     // 'submission_failed'
CheckbookStatus.Deleted              // 'DELETED'

// ============ AllocationStatus ============
AllocationStatus.Idle     // 'idle'
AllocationStatus.Pending  // 'pending'
AllocationStatus.Used     // 'used'

// ============ WithdrawRequestStatus ============
WithdrawRequestStatus.Pending    // 'pending'
WithdrawRequestStatus.Completed  // 'completed'
WithdrawRequestStatus.Failed     // 'failed'
```

**使用示例**：

```typescript
// 1. 状态比较
const checkbook = client.stores.checkbooks.get(id);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  // 可以创建 allocations
}

// 2. 状态过滤
const idleAllocations = client.stores.allocations.all.filter(
  a => a.status === AllocationStatus.Idle
);

// 3. UI 显示
function getStatusBadge(status: CheckbookStatus) {
  switch (status) {
    case CheckbookStatus.Pending:
      return <Badge color="blue">处理中</Badge>;
    case CheckbookStatus.WithCheckbook:
      return <Badge color="green">已激活</Badge>;
    case CheckbookStatus.ProofFailed:
      return <Badge color="red">失败</Badge>;
    default:
      return <Badge>未知</Badge>;
  }
}

// 4. 状态流转控制
function canCreateAllocation(checkbook: Checkbook): boolean {
  return checkbook.status === CheckbookStatus.WithCheckbook;
}

function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 5. React 组件中使用
import { AllocationStatus } from '@enclave-hq/sdk';
import { autorun } from 'mobx';
import { useEffect, useState } from 'react';

function AllocationList({ client }) {
  const [idleCount, setIdleCount] = useState(0);
  
  useEffect(() => {
    const dispose = autorun(() => {
      const idle = client.stores.allocations.getByStatus(AllocationStatus.Idle);
      setIdleCount(idle.length);
    });
    
    return dispose;
  }, [client]);
  
  return <div>可用分配: {idleCount}</div>;
}
```

**TypeScript 类型安全**：

```typescript
// 使用枚举确保类型安全
function processCheckbook(status: CheckbookStatus) {
  // TypeScript 会确保只能传入有效的 CheckbookStatus 值
}

// 错误示例（TypeScript 会报错）
processCheckbook('invalid_status'); // ❌ Error

// 正确示例
processCheckbook(CheckbookStatus.Pending); // ✅ OK
```

---

## 认证相关

### `client.connect(signer)`

**支持的签名器类型**：
1. **私钥字符串**：`'0x...'`（仅限后端）
2. **ethers Signer 对象**：MetaMask、WalletConnect 等
3. **签名回调**：`{ address, signMessage }`（最灵活）

**流程**：
1. 使用签名器创建适配器
2. 调用后端 API 进行认证（使用签名器签名）
3. 建立 WebSocket 连接
4. 初始数据同步

**对应后端 API**：

#### 步骤 1: 获取 Nonce
```typescript
// SDK 内部调用
GET /api/auth/nonce?owner={address}

// 返回
{
  "nonce": "abcd1234",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

#### 步骤 2: 登录认证
```typescript
// SDK 内部调用
POST /api/auth/login

// 请求体
{
  "user_address": "0x...",
  "chain_id": 714,
  "message": "Sign to authenticate with nonce: abcd1234",
  "signature": "0x..."
}

// 返回
{
  "token": "eyJhbGc...",
  "user_address": "0x...",
  "universal_address": "714:0x...",
  "chain_id": 714,
  "expires_in": 86400
}
```

#### 步骤 3: WebSocket 连接
```typescript
// SDK 内部调用
WebSocket ws://localhost:3001/api/ws?token={JWT_TOKEN}
```

---

## 状态系统

### CheckbookStatus（支票本状态）

支票本的生命周期状态，从存款到激活的完整流程：

| 状态 | 值 | 说明 | 可用操作 |
|------|-----|------|---------|
| **pending** | `pending` | 存款已提交，正在处理中 | 等待区块链确认 |
| **unsigned** | `unsigned` | 存款已确认，正在安全加密中 | 系统自动处理 |
| **ready_for_commitment** | `ready_for_commitment` | 已准备好，可以设置 Commitment 信息 | ✅ `client.createCommitment()` |
| **generating_proof** | `generating_proof` | 正在生成专属隐私转账凭证 | ZKVM 证明生成中 |
| **submitting_commitment** | `submitting_commitment` | 凭证已生成，正在保存到区块链 | 交易已发送 |
| **commitment_pending** | `commitment_pending` | 凭证已提交，等待区块链确认 | 等待区块确认 |
| **with_checkbook** | `with_checkbook` | 凭证已完成，可以创建支票 | ✅ `client.createAllocation()` |
| **proof_failed** | `proof_failed` | 证明生成失败 | ✅ `client.createCommitment()` (可重试) |
| **submission_failed** | `submission_failed` | 提交失败 | ✅ `client.createCommitment()` (可重试) |
| **DELETED** | `DELETED` | 记录已删除 | 不可用 |

**状态流转**：
```
pending → unsigned → ready_for_commitment → generating_proof
    → submitting_commitment → commitment_pending → with_checkbook
                    ↓ (失败)
            proof_failed / submission_failed
                    ↑ (可重试)
            (重新调用 createCommitment())
```

**使用示例**：
```typescript
import { canCreateCommitment, canCreateAllocations, isRetryableFailure, CheckbookStatus } from '@enclave-hq/sdk';

const checkbook = client.stores.checkbooks.get(id);

// 检查是否可以创建 commitment（包括失败后重试）
if (canCreateCommitment(checkbook.status)) {
  // 可以创建 commitment（包括 ready_for_commitment、submission_failed、proof_failed 等状态）
  await client.createCommitment({ ... });
}

// 检查是否可以创建 allocations
if (canCreateAllocations(checkbook.status)) {
  // 可以创建 allocations
}

// 检查是否为可重试的失败状态
if (isRetryableFailure(checkbook.status)) {
  // 显示重试按钮给用户
  // 状态为 proof_failed 或 submission_failed
}
```

---

### AllocationStatus（分配状态）

分配（Allocation）状态用于控制是否可以被包含到新的 WithdrawRequest 中：

| 状态 | 值 | 说明 | 是否可包含到新 WithdrawRequest |
|------|-----|------|---------------------------|
| **idle** | `idle` | 分配已创建，尚未使用 | ✅ **可以** |
| **pending** | `pending` | 已包含在某个 WithdrawRequest 中 | ❌ **不可以** |
| **used** | `used` | 提现已成功完成 | ❌ **不可以** |

**状态流转**：
```
idle → pending → used
     ↓ (WithdrawRequest 失败时)
   idle (回滚)
```

**关键特性**：
- 一个 WithdrawRequest 可以包含**多个** `idle` 状态的 allocations
- 当 WithdrawRequest 状态变为 `pending` 时，所有包含的 allocations 状态变为 `pending`
- 当 WithdrawRequest 状态变为 `completed` 时，所有包含的 allocations 状态变为 `used`
- 当 WithdrawRequest 状态变为 `failed` 时，所有包含的 allocations 状态回滚到 `idle`

---

### WithdrawRequestStatus（提现请求状态）

提现请求（WithdrawRequest）状态采用两阶段架构：

| 状态 | 值 | 说明 | Allocations 状态 |
|------|-----|------|-----------------|
| **pending** | `pending` | 正在生成提现证明 | `pending` |
| **completed** | `completed` | ✅ 链上请求已完成（⚠️ 不代表资金已到账） | `used` |
| **failed** | `failed` | ❌ 提现请求失败 | 回滚到 `idle` |

**状态流转**：
```
pending → completed (链上请求完成)
       ↓
    failed (allocations 回滚到 idle)
```

**状态与字段关系**：

| WithdrawRequest 状态 | Allocations 状态 | `nullifier` | `request_id` | `execute_tx_hash` |
|---------------------|-----------------|-------------|-------------|-------------------|
| `pending` | `pending` | ✅ 有值 | `null` | `null` |
| `completed` | `used` | ✅ 有值 | ✅ 有值 | ✅ 有值 |
| `failed` | 回滚到 `idle` | ✅ 有值 | `null` | `null` |

**SDK 使用示例**：

```typescript
// 场景1：查询可用的 allocations
const idleAllocations = client.stores.allocations.all.filter(
  a => a.status === 'idle'
);

// 场景2：创建 WithdrawRequest（包含多个 allocations）
const withdrawRequest = await client.withdraw({
  allocation_ids: [alloc1.id, alloc2.id, alloc3.id], // 这3个必须都是 idle 状态
  intent: 'cross_chain',
  // ...
});
// 立即，这3个 allocations 状态变为 pending

// 场景3：监听 WithdrawRequest 状态变化
autorun(() => {
  const wr = client.stores.withdrawals.get(withdrawRequestId);
  
  if (wr?.status === 'completed') {
    console.log('✅ 链上提现请求已完成');
    // 此时包含的 allocations 状态已变为 used
    
    // ⚠️ 如果是跨链提现，还需要监听阶段2的转换状态
    if (wr.target_chain_id !== wr.source_chain_id) {
      console.log('⏳ 等待跨链转换完成...');
      // 需要额外查询转换服务的状态
    }
  } else if (wr?.status === 'failed') {
    console.log('❌ 提现请求失败');
    // 此时包含的 allocations 状态已回滚到 idle，可以重新创建 WithdrawRequest
  }
});

// 场景4：查询 allocation 的提现状态
const allocation = client.stores.allocations.get(allocId);
if (allocation.status === 'pending') {
  // 找到关联的 WithdrawRequest
  const wr = client.stores.withdrawals.all.find(
    w => w.allocation_ids.includes(allocId)
  );
  console.log('Allocation 正在提现中，WithdrawRequest ID:', wr?.id);
}
```

---

## Allocation 相关

### `client.stores.allocations.getByTokenIdAndStatus(tokenId, status)`

**功能**：查询特定 token 和状态的 allocations

**对应后端 API**：
```typescript
// SDK 本地查询（从内存中过滤）
// 无需调用后端 API
```

**使用场景**：
```typescript
// 查询 Token ID 为 1（USDT）且状态为 idle 的所有 allocations
const idleUSDT = client.stores.allocations.getByTokenIdAndStatus(1, 'idle');
console.log(`可用 USDT 数量: ${idleUSDT.length}`);

// 查询 Token ID 为 2（USDC）且状态为 pending 的所有 allocations
const pendingUSDC = client.stores.allocations.getByTokenIdAndStatus(2, 'pending');
```

---

### `client.stores.allocations.getByCheckbookIdAndStatus(checkbookId, status)`

**功能**：查询特定 checkbook 和状态的 allocations

**对应后端 API**：
```typescript
// SDK 本地查询（从内存中过滤）
// 无需调用后端 API
```

**使用场景**：
```typescript
// 查询特定 checkbook 中状态为 idle 的 allocations
const checkbookIdle = client.stores.allocations.getByCheckbookIdAndStatus(
  'checkbook-uuid-123',
  'idle'
);
```

---

### `client.stores.allocations.fetchList(params)`

**功能**：从后端 API 查询 allocations 列表

**对应后端 API**：
```typescript
GET /api/allocations?checkbook_id={id}&token_id={id}&status={status}

// 返回
{
  "allocations": [
    {
      "id": "uuid",
      "checkbook_id": "checkbook-uuid",
      "token_id": 1,
      "amount": "1000000",
      "recipient": { "chain_id": 714, "data": "0x..." },
      "status": "idle",
      "withdraw_request_id": null,
      "created_at": "2025-10-17T12:00:00Z",
      "updated_at": "2025-10-17T12:00:00Z"
    }
  ]
}
```

**参数**：
- `checkbook_id` (可选): Checkbook ID
- `token_id` (可选): Token ID
- `status` (可选): 状态过滤 (`idle`, `pending`, `used`)

**使用场景**：
```typescript
// 查询所有 idle 状态的 allocations
const idleList = await client.stores.allocations.fetchList({ status: 'idle' });

// 查询特定 checkbook 的所有 allocations
const checkbookAllocations = await client.stores.allocations.fetchList({ 
  checkbookId: 'checkbook-uuid' 
});

// 组合查询：特定 checkbook + 特定 token + 特定状态
const specific = await client.stores.allocations.fetchList({
  checkbook_id: 'checkbook-uuid',
  token_id: 1,
  status: 'idle'
});
```

---

### `client.stores.allocations.createAllocations(checkbookId, allocations)`

**功能**：批量创建 allocations

**对应后端 API**：
```typescript
POST /api/allocations

// 请求体
{
  "checkbook_id": "checkbook-uuid",
  "allocations": [
    {
      "recipient": { "chain_id": 714, "data": "0x123..." },
      "amount": "1000000",
      "token_id": 1
    },
    {
      "recipient": { "chain_id": 714, "data": "0x456..." },
      "amount": "2000000",
      "token_id": 1
    }
  ]
}

// 返回
{
  "allocations": [
    {
      "id": "uuid-1",
      "checkbook_id": "checkbook-uuid",
      "status": "idle",
      ...
    },
    {
      "id": "uuid-2",
      "checkbook_id": "checkbook-uuid",
      "status": "idle",
      ...
    }
  ]
}
```

**使用场景**：
```typescript
// 批量创建给多个接收者的分配
const allocations = await client.stores.allocations.createAllocations(
  checkbookId,
  [
    { 
      recipient: { chain_id: 714, data: '0x123...' }, 
      amount: '100000000', // 0.1 USDT
      token_id: 1 
    },
    { 
      recipient: { chain_id: 714, data: '0x456...' }, 
      amount: '200000000', // 0.2 USDT
      token_id: 1 
    },
  ]
);
// 创建后，allocations 自动存入 store，状态为 idle
```

---

### AllocationsStore 便利属性

SDK 提供了多个便利的 computed 属性：

```typescript
// 按状态查询
client.stores.allocations.idle      // 所有 idle 状态
client.stores.allocations.pending   // 所有 pending 状态
client.stores.allocations.used      // 所有 used 状态

// 按 token_id 分组
client.stores.allocations.byTokenId // Map<number, Allocation[]>
const usdtAllocations = client.stores.allocations.byTokenId.get(1);

// 按 checkbook_id 分组
client.stores.allocations.byCheckbookId // Map<string, Allocation[]>
const checkbookAllocations = client.stores.allocations.byCheckbookId.get(checkbookId);

// 按状态分组
client.stores.allocations.byStatus // Map<AllocationStatus, Allocation[]>
const idleAllocations = client.stores.allocations.byStatus.get('idle');
```

---

### 完整使用流程

```typescript
// 1. 创建 checkbook 并激活（status = with_checkbook）
const checkbook = await client.createCommitment({ ... });

// 2. 创建 allocations（批量分配给多个接收者）
const allocations = await client.stores.allocations.createAllocations(
  checkbook.checkbook_id,
  [
    { recipient: addr1, amount: '100', token_id: 1 }, // idle
    { recipient: addr2, amount: '200', token_id: 1 }, // idle
    { recipient: addr3, amount: '300', token_id: 2 }, // idle
  ]
);

// 3. 查询可用的 USDT allocations（Token ID = 1）
const idleUSDT = client.stores.allocations.getByTokenIdAndStatus(1, 'idle');
console.log(`可提现的 USDT 分配: ${idleUSDT.length} 个`);

// 4. 创建 WithdrawRequest（包含多个 allocations）
const withdrawRequest = await client.withdraw({
  allocation_ids: idleUSDT.map(a => a.id), // 使用所有 idle USDT allocations
  intent: 'same_chain',
});
// 这些 allocations 状态变为 pending

// 5. 监听状态变化
autorun(() => {
  const wr = client.stores.withdrawals.get(withdrawRequest.id);
  
  if (wr?.status === 'completed') {
    console.log('✅ 提现完成');
    // allocations 状态已变为 used
  } else if (wr?.status === 'failed') {
    console.log('❌ 提现失败');
    // allocations 状态已回滚到 idle，可以重新创建 WithdrawRequest
  }
});
```

---

## 签名器架构

SDK 支持灵活的签名方式，无需暴露私钥。

### 示例1: 私钥模式（后端）

```typescript
await client.connect(process.env.PRIVATE_KEY);
```

### 示例2: ethers Signer（MetaMask）

```typescript
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await client.connect(signer);
```

### 示例3: 签名回调（远程签名服务）

```typescript
await client.connect({
  address: userAddress,
  signMessage: async (message) => {
    // 调用自己的签名服务
    const res = await fetch('/api/sign', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    const { signature } = await res.json();
    return signature;
  },
});
```

### 示例4: 硬件钱包（Ledger）

```typescript
await client.connect({
  address,
  signMessage: async (message) => {
    const result = await eth.signPersonalMessage(
      "44'/60'/0'/0/0",
      Buffer.from(message).toString('hex')
    );
    return '0x' + result.r + result.s + result.v.toString(16);
  },
});
```

---

## 存款相关

### `client.deposit(params)`

**SDK API**：
```typescript
await client.deposit({
  chainId: 714,
  tokenAddress: '0x...',
  amount: '1000000',
  treasuryAddress: '0x...',
});
```

**对应后端 API**：

#### 步骤 1: 链上操作（SDK 直接调用合约）
```typescript
// 1. Approve Token
await token.approve(treasuryAddress, amount);

// 2. Deposit to Treasury
await treasury.deposit(tokenAddress, amount);
```

#### 步骤 2: 等待后端检测（BlockScanner）
```
后端 BlockScanner 自动检测到存款事件
→ 创建 Deposit 记录
→ 通过 WebSocket 推送更新
```

#### 步骤 3: WebSocket 推送
```json
{
  "type": "deposit_update",
  "data": {
    "id": 1,
    "chain_id": 714,
    "local_deposit_id": 1,
    "amount": "1000000",
    "depositor": "0x...",
    "status": "detected",
    "transaction_hash": "0x..."
  }
}
```

### `client.stores.deposits.getByOwner()`

**SDK API**：
```typescript
// 直接从 Store 读取（实时同步）
const deposits = client.stores.deposits.all;
```

**对应后端 API**：
```typescript
// SDK 初始同步时调用
GET /api/deposits/by-owner?chain_id={chainId}&owner_data={address}&page=1&size=100

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "deposits": [
    {
      "user_chain_id": 714,
      "user_data": "0x...",
      "amount": "1000000",
      "status": "detected",
      "created_at": "2025-01-17T12:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "size": 100
}
```

### `client.stores.deposits.get(id)`

**SDK API**：
```typescript
// 从本地 Store 读取单个存款（不发起 API 请求）
const deposit = client.stores.deposits.get('714_1');
```

**数据来源**：
- 本地 Store（内存中）

### `client.stores.deposits.getByOwner(params)` ⭐

**SDK API**：
```typescript
// ⚠️ 主动从后端 API 获取指定 owner 的存款
const result = await client.stores.deposits.getByOwner({
  chainId: 714,
  ownerAddress: '0x...',
  page: 1,
  size: 10,
});

console.log(result.deposits);  // 存款列表
console.log(result.total);     // 总数
```

**对应后端 API**：
```typescript
GET /api/deposits/by-owner?chain_id=714&owner_data=0x...&page=1&size=10

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "deposits": [
    {
      "chain_id": 714,
      "local_deposit_id": 1,
      "owner_data": "0x...",
      "amount": "1000000",
      "status": "confirmed",
      "created_at": "2025-10-17T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 10
}
```

**重要说明**：
- ✅ 此方法会**主动调用后端 API**（不同于 `get()` 和 `all`）
- ✅ 获取的数据会**自动更新到 Store** 中
- ✅ 需要 JWT 认证
- ✅ JWT 的 `universal_address` 必须匹配 `chain_id:owner_data`
- ✅ 支持分页查询

---


## Commitment 相关

### 设计原则

**核心特性**：
- ✅ **数据格式化在 SDK 内部实现**（不调用后端 API）
- ✅ **支持离线准备待签名数据**
- ✅ **分离准备和提交流程**（用户完全控制签名）
- ✅ **提供便捷的一步完成方法**（私钥模式）

### 方式1: 分离模式（推荐，用户控制签名）

#### `client.prepareCommitment(params)`

**SDK API**：
```typescript
const commitmentData = await client.prepareCommitment({
  checkbookId: 'uuid',
  allocations: [
    {
      recipient_chain_id: 714,
      recipient_address: '0x...',
      amount: '500000',
    },
  ],
});

// 返回
{
  dataToSign: "Enclave Commitment v1\nCheckbook ID: ...",
  payload: {
    checkbook_id: 'uuid',
    allocations: [...],
    allocations_hash: '0x...',
    timestamp: 1234567890,
    version: 'v1',
  },
  metadata: {
    totalAmount: 500000n,
    recipientCount: 1,
  },
}
```

**⚠️ 重要**：此方法 **不调用后端 API**，完全在 SDK 内部实现！

**SDK 内部实现**：
1. 对 `allocations` 进行规范化排序
2. 计算 `allocations_hash`（keccak256）
3. 生成标准格式的待签名消息
4. 返回准备好的数据和元数据

**跨语言一致性**：
- 所有语言 SDK（JS/Go/Python/Rust）必须使用**完全相同**的格式化逻辑
- 排序算法、哈希算法、消息格式必须一致
- 详见：`docs/DATA_FORMAT_SPEC.md`

#### `client.submitCommitment(params)`

**SDK API**：
```typescript
const result = await client.submitCommitment({
  payload: commitmentData.payload,  // 来自 prepareCommitment
  signature: '0x...',               // 用户自己签名
});
```

**对应后端 API**：
```typescript
POST /api/commitments/submit

// Headers
Authorization: Bearer {JWT_TOKEN}

// 请求体
{
  "checkbook_id": "uuid",
  "allocations": [...],
  "allocations_hash": "0x...",
  "timestamp": 1234567890,
  "version": "v1",
  "signature": "0x..."
}

// 返回
{
  "success": true,
  "commitment_id": "uuid",
  "status": "submitted",
  "tx_hash": "0x...",
  "message": "Commitment proof submitted successfully"
}
```

#### 完整流程示例（浏览器 + MetaMask）

```typescript
// 1. SDK 内部准备数据（无需后端 API）
const commitmentData = await client.prepareCommitment({
  checkbookId: 'uuid',
  allocations: [...],
});

// 2. 展示给用户审查
console.log('分配总额:', commitmentData.metadata.totalAmount);
console.log('接收人数:', commitmentData.metadata.recipientCount);

// 3. 用户通过 MetaMask 签名
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [commitmentData.dataToSign, userAddress],
});

// 4. SDK 提交到后端
const result = await client.submitCommitment({
  payload: commitmentData.payload,
  signature,
});
```

### 方式2: 一步模式（私钥模式，后端专用）

#### `client.createCommitment(params)`

**SDK API**：
```typescript
const result = await client.createCommitment({
  checkbookId: 'uuid',
  allocations: [...],
});
// SDK 内部自动: prepareCommitment -> 签名 -> submitCommitment
```

**SDK 内部流程**：
1. 调用 `prepareCommitment()` 准备数据
2. 使用当前签名器自动签名
3. 调用 `submitCommitment()` 提交

**适用场景**：
- Node.js 后端服务
- 自动化脚本
- 有私钥的环境

#### WebSocket 状态更新
```json
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

### `client.stores.checkbooks.get(id)`

**SDK API**：
```typescript
// 从 Store 读取
const checkbook = client.stores.checkbooks.get('uuid');
```

**对应后端 API**：
```typescript
GET /api/checkbooks/id/{id}

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "success": true,
  "data": {
    "checkbook": {
      "id": "uuid",
      "chain_id": 714,
      "deposit_id": 1,
      "user_address": "0x...",
      "amount": "1000000",
      "status": "issued",
      "commitment": "0x...",
      "created_at": "2025-01-17T12:00:00Z"
    },
    "checks": [
      {
        "id": "uuid",
        "checkbook_id": "uuid",
        "commitment": "0x...",
        "nullifier": "0x...",
        "amount": "500000",
        "status": "available"
      }
    ],
    "checks_count": 1
  }
}
```

### `client.stores.checkbooks.delete(id)`

**SDK API**：
```typescript
await client.stores.checkbooks.delete('uuid');
```

**对应后端 API**：
```typescript
DELETE /api/checkbooks/{id}

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "success": true,
  "message": "Checkbook deleted successfully",
  "checkbook_id": "uuid"
}
```

---

## 提现相关

### 提现操作 API

#### `client.withdraw(params)` - 提交提现请求

**SDK API**：
```typescript
const result = await client.withdraw({
  allocationIds: ['uuid1', 'uuid2'],
  intent: {
    type: 'RawToken',          // Intent 类型
    chainId: 714,               // 目标链
    tokenAddress: '0x...',      // Token 合约地址
    beneficiary: '0x...',       // 接收地址
  },
});

console.log(result.withdraw_request_id);
console.log(result.status);
```

**对应后端 API**：

#### 步骤 1: 提交提现请求
```typescript
POST /api/withdraws/submit

// Headers
Authorization: Bearer {JWT_TOKEN}

// 请求体
{
  "allocation_ids": ["uuid1", "uuid2"],
  "proof_data": "0x...",  // SDK 内部生成零知识证明
  "intent": {
    "type": "RawToken",        // Intent 类型：RawToken, DeFiDeposit, Swap等
    "chain_id": 714,            // 目标链 ID
    "token_address": "0x...",   // Token 合约地址
    "beneficiary": "0x..."      // 接收方地址
  }
}

// 返回
{
  "success": true,
  "withdraw_request_id": "uuid",
  "status": "submitted",
  "tx_hash": "0x...",
  "message": "Withdrawal proof submitted successfully"
}
```

**Intent 类型说明**：

| Intent 类型 | 说明 | 额外参数 |
|------------|------|---------|
| `RawToken` | 直接提现 Token 到地址 | `beneficiary`, `token_address` |
| `DeFiDeposit` | 提现并存入 DeFi 协议 | `protocol_address`, `pool_id` |
| `Swap` | 提现并兑换 Token | `target_token`, `min_amount` |
| `Bridge` | 提现并跨链 | `target_chain_id`, `bridge_protocol` |

#### 步骤 2: WebSocket 状态更新
```json
{
  "type": "withdrawal_update",
  "data": {
    "id": "uuid",
    "status": "proved",
    "execute_status": "success",
    "payout_status": "success",
    "execute_tx_hash": "0x...",
    "payout_tx_hash": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### `client.stores.withdrawals.getAll()`

**SDK API**：
```typescript
// 从 Store 读取所有提现记录
const withdrawals = client.stores.withdrawals.all;
```

**对应后端 API**：
```typescript
// SDK 初始同步时调用
GET /api/my/withdraw-requests?page=1&size=100

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "withdraw_requests": [
    {
      "id": "uuid",
      "user_address": "0x...",
      "status": "completed",
      "amount": "500000",
      "execute_status": "success",
      "payout_status": "success",
      "execute_tx_hash": "0x...",
      "payout_tx_hash": "0x...",
      "created_at": "2025-01-17T12:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "size": 100
}
```

### `client.stores.withdrawals.getStats()`

**SDK API**：
```typescript
// Computed value from Store
const stats = {
  total: client.stores.withdrawals.count,
  completed: client.stores.withdrawals.getByStatus('completed').length,
  pending: client.stores.withdrawals.getByStatus('pending').length,
};
```

**对应后端 API**：
```typescript
// SDK 可选调用
GET /api/my/withdraw-requests/stats

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "total_requests": 10,
  "completed": 8,
  "pending": 1,
  "failed": 1,
  "total_amount_withdrawn": "5000000",
  "last_withdraw_at": "2025-01-17T12:00:00Z"
}
```

### `client.retryWithdrawal(id)`

**SDK API**：
```typescript
await client.retryWithdrawal('uuid');
```

**对应后端 API**：
```typescript
POST /api/my/withdraw-requests/{id}/retry

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "success": true,
  "message": "Withdrawal retry initiated",
  "request_id": "uuid",
  "new_tx_hash": "0x..."
}
```

---

## Pool & Token 相关

### `client.stores.pools.getAll()`

**SDK API**：
```typescript
// 从 Store 读取所有 Pool
const pools = client.stores.pools.all;
```

**对应后端 API**：
```typescript
// SDK 初始同步时调用
GET /api/pools?page=1&size=100

// 返回
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

**SDK API**：
```typescript
// Computed value from Store
const featured = client.stores.pools.find(p => p.featured);
```

**对应后端 API**：
```typescript
// SDK 可选调用
GET /api/pools/featured

// 返回
{
  "pools": [
    {
      "id": 1,
      "name": "Aave V3",
      "protocol": "Aave V3",
      "featured": true,
      "chain_id": 714
    }
  ]
}
```

### `client.stores.pools.get(id)`

**SDK API**：
```typescript
const pool = client.stores.pools.get('1');
```

**对应后端 API**：
```typescript
// SDK 可选调用（如需详细信息）
GET /api/pools/{id}

// 示例
GET /api/pools/1

// 返回
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

**SDK API**：
```typescript
const tokens = client.stores.pools.getTokens(1);
```

**对应后端 API**：
```typescript
GET /api/pools/{id}/tokens

// 示例
GET /api/pools/1/tokens

// 返回
{
  "tokens": [
    {
      "id": 1,
      "asset_id": "0x000...",
      "symbol": "aUSDT",
      "name": "Aave USDT",
      "decimals": 6,
      "base_token": "USDT",
      "protocol": "Aave V3",
      "icon_url": "https://...",
      "is_active": true
    }
  ],
  "total": 5,
  "pool_id": 1
}
```

### `client.searchTokens(keyword)`

**SDK API**：
```typescript
await client.searchTokens('USDT');
```

**对应后端 API**：
```typescript
GET /api/tokens/search?keyword={keyword}&limit=10

// 示例
GET /api/tokens/search?keyword=USDT&limit=10

// 返回
{
  "results": [
    {
      "id": 1,
      "symbol": "aUSDT",
      "name": "Aave USDT",
      "protocol": "Aave V3",
      "pool_id": 1,
      "pool_name": "Aave V3",
      "icon_url": "https://..."
    }
  ],
  "total": 3
}
```

---

## 价格相关

### `client.subscribePrices(assetIds)`

**SDK API**：
```typescript
// 订阅价格更新
await client.subscribePrices([
  '0x00000001000100000000000000000000000000000000000000000000000000000',
]);
```

**对应 WebSocket**：
```json
// 发送订阅消息
{
  "action": "subscribe",
  "type": "prices",
  "asset_ids": ["0x00000001000100000000000000000000000000000000000000000000000000000"],
  "timestamp": 1705500000
}

// 后端每分钟推送
{
  "type": "price_update",
  "asset_id": "0x00000001000100000000000000000000000000000000000000000000000000000",
  "price": "1234.56",
  "change_24h": "+5.2%",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### `client.stores.prices.get(assetId)`

**SDK API**：
```typescript
// 从 Store 读取单个价格
const price = client.stores.prices.get('0x000...');
```

**对应后端 API**：
```typescript
// SDK 可选调用（如需初始价格）
GET /api/tokens/{asset_id}/price

// 示例
GET /api/tokens/0x00000001000100000000000000000000000000000000000000000000000000000/price

// 返回
{
  "token_price": {
    "asset_id": "0x000...",
    "symbol": "aUSDT",
    "name": "Aave USDT",
    "price": "1234.56",
    "change_24h": "+5.2",
    "date": "2025-01-17T12:00:00Z"
  }
}
```

### `client.stores.prices.getBatch(assetIds)`

**SDK API**：
```typescript
// Computed value from Store
const prices = assetIds.map(id => client.stores.prices.get(id));
```

**对应后端 API**：
```typescript
// SDK 可选调用（批量获取初始价格）
POST /api/tokens/prices

// 请求体
{
  "asset_ids": [
    "0x00000001000100000000000000000000000000000000000000000000000000000",
    "0x00000001000200000000000000000000000000000000000000000000000000000"
  ]
}

// 返回
{
  "prices": {
    "0x000...": {
      "asset_id": "0x000...",
      "symbol": "aUSDT",
      "price": "1234.56",
      "change_24h": "+5.2%"
    },
    "0x000...": {
      "asset_id": "0x000...",
      "symbol": "stETH",
      "price": "2456.78",
      "change_24h": "-2.1%"
    }
  },
  "count": 2
}
```

### `client.stores.prices.getHistory(assetId, days)`

**SDK API**：
```typescript
await client.stores.prices.getHistory('0x000...', 30);
```

**对应后端 API**：
```typescript
GET /api/tokens/{asset_id}/price-history?days={days}&limit=100

// 示例
GET /api/tokens/0x000.../price-history?days=30&limit=100

// 返回
{
  "asset_id": "0x000...",
  "symbol": "aUSDT",
  "name": "Aave USDT",
  "prices": [
    {
      "id": 1,
      "asset_id": "0x000...",
      "price": "1234.56",
      "change_24h": "+5.2",
      "date": "2025-01-17T12:00:00Z"
    }
  ],
  "count": 30
}
```

---

## WebSocket 订阅

### 连接建立

**SDK 内部**：
```typescript
// 连接 WebSocket
const ws = new WebSocket(`wss://api.enclave-hq.com/api/ws?token=${JWT_TOKEN}`);

// 接收连接确认
{
  "type": "connected",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connected to WebSocket service",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### 订阅类型映射

| SDK 方法 | WebSocket 订阅类型 | 消息类型 |
|---------|-------------------|---------|
| `client.connect()` | `deposits` | `deposit_update` |
| `client.connect()` | `checkbooks` | `checkbook_update` |
| `client.connect()` | `withdraw_requests` | `withdrawal_update` |
| `client.subscribePrices()` | `prices` | `price_update` |

### 订阅存款更新

```json
// SDK 发送
{
  "action": "subscribe",
  "type": "deposits",
  "address": "0x...",
  "timestamp": 1705500000
}

// 订阅确认
{
  "type": "subscription_confirmed",
  "sub_type": "deposits",
  "message": "Subscribed to deposits",
  "timestamp": "2025-01-17T12:00:00Z"
}

// 更新推送
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

### 订阅 Checkbook 更新

```json
// SDK 发送
{
  "action": "subscribe",
  "type": "checkbooks",
  "address": "0x...",
  "timestamp": 1705500000
}

// 更新推送
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

### 订阅提现更新

```json
// SDK 发送
{
  "action": "subscribe",
  "type": "withdraw_requests",
  "address": "0x...",
  "timestamp": 1705500000
}

// 更新推送
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

### 取消订阅

```json
// SDK 发送
{
  "action": "unsubscribe",
  "type": "prices",
  "timestamp": 1705500000
}

// 取消订阅确认
{
  "type": "unsubscription_confirmed",
  "sub_type": "prices",
  "message": "Unsubscribed from prices",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

---

## KMS 相关

### `client.wallet.signWithKMS()`

**SDK API**：
```typescript
// 使用 KMS 签名
const signature = await client.wallet.signWithKMS(message);
```

**对应后端 API**：

#### 获取 KMS 地址
```typescript
GET /api/kms/address?chain_id={chainId}

// 返回
{
  "address": "0x...",
  "chain_id": 714,
  "key_name": "my_key"
}
```

#### 存储密钥映射
```typescript
POST /api/kms/keys

// 请求体
{
  "private_key": "0x...",
  "chain_id": 714,
  "key_name": "my_key"
}

// 返回
{
  "success": true,
  "key_id": "uuid",
  "address": "0x..."
}
```

#### 同步 KMS 状态
```typescript
POST /api/kms/sync

// 请求体
{
  "chain_id": 714
}

// 返回
{
  "status": "synced",
  "chain_id": 714,
  "address": "0x...",
  "message": "KMS synchronized successfully"
}
```

---

## 状态码映射

| HTTP 状态码 | SDK 错误类型 | 处理方式 |
|-----------|-------------|---------|
| 200/201 | - | 正常响应 |
| 400 | `ValidationError` | 参数验证失败 |
| 401 | `AuthenticationError` | Token 过期，重新登录 |
| 403 | `PermissionError` | 权限不足 |
| 404 | `NotFoundError` | 资源不存在 |
| 500 | `ServerError` | 服务器错误，重试 |
| 503 | `ServiceUnavailableError` | 服务不可用，重试 |

## 错误处理示例

```typescript
try {
  await client.deposit(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // 重新登录
    await client.connect(privateKey);
    await client.deposit(params); // 重试
  } else if (error instanceof ValidationError) {
    // 参数错误，提示用户
    console.error('Invalid parameters:', error.message);
  } else {
    // 其他错误
    console.error('Unexpected error:', error);
  }
}
```

---

## 完整流程示例

### 存款到提现完整流程

```typescript
// 1. 连接
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});
await client.connect(privateKey);

// 2. 存款
const depositResult = await client.deposit({
  chainId: 714,
  tokenAddress: '0x...',
  amount: '1000000',
});

// 3. 等待存款被检测（自动通过 WebSocket）
client.stores.deposits.on('added', (deposit) => {
  console.log('存款已检测:', deposit);
});

// 4. 创建分配
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

// 5. 等待 Checkbook 状态更新（自动通过 WebSocket）
client.stores.checkbooks.on('updated', (checkbook) => {
  if (checkbook.status === 'with_checkbook') {
    console.log('Checkbook 已就绪');
  }
});

// 6. 提现
const withdrawalResult = await client.withdraw({
  allocationIds: ['uuid1'],
  recipient: {
    chain_id: 714,
    address: '0x...',
    amount: '500000',
    token_symbol: 'USDT',
  },
});

// 7. 监控提现状态（自动通过 WebSocket）
client.stores.withdrawals.on('updated', (withdrawal) => {
  console.log('提现状态:', withdrawal.status);
  if (withdrawal.status === 'completed') {
    console.log('提现完成!', withdrawal.payout_tx_hash);
  }
});
```

---

## Store 方法分类

### 本地查询（不调用 API）

以下方法**仅从本地 Store 读取**，不发起网络请求：

| 方法 | 说明 | 示例 |
|------|------|------|
| `stores.checkbooks.all` | 获取所有 checkbooks（含 deposit 信息） | `client.stores.checkbooks.all` |
| `stores.checkbooks.get(id)` | 获取单个 checkbook | `client.stores.checkbooks.get('uuid')` |
| `stores.checkbooks.count` | 获取数量 | `client.stores.checkbooks.count` |
| `stores.checkbooks.find(predicate)` | 查找符合条件的数据 | `client.stores.checkbooks.find(cb => cb.status === 'with_checkbook')` |
| `stores.checkbooks.byStatus` | 按状态过滤（computed） | `client.stores.checkbooks.byStatus` |
| `stores.withdrawals.*` | 提现记录相关查询 | `client.stores.withdrawals.all` |

**特点**：
- ⚡ 即时响应（从内存读取）
- 📶 离线可用
- 💾 数据来自 WebSocket 推送或上次刷新

### 主动查询（调用 API）

以下方法会**主动调用后端 API**：

| 方法 | 说明 | 示例 |
|------|------|------|
| `stores.checkbooks.fetchList(params)` | 查询 checkbooks 列表（含 deposit） | `await client.stores.checkbooks.fetchList({page: 1, limit: 10})` |
| `stores.checkbooks.getById(id)` | 获取特定 Checkbook 详情 | `await client.stores.checkbooks.getById('uuid')` |
| `stores.withdrawals.fetchList(params)` | 查询提现记录列表（分页） | `await client.stores.withdrawals.fetchList({page: 1, limit: 10, status: 'pending'})` |
| `stores.withdrawals.getById(id)` | 获取特定提现请求详情 | `await client.stores.withdrawals.getById('uuid')` |
| `stores.withdrawals.getByNullifier(nullifier)` | 按 nullifier 查询提现 | `await client.stores.withdrawals.getByNullifier('0x...')` |

**特点**：
- 🌐 需要网络请求
- 🔄 获取最新数据
- 📥 自动更新本地 Store
- 🔐 需要认证
- 🎯 精确查询，避免不必要的全量刷新

### 使用建议

```typescript
// ✅ 好的做法：先从 Store 读取，需要时精确查询
function CheckbooksList() {
  const checkbooks = client.stores.checkbooks.all;  // 快速读取本地数据
  
  // 用户主动刷新：调用特定的查询方法
  const handleRefresh = async () => {
    await client.stores.checkbooks.fetchList({
      page: 1,
      size: 20,
    });
    // 数据会自动更新到 Store
  };
  
  // WebSocket 会自动更新 Store，大多数情况下无需手动刷新
  return (
    <div>
      <button onClick={handleRefresh}>刷新</button>
      {checkbooks.map(cb => (
        <CheckbookItem 
          key={cb.checkbook_id} 
          checkbook={cb}
          depositId={cb.local_deposit_id}  // 包含关联的 deposit ID
        />
      ))}
    </div>
  );
}

// ❌ 不好的做法：每次渲染都调用 API
function CheckbooksList() {
  // 不要这样做！
  const [checkbooks, setCheckbooks] = useState([]);
  
  useEffect(() => {
    // 每次组件渲染都会调用 API
    client.stores.checkbooks.getList({...}).then(setCheckbooks);
  }, []); // 依赖不完整还会导致多次调用
}

// ✅ 正确做法：使用 MobX observer
import { observer } from 'mobx-react-lite';

const CheckbooksList = observer(() => {
  // MobX 自动追踪变化，Store 更新时自动重新渲染
  const checkbooks = client.stores.checkbooks.all;
  
  return (
    <div>
      {checkbooks.map(cb => (
        <CheckbookItem 
          key={cb.checkbook_id} 
          checkbook={cb}
          depositInfo={{
            localDepositId: cb.local_deposit_id,
            grossAmount: cb.gross_amount,
          }}
        />
      ))}
    </div>
  );
});
```

---

## SDK 内部实现 vs 后端 API

### 数据准备（SDK 内部）

以下操作**完全在 SDK 内部实现**，不调用后端 API：

| 操作 | SDK 方法 | 实现位置 | 说明 |
|------|---------|---------|------|
| Commitment 数据准备 | `prepareCommitment()` | `CommitmentFormatter` | 排序、哈希、生成待签名消息 |
| Withdraw 数据准备 | `prepareWithdraw()` | `WithdrawFormatter` | 生成标准待签名消息 |
| 签名操作 | `signMessage()` | `SignerAdapter` | 支持多种签名方式 |

**优势**：
- ✅ 离线可用
- ✅ 减少网络请求
- ✅ 更快的响应速度
- ✅ 用户完全控制签名流程

### 后端 API 调用

以下操作**需要调用后端 API**：

| 操作 | SDK 方法 | 后端 API | 说明 |
|------|---------|---------|------|
| 认证 | `connect()` | `POST /api/auth/login` | 获取 JWT token |
| 提交 Commitment | `submitCommitment()` | `POST /api/commitments/submit` | 提交已签名数据 |
| 提交 Withdraw | `submitWithdraw()` | `POST /api/withdraws/submit` | 提交已签名数据 |
| 查询数据 | `stores.*.refresh()` | `GET /api/*` | 主动刷新数据 |

---

## 数据同步机制

### 双重同步机制设计

Enclave SDK 采用**双重数据同步机制**：

```
主要机制: WebSocket 实时推送 (自动、实时)
   ↓
   ├─ Checkbook 状态更新（包含 Deposit 信息）
   ├─ 提现状态更新
   └─ 价格更新

备用机制: 主动查询 (手动、按需)
   ↓
   ├─ 用户主动拉取最新数据
   ├─ WebSocket 断线后补充数据
   ├─ 特定条件查询（跨链、跨用户等）
   └─ 需要最新状态时
```

### 主动查询 API

#### 查询 Checkbooks（包含 Deposit 信息）

```typescript
// 查询当前用户的 checkbooks 列表（主动调用后端 API）
const result = await client.stores.checkbooks.fetchList({
  page: 1,
  size: 20,
  deleted: false,  // 是否包含已删除的记录
});

console.log(result.data);        // checkbooks 列表
console.log(result.pagination);  // 分页信息
```

**对应后端 API**：
```typescript
GET /api/checkbooks?page=1&size=20&deleted=false

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "data": [
    {
      "checkbook_id": "uuid",
      "local_deposit_id": 18323722,  // 关联的 deposit ID
      "chain_id": 714,
      "owner": {
        "chain_id": 714,
        "data": "0x..."
      },
      "status": "with_checkbook",
      "gross_amount": "2000000000000000000",  // deposit 金额
      "allocatable_amount": "960000000000000000",
      "fee_total_locked": "1040000000000000000",
      "checks": [...],
      "checks_count": 1,
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 26,
    "total_pages": 3
  }
}
```

**重要说明**：
- ⚠️ **Deposits 和 Checkbooks 已合并**：后端 API 通过 `/api/checkbooks` 同时返回两者信息
- ✅ 每个 checkbook 记录包含关联的 `local_deposit_id`
- ✅ Chain ID 和 owner 从 JWT token 的 `universal_address` 自动提取
- ✅ Deposit 和 Checkbook 是一对一关系

#### 查询 Checkbook

```typescript
// 获取特定 Checkbook 的详细信息
const checkbook = await client.stores.checkbooks.getById('uuid');
```

**对应后端 API**：
```typescript
GET /api/checkbooks/id/{id}

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "success": true,
  "data": {
    "checkbook": { ... },
    "checks": [ ... ]
  }
}
```

#### 查询提现记录列表

```typescript
// 查询提现记录列表（支持分页和过滤）
const result = await client.stores.withdrawals.fetchList({
  page: 1,
  size: 10,
  status: 'pending',  // 可选：按状态过滤
});

console.log(result.withdraw_requests);  // 提现列表
console.log(result.total);               // 总数
console.log(result.page);                // 当前页
```

**对应后端 API**：
```typescript
GET /api/my/withdraw-requests?page=1&size=10&status=pending

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "withdraw_requests": [
    {
      "id": "uuid",
      "user_address": "0x...",
      "status": "completed",
      "amount": "1000000000000000000",
      "execute_status": "success",
      "payout_status": "success",
      "execute_tx_hash": "0x...",
      "payout_tx_hash": "0x...",
      "created_at": "2025-10-16T12:00:00Z",
      "updated_at": "2025-10-16T12:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "size": 10
}
```

#### 查询单个提现请求

```typescript
// 获取特定提现请求的详细信息
const withdrawal = await client.stores.withdrawals.getById('uuid');

console.log(withdrawal.withdraw_request);  // 提现请求详情
console.log(withdrawal.allocations);       // 关联的 allocations
```

**对应后端 API**：
```typescript
GET /api/my/withdraw-requests/{id}

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "withdraw_request": {
    "id": "uuid",
    "user_address": "0x...",
    "status": "completed",
    "amount": "1000000000000000000",
    "execute_status": "success",
    "payout_status": "success",
    "execute_tx_hash": "0x...",
    "payout_tx_hash": "0x...",
    "created_at": "2025-10-16T12:00:00Z",
    "updated_at": "2025-10-16T12:00:00Z"
  },
  "allocations": [
    {
      "id": "uuid",
      "amount": "500000000000000000",
      "status": "withdrawn"
    }
  ]
}
```

#### 按 Nullifier 查询提现

```typescript
// 通过 check nullifier 查询提现请求
const withdrawal = await client.stores.withdrawals.getByNullifier('0x...');

console.log(withdrawal.id);
console.log(withdrawal.status);
```

**对应后端 API**：
```typescript
GET /api/my/withdraw-requests/by-nullifier/{nullifier}

// Headers
Authorization: Bearer {JWT_TOKEN}

// 返回
{
  "withdraw_request": {
    "id": "uuid",
    "nullifier": "0x...",
    "status": "completed"
  }
}
```

### 使用场景

#### 场景1: 浏览器应用（推荐）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

await client.connect(signer);

// 依赖 WebSocket 自动推送（主要机制）
// WebSocket 会自动更新 Store 数据

// 用户主动下拉刷新：调用特定查询方法
async function onPullToRefresh() {
  await client.stores.checkbooks.fetchList({
    page: 1,
    size: 20,
  });
  showToast('数据已更新');
}
```

#### 场景2: 移动应用

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { AppState } from 'react-native';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

await client.connect(signer);

// App 从后台恢复时查询最新数据
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    // App 回到前台，查询最新数据
    client.stores.checkbooks.getList({
      page: 1,
      size: 20,
    }).catch(console.error);
  }
});

// 用户下拉刷新
const onRefresh = async () => {
  setRefreshing(true);
  try {
    await client.stores.checkbooks.fetchList({
      page: 1,
      size: 20,
    });
  } finally {
    setRefreshing(false);
  }
};
```

#### 场景3: 后端服务（定时任务）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

await client.connect(process.env.PRIVATE_KEY);

// 定时查询数据
setInterval(async () => {
  try {
    // 查询最新 checkbooks（包含 deposit 信息）
    const result = await client.stores.checkbooks.fetchList({
      page: 1,
      size: 100,
    });
    
    await processCheckbooks(result.data);
  } catch (error) {
    console.error('Query failed:', error);
  }
}, 30000); // 每30秒查询一次
```

#### 场景4: WebSocket 断线恢复

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

await client.connect(signer);

// 监听 WebSocket 重连事件
client.connection.on('reconnected', async () => {
  console.log('WebSocket 重连成功，查询最新数据...');
  
  // WebSocket 断线期间可能错过的更新，主动查询一次
  await client.stores.checkbooks.fetchList({
    page: 1,
    size: 20,
  });
  
  console.log('数据同步完成');
});
```

### 最佳实践

1. **优先依赖 WebSocket 推送**
   - WebSocket 是主要同步机制
   - 实时性最好，用户体验最佳
   - 大多数情况下无需主动查询

2. **按需主动查询**
   - 用户明确需要最新数据时（下拉刷新）
   - WebSocket 重连后补充数据
   - 需要跨链、跨用户查询时
   - 特定条件过滤时

3. **使用精确查询方法**
   - 调用具体的查询方法如 `getByOwner()`
   - 带上必要的查询参数
   - 避免获取不需要的数据

4. **合理设置查询频率**
   - 避免短时间内重复查询
   - 使用防抖/节流控制用户触发的查询
   - 后台服务设置合理的轮询间隔

5. **结合本地 Store 使用**
   - 优先从本地 Store 读取（`stores.*.all`）
   - 仅在必要时调用查询 API
   - 查询结果自动更新本地 Store

---

**版本**: v2.0.0-alpha  
**最后更新**: 2025-01-17  
**维护者**: Enclave Team

