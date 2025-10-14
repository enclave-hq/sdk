# ZKPay Client Library API Documentation

ZKPay client library provides complete backend interaction interfaces, including login, deposit, commitment, withdrawal and other functions.

## Quick Start

### Basic Usage

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

// Create client
const client = new ZKPayClient(config, logger);

// Initialize
await client.initialize();

// Method 1: Direct private key login
await client.login(privateKey, "user1");

// Execute operations...
```

### KMS Integration Usage

```javascript
// Method 2: Basic KMS login
const { ZKPayKMSSigner } = require("../utils/zkpay-kms-adapter");

const kmsConfig = {
  baseURL: "http://localhost:18082",
  keyAlias: "my_bsc_key",
  encryptedKey: "encrypted_private_key_from_kms",
  slip44Id: 714, // BSC
  address: "0x...",
  defaultSignatureType: "eip191",
};

const kmsSigner = new ZKPayKMSSigner(kmsConfig);
await client.loginWithSigner(kmsSigner, kmsConfig.address);

// Method 3: SAAS KMS login
const { SaasKMSSigner } = require("../utils/saas-kms-signer");

const saasKmsConfig = {
  kmsUrl: "https://kms.your-saas.com",
  enterpriseId: "your_enterprise_id",
  chainId: 714,
  userAddress: "0x...",
  keyAlias: "enterprise_key",
  k1Key: "your_k1_key",
};

const saasSigner = new SaasKMSSigner(saasKmsConfig);
await client.loginWithSigner(saasSigner, saasKmsConfig.userAddress);
```

## API 接口

### 1. Initialization and Authentication

#### `initialize()`

Initialize client library

```javascript
await client.initialize();
```

#### `login(privateKey, userName?)`

Login to backend using private key

```javascript
const result = await client.login("0x...", "user1");
// 返回: { success: true, address: '0x...', userName: 'user1', token: '...' }
```

#### `loginWithSigner(signer, userAddress)`

Login to backend using KMS signer

```javascript
// 基础KMS签名器
const kmsSigner = new ZKPayKMSSigner(kmsConfig);
const result = await client.loginWithSigner(kmsSigner, userAddress);

// SAAS KMS签名器
const saasSigner = new SaasKMSSigner(saasKmsConfig);
const result = await client.loginWithSigner(saasSigner, userAddress);
// 返回: { success: true, address: '0x...', userName: 'auto', token: '...' }
```

#### `isLoggedIn()`

Check login status

```javascript
const loggedIn = client.isLoggedIn(); // true/false
```

#### `getCurrentUser()`

Get current user information

```javascript
const user = client.getCurrentUser();
// Returns: { address: '0x...', privateKey: '0x...', userName: 'user1', wallet: Wallet }
```

#### `logout()`

Logout

```javascript
client.logout();
```

### 2. Token 操作

#### `checkTokenBalance(chainId, tokenSymbol)`

检查 Token 余额

```javascript
const balance = await client.checkTokenBalance(56, "test_usdt");
// 返回: { balance: BigInt, decimals: 18, symbol: 'TUSDT', formatted: '100.0' }
```

#### `checkTokenAllowance(chainId, tokenSymbol)`

检查 Token 授权额度

```javascript
const allowance = await client.checkTokenAllowance(56, "test_usdt");
// 返回: { allowance: BigInt, decimals: 18, formatted: '50.0' }
```

#### `approveToken(chainId, tokenSymbol, amount)`

授权 Token

```javascript
const result = await client.approveToken(56, "test_usdt", "100.0");
// 返回: { txHash: '0x...', receipt: {...}, allowance: BigInt, gasUsed: BigInt }
```

### 3. 存款操作

#### `deposit(chainId, tokenSymbol, amount)`

执行存款（包含自动授权）

```javascript
const result = await client.deposit(56, "test_usdt", "10.0");
// 返回: { approve: {...}, deposit: {...}, chainId: 56, tokenSymbol: 'test_usdt', amount: '10.0' }
```

#### `waitForDepositDetection(txHash, chainId, maxWaitTime?)`

等待后端检测存款

```javascript
const deposit = await client.waitForDepositDetection("0x...", 56, 60);
// 返回: 存款记录对象
```

### 4. CheckBook 操作

#### `getUserDeposits(userAddress?, chainId?)`

获取用户的存款记录（CheckBook）

```javascript
const deposits = await client.getUserDeposits();
// 返回: [{ id, checkbookId, localDepositId, status, chainId, tokenId, ... }]
```

#### `getCheckbookDetails(checkbookId)`

获取特定 CheckBook 详情

```javascript
const checkbook = await client.getCheckbookDetails("checkbook_123");
// 返回: CheckBook详细信息
```

### 5. 分配和签名

#### `createAllocationAndSign(checkbookId, allocations, options?)`

创建分配方案并签名

```javascript
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x...",
    amount: "10000000000000000000", // 10.0 USDT (18 decimals)
  },
];

const result = await client.createAllocationAndSign(
  "checkbook_123",
  allocations
);
// 返回: { checkbookId, allocations, signature, signatureMessage, deposit }
```

### 6. Commitment 操作

#### `executeCommitmentSync(checkbookId, allocations, waitForWithCheck?)`

执行 Commitment（同步方式，等待完成）

```javascript
const result = await client.executeCommitmentSync(
  "checkbook_123",
  allocations,
  true
);
// 返回: { status: 'with_checkbook', finalStatus: 'with_checkbook', ... }
```

#### `executeCommitmentAsync(checkbookId, allocations)`

执行 Commitment（异步方式，立即返回）

```javascript
const result = await client.executeCommitmentAsync(
  "checkbook_123",
  allocations
);
// 返回: {
//   status: 'submitted',
//   waitForCompletion: (targetStatuses, maxWaitTime) => Promise,
//   checkStatus: () => Promise
// }

// 可选：等待完成
const finalResult = await result.waitForCompletion(["with_checkbook"], 300);
```

#### `waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime?)`

等待 Commitment 状态变化

```javascript
const result = await client.waitForCommitmentStatus(
  "checkbook_123",
  ["with_checkbook", "issued"],
  300
);
```

### 7. 提现证明操作

#### `generateProofSync(checkbookId, recipientInfo, waitForCompleted?)`

生成提现证明（同步方式，等待完成）

```javascript
const recipientInfo = {
  chain_id: 714,
  address: "0x...",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const result = await client.generateProofSync(
  "checkbook_123",
  recipientInfo,
  true
);
// 返回: { checkId, completionResult, finalStatus: 'completed', ... }
```

#### `generateProofAsync(checkbookId, recipientInfo)`

生成提现证明（异步方式，立即返回）

```javascript
const result = await client.generateProofAsync("checkbook_123", recipientInfo);
// 返回: {
//   checkId: 'check_456',
//   waitForCompletion: (maxWaitTime) => Promise,
//   checkStatus: () => Promise
// }

// 可选：等待完成
const completionResult = await result.waitForCompletion(300);
```

### 8. 高级操作

#### `performFullDepositToCommitment(chainId, tokenSymbol, amount, allocations, options?)`

完整的存款到 Commitment 流程

```javascript
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x...",
    amount: "10000000000000000000",
  },
];

const result = await client.performFullDepositToCommitment(
  56,
  "test_usdt",
  "10.0",
  allocations,
  { waitForCommitment: true, maxWaitTime: 300 }
);
// 返回: { deposit: {...}, depositRecord: {...}, commitment: {...}, success: true }
```

#### `performFullCommitmentToWithdraw(checkbookId, recipientInfo, options?)`

完整的 Commitment 到提现流程

```javascript
const recipientInfo = {
  chain_id: 714,
  address: "0x...",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const result = await client.performFullCommitmentToWithdraw(
  "checkbook_123",
  recipientInfo,
  { waitForProof: true, maxWaitTime: 300 }
);
// 返回: { checkbook: {...}, proof: {...}, success: true }
```

### 9. 工具方法

#### `getSupportedChains()`

获取支持的链列表

```javascript
const chains = client.getSupportedChains();
// 返回: [{ chain_id: 56, name: 'BSC', ... }, ...]
```

#### `getSupportedTokens(chainId)`

获取指定链支持的 Token 列表

```javascript
const tokens = client.getSupportedTokens(56);
// 返回: { 'test_usdt': { address: '0x...', decimals: 18 }, ... }
```

#### `cleanup()`

清理资源

```javascript
await client.cleanup();
```

## 📊 API 调用流程

### 完整 API 调用流程图

```
阶段1: 初始化认证    阶段2: 存款操作      阶段3: 承诺分配      阶段4: 证明生成      阶段5: 状态监控
      ↓                    ↓                    ↓                    ↓                    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ initialize  │    │checkBalance │    │createAlloc  │    │generateProof│    │waitForStatus│
│             │    │             │    │AndSign      │    │Sync/Async   │    │             │
│ login/      │    │checkAllowance│   │             │    │             │    │checkStatus  │
│ loginWith   │    │             │    │executeCommit│    │             │    │             │
│ Signer      │    │approveToken │    │ment         │    │             │    │             │
│             │    │             │    │Sync/Async   │    │             │    │             │
│             │    │deposit      │    │             │    │             │    │             │
│             │    │             │    │             │    │             │    │             │
│             │    │waitForDeposit│   │             │    │             │    │             │
│             │    │Detection    │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 阶段详细说明

#### 阶段 1: 初始化和认证

1. **客户端初始化**: `await client.initialize()`
2. **用户认证** (三种方式)：
   - 直接私钥: `await client.login(privateKey)`
   - 基础 KMS: `await client.loginWithSigner(kmsSigner, userAddress)`
   - SAAS KMS: `await client.loginWithSigner(saasSigner, userAddress)`

#### 阶段 2: 存款操作

1. **检查 Token 余额**: `await client.checkTokenBalance(chainId, tokenAddress)`
2. **检查 Token 授权**: `await client.checkTokenAllowance(chainId, tokenAddress, treasuryAddress)`
3. **授权 Token** (如需要): `await client.approveToken(chainId, tokenAddress, amount, treasuryAddress)`
4. **执行存款**: `await client.deposit(chainId, tokenAddress, amount, treasuryAddress)`
5. **等待后端检测**: `await client.waitForDepositDetection(txHash, chainId, maxWaitTime)`

#### 阶段 3: 承诺分配

1. **创建分配方案**: 定义 allocations 数组
2. **创建分配并签名**: `await client.createAllocationAndSign(checkbookId, allocations)`
3. **执行承诺** (二选一):
   - 同步方式: `await client.executeCommitmentSync(checkbookId, allocations, waitForWithCheck)`
   - 异步方式: `await client.executeCommitmentAsync(checkbookId, allocations)`

#### 阶段 4: 证明生成

1. **准备接收信息**: 定义 recipientInfo 对象
2. **生成提现证明** (二选一):
   - 同步方式: `await client.generateProofSync(checkbookId, recipientInfo, waitForCompleted)`
   - 异步方式: `await client.generateProofAsync(checkbookId, recipientInfo)`

#### 阶段 5: 状态监控

1. **监控承诺状态**: `await client.waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime)`
2. **监控证明状态**: `await client.waitForProofStatus(checkId, targetStatuses, maxWaitTime)`
3. **检查当前状态**: `await client.checkStatus()`

### API 调用时序图

```
Client          WalletManager    DepositManager   CommitmentManager   WithdrawManager
  │                    │               │                 │                 │
  │─── initialize() ───│               │                 │                 │
  │                    │               │                 │                 │
  │─── login() ────────│               │                 │                 │
  │                    │               │                 │                 │
  │─── checkBalance ───┼───────────────│                 │                 │
  │                    │               │                 │                 │
  │─── deposit() ──────┼───────────────│                 │                 │
  │                    │               │                 │                 │
  │─── executeCommitment() ────────────┼─────────────────│                 │
  │                    │               │                 │                 │
  │─── generateProof() ────────────────┼─────────────────┼─────────────────│
  │                    │               │                 │                 │
```

## Usage Examples

### 完整流程示例

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

async function fullExample() {
  const client = new ZKPayClient(config);

  try {
    // 1. 初始化
    await client.initialize();

    // 2. 登录
    await client.login("0x...", "user1");

    // 3. 检查余额
    const balance = await client.checkTokenBalance(56, "test_usdt");
    console.log("余额:", balance.formatted);

    // 4. 执行存款
    const depositResult = await client.deposit(56, "test_usdt", "10.0");
    console.log("存款成功:", depositResult.deposit.txHash);

    // 5. 等待检测
    const depositRecord = await client.waitForDepositDetection(
      depositResult.deposit.txHash,
      56,
      60
    );

    // 6. 创建分配并执行Commitment
    const allocations = [
      {
        recipient_chain_id: 714,
        recipient_address: "0x...",
        amount: "10000000000000000000",
      },
    ];

    const commitmentResult = await client.executeCommitmentSync(
      depositRecord.checkbook_id,
      allocations,
      true
    );
    console.log("Commitment成功:", commitmentResult.status);

    // 7. 生成提现证明
    const recipientInfo = {
      chain_id: 714,
      address: client.getCurrentUser().address,
      amount: "10000000000000000000",
      token_symbol: "test_usdt",
    };

    const proofResult = await client.generateProofSync(
      depositRecord.checkbook_id,
      recipientInfo,
      true
    );
    console.log("提现成功:", proofResult.completionResult.transaction_hash);
  } finally {
    await client.cleanup();
  }
}
```

### 异步操作示例

```javascript
async function asyncExample() {
  const client = new ZKPayClient(config);

  try {
    await client.initialize();
    await client.login("0x...", "user1");

    // 异步执行Commitment
    const commitmentResult = await client.executeCommitmentAsync(
      "checkbook_123",
      allocations
    );

    console.log("Commitment已提交:", commitmentResult.status);

    // 在后台等待完成
    commitmentResult
      .waitForCompletion(["with_checkbook"], 300)
      .then((result) => {
        console.log("Commitment完成:", result.status);

        // 继续执行提现
        return client.generateProofAsync("checkbook_123", recipientInfo);
      })
      .then((proofResult) => {
        console.log("提现证明已提交:", proofResult.checkId);

        return proofResult.waitForCompletion(300);
      })
      .then((completionResult) => {
        console.log("提现完成:", completionResult.transaction_hash);
      })
      .catch((error) => {
        console.error("异步操作失败:", error.message);
      });

    // 主线程可以继续其他操作...
  } finally {
    await client.cleanup();
  }
}
```

## 错误处理

All methods may throw exceptions, it is recommended to use try-catch for error handling:

```javascript
try {
  const result = await client.deposit(56, "test_usdt", "10.0");
  console.log("操作成功:", result);
} catch (error) {
  console.error("操作失败:", error.message);

  // 检查特定错误类型
  if (error.message.includes("余额不足")) {
    console.log("请先充值Token");
  } else if (error.message.includes("未登录")) {
    console.log("请先登录");
  }
}
```

## 配置要求

### 基础配置

客户端库需要以下基础配置结构：

```yaml
environment:
  name: "development"

services:
  zkpay_backend:
    url: "http://localhost:3001"
    timeout: 30000

blockchain:
  management_chain:
    chain_id: 714
    name: "BSC"
    rpc_url: "https://bsc-dataseed1.binance.org/"
    contracts:
      treasury_contract: "0x..."
    tokens:
      test_usdt:
        address: "0x..."
        decimals: 18

  source_chains:
    - chain_id: 56
      name: "BSC Mainnet"
      rpc_url: "https://bsc-dataseed1.binance.org/"
      contracts:
        treasury_contract: "0x..."
      tokens:
        test_usdt:
          address: "0x..."
          decimals: 18

test_users:
  default:
    private_key: "0x..."
    address: "0x..."

test_config:
  deposit:
    default_amount: "10.0"
    confirmation_blocks: 1
  withdraw:
    max_wait_time: 180

logging:
  level: "info"
```

### KMS 配置

#### 基础 KMS 配置

```json
{
  "kms": {
    "type": "basic",
    "config": {
      "baseURL": "http://localhost:18082",
      "keyAlias": "my_bsc_key",
      "encryptedKey": "encrypted_private_key_from_kms",
      "slip44Id": 714,
      "address": "0x...",
      "defaultSignatureType": "eip191"
    }
  }
}
```

#### SAAS KMS 配置

```json
{
  "kms": {
    "type": "saas",
    "config": {
      "kmsUrl": "https://kms.your-saas.com",
      "enterpriseId": "your_enterprise_id",
      "chainId": 714,
      "userAddress": "0x...",
      "keyAlias": "enterprise_key",
      "k1Key": "your_k1_key"
    }
  }
}
```

#### 多链 KMS 配置

```json
{
  "kms": {
    "type": "multi_chain",
    "chains": {
      "bsc": {
        "slip44Id": 714,
        "encryptedKey": "bsc_encrypted_key",
        "address": "0xBSC_ADDRESS",
        "defaultSignatureType": "eip191"
      },
      "ethereum": {
        "slip44Id": 60,
        "encryptedKey": "eth_encrypted_key",
        "address": "0xETH_ADDRESS",
        "defaultSignatureType": "eip191"
      },
      "tron": {
        "slip44Id": 195,
        "encryptedKey": "tron_encrypted_key",
        "address": "TRON_ADDRESS",
        "defaultSignatureType": "tip191t"
      }
    }
  }
}
```

### 支持的 KMS 签名类型

| 网络     | SLIP44 ID | 签名类型 | 说明                    |
| -------- | --------- | -------- | ----------------------- |
| Ethereum | 60        | eip191   | 以太坊 EIP-191 标准签名 |
| BSC      | 714       | eip191   | 币安智能链 EIP-191 签名 |
| Tron     | 195       | tip191t  | 波场 TIP-191T 签名      |
| Polygon  | 966       | eip191   | Polygon EIP-191 签名    |
| Arbitrum | 42161     | eip191   | Arbitrum EIP-191 签名   |
| Optimism | 10        | eip191   | Optimism EIP-191 签名   |

## 注意事项

### Basic Usage Notes

1. **登录状态**: 大部分操作需要先调用 `login()` 或 `loginWithSigner()` 方法
2. **异步操作**: 同步和异步方法的区别在于是否等待操作完成
3. **错误处理**: 所有方法都可能抛出异常，需要适当的错误处理
4. **Resource Cleanup**: Call `cleanup()` method to clean up resources after use
5. **金额精度**: Token 金额需要考虑精度，通常为 18 位小数
6. **Chain ID**: Use SLIP-44 standard chain ID (e.g., BSC is 714)

### KMS 集成注意事项

7. **KMS 连接**: 确保 KMS 服务可访问，网络连接稳定
8. **Signature Type**: Different blockchain networks require corresponding signature types (eip191/tip191t)
9. **密钥管理**: KMS 中的密钥别名(keyAlias)必须唯一且正确配置
10. **企业认证**: SAAS KMS 需要有效的企业 ID 和 K1 密钥进行认证
11. **Multi-chain Support**: When using multi-chain KMS, ensure each chain is configured correctly
12. **安全性**: KMS 签名器会自动处理私钥安全，无需手动管理私钥
13. **错误重试**: KMS 服务可能因网络问题失败，建议实现重试机制
14. **日志记录**: KMS 操作会产生详细日志，便于调试和审计

## 更多示例

查看 `zkpay-client-example.js` 文件获取更多详细的使用示例。
