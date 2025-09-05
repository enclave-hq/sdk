# ZKPay 客户端库 API 文档

ZKPay 客户端库提供了完整的后台交互接口，包含登录、存款、Commitment、提现等功能。

## 快速开始

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

// 创建客户端
const client = new ZKPayClient(config, logger);

// 初始化
await client.initialize();

// 登录
await client.login(privateKey, "user1");

// 执行操作...
```

## API 接口

### 1. 初始化和认证

#### `initialize()`

初始化客户端库

```javascript
await client.initialize();
```

#### `login(privateKey, userName?)`

使用私钥登录到后台

```javascript
const result = await client.login("0x...", "user1");
// 返回: { success: true, address: '0x...', userName: 'user1', token: '...' }
```

#### `isLoggedIn()`

检查登录状态

```javascript
const loggedIn = client.isLoggedIn(); // true/false
```

#### `getCurrentUser()`

获取当前用户信息

```javascript
const user = client.getCurrentUser();
// 返回: { address: '0x...', privateKey: '0x...', userName: 'user1', wallet: Wallet }
```

#### `logout()`

退出登录

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

## 使用示例

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

所有方法都会抛出异常，建议使用 try-catch 进行错误处理：

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

客户端库需要以下配置结构：

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

## 注意事项

1. **登录状态**: 大部分操作需要先调用 `login()` 方法
2. **异步操作**: 同步和异步方法的区别在于是否等待操作完成
3. **错误处理**: 所有方法都可能抛出异常，需要适当的错误处理
4. **资源清理**: 使用完毕后调用 `cleanup()` 方法清理资源
5. **金额精度**: Token 金额需要考虑精度，通常为 18 位小数
6. **链 ID**: 使用 SLIP-44 标准的链 ID（如 BSC 为 714）

## 更多示例

查看 `zkpay-client-example.js` 文件获取更多详细的使用示例。
