# Enclave SDK 概览

**Languages**: [English](./SDK_OVERVIEW.md) | 中文 | [日本語](./SDK_OVERVIEW.ja.md) | [한국어](./SDK_OVERVIEW.ko.md)

## 🎯 概述

Enclave SDK 是一套多语言的客户端库，用于与 Enclave 隐私保护多链 DeFi 协议进行交互。SDK 提供了统一、易用的 API，支持存款、Commitment 创建、提现等完整的业务流程。

## 🏗️ 架构设计

### 核心理念

**从命令式到响应式**：Enclave SDK v2.0 采用全新的响应式架构，基于 Store 模式和 WebSocket 实时同步，让开发者无需关心数据轮询和状态管理。

```
传统命令式 API                响应式 Store 驱动
┌─────────────────┐          ┌─────────────────┐
│ 调用 API        │          │ 连接一次        │
│ 等待返回        │   ═══>   │ Store 自动更新  │
│ 手动更新 UI     │          │ UI 自动响应     │
│ 需要轮询        │          │ WebSocket 推送  │
└─────────────────┘          └─────────────────┘
```

### 技术栈

| 组件 | 技术选型 | 原因 |
|------|---------|------|
| **状态管理** | MobX | 响应式、自动依赖追踪、框架无关 |
| **实时通信** | WebSocket | 基于后端 WebSocket API，支持订阅机制 |
| **区块链交互** | ethers.js v6 | 成熟稳定、TypeScript 支持好 |
| **HTTP 客户端** | axios | 拦截器、取消请求、超时控制 |
| **类型系统** | TypeScript | 类型安全、IDE 支持好 |
| **构建工具** | tsup | 快速、支持多格式输出 |

## 🌍 多语言支持

### 语言矩阵

```
enclave/sdk/
├── js/          JavaScript/TypeScript SDK (v2.0) ✅ 进行中
├── go/          Go SDK (计划中)
├── python/      Python SDK (计划中)
└── rust/        Rust SDK (计划中)
```

### JavaScript SDK 特性

- ✅ **环境通用**：支持浏览器、Node.js、React Native、Electron
- ✅ **框架集成**：React、Vue、Next.js、Svelte 等
- ✅ **TypeScript**：完整的类型定义和推断
- ✅ **Tree-shakable**：按需加载，减小包体积
- ✅ **响应式**：基于 MobX 的自动状态管理

### Go SDK (未来)

- 高性能后端服务集成
- gRPC 支持
- 并发友好
- 适用于 Go 微服务架构

### Python SDK (未来)

- 数据分析和脚本
- Flask/Django 后端集成
- Jupyter Notebook 支持
- 机器学习场景

## 📊 架构图

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     应用层 (Application)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Frontend │  │ Mobile App   │  │ Backend API  │      │
│  │ (React/Vue)  │  │ (React Native)│  │ (Next.js)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ EnclaveClient
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enclave SDK (核心层)                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    EnclaveClient                      │  │
│  │  - connect() / disconnect()                          │  │
│  │  - deposit() / withdraw()                            │  │
│  │  - 事件发射器                                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────┬──────────┴──────────┬──────────────────┐  │
│  │             │                     │                  │  │
│  ▼             ▼                     ▼                  ▼  │
│  ┌──────┐  ┌────────┐  ┌─────────┐  ┌──────────────┐     │
│  │Stores│  │  API   │  │WebSocket│  │  Blockchain  │     │
│  │(MobX)│  │ Client │  │ Manager │  │    Wallet    │     │
│  └──────┘  └────────┘  └─────────┘  └──────────────┘     │
│     │          │             │               │             │
│     │          │             │               │             │
│     ▼          ▼             ▼               ▼             │
│  [响应式]   [REST API]   [实时推送]     [链上交互]         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Enclave 后端服务                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │   Database   │      │
│  │  (Go Gin)    │  │  (订阅推送)   │  │ (PostgreSQL) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    区块链网络层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   BSC    │  │ zkSync   │  │ Ethereum │  │   ...    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### JavaScript SDK 内部架构

```
EnclaveClient
    │
    ├── StoreManager (状态管理)
    │   ├── DepositsStore      (存款状态)
    │   ├── CheckbooksStore    (Checkbook 状态)
    │   ├── WithdrawalsStore   (提现状态)
    │   ├── PricesStore        (价格状态)
    │   ├── PoolsStore         (Pool/Token 状态)
    │   └── UserStore          (用户状态)
    │
    ├── ConnectionManager (连接管理)
    │   ├── WebSocketClient    (WebSocket 连接)
    │   ├── SubscriptionManager (订阅管理)
    │   └── MessageHandler     (消息处理)
    │
    ├── APIClient (REST API)
    │   ├── AuthAPI            (认证)
    │   ├── DepositsAPI        (存款)
    │   ├── CheckbooksAPI      (Checkbook)
    │   ├── WithdrawalsAPI     (提现)
    │   ├── PoolsAPI           (Pool/Token)
    │   └── KMSAPI             (KMS)
    │
    ├── WalletManager (钱包管理)
    │   ├── SignerAdapter      (签名适配器)
    │   └── ContractManager    (合约交互)
    │
    ├── ActionManager (业务操作)
    │   ├── DepositAction      (存款流程)
    │   ├── CommitmentAction   (Commitment 流程)
    │   └── WithdrawalAction   (提现流程)
    │
    └── Adapters (环境适配)
        ├── WebSocketAdapter   (WS 适配: Browser/Node)
        └── StorageAdapter     (存储适配: LocalStorage/FS)
```

## 🎯 使用场景

### 场景 1: Web 前端应用

**技术栈**：React + Next.js + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';

// 创建全局客户端实例
const client = new EnclaveClient({
  apiUrl: process.env.NEXT_PUBLIC_ENCLAVE_API, // e.g., https://api.enclave-hq.com
});

await client.connect(privateKey);

// 组件自动响应 Store 变化
const DepositsView = observer(() => {
  const { deposits } = client.stores;
  
  return (
    <div>
      <h1>我的存款 ({deposits.count})</h1>
      <p>总金额: {deposits.totalAmount.toString()}</p>
      {deposits.all.map(d => (
        <DepositCard key={d.id} deposit={d} />
      ))}
    </div>
  );
});
```

**优势**：
- ✅ 实时更新（WebSocket）
- ✅ 无需手动状态管理
- ✅ TypeScript 类型安全
- ✅ 自动优化渲染性能

### 场景 2: Node.js 后端服务

**技术栈**：Next.js API Routes / Express / Nest.js

```typescript
// app/api/deposits/route.ts
import { EnclaveClient } from '@enclave-hq/sdk';

// 服务端单例实例
const serverClient = new EnclaveClient({
  apiUrl: process.env.ENCLAVE_API_URL,
  storage: 'filesystem', // 使用文件系统存储
});

await serverClient.connect(process.env.SERVER_PRIVATE_KEY);

export async function GET(request: Request) {
  // 直接从 Store 读取（WebSocket 实时同步）
  const deposits = serverClient.stores.deposits.all;
  
  return Response.json({
    deposits,
    total: serverClient.stores.deposits.totalAmount.toString(),
  });
}

export async function POST(request: Request) {
  const { chainId, tokenAddress, amount } = await request.json();
  
  // 执行存款操作
  const result = await serverClient.deposit({
    chainId,
    tokenAddress,
    amount,
  });
  
  return Response.json(result);
}
```

**优势**：
- ✅ 服务端长连接复用
- ✅ 自动数据同步
- ✅ 减少 API 调用次数
- ✅ 适用于微服务架构

### 场景 3: React Native 移动应用

**技术栈**：React Native + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';
import { View, Text, FlatList } from 'react-native';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 使用生物识别或安全存储获取私钥
const privateKey = await SecureStore.getItemAsync('private_key');
await client.connect(privateKey);

const DepositsScreen = observer(() => {
  const { deposits } = client.stores;
  
  return (
    <View>
      <Text>我的存款 ({deposits.count})</Text>
      <FlatList
        data={deposits.all}
        renderItem={({ item }) => <DepositCard deposit={item} />}
        keyExtractor={item => item.id}
      />
    </View>
  );
});
```

**优势**：
- ✅ 跨平台（iOS + Android）
- ✅ 离线支持（Store 持久化）
- ✅ 实时推送
- ✅ 原生性能

### 场景 4: 数据分析和监控

**技术栈**：Node.js + TypeScript（脚本/定时任务）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: process.env.ENCLAVE_API_URL,
});

await client.connect(process.env.MONITOR_PRIVATE_KEY);

// 监听所有存款事件
client.stores.deposits.on('added', (deposit) => {
  console.log(`[新存款] ${deposit.amount} 来自 ${deposit.depositor}`);
  
  // 发送告警到 Slack/Discord
  await sendAlert({
    type: 'new_deposit',
    data: deposit,
  });
});

// 监听价格变化
client.stores.prices.on('updated', (price) => {
  if (Math.abs(parseFloat(price.change_24h)) > 10) {
    console.log(`[价格剧烈波动] ${price.symbol}: ${price.change_24h}%`);
  }
});

// 生成统计报告
setInterval(() => {
  const stats = {
    totalDeposits: client.stores.deposits.count,
    totalAmount: client.stores.deposits.totalAmount.toString(),
    activeCheckbooks: client.stores.checkbooks.count,
    pendingWithdrawals: client.stores.withdrawals.getByStatus('pending').length,
  };
  
  console.log('统计报告:', stats);
  await saveToDatabase(stats);
}, 60000); // 每分钟
```

**优势**：
- ✅ 实时监控
- ✅ 事件驱动
- ✅ 易于集成告警系统
- ✅ 自动统计和报表

### 场景 5: DApp 集成

**技术栈**：Vanilla JS + Web3

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { ethers } from 'ethers';

// 使用 MetaMask
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 使用 MetaMask 签名器
await client.connect(signer);

// 简单的存款按钮
document.getElementById('deposit-btn').addEventListener('click', async () => {
  const amount = document.getElementById('amount').value;
  
  try {
    const result = await client.deposit({
      chainId: 714, // BSC
      tokenAddress: '0x...',
      amount: ethers.parseUnits(amount, 6).toString(),
    });
    
    alert('存款成功！');
  } catch (error) {
    alert('存款失败：' + error.message);
  }
});

// 实时显示余额
client.stores.deposits.on('change', () => {
  const total = client.stores.deposits.totalAmount;
  document.getElementById('balance').textContent = 
    ethers.formatUnits(total, 6);
});
```

**优势**：
- ✅ 与 MetaMask 等钱包无缝集成
- ✅ 无需复杂的状态管理
- ✅ 适用于任何 JavaScript 框架
- ✅ 轻量级集成

## 🔄 数据流

### 存款流程

```
用户操作
    │
    ├─> client.deposit(params)
    │       │
    │       ├─> 1. 钱包签名 Approve
    │       ├─> 2. 发送链上交易
    │       ├─> 3. 等待交易确认
    │       └─> 4. 通知后端
    │
    ▼
后端检测
    │
    ├─> BlockScanner 检测到存款事件
    │       │
    │       └─> 创建 Deposit 记录
    │
    ▼
WebSocket 推送
    │
    ├─> 后端推送 deposit_update 消息
    │       │
    │       └─> SDK 收到消息
    │
    ▼
Store 更新
    │
    ├─> DepositsStore.upsert(deposit)
    │       │
    │       └─> 触发 'change' 事件
    │
    ▼
UI 自动更新
    │
    └─> React/Vue 组件自动重新渲染
```

### 价格订阅流程

```
初始化
    │
    ├─> client.connect(privateKey)
    │       │
    │       └─> WebSocket 连接建立
    │
    ▼
订阅价格
    │
    ├─> client.subscribePrices(['0x...'])
    │       │
    │       └─> 发送订阅消息到后端
    │
    ▼
定时推送
    │
    ├─> 后端每分钟推送价格更新
    │       │
    │       └─> SDK 收到 price_update 消息
    │
    ▼
Store 更新
    │
    ├─> PricesStore.updatePrice(...)
    │       │
    │       └─> 自动触发依赖更新
    │
    ▼
UI 响应
    │
    └─> 价格图表/列表自动刷新
```

## 📦 包结构

### npm 包发布

```bash
@enclave-hq/sdk
├── dist/
│   ├── index.js         # CommonJS
│   ├── index.mjs        # ES Module
│   ├── index.d.ts       # TypeScript 定义
│   ├── react.js         # React 集成
│   ├── vue.js           # Vue 集成
│   └── nextjs.js        # Next.js 工具
├── package.json
└── README.md
```

### 按需导入

```typescript
// 核心客户端
import { EnclaveClient } from '@enclave-hq/sdk';

// React Hooks
import { useEnclave, useEnclaveDeposits } from '@enclave-hq/sdk/react';

// Next.js 工具
import { createServerClient } from '@enclave-hq/sdk/nextjs';

// Vue Composables
import { useEnclave } from '@enclave-hq/sdk/vue';
```

## 🔐 安全考虑

### 私钥管理

- ✅ **浏览器端**：使用 MetaMask 等钱包，不存储私钥
- ✅ **Node.js 端**：使用环境变量或 KMS
- ✅ **移动端**：使用设备安全存储（SecureStore）
- ❌ **永远不要**：在代码中硬编码私钥

### WebSocket 安全

- ✅ JWT Token 认证
- ✅ 自动重连和令牌刷新
- ✅ 消息签名验证
- ✅ Rate limiting

### 数据验证

- ✅ 所有输入参数验证
- ✅ 金额范围检查
- ✅ 地址格式验证
- ✅ ChainID 映射验证

## 🚀 性能优化

### Store 优化

- ✅ **Computed Values**：自动缓存计算结果
- ✅ **精确更新**：只更新变化的部分
- ✅ **批量操作**：合并多次更新
- ✅ **懒加载**：按需加载数据

### WebSocket 优化

- ✅ **消息队列**：缓冲高频消息
- ✅ **自动重连**：断线重连机制
- ✅ **心跳检测**：保持连接活跃
- ✅ **订阅管理**：智能订阅/取消订阅

### 包大小优化

- ✅ **Tree-shaking**：未使用的代码不打包
- ✅ **代码分割**：React/Vue 集成按需加载
- ✅ **压缩**：gzip + brotli
- ✅ **依赖优化**：最小化外部依赖

| 模块 | 大小 (gzipped) |
|------|----------------|
| 核心 SDK | ~40KB |
| React 集成 | +5KB |
| Vue 集成 | +5KB |
| Next.js 工具 | +3KB |

## 📚 相关文档

- [JavaScript SDK 设计文档](./SDK_JS_DESIGN.md) - 详细技术设计
- [API 映射文档](./SDK_API_MAPPING.md) - SDK API 与后端 API 对应关系
- [后端 API 文档](../backend/API_DOCUMENTATION.md) - 后端 REST API 参考
- [WebSocket 集成文档](../backend/WEBSOCKET_INTEGRATION.md) - WebSocket 协议说明
- [存款提现流程](./DEPOSIT_WITHDRAW_FLOW.md) - 完整业务流程
- [Intent 设计文档](./INTENT_DESIGN.md) - Intent 系统设计

## 🛣️ Roadmap

### Phase 1: JavaScript SDK v2.0 (进行中)

- [x] 架构设计
- [ ] 核心实现
  - [ ] Store 层
  - [ ] API 层
  - [ ] WebSocket 层
  - [ ] 主客户端
- [ ] 平台集成
  - [ ] React
  - [ ] Next.js
  - [ ] Vue (可选)
- [ ] 文档和示例
- [ ] 测试覆盖
- [ ] npm 发布

### Phase 2: Go SDK (计划中)

- [ ] 架构设计
- [ ] 核心实现
- [ ] gRPC 支持
- [ ] 示例和文档
- [ ] 发布到 pkg.go.dev

### Phase 3: Python SDK (计划中)

- [ ] 架构设计
- [ ] 核心实现
- [ ] Flask/Django 集成
- [ ] 示例和文档
- [ ] 发布到 PyPI

### Phase 4: Rust SDK (计划中)

- [ ] 架构设计
- [ ] 核心实现
- [ ] WASM 支持
- [ ] 示例和文档
- [ ] 发布到 crates.io

## 📞 支持

- GitHub Issues: https://github.com/enclave-hq/enclave/issues
- Documentation: https://docs.enclave-hq.com
- Discord: https://discord.gg/enclave

---

**版本**: v2.0.0-alpha  
**最后更新**: 2025-01-17  
**维护者**: Enclave Team

