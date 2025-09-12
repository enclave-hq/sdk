# ZKPay Client Library 示例和测试

本目录包含了 ZKPay Client Library 的核心使用示例和测试代码。

## 🚨 重要安全警告

⚠️ **绝不要在配置文件中直接写入私钥！**
⚠️ **请使用环境变量或 .env 文件存储敏感信息！**
⚠️ **只使用测试账户和测试网络！**

## 📁 文件说明

### 🌟 **核心示例**

- **`zkpay-client-example.js`** - 完整的使用示例，展示 8 个不同的使用场景（存款、承诺、提现等）
- **`async-usage-example.js`** - 异步方法使用示例，展示如何使用 await 调用异步方法

### 🔐 **KMS集成示例**

- **`kms-key-initialization-example.js`** - KMS密钥初始化示例
- **`zkpay-kms-integration-example.js`** - ZKPay与KMS服务集成示例
- **`kms-full-flow-example.js`** - 完整的KMS流程示例（Deposit→Commitment→Withdraw）

### 🧪 **测试文件**

- **`quick-client-library-test.js`** - 快速功能验证测试，包含完整的 E2E 流程
- **`test-async-features.js`** - 异步功能测试，演示异步方法的各种使用方式
- **`ready-checkbook-test.js`** - 使用现有ready checkbook进行完整流程测试

### 🚀 **工具和配置**

- **`run-client-library-test.sh`** - 运行测试的 shell 脚本
- **`setup-test-env.sh`** - 测试环境设置脚本
- **`bsc-testnet-config.env`** - BSC测试网配置环境变量
- **`logger.js`** - 日志管理器（提供统一的日志记录功能）

## 🔧 使用方法

### 1. 运行完整示例

```bash
cd zksdk/examples
node zkpay-client-example.js --all
```

### 2. 运行快速测试

```bash
cd zksdk/examples
./run-client-library-test.sh quick
```

### 3. 运行异步功能测试

```bash
cd zksdk/examples
node test-async-features.js
```

### 4. 运行KMS集成示例

```bash
cd zksdk/examples
node zkpay-kms-integration-example.js
```

### 5. 运行KMS完整流程示例

```bash
cd zksdk/examples
# 使用自动生成的私钥
node kms-full-flow-example.js --amount 10.0

# 使用客户端提供的私钥
node kms-full-flow-example.js --use-provided-key --private-key 0x1234... --amount 10.0
```

### 6. 运行Ready CheckBook测试

```bash
cd zksdk/examples
node ready-checkbook-test.js
```

## 📋 测试覆盖

### 完整功能测试包括：

- ✅ 客户端初始化
- ✅ 用户登录
- ✅ Token 操作（余额查询、授权检查）
- ✅ CheckBook 查询和详情
- ✅ 存款操作（授权 → 存款）
- ✅ 存款检测（后端确认）
- ✅ 等待 checkbook 准备
- ✅ 分配和签名（Commitment 执行）
- ✅ Commitment 状态验证
- ✅ 提现证明生成
- ✅ 提现完成确认

### 异步功能测试包括：

- 🔄 Commitment 异步提交和等待
- 🔄 Withdraw 异步提交和等待
- 🔄 状态轮询和监控
- 🔄 超时处理

## 💡 提示

- 确保在运行测试前已经设置了正确的环境变量（如`TEST_USER_PRIVATE_KEY`）
- 测试需要连接到 ZKPay 后端服务
- 完整功能测试会执行实际的区块链交易，需要消耗少量 gas 费用

## 📊 目录结构

```
examples/
├── README.md                           # 本文件
├── logger.js                           # 日志管理器
├── zkpay-client-example.js             # 完整使用示例
├── async-usage-example.js              # 异步方法示例
├── kms-key-initialization-example.js   # KMS密钥初始化示例
├── zkpay-kms-integration-example.js    # KMS集成示例
├── kms-full-flow-example.js            # KMS完整流程示例
├── quick-client-library-test.js        # 快速功能测试
├── test-async-features.js              # 异步功能测试
├── ready-checkbook-test.js             # Ready CheckBook测试
├── run-client-library-test.sh          # 运行脚本
├── setup-test-env.sh                   # 环境设置脚本
└── bsc-testnet-config.env              # BSC测试网配置
```
