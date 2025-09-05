# ZKPay 端到端自动化测试工具

## 🎯 功能概述

这是一个完整的 ZKPay 端到端自动化测试工具，能够从给定私钥开始，自动执行从 Token Approve、Deposit 到 Commitment 生成、Withdraw 的完整流程。

### 核心功能

1. **钱包管理** - 自动管理测试用户的私钥和多链钱包连接
2. **存款流程** - 自动执行 Token 授权和存款操作
3. **Commitment 流程** - 自动生成隐私证明和提交承诺
4. **提现流程** - 自动生成提现证明和执行跨链提现
5. **端到端测试** - 完整的工作流程自动化测试
6. **压力测试** - 多用户并发测试支持
7. **结果验证** - 自动验证交易结果和余额变化

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Wallet Manager │    │ Deposit Manager │    │Commitment Mgr   │
│                 │    │                 │    │                 │
│ • 私钥管理       │    │ • Token授权      │    │ • 证明生成       │
│ • 多链连接       │    │ • 存款执行       │    │ • 承诺提交       │
│ • 余额检查       │    │ • 事件监听       │    │ • 状态监控       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
              ┌─────────────────────────────────────┐
              │           E2E Test Engine          │
              │                                     │
              │ • 测试编排                           │
              │ • 结果记录                           │
              │ • 错误处理                           │
              │ • 报告生成                           │
              └─────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Withdraw Manager│    │   Logger System │    │Environment Check│
│                 │    │                 │    │                 │
│ • 提现证明       │    │ • 结构化日志     │    │ • 配置验证       │
│ • 跨链执行       │    │ • 测试结果       │    │ • 网络检查       │
│ • 交易验证       │    │ • 错误追踪       │    │ • 服务检查       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆到e2e-automation目录
cd /Users/qizhongzhu/zkpay/e2e-automation

# 安装依赖
npm install

# 检查环境
npm run check-env
```

### 2. 配置设置

复制并编辑环境变量配置：

```bash
cp env.example .env
# 编辑 .env 文件，设置你的私钥和RPC URL
```

编辑 `config.yaml` 文件，根据你的测试环境调整配置。

### 3. 运行测试

#### 基础端到端测试

```bash
# 运行完整的E2E测试
npm test

# 或使用node直接运行
node zkpay-e2e-test.js
```

#### 自定义测试参数

```bash
# 指定测试用户和金额
node zkpay-e2e-test.js --user default --amount 5.0 --token usdt

# 指定源链和目标链
node zkpay-e2e-test.js --source-chain 31337 --target-chain 97

# 跳过某些阶段
node zkpay-e2e-test.js --skip-deposit  # 只测试Commitment和Withdraw
node zkpay-e2e-test.js --skip-withdraw # 只测试Deposit和Commitment
```

#### 压力测试

```bash
# 运行压力测试 (2个用户，每用户3笔交易)
node zkpay-e2e-test.js --stress-test --concurrent-users 2 --tx-per-user 3
```

#### 乱序提现测试

```bash
# 运行乱序提现测试 (创建3个commitment，按2,0,1顺序提现)
node zkpay-e2e-test.js --out-of-order-test --commitment-count 3 --withdraw-order 2,0,1

# 自定义乱序测试
node zkpay-e2e-test.js --out-of-order-test --commitment-count 5 --withdraw-order 4,1,0,3,2
```

## 📋 详细用法

### 命令行选项

| 选项                       | 描述             | 默认值        |
| -------------------------- | ---------------- | ------------- |
| `-c, --config <file>`      | 配置文件路径     | `config.yaml` |
| `-u, --user <name>`        | 测试用户名       | `default`     |
| `-s, --source-chain <id>`  | 源链 ID          | `31337`       |
| `-t, --target-chain <id>`  | 目标链 ID        | `97`          |
| `--token <symbol>`         | Token 符号       | `usdt`        |
| `-a, --amount <amount>`    | 测试金额         | `10.0`        |
| `--skip-deposit`           | 跳过存款阶段     | false         |
| `--skip-withdraw`          | 跳过提现阶段     | false         |
| `--stress-test`            | 运行压力测试     | false         |
| `--out-of-order-test`      | 运行乱序提现测试 | false         |
| `--concurrent-users <num>` | 并发用户数       | `2`           |
| `--tx-per-user <num>`      | 每用户交易数     | `3`           |
| `--commitment-count <num>` | Commitment 数量  | `5`           |
| `--withdraw-order <order>` | 提现顺序         | `4,1,0,3,2`   |

### 测试流程说明

#### 1. 存款阶段 (Deposit Phase)

- ✅ 检查 Token 余额
- ✅ 授权 Token 给 Treasury 合约
- ✅ 执行存款交易
- ✅ 监听存款事件
- ✅ 记录存款 ID 和相关信息

#### 2. Commitment 阶段 (Commitment Phase)

- ✅ 创建存款记录到后端
- ✅ 生成隐私证明 (零知识证明)
- ✅ 提交 Commitment 到管理链
- ✅ 等待区块链确认
- ✅ 监控状态变化

#### 3. 提现阶段 (Withdraw Phase)

- ✅ 创建 Check (提现凭证)
- ✅ 生成提现证明
- ✅ 执行跨链提现
- ✅ 验证目标链交易
- ✅ 检查余额变化

### 支持的测试场景

1. **单用户完整流程** - 测试一个用户的完整 ZKPay 使用流程
2. **多用户并发测试** - 测试系统在多用户并发使用时的稳定性
3. **跨链测试** - 测试不同链之间的资金转移
4. **乱序提现测试** - 创建多个 commitment，然后不按顺序执行 withdraw，验证隐私和安全性
5. **BSC 主网功能测试** - 验证所有功能在 BSC 主网环境中的完整性
6. **失败恢复测试** - 测试系统在失败情况下的恢复能力
7. **性能压力测试** - 测试系统的性能极限

## 🔗 支持的区块链网络

### 生产网络

**BSC Mainnet** - 生产主网

- Chain ID: 56
- RPC: https://bsc-dataseed1.binance.org
- 真实的 Gas 费用和网络环境
- 完整的 EVM 兼容性
- 生产级别的性能和稳定性

### 网络特点

- **真实环境**: 使用真实的 BSC 主网进行测试
- **Gas 费用**: 需要真实的 BNB 支付 Gas 费用
- **高可靠性**: 生产级别的网络稳定性
- **完整功能**: 验证所有功能在真实环境中的表现

## 📊 测试结果

### 日志输出

测试过程中的所有信息都会输出到：

- 控制台 (实时显示)
- 日志文件 `e2e-test.log`
- 测试结果文件 `test-results-<timestamp>.json`

### 结果分析

测试完成后会生成详细的结果报告，包括：

```json
{
  "totalTests": 1,
  "completedTests": 1,
  "failedTests": 0,
  "successRate": "100.00",
  "totalDuration": 45000,
  "avgDuration": "45000.00",
  "results": [
    {
      "name": "FullE2ETest",
      "status": "completed",
      "duration": 45000,
      "steps": [
        { "name": "存款流程完成", "status": "completed" },
        { "name": "Commitment流程完成", "status": "completed" },
        { "name": "提现流程完成", "status": "completed" }
      ],
      "metadata": {
        "userAddress": "0x...",
        "sourceChainId": 31337,
        "targetChainId": 97,
        "tokenSymbol": "usdt",
        "amount": "10.0"
      }
    }
  ]
}
```

## ⚙️ 配置说明

### 环境变量配置

必须设置的环境变量：

```bash
# 测试用户私钥
export TEST_USER_PRIVATE_KEY="0x..."

# BSC Testnet RPC
export BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545"

# ZKPay后端服务
export ZKPAY_BACKEND_URL="http://localhost:3001"
```

### 配置文件说明

`config.yaml` 文件包含了测试的所有配置项：

- **environment** - 测试环境信息
- **services** - 后端服务配置
- **blockchain** - 区块链网络配置
- **test_users** - 测试用户配置
- **test_config** - 测试参数配置
- **logging** - 日志配置

## 🔧 故障排除

### 常见问题

1. **私钥格式错误**

   ```bash
   # 确保私钥格式正确 (64位十六进制，带0x前缀)
   export TEST_USER_PRIVATE_KEY="0x1234567890abcdef..."
   ```

2. **网络连接失败**

   ```bash
   # 检查RPC URL是否可访问
   curl -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        $BSC_TESTNET_RPC
   ```

3. **余额不足**

   ```bash
   # 确保测试账户有足够的BNB和测试Token
   # BSC Testnet可以通过水龙头获取测试币
   ```

4. **服务不可用**
   ```bash
   # 检查ZKPay后端服务是否运行
   curl $ZKPAY_BACKEND_URL/health
   ```

### 调试模式

启用详细日志：

```bash
# 设置日志级别为debug
export LOG_LEVEL=debug
node zkpay-e2e-test.js
```

## 🔐 安全注意事项

1. **私钥安全**

   - 仅使用测试网络的私钥
   - 不要在生产环境中使用真实私钥
   - 不要将私钥提交到代码仓库

2. **网络安全**

   - 使用可信的 RPC 端点
   - 在公共网络上运行时注意网络安全

3. **测试数据**
   - 所有测试仅使用测试网络
   - 测试 Token 没有实际价值

## 📝 开发指南

### 添加新的测试场景

1. 在 `zkpay-e2e-test.js` 中添加新的测试方法
2. 在配置文件中添加相应的参数
3. 在命令行接口中添加新的选项

### 扩展管理器功能

每个管理器都是独立的模块，可以单独扩展：

- `zkpay-wallet-manager.js` - 钱包和私钥管理
- `zkpay-deposit-manager.js` - 存款和 Token 操作
- `zkpay-commitment-manager.js` - 隐私证明和承诺
- `zkpay-withdraw-manager.js` - 提现和跨链操作

## 📈 性能优化

### 并发优化

- 使用连接池管理 RPC 连接
- 合理设置交易之间的延迟
- 避免 nonce 冲突

### 错误处理

- 自动重试机制
- 优雅的错误恢复
- 详细的错误日志

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🆘 支持

如有问题或建议，请：

1. 查看故障排除部分
2. 检查日志文件
3. 提交 Issue 或联系开发团队
