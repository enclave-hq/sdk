# ZKPay 客户端库

这是一个完整的 ZKPay 客户端操作库，提供了与后台交互的统一接口。

## 📁 目录结构

```
zkpay-client-library/
├── README.md                    # 本文件
├── index.js                     # 统一入口文件
│
├── core/                        # 核心库文件
│   └── zkpay-client-library.js  # 主要客户端库
│
├── managers/                    # 功能管理器
│   ├── zkpay-wallet-manager.js  # 钱包管理器
│   ├── zkpay-deposit-manager.js # 存款管理器
│   ├── zkpay-commitment-manager.js # Commitment管理器
│   └── zkpay-withdraw-manager.js   # 提现管理器
│
# 注意：签名消息生成功能已整合到CommitmentManager内部
│
├── examples/                    # 使用示例
│   └── zkpay-client-example.js  # 详细使用示例
│
├── tests/                       # 测试文件
│   └── test-zkpay-client.js     # 功能测试脚本
│
└── docs/                        # 文档
    ├── ZKPAY_CLIENT_API.md      # 完整API文档
    ├── README_ZKPAY_CLIENT.md   # 详细使用说明
    └── QUICK_START.md           # 快速开始指南
```

## 🚀 快速开始

### 1. 导入库

```javascript
// 方式1: 导入主要客户端库
const { ZKPayClient } = require("./zkpay-client-library");

// 方式2: 导入特定组件
const {
  ZKPayClient,
  ZKPayWalletManager,
  generateSignMessage,
} = require("./zkpay-client-library");
```

### 2. 基本使用

```javascript
const client = new ZKPayClient(config);
await client.initialize();
await client.login("0x...", "user1");

// 执行操作
const deposits = await client.getUserDeposits();
const depositResult = await client.deposit(56, "test_usdt", "10.0");
```

## 📋 核心功能

✅ **1. 登录到后台**

- 使用私钥登录认证
- 自动身份验证
- 认证状态管理

✅ **2. Approve 和 Deposit**

- Token 授权检查
- 自动授权处理
- 存款执行

✅ **3. 读取 CheckBook**

- 用户存款记录查询
- CheckBook 详情获取
- 状态实时监控

✅ **4. 创建分配和签名**

- 分配方案创建
- 标准签名消息生成（使用 CommitmentManager 内部方法）
- 自动签名处理

✅ **5. 执行 Commitment**

- **同步方式**: 等待完成，直接返回最终结果和commitment哈希
- **异步方式**: 立即返回，提供多种等待方法
  - `waitForCompletion()`: 轮询状态直到完成或超时
  - `waitUntilCompleted()`: 等待完成并返回包含哈希的完整结果
  - `checkStatus()`: 随时查询当前状态，提供监控方法

✅ **6. 生成提现证明**

- **同步方式**: 等待到 completed 状态，直接返回交易哈希
- **异步方式**: 立即返回，提供多种等待方法
  - `waitForCompletion()`: 轮询状态直到完成或超时
  - `waitUntilCompleted()`: 等待完成并返回包含交易哈希的完整结果
  - `checkStatus()`: 随时查询当前状态

## 🔧 技术特性

### 集成现有组件

- ✅ 复用所有现有的管理器类
- ✅ 使用 CommitmentManager 内部签名方法
- ✅ 保持与 webserver 和 ZKVM 的签名一致性
- ✅ 使用标准的 Universal Address 格式

### 同步/异步支持

- ✅ 同步方式: 适合简单脚本，等待操作完成
- ✅ 异步方式: 适合复杂应用，支持并发操作
- ✅ 灵活的状态监控和等待机制

### 错误处理和日志

- ✅ 统一的异常处理
- ✅ 详细的操作日志
- ✅ 调试信息支持

## 📖 使用文档

- **API 文档**: `docs/ZKPAY_CLIENT_API.md`
- **使用说明**: `docs/README_ZKPAY_CLIENT.md`
- **快速开始**: `docs/QUICK_START.md`

## 🧪 测试和示例

### 运行功能测试

```bash
cd zkpay-client-library
node tests/test-zkpay-client.js --config ../config.yaml
```

### 运行使用示例

```bash
cd zkpay-client-library
node examples/zkpay-client-example.js --config ../config.yaml --all
```

## 🔄 与原有代码的关系

这个库是在现有 E2E 自动化代码基础上构建的：

- **复用**: 完全复用现有的 manager 类
- **增强**: 添加了统一的客户端接口
- **集成**: 使用 CommitmentManager 内部签名方法
- **扩展**: 提供了同步/异步两种操作方式

## 🚀 快速测试

```bash
# 进入library目录
cd zkpay-client-library

# 运行基础功能测试
node tests/test-zkpay-client.js --config ../config.yaml

# 运行完整示例
node examples/zkpay-client-example.js --config ../config.yaml --example example1
```

## 📦 依赖

- `ethers` - 以太坊交互
- `axios` - HTTP 请求
- `js-yaml` - 配置文件解析
- 现有的 logger 和 manager 组件

## 🔗 相关文件

- 原始 E2E 测试: `../zkpay-e2e-test.js`
- 日志工具: `../logger.js`
- 配置文件: `../config.yaml`
