# ZKPay Client Library - 安装和使用指南

## 🚀 快速开始

### 1. 安装

```bash
# 克隆仓库
git clone git@github.com:QuantrixLab/ZKPaySDK.git
cd ZKPaySDK

# 安装依赖
npm install
```

### 2. 配置

#### 基础配置
```bash
cd examples
# 编辑 config.yaml 设置API地址和测试参数
# 设置环境变量
export TEST_USER_PRIVATE_KEY="your_private_key_without_0x_prefix"
```

#### KMS集成配置

对于企业级用户，可以配置KMS服务进行安全的密钥管理：

**方式1: 基础KMS配置**
```bash
# 设置KMS服务地址
export KMS_BASE_URL="http://localhost:18082"

# 设置KMS密钥配置
export KMS_KEY_ALIAS="your_key_alias"
export KMS_ENCRYPTED_KEY="your_encrypted_key"
export KMS_USER_ADDRESS="0x..."
```

**方式2: SAAS KMS配置**
```bash
# 设置SAAS KMS服务
export SAAS_KMS_URL="https://kms.your-saas.com"
export SAAS_ENTERPRISE_ID="your_enterprise_id"
export SAAS_K1_KEY="your_k1_key"
export SAAS_USER_ADDRESS="0x..."
export SAAS_KEY_ALIAS="enterprise_key"
```

**方式3: 配置文件方式**
创建 `kms-config.json` 文件：
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

### 3. 运行测试

#### 基础测试
```bash
# 快速测试
npm test

# 完整功能测试
npm run test:full

# 异步功能测试
npm run test:async
```

#### KMS集成测试
```bash
# KMS密钥初始化测试
node examples/kms-key-initialization-example.js

# KMS集成测试
node examples/zkpay-kms-integration-example.js

# KMS完整流程测试
node examples/kms-full-flow-example.js --amount 10.0

# 使用客户端提供的私钥进行KMS测试
node examples/kms-full-flow-example.js --use-provided-key --private-key 0x... --amount 10.0
```

### 4. 运行示例

#### 基础示例
```bash
# 基本示例
npm run example

# 异步示例
npm run example:async
```

#### KMS示例
```bash
# KMS集成示例
node examples/zkpay-kms-integration-example.js

# 完整KMS流程示例
node examples/kms-full-flow-example.js --amount 5.0

# 多链KMS管理示例
node examples/multi-chain-kms-example.js
```

## 📦 作为 NPM 包使用

```bash
npm install zkpay-client-library
```

```javascript
const { ZKPayClient } = require("zkpay-client-library");

const client = new ZKPayClient(config);
await client.initialize();
await client.login(privateKey);

// 执行操作
const result = await client.executeCommitmentSync(checkbookId, allocations);
```

## 📚 文档

- [README.md](./README.md) - 项目概述
- [LIBRARY_OVERVIEW.md](./LIBRARY_OVERVIEW.md) - 库架构说明
- [USAGE_GUIDE.md](./USAGE_GUIDE.md) - 详细使用指南
- [examples/README.md](./examples/README.md) - 示例和测试说明

## 🔧 开发

```bash
# 运行测试
npm test

# 运行示例
npm run example

# 查看所有可用脚本
npm run
```

## 📋 系统要求

- Node.js >= 16.0.0
- NPM or Yarn
- 连接到 ZKPay 后端服务

## 🎯 主要功能

- ✅ 完整的 ZKPay 后端交互
- ✅ 存款、Commitment、提现操作
- ✅ 同步和异步操作模式
- ✅ 状态监控和等待机制
- ✅ 完整的测试覆盖
- ✅ 详细的文档和示例
- ✅ KMS密钥管理系统集成
- ✅ SAAS企业级KMS支持
- ✅ 多链签名和SLIP44标准支持
- ✅ 安全的私钥管理和签名服务

## 🔐 KMS集成特性

### 支持的KMS类型
- **基础KMS**: 标准KMS服务集成
- **SAAS KMS**: 企业级SAAS KMS服务
- **多链KMS**: 支持多区块链网络的统一KMS管理

### 支持的区块链网络
| 网络 | SLIP44 ID | 签名类型 | KMS支持 |
|------|-----------|----------|---------|
| Ethereum | 60 | eip191 | ✅ |
| BSC | 714 | eip191 | ✅ |
| Tron | 195 | tip191t | ✅ |
| Polygon | 966 | eip191 | ✅ |
| Arbitrum | 42161 | eip191 | ✅ |
| Optimism | 10 | eip191 | ✅ |

### 安全特性
- 🔒 私钥从不离开KMS服务
- 🔐 支持硬件安全模块(HSM)
- 📝 完整的签名审计日志
- 🔑 基于角色的访问控制(RBAC)
- 🛡️ 企业级安全合规支持
