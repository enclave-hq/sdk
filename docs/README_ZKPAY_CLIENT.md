# ZKPay Client Operation Library

This is a complete client library for interacting with ZKPay backend, providing unified interfaces for login, deposit, commitment, withdrawal and other functions.

## Features

✅ **Complete Operation Flow Support**

- User login and authentication
- Token authorization and deposit
- Read user CheckBook records
- Create allocation plans and signatures
- Execute Commitment (synchronous/asynchronous)
- Generate withdrawal proofs (synchronous/asynchronous)

✅ **Easy-to-Use API**

- Unified error handling
- Detailed logging
- Flexible configuration options
- Comprehensive documentation and examples

✅ **Advanced Features**

- Complete flow encapsulation
- Status monitoring and waiting
- Automatic resource cleanup
- Concurrent operation support

## 快速开始

### 1. 安装依赖

```bash
npm install ethers axios js-yaml
```

### 2. 基本使用

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

async function example() {
  // 创建客户端
  const client = new ZKPayClient(config);

  try {
    // 初始化
    await client.initialize();

    // 登录
    await client.login("0x...", "user1");

    // 执行存款
    const depositResult = await client.deposit(56, "test_usdt", "10.0");

    // 等待检测
    const depositRecord = await client.waitForDepositDetection(
      depositResult.deposit.txHash,
      56,
      60
    );

    // 创建分配并执行Commitment
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

    // 生成提现证明
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

    console.log("完整流程执行成功!");
  } finally {
    await client.cleanup();
  }
}
```

## 文件结构

```
e2e-automation/
├── zkpay-client-library.js      # 核心客户端库
├── zkpay-client-example.js      # 详细使用示例
├── test-zkpay-client.js         # 功能测试脚本
├── ZKPAY_CLIENT_API.md          # 完整API文档
└── README_ZKPAY_CLIENT.md       # 本文件
```

## 核心 API

### 认证相关

- `initialize()` - 初始化客户端
- `login(privateKey, userName)` - 用户登录
- `isLoggedIn()` - 检查登录状态
- `logout()` - 退出登录

### Token 操作

- `checkTokenBalance(chainId, tokenSymbol)` - 检查余额
- `checkTokenAllowance(chainId, tokenSymbol)` - 检查授权额度
- `approveToken(chainId, tokenSymbol, amount)` - 授权 Token
- `deposit(chainId, tokenSymbol, amount)` - 执行存款

### CheckBook 操作

- `getUserDeposits(userAddress?, chainId?)` - 获取存款记录
- `getCheckbookDetails(checkbookId)` - 获取 CheckBook 详情
- `waitForDepositDetection(txHash, chainId, maxWaitTime?)` - 等待存款检测

### Commitment 操作（同步/异步）

- `executeCommitmentSync(checkbookId, allocations, waitForWithCheck?)` - 同步执行
- `executeCommitmentAsync(checkbookId, allocations)` - 异步执行
- `createAllocationAndSign(checkbookId, allocations)` - 创建分配和签名

### 提现操作（同步/异步）

- `generateProofSync(checkbookId, recipientInfo, waitForCompleted?)` - 同步生成证明
- `generateProofAsync(checkbookId, recipientInfo)` - 异步生成证明

### 高级功能

- `performFullDepositToCommitment(...)` - 完整存款到 Commitment 流程
- `performFullCommitmentToWithdraw(...)` - 完整 Commitment 到提现流程

## 同步 vs 异步操作

### 同步方式（等待完成）

```javascript
// 执行Commitment并等待完成
const result = await client.executeCommitmentSync(
  checkbookId,
  allocations,
  true
);
console.log("Commitment完成:", result.finalStatus);

// 生成证明并等待完成
const proofResult = await client.generateProofSync(
  checkbookId,
  recipientInfo,
  true
);
console.log("提现完成:", proofResult.completionResult.transaction_hash);
```

### 异步方式（立即返回）

```javascript
// 提交Commitment请求，立即返回
const commitmentResult = await client.executeCommitmentAsync(
  checkbookId,
  allocations
);
console.log("Commitment已提交:", commitmentResult.status);

// 在后台等待完成
commitmentResult
  .waitForCompletion(["with_checkbook"], 300)
  .then((result) => {
    console.log("Commitment完成:", result.status);

    // 继续下一步操作
    return client.generateProofAsync(checkbookId, recipientInfo);
  })
  .then((proofResult) => {
    return proofResult.waitForCompletion(300);
  })
  .then((completionResult) => {
    console.log("提现完成:", completionResult.transaction_hash);
  });

// 主线程可以继续其他操作...
```

## 运行示例

### 运行完整示例

```bash
node zkpay-client-example.js --config config.yaml --all
```

### 运行单个示例

```bash
node zkpay-client-example.js --config config.yaml --example example1
```

### 运行功能测试

```bash
node test-zkpay-client.js --config config.yaml
```

## 配置要求

客户端库需要以下配置结构（`config.yaml`）：

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

## 错误处理

所有 API 方法都会抛出异常，建议使用 try-catch 进行错误处理：

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

## 注意事项

1. **登录状态**: 大部分操作需要先调用 `login()` 方法
2. **异步操作**: 同步和异步方法的区别在于是否等待操作完成
3. **错误处理**: 所有方法都可能抛出异常，需要适当的错误处理
4. **资源清理**: 使用完毕后调用 `cleanup()` 方法清理资源
5. **金额精度**: Token 金额需要考虑精度，通常为 18 位小数
6. **链 ID**: 使用 SLIP-44 标准的链 ID（如 BSC 为 714）

## 开发和调试

### 启用调试日志

```javascript
const logger = createLogger("ZKPayClient", { level: "debug" });
const client = new ZKPayClient(config, logger);
```

### 运行测试

```bash
# 运行功能测试
node test-zkpay-client.js --config config.yaml

# JSON格式输出
node test-zkpay-client.js --config config.yaml --json
```

### 检查 API 连接

```javascript
await client.initialize();
await client.testApiConnection();
```

## 支持和贡献

如有问题或建议，请查看：

- `ZKPAY_CLIENT_API.md` - 完整 API 文档
- `zkpay-client-example.js` - 详细使用示例
- `test-zkpay-client.js` - 功能测试代码

## 更新日志

- **v1.0.0** - 初始版本，支持完整的 ZKPay 操作流程
  - 用户认证和登录
  - Token 授权和存款
  - CheckBook 查询和管理
  - 分配创建和签名
  - Commitment 执行（同步/异步）
  - 提现证明生成（同步/异步）
  - 高级流程封装
  - 完整的错误处理和日志记录
