# ZKPay 客户端库 - 快速开始

## 🚀 5 分钟快速上手

### 1. 导入库

```javascript
const { ZKPayClient } = require("./zkpay-client-library");
// 或者
const { ZKPayClient } = require("./index");
```

### 2. 创建和初始化客户端

```javascript
const client = new ZKPayClient(config);
await client.initialize();
```

### 3. 登录

#### 方式1: 直接私钥登录
```javascript
await client.login("0x你的私钥", "用户名");
```

#### 方式2: KMS签名器登录
```javascript
// 基础KMS配置
const { ZKPayKMSSigner } = require("../utils/zkpay-kms-adapter");

const kmsConfig = {
    baseURL: 'http://localhost:18082',
    keyAlias: 'my_bsc_key',
    encryptedKey: 'encrypted_private_key_from_kms',
    slip44Id: 714,  // BSC
    address: '0x...',
    defaultSignatureType: 'eip191'
};

const kmsSigner = new ZKPayKMSSigner(kmsConfig);
await client.loginWithSigner(kmsSigner, kmsConfig.address);
```

#### 方式3: SAAS KMS登录
```javascript
// SAAS KMS配置
const { SaasKMSSigner } = require("../utils/saas-kms-signer");

const saasKmsConfig = {
    kmsUrl: 'https://kms.your-saas.com',
    enterpriseId: 'your_enterprise_id',
    chainId: 714,
    userAddress: '0x...',
    keyAlias: 'enterprise_key',
    k1Key: 'your_k1_key'
};

const saasSigner = new SaasKMSSigner(saasKmsConfig);
await client.loginWithSigner(saasSigner, saasKmsConfig.userAddress);
```

### 4. 执行操作

```javascript
// 存款
const deposit = await client.deposit(56, "test_usdt", "10.0");

// 等待检测
const record = await client.waitForDepositDetection(deposit.deposit.txHash, 56);

// 执行Commitment
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x接收地址",
    amount: "10000000000000000000", // 10.0 USDT
  },
];

const commitment = await client.executeCommitmentSync(
  record.checkbook_id,
  allocations
);

// 提现
const recipientInfo = {
  chain_id: 714,
  address: "0x接收地址",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const withdraw = await client.generateProofSync(
  record.checkbook_id,
  recipientInfo
);
```

## 📋 核心功能对照表

| 需求                  | 方法                                                   | 说明               |
| --------------------- | ------------------------------------------------------ | ------------------ |
| 1. 登录到后台         | `login(privateKey, userName)`                          | 使用私钥登录认证   |
| 2. Approve 和 Deposit | `deposit(chainId, tokenSymbol, amount)`                | 自动处理授权和存款 |
| 3. 读取 CheckBook     | `getUserDeposits()`                                    | 获取用户的存款记录 |
| 4. 创建分配+签名      | `createAllocationAndSign(checkbookId, allocations)`    | 创建分配方案并签名 |
| 5. 执行 Commitment    | `executeCommitmentSync()` / `executeCommitmentAsync()` | 同步/异步执行      |
| 6. 生成提现证明       | `generateProofSync()` / `generateProofAsync()`         | 同步/异步生成证明  |

## 🔄 同步 vs 异步

### 同步方式（等待完成）

```javascript
// 执行并等待完成
const result = await client.executeCommitmentSync(
  checkbookId,
  allocations,
  true
);
console.log("完成状态:", result.finalStatus);
```

### 异步方式（立即返回）

```javascript
// 提交请求，立即返回
const result = await client.executeCommitmentAsync(checkbookId, allocations);

// 可选择等待完成
const final = await result.waitForCompletion(["with_checkbook"], 300);
console.log("完成状态:", final.status);
```

## ⚡ 一键完整流程

```javascript
// 从存款到Commitment的完整流程
const result = await client.performFullDepositToCommitment(
  56,
  "test_usdt",
  "10.0",
  allocations
);

// 从Commitment到提现的完整流程
const withdraw = await client.performFullCommitmentToWithdraw(
  checkbookId,
  recipientInfo
);
```

## 🧪 运行测试

### 基础测试
```bash
# 运行示例
node zkpay-client-example.js --config config.yaml --all

# 运行测试
node test-zkpay-client.js --config config.yaml
```

### KMS集成测试
```bash
# KMS完整流程测试
node kms-full-flow-example.js --amount 10.0

# 使用提供的私钥进行KMS测试
node kms-full-flow-example.js --use-provided-key --private-key 0x... --amount 10.0

# KMS集成示例
node zkpay-kms-integration-example.js

# KMS密钥初始化示例
node kms-key-initialization-example.js
```

## 📖 更多文档

- `ZKPAY_CLIENT_API.md` - 完整 API 文档
- `README_ZKPAY_CLIENT.md` - 详细使用说明
- `zkpay-client-example.js` - 完整使用示例
