# ZKPay Client Library Examples and Tests

This directory contains core usage examples and test code for ZKPay Client Library.

## 🚨 Important Security Warning

⚠️ **Never write private keys directly in configuration files!**
⚠️ **Please use environment variables or .env files to store sensitive information!**
⚠️ **Only use test accounts and test networks!**

## 📁 File Description

### 🌟 **Core Examples**

- **`zkpay-client-example.js`** - Complete usage example, demonstrating 8 different use cases (deposit, commitment, withdrawal, etc.)
- **`async-usage-example.js`** - Asynchronous method usage example, showing how to use await to call async methods

### 🔐 **KMS Integration Examples**

- **`kms-key-initialization-example.js`** - KMS key initialization example
- **`zkpay-kms-integration-example.js`** - ZKPay and KMS service integration example
- **`kms-full-flow-example.js`** - Complete KMS flow example (Deposit→Commitment→Withdraw)

### 🧪 **Test Files**

- **`quick-client-library-test.js`** - Quick functionality verification test, including complete E2E flow
- **`test-async-features.js`** - Asynchronous functionality test, demonstrating various usage of async methods
- **`ready-checkbook-test.js`** - Complete flow test using existing ready checkbook

### 🚀 **Tools and Configuration**

- **`run-client-library-test.sh`** - Shell script for running tests
- **`setup-test-env.sh`** - Test environment setup script
- **`bsc-testnet-config.env`** - BSC testnet configuration environment variables
- **`logger.js`** - Log manager (provides unified logging functionality)

## 🔧 UseMethod

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

### 3. 运行异步Function测试

```bash
cd zksdk/examples
node test-async-features.js
```

### 4. 运行 KMS 集成示例

```bash
cd zksdk/examples
node zkpay-kms-integration-example.js
```

### 5. 运行 KMS 完整流程示例

```bash
cd zksdk/examples
# Use自动生成的Private Key
node kms-full-flow-example.js --amount 10.0

# Use客户端Provide的Private Key
node kms-full-flow-example.js --use-provided-key --private-key 0x1234... --amount 10.0
```

### 6. 运行 Ready CheckBook 测试

```bash
cd zksdk/examples
node ready-checkbook-test.js
```

## 📋 测试覆盖

### 完整Function测试包括：

- ✅ 客户端初始化
- ✅ User登录
- ✅ Token Operation（余额Query、授权Check）
- ✅ CheckBook Query和Details
- ✅ DepositOperation（授权 → Deposit）
- ✅ Deposit检测（后端确认）
- ✅ Wait checkbook 准备
- ✅ 分配和Signature（Commitment Execute）
- ✅ Commitment Status验证
- ✅ 提现证明生成
- ✅ 提现完成确认

### 异步Function测试包括：

- 🔄 Commitment 异步提交和Wait
- 🔄 Withdraw 异步提交和Wait
- 🔄 Status轮询和监控
- 🔄 超时Process

## 💡 提示

- 确保在运行测试前已经设置了正确的Environment变量（如`TEST_USER_PRIVATE_KEY`）
- 测试需要连接到 ZKPay 后端Service
- 完整Function测试会Execute实际的区块链交易，需要消耗少量 gas 费用

## 📊 Directory结构

```
examples/
├── README.md                           # 本File
├── logger.js                           # LogManagement器
├── zkpay-client-example.js             # 完整Use示例
├── async-usage-example.js              # 异步Method示例
├── kms-key-initialization-example.js   # KMSKey初始化示例
├── zkpay-kms-integration-example.js    # KMS集成示例
├── kms-full-flow-example.js            # KMS完整流程示例
├── quick-client-library-test.js        # 快速Function测试
├── test-async-features.js              # 异步Function测试
├── ready-checkbook-test.js             # Ready CheckBook测试
├── run-client-library-test.sh          # 运行脚本
├── setup-test-env.sh                   # Environment设置脚本
└── bsc-testnet-config.env              # BSC测试网Configuration
```
