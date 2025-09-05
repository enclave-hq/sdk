# ZKPay 客户端库总览

## 🎯 库的设计目标

基于现有的 E2E 自动化代码，创建一个统一的、易用的 ZKPay 后台交互库，满足以下需求：

1. ✅ **登录到后台** - 使用私钥认证
2. ✅ **实现 Approve 和 Deposit** - Token 授权和存款
3. ✅ **读取本地址对应的 CheckBook** - 查询用户资产
4. ✅ **创建分配，然后签名** - 分配方案和签名生成
5. ✅ **判定状态，执行 commitment** - 同步/异步方案
6. ✅ **判定状态，执行 generate_proof** - 同步/异步方案

## 📁 库结构详解

### 核心组件 (core/)

- **`zkpay-client-library.js`** - 主要客户端库类
  - 整合所有功能的统一接口
  - 提供登录认证、状态管理
  - 封装同步/异步操作模式

### 功能管理器 (managers/)

- **`zkpay-wallet-manager.js`** - 钱包和签名管理
- **`zkpay-deposit-manager.js`** - Token 授权和存款处理
- **`zkpay-commitment-manager.js`** - Commitment 生成和提交
- **`zkpay-withdraw-manager.js`** - 提现证明和执行

### 工具库 (utils/)

- **签名消息生成** - 已整合到 CommitmentManager 内部
  - 与 Rust ZKVM 完全一致的签名消息格式
  - 支持多语言和多链地址格式
  - Universal Address 转换和格式化

### 示例和测试 (examples/, tests/)

- **`zkpay-client-example.js`** - 8 个详细使用示例
- **`test-zkpay-client.js`** - 完整功能测试套件

### 文档 (docs/)

- **`ZKPAY_CLIENT_API.md`** - 完整 API 文档
- **`README_ZKPAY_CLIENT.md`** - 详细使用说明
- **`QUICK_START.md`** - 快速开始指南

## 🔧 技术实现亮点

### 1. 复用现有架构

- ✅ 完全复用现有的 4 个 manager 类
- ✅ 保持与现有 E2E 测试的兼容性
- ✅ 使用 CommitmentManager 内部签名方法

### 2. 统一的接口设计

```javascript
// 简单的API调用
const deposits = await client.getUserDeposits();
const result = await client.deposit(56, "test_usdt", "10.0");
```

### 3. 同步/异步双模式

```javascript
// 同步：等待完成
const result1 = await client.executeCommitmentSync(id, allocations, true);

// 异步：立即返回 + 可选等待
const result2 = await client.executeCommitmentAsync(id, allocations);
const final = await result2.waitForCompletion(["with_checkbook"], 300);
```

### 4. 标准签名消息生成

- 使用 CommitmentManager 中的标准实现
- 与 webserver 和 ZKVM 完全一致
- 支持多语言和 Universal Address 格式

### 5. 完整的错误处理

- 统一异常处理机制
- 详细的错误信息和建议
- 自动认证状态管理

## 📊 使用场景

### 场景 1: 简单脚本（同步模式）

```javascript
// 适合简单的自动化脚本
await client.login(privateKey);
const deposit = await client.deposit(56, "test_usdt", "10.0");
const record = await client.waitForDepositDetection(deposit.deposit.txHash, 56);
const commitment = await client.executeCommitmentSync(
  record.checkbook_id,
  allocations
);
const withdraw = await client.generateProofSync(
  record.checkbook_id,
  recipientInfo
);
```

### 场景 2: 复杂应用（异步模式）

```javascript
// 适合复杂的web应用或并发处理
const commitmentResult = await client.executeCommitmentAsync(id, allocations);

// 主线程继续其他操作
doOtherWork();

// 后台等待完成
commitmentResult
  .waitForCompletion()
  .then((result) => updateUI(result))
  .catch((error) => handleError(error));
```

### 场景 3: 批量处理

```javascript
// 并行处理多个操作
const promises = checkbookIds.map((id) =>
  client.executeCommitmentAsync(id, allocations)
);
const results = await Promise.all(promises);

// 等待所有操作完成
const completions = await Promise.all(
  results.map((r) => r.waitForCompletion())
);
```

## 🔍 与现有代码的关系

### 继承和扩展

- **继承**: 完全基于现有的 manager 类
- **扩展**: 添加了统一的客户端接口
- **增强**: 提供了同步/异步双模式
- **集成**: 整合了 lib 目录的工具

### 目录映射

```
原始文件                    →  新位置
zkpay-wallet-manager.js    →  managers/zkpay-wallet-manager.js
zkpay-deposit-manager.js   →  managers/zkpay-deposit-manager.js
zkpay-commitment-manager.js →  managers/zkpay-commitment-manager.js
zkpay-withdraw-manager.js  →  managers/zkpay-withdraw-manager.js
# 签名消息生成已整合到 CommitmentManager 内部
zkpay-client-library.js    →  core/zkpay-client-library.js
```

### 向后兼容

- 原始的 manager 类仍然可以直接使用
- 现有的 E2E 测试代码无需修改
- 新的客户端库作为高级封装层

## 🚀 快速验证

```bash
# 进入library目录
cd zkpay-client-library

# 测试基本导入
node -e "const {ZKPayClient} = require('./index.js'); console.log('✅ 导入成功');"

# 运行功能测试
npm test

# 运行使用示例
npm run example
```

## 🎉 总结

这个客户端库成功实现了您要求的所有功能：

1. ✅ **完整功能**: 登录、存款、CheckBook 查询、分配签名、Commitment、提现证明
2. ✅ **双模式支持**: 同步（等待完成）和异步（立即返回）
3. ✅ **代码复用**: 完全基于现有代码，无重复实现
4. ✅ **标准集成**: 使用 CommitmentManager 内部签名方法
5. ✅ **良好组织**: 清晰的目录结构和文档
6. ✅ **易于使用**: 简洁的 API 和丰富的示例

现在您有了一个完整、专业的 ZKPay 客户端库，可以轻松集成到任何项目中！
