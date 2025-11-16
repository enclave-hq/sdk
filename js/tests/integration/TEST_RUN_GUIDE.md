# E2E 测试运行指南

## 前置条件

### 1. 确保服务已启动

```bash
# 检查 BlockScanner 是否运行
ps aux | grep blockscanner

# 检查 Backend 是否运行
curl http://localhost:3001/ping
# 应该返回: {"message":"pong"}
```

### 2. 设置环境变量

```bash
# 必须设置：用于签名和认证的私钥
export PRIVATE_KEY="your-private-key-here"

# 可选：如果 backend 不在 localhost:3001
export API_URL="http://localhost:3001"
export WS_URL="ws://localhost:3001/ws"
```

### 3. 安装依赖（如果还没有）

```bash
cd /Users/qizhongzhu/enclave/sdk/js
npm install
```

## 运行测试

### 方式 1: 运行单个测试文件

```bash
cd /Users/qizhongzhu/enclave/sdk/js

# 设置环境变量
export PRIVATE_KEY="your-private-key-here"
export API_URL="http://localhost:3001"
export WS_URL="ws://localhost:3001/ws"

# 运行测试
npm test -- tests/integration/deposit-commitment-withdraw.test.ts
```

### 方式 2: 使用 vitest 直接运行

```bash
cd /Users/qizhongzhu/enclave/sdk/js

# 设置环境变量
export PRIVATE_KEY="your-private-key-here"

# 运行测试
npx vitest tests/integration/deposit-commitment-withdraw.test.ts
```

### 方式 3: 使用 vitest UI（推荐用于调试）

```bash
cd /Users/qizhongzhu/enclave/sdk/js

# 设置环境变量
export PRIVATE_KEY="your-private-key-here"

# 启动 UI
npm run test:ui

# 然后在浏览器中选择要运行的测试
```

## 测试流程说明

测试将执行以下步骤：

1. **初始化 SDK 客户端**
   - 连接到 Backend API
   - 连接到 WebSocket
   - 获取用户地址和 Treasury 地址

2. **创建 Checkbook（模拟存款）**
   - 通过 `POST /api/checkbooks` 创建 checkbook
   - 等待状态变为 `ready_for_commitment` 或 `with_checkbook`

3. **创建 Commitment（分配）**
   - 将 2 USDT 分成 4 份（每份 0.5 USDT）
   - 创建 4 个 allocations

4. **等待 Allocations 就绪**
   - 等待所有 allocations 状态变为 `idle`

5. **创建 Withdraw 请求**
   - 使用所有 4 个 allocations 创建 withdraw 请求
   - 验证 withdraw 请求的详细信息

## 注意事项

1. **私钥安全**: 不要将真实的私钥提交到代码仓库
   - 使用测试环境的私钥
   - 或使用环境变量文件（`.env`）

2. **测试超时**: 测试设置了 5 分钟超时（300000ms）
   - 如果测试运行时间较长，可能需要调整超时时间

3. **数据库状态**: 测试会在数据库中创建真实数据
   - 建议在测试数据库中运行
   - 或定期清理测试数据

4. **网络要求**: 
   - Backend 必须在运行
   - WebSocket 连接必须可用
   - 如果使用真实链，需要 RPC 连接

## 故障排除

### 错误: PRIVATE_KEY not set
```bash
export PRIVATE_KEY="your-private-key"
```

### 错误: Connection refused
- 检查 Backend 是否在运行: `curl http://localhost:3001/ping`
- 检查端口是否正确

### 错误: WebSocket connection failed
- 检查 WS_URL 是否正确
- 检查 Backend WebSocket 是否启用

### 错误: API endpoint not found
- 确保 Backend 已重新启动（如果刚刚添加了端点）
- 检查路由配置

## 测试配置

测试使用的默认配置：
- **Chain ID**: 714 (BSC)
- **Token ID**: 1 (USDT)
- **Deposit Amount**: 2 USDT (2000000, 6 decimals)
- **Allocation Count**: 4 (分成 4 份)

可以在测试文件中修改 `TEST_CONFIG` 来调整这些值。

