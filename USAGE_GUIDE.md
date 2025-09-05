# ZKPay 客户端库使用指南

## 🎯 核心功能对照表

| 需求                  | API 方法                                            | 同步/异步 | 说明                       |
| --------------------- | --------------------------------------------------- | --------- | -------------------------- |
| 1. 登录到后台         | `login(privateKey, userName)`                       | 同步      | 使用私钥登录认证           |
| 2. Approve 和 Deposit | `deposit(chainId, tokenSymbol, amount)`             | 同步      | 自动处理授权和存款         |
| 3. 读取 CheckBook     | `getUserDeposits()`                                 | 同步      | 获取用户的存款记录         |
| 4. 创建分配+签名      | `createAllocationAndSign(checkbookId, allocations)` | 同步      | 创建分配方案并签名         |
| 5. 执行 Commitment    | `executeCommitmentSync()`                           | 同步      | 等待到 with_checkbook 状态 |
| 5. 执行 Commitment    | `executeCommitmentAsync()`                          | 异步      | 立即返回，提供监控方法     |
| 6. 生成提现证明       | `generateProofSync()`                               | 同步      | 等待到 completed 状态      |
| 6. 生成提现证明       | `generateProofAsync()`                              | 异步      | 立即返回，提供监控方法     |

## 🚀 基本使用流程

### 步骤 1: 初始化和登录

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

const client = new ZKPayClient(config);
await client.initialize();
await client.login("0x你的私钥", "user1");
```

### 步骤 2: 执行存款

```javascript
// 检查余额
const balance = await client.checkTokenBalance(56, "test_usdt");
console.log("当前余额:", balance.formatted);

// 执行存款（自动处理授权）
const depositResult = await client.deposit(56, "test_usdt", "10.0");
console.log("存款交易:", depositResult.deposit.txHash);

// 等待后端检测
const depositRecord = await client.waitForDepositDetection(
  depositResult.deposit.txHash,
  56,
  60
);
console.log("CheckBook ID:", depositRecord.checkbook_id);
```

### 步骤 3: 执行 Commitment

#### 同步方式（等待完成）

```javascript
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x接收地址",
    amount: "10000000000000000000", // 10.0 USDT
  },
];

const commitmentResult = await client.executeCommitmentSync(
  depositRecord.checkbook_id,
  allocations,
  true // 等待到with_checkbook状态
);
console.log("Commitment完成:", commitmentResult.finalStatus);
```

#### 异步方式（立即返回）

```javascript
const commitmentResult = await client.executeCommitmentAsync(
  depositRecord.checkbook_id,
  allocations
);
console.log("Commitment已提交:", commitmentResult.status);

// 在后台等待完成
commitmentResult.waitForCompletion(["with_checkbook"], 300).then((result) => {
  console.log("Commitment完成:", result.status);
  // 继续下一步...
});
```

### 步骤 4: 生成提现证明

#### 同步方式（等待完成）

```javascript
const recipientInfo = {
  chain_id: 714,
  address: client.getCurrentUser().address,
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const proofResult = await client.generateProofSync(
  depositRecord.checkbook_id,
  recipientInfo,
  true // 等待到completed状态
);
console.log("提现完成:", proofResult.completionResult.transaction_hash);
```

#### 异步方式（立即返回）

```javascript
const proofResult = await client.generateProofAsync(
  depositRecord.checkbook_id,
  recipientInfo
);
console.log("证明生成已提交:", proofResult.checkId);

// 在后台等待完成
proofResult.waitForCompletion(300).then((result) => {
  console.log("提现完成:", result.transaction_hash);
});
```

## 🔧 高级功能

### 一键完整流程

```javascript
// 从存款到Commitment
const result1 = await client.performFullDepositToCommitment(
  56,
  "test_usdt",
  "10.0",
  allocations
);

// 从Commitment到提现
const result2 = await client.performFullCommitmentToWithdraw(
  result1.depositRecord.checkbook_id,
  recipientInfo
);
```

### 查询用户资产

```javascript
// 获取所有存款记录
const deposits = await client.getUserDeposits();

deposits.forEach((deposit) => {
  console.log(`CheckBook ${deposit.checkbookId}:`);
  console.log(`  状态: ${deposit.status}`);
  console.log(`  金额: ${deposit.allocatableAmount}`);
  console.log(`  Token: ${deposit.tokenSymbol}`);
  console.log(`  Check数量: ${deposit.checks.length}`);
});
```

### 批量操作示例

```javascript
// 并行执行多个Commitment
const commitmentPromises = checkbookIds.map((checkbookId) =>
  client.executeCommitmentAsync(checkbookId, allocations)
);

const commitmentResults = await Promise.all(commitmentPromises);

// 等待所有Commitment完成
const completionPromises = commitmentResults.map((result) =>
  result.waitForCompletion(["with_checkbook"], 300)
);

const completionResults = await Promise.all(completionPromises);
console.log("所有Commitment已完成");
```

## 📊 状态监控

### 手动状态查询

```javascript
// 查询CheckBook状态
const checkbook = await client.getCheckbookDetails(checkbookId);
console.log("当前状态:", checkbook.status);

// 查询用户所有存款
const deposits = await client.getUserDeposits();
console.log("存款数量:", deposits.length);
```

### 自动状态等待

```javascript
// 等待特定状态
const result = await client.waitForCommitmentStatus(
  checkbookId,
  ["with_checkbook", "issued"],
  300 // 5分钟超时
);
```

## 🔍 错误处理最佳实践

```javascript
async function safeOperation() {
  try {
    // 检查登录状态
    if (!client.isLoggedIn()) {
      await client.login(privateKey, "user1");
    }

    // 检查余额
    const balance = await client.checkTokenBalance(56, "test_usdt");
    if (parseFloat(balance.formatted) < 10) {
      throw new Error("余额不足，需要至少10 USDT");
    }

    // 执行操作
    const result = await client.deposit(56, "test_usdt", "10.0");
    return result;
  } catch (error) {
    console.error("操作失败:", error.message);

    // 特定错误处理
    if (error.message.includes("余额不足")) {
      console.log("💡 请先充值Token");
    } else if (error.message.includes("未登录")) {
      console.log("💡 请检查私钥并重新登录");
    } else if (error.message.includes("网络")) {
      console.log("💡 请检查网络连接");
    }

    throw error;
  }
}
```

## 🧪 快速测试

```bash
# 进入library目录
cd zkpay-client-library

# 运行基础功能测试
npm test

# 运行完整示例
npm run example

# 运行单个示例
npm run example:single

# JSON格式输出测试结果
npm run test:json
```

## 📦 集成到项目

### 作为模块使用

```javascript
// 在其他项目中使用
const { ZKPayClient } = require("./path/to/zkpay-client-library");

// 或者安装为npm包（如果发布）
// const { ZKPayClient } = require('zkpay-client-library');
```

### 作为依赖集成

```json
// package.json
{
  "dependencies": {
    "zkpay-client-library": "file:./e2e-automation/zkpay-client-library"
  }
}
```

## 🔗 相关资源

- **API 文档**: `docs/ZKPAY_CLIENT_API.md`
- **详细说明**: `docs/README_ZKPAY_CLIENT.md`
- **快速开始**: `docs/QUICK_START.md`
- **使用示例**: `examples/zkpay-client-example.js`
- **测试代码**: `tests/test-zkpay-client.js`




