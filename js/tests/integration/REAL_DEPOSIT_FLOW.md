# 真实存款流程说明

## 真实流程 vs 测试流程

### 真实流程（生产环境）

```
1. 用户调用链上合约
   ↓
   Treasury.deposit(tokenAddress, amount, promoteCode)
   ↓
2. 合约发出事件
   ↓
   DepositReceived(depositor, token, amount, localDepositId, chainId)
   ↓
3. BlockScanner 监听事件
   ↓
   检测到 DepositReceived 事件
   ↓
4. BlockScanner 通过 NATS 发送事件
   ↓
   NATS Subject: zkpay.blockchain.bsc.enclave_treasury.DepositReceived
   ↓
5. Backend 接收事件
   ↓
   BlockchainEventProcessor 处理事件
   ↓
6. Backend 自动创建 Checkbook
   ↓
   状态: pending → unsigned → ready_for_commitment
   ↓
7. 通过 WebSocket 推送更新
   ↓
   客户端收到 checkbook 创建通知
```

### 测试流程（当前实现）

```
1. 直接通过 API 创建 Checkbook
   ↓
   POST /api/checkbooks
   ↓
2. Backend 创建 Checkbook 记录
   ↓
   状态: pending
   ↓
3. 继续后续流程（commitment, withdraw）
```

## 为什么测试中跳过了链上存款？

1. **简化测试**: 不需要真实的链上交易，避免：
   - 需要测试代币余额
   - 需要支付 gas 费用
   - 需要等待区块确认
   - 需要配置 RPC 连接

2. **快速迭代**: 可以快速测试后续流程（commitment, withdraw）

3. **隔离测试**: 专注于测试 SDK 的 API 调用和状态管理

## 如何测试真实流程？

如果你想测试完整的真实流程，可以：

### 选项 1: 使用 SDK 的合约调用功能

```typescript
// 1. 获取 Treasury 地址
const treasuryAddress = await client.chainConfig.getTreasuryAddress(chainId);

// 2. 获取 Token 地址
const tokenAddress = '0x...'; // USDT 地址

// 3. 先授权 Token
await client.contractProvider.writeContract(
  tokenAddress,
  ERC20_ABI,
  'approve',
  [treasuryAddress, amount]
);

// 4. 调用 Treasury.deposit
const txHash = await client.contractProvider.writeContract(
  treasuryAddress,
  TREASURY_ABI,
  'deposit',
  [tokenAddress, amount, '0x000000'] // promoteCode
);

// 5. 等待交易确认
await client.contractProvider.waitForTransaction(txHash, 1);

// 6. 等待 Backend 创建 Checkbook（通过 WebSocket 或轮询）
// Backend 会在收到 DepositReceived 事件后自动创建
```

### 选项 2: 使用测试网络

```typescript
// 在测试网络上运行完整流程
// 1. 使用测试 RPC (如 BSC Testnet)
// 2. 使用测试代币
// 3. 调用真实的合约方法
// 4. 等待 BlockScanner 检测事件
// 5. 验证 Backend 自动创建 Checkbook
```

## Treasury.deposit 方法签名

```solidity
function deposit(
    address tokenAddress,
    uint256 amount,
    bytes6 promoteCode
) external notPaused
```

**参数**:
- `tokenAddress`: 代币合约地址（如 USDT）
- `amount`: 存款金额（原始单位，如 6 decimals 的 USDT）
- `promoteCode`: 推广码（6 bytes，可选，默认 `0x000000`）

**事件**:
```solidity
event DepositReceived(
    address indexed depositor,
    address indexed token,
    uint256 amount,
    uint64 indexed localDepositId,
    uint32 chainId
);
```

## 当前测试的改进建议

可以在测试中添加一个选项来选择测试模式：

```typescript
const TEST_MODE = process.env.TEST_MODE || 'api'; // 'api' | 'real'

if (TEST_MODE === 'real') {
  // 真实流程：调用合约
  await callTreasuryDeposit();
  await waitForCheckbookCreation();
} else {
  // 简化流程：直接 API 创建
  await createCheckbookViaAPI();
}
```

这样可以：
- 默认使用快速测试（API 模式）
- 需要时切换到真实流程测试（real 模式）


