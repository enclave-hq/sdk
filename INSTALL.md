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

```bash
cd examples
# 编辑 config.yaml 设置API地址和测试参数
# 设置环境变量
export TEST_USER_PRIVATE_KEY="your_private_key_without_0x_prefix"
```

### 3. 运行测试

```bash
# 快速测试
npm test

# 完整功能测试
npm run test:full

# 异步功能测试
npm run test:async
```

### 4. 运行示例

```bash
# 基本示例
npm run example

# 异步示例
npm run example:async
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
