# ZKPay Client Library 示例和测试

本目录包含了 ZKPay Client Library 的各种使用示例和测试代码。

## 📁 文件说明

### 🌟 **主要示例**

- **`zkpay-client-example.js`** - 完整的使用示例，展示 8 个不同的使用场景
- **`async-usage-example.js`** - 异步方法使用示例，展示如何使用 await 调用异步方法

### 🧪 **测试文件**

- **`quick-client-library-test.js`** - 快速功能验证测试，包含完整的 E2E 流程
- **`test-async-features.js`** - 异步功能测试，演示异步方法的各种使用方式

### 🚀 **运行脚本和配置**

- **`run-client-library-test.sh`** - 运行测试的 shell 脚本
- **`config.yaml`** - 配置文件（包含 API 地址、测试用户、链信息等）
- **`logger.js`** - 日志管理器（提供统一的日志记录功能）

## 🔧 使用方法

### 1. 运行完整功能测试

```bash
cd zkpay-client-library/examples
chmod +x run-client-library-test.sh
./run-client-library-test.sh functional
```

### 2. 运行快速测试

```bash
cd zkpay-client-library/examples
./run-client-library-test.sh quick
```

### 3. 运行异步功能测试

```bash
cd zkpay-client-library/examples
node test-async-features.js
```

### 4. 运行主要示例

```bash
cd zkpay-client-library/examples
node zkpay-client-example.js
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
├── README.md                    # 本文件
├── config.yaml                  # 配置文件
├── logger.js                    # 日志管理器
├── zkpay-client-example.js      # 完整使用示例
├── async-usage-example.js       # 异步方法示例
├── quick-client-library-test.js # 快速功能测试
├── test-async-features.js       # 异步功能测试
└── run-client-library-test.sh   # 运行脚本
```
