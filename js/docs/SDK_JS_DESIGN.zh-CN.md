# Enclave JavaScript SDK - 技术设计文档

**Languages**: [English](./SDK_JS_DESIGN.md) | 中文 | [日本語](./SDK_JS_DESIGN.ja.md) | [한국어](./SDK_JS_DESIGN.ko.md)

## 📋 目录

- [概述](#概述)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [核心模块设计](#核心模块设计)
- [签名器架构](#签名器架构)
- [数据格式化工具](#数据格式化工具)
- [类型系统](#类型系统)
- [Store 架构](#store-架构)
- [API 客户端](#api-客户端)
- [WebSocket 层](#websocket-层)
- [环境适配](#环境适配)
- [业务操作层](#业务操作层)
- [平台集成](#平台集成)
- [错误处理](#错误处理)
- [性能优化](#性能优化)
- [测试策略](#测试策略)

## 概述

Enclave JavaScript SDK v2.0 是基于 **响应式架构** 和 **MobX状态管理** 的全新 SDK，提供统一、易用的 API 用于与 Enclave 后端服务交互。

### 核心设计理念

1. **响应式优先**：基于 MobX，数据变化自动触发 UI 更新
2. **环境无关**：支持浏览器、Node.js、React Native 等所有 JS 运行环境
3. **TypeScript 优先**：完整的类型定义，提供优秀的开发体验
4. **实时同步**：WebSocket 自动推送更新，无需手动轮询
5. **简单易用**：一个 `connect()` 完成所有初始化

### 架构原则

- **单一职责**：每个模块只负责一个核心功能
- **依赖注入**：模块间通过接口通信，易于测试和替换
- **事件驱动**：使用 EventEmitter 进行模块间通信
- **防御式编程**：完善的错误处理和边界检查
- **性能优先**：懒加载、批量更新、精确渲染

## 技术栈

### 核心依赖

```json
{
  "dependencies": {
    "mobx": "^6.12.0",           // 响应式状态管理
    "ethers": "^6.10.0",         // 区块链交互
    "axios": "^1.6.0",           // HTTP 客户端
    "eventemitter3": "^5.0.1"    // 事件系统
  },
  "peerDependencies": {
    "ws": "^8.0.0",              // Node.js WebSocket (可选)
    "react": ">=16.8.0",         // React 集成 (可选)
    "vue": ">=3.0.0"             // Vue 集成 (可选)
  },
  "devDependencies": {
    "typescript": "^5.3.0",      // TypeScript
    "tsup": "^8.0.0",            // 构建工具
    "vitest": "^1.0.0",          // 测试框架
    "eslint": "^8.56.0",         // 代码检查
    "prettier": "^3.1.0"         // 代码格式化
  }
}
```

### 为什么选择这些技术？

| 技术 | 原因 | 替代方案对比 |
|------|------|-------------|
| **MobX** | 响应式、自动依赖追踪、框架无关 | Redux (太重)、Zustand (功能少) |
| **ethers.js v6** | 成熟稳定、TypeScript 支持好 | web3.js (API 不够现代) |
| **axios** | 拦截器、取消请求、超时控制 | fetch (功能较少) |
| **tsup** | 快速、零配置、多格式输出 | webpack (配置复杂)、rollup (配置多) |
| **vitest** | 快速、兼容 Jest API、原生 ESM | Jest (较慢) |

## SDK 导出策略

SDK 采用清晰的导出策略，将核心类、状态枚举和类型定义导出供客户端使用：

```typescript
// src/index.ts - 主入口文件

// ============ 核心客户端 ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ 状态枚举（供客户端使用）============
export { 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from './types/models';

// ============ 数据模型类型 ============
export type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  WithdrawRequestDetail,
  UniversalAddress,
  TokenPrice,
  Pool,
  Token,
  User,
} from './types/models';

// ============ 配置类型 ============
export type {
  EnclaveConfig,
  SignerInput,
  ISigner,
  SignerCallback,
} from './types';
```

### 为什么导出状态枚举？

1. ✅ **类型安全**：TypeScript 在编译时检查状态值的正确性
2. ✅ **代码提示**：IDE 可以提供自动补全和文档
3. ✅ **可读性**：`CheckbookStatus.WithCheckbook` 比 `'with_checkbook'` 更清晰
4. ✅ **重构友好**：状态值改变时只需修改枚举定义，所有引用自动更新
5. ✅ **避免魔法字符串**：消除硬编码的字符串，减少错误

### 客户端使用示例

```typescript
import { 
  EnclaveClient, 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave-hq/sdk';

// 创建客户端
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 1. 使用枚举进行状态比较
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook 已激活，可以创建分配');
}

// 2. 使用枚举进行查询
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. 使用枚举进行条件判断
const withdrawal = client.stores.withdrawals.get(withdrawId);
switch (withdrawal.status) {
  case WithdrawRequestStatus.Pending:
    console.log('⏳ 提现处理中...');
    break;
  case WithdrawRequestStatus.Completed:
    console.log('✅ 提现已完成');
    break;
  case WithdrawRequestStatus.Failed:
    console.log('❌ 提现失败，可以重试');
    break;
}

// 4. 在 React UI 中使用枚举
function CheckbookStatusBadge({ status }: { status: CheckbookStatus }) {
  const config = {
    [CheckbookStatus.Pending]: { text: '处理中', color: 'blue' },
    [CheckbookStatus.ReadyForCommitment]: { text: '准备就绪', color: 'yellow' },
    [CheckbookStatus.WithCheckbook]: { text: '已激活', color: 'green' },
    [CheckbookStatus.ProofFailed]: { text: '证明失败', color: 'red' },
  };
  
  const { text, color } = config[status] || { text: '未知', color: 'gray' };
  return <Badge color={color}>{text}</Badge>;
}

// 5. 状态流转控制
function canCreateAllocation(checkbook: Checkbook): boolean {
  return checkbook.status === CheckbookStatus.WithCheckbook;
}

function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 6. TypeScript 类型安全
function processCheckbook(status: CheckbookStatus) {
  // TypeScript 会确保只能传入有效的 CheckbookStatus 值
}

// ❌ 错误：TypeScript 会报错
processCheckbook('invalid_status'); // Type 'string' is not assignable to type 'CheckbookStatus'

// ✅ 正确
processCheckbook(CheckbookStatus.Pending);
```

---

## 目录结构

```
sdk/js/
├── src/
│   ├── client/                      # 客户端核心
│   │   ├── EnclaveClient.ts         # 主客户端入口
│   │   └── ConnectionManager.ts     # 连接管理
│   │
│   ├── stores/                      # MobX Store 层
│   │   ├── BaseStore.ts             # Store 基类
│   │   ├── StoreManager.ts          # Store 管理器
│   │   ├── DepositsStore.ts         # 存款状态
│   │   ├── CheckbooksStore.ts       # Checkbook 状态
│   │   ├── WithdrawalsStore.ts      # 提现状态
│   │   ├── PricesStore.ts           # 价格状态
│   │   ├── PoolsStore.ts            # Pool/Token 状态
│   │   └── UserStore.ts             # 用户状态
│   │
│   ├── api/                         # REST API 层
│   │   ├── APIClient.ts             # HTTP 客户端基类
│   │   ├── AuthAPI.ts               # 认证 API
│   │   ├── DepositsAPI.ts           # 存款 API
│   │   ├── CheckbooksAPI.ts         # Checkbook API
│   │   ├── WithdrawalsAPI.ts        # 提现 API
│   │   ├── PoolsAPI.ts              # Pool/Token API
│   │   └── KMSAPI.ts                # KMS API
│   │
│   ├── websocket/                   # WebSocket 层
│   │   ├── WebSocketClient.ts       # WS 客户端
│   │   ├── SubscriptionManager.ts   # 订阅管理
│   │   ├── MessageHandler.ts        # 消息处理器
│   │   └── ReconnectionManager.ts   # 重连管理
│   │
│   ├── blockchain/                  # 区块链交互层
│   │   ├── WalletManager.ts         # 钱包管理
│   │   ├── SignerAdapter.ts         # 签名适配器
│   │   ├── ContractManager.ts       # 合约交互
│   │   └── TransactionBuilder.ts    # 交易构建
│   │
│   ├── actions/                     # 业务操作层
│   │   ├── ActionManager.ts         # 操作管理器
│   │   ├── DepositAction.ts         # 存款操作
│   │   ├── CommitmentAction.ts      # Commitment 操作
│   │   └── WithdrawalAction.ts      # 提现操作
│   │
│   ├── adapters/                    # 环境适配层
│   │   ├── websocket/
│   │   │   ├── IWebSocketAdapter.ts
│   │   │   ├── BrowserWebSocketAdapter.ts
│   │   │   └── NodeWebSocketAdapter.ts
│   │   └── storage/
│   │       ├── IStorageAdapter.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── FileStorageAdapter.ts
│   │
│   ├── platforms/                   # 平台特定集成
│   │   ├── react/
│   │   │   ├── hooks.ts             # React Hooks
│   │   │   ├── provider.tsx         # Context Provider
│   │   │   └── index.ts
│   │   ├── vue/
│   │   │   ├── composables.ts       # Vue Composables
│   │   │   ├── plugin.ts            # Vue Plugin
│   │   │   └── index.ts
│   │   └── nextjs/
│   │       ├── server.ts            # 服务端工具
│   │       ├── client.ts            # 客户端工具
│   │       └── index.ts
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── models.ts                # 数据模型
│   │   ├── api.ts                   # API 类型
│   │   ├── config.ts                # 配置类型
│   │   ├── events.ts                # 事件类型
│   │   ├── websocket.ts             # WebSocket 类型
│   │   └── index.ts
│   │
│   ├── utils/                       # 工具函数
│   │   ├── address.ts               # 地址格式化
│   │   ├── amount.ts                # 金额处理
│   │   ├── logger.ts                # 日志工具
│   │   ├── retry.ts                 # 重试机制
│   │   ├── validators.ts            # 数据验证
│   │   ├── environment.ts           # 环境检测
│   │   └── index.ts
│   │
│   └── index.ts                     # 主导出文件
│
├── examples/                        # 使用示例
│   ├── basic-usage.ts               # 基础使用
│   ├── react-app/                   # React 示例
│   ├── nextjs-app/                  # Next.js 示例
│   ├── nodejs-backend.ts            # Node.js 后端
│   └── kms-integration.ts           # KMS 集成
│
├── tests/                           # 测试
│   ├── unit/                        # 单元测试
│   │   ├── stores/
│   │   ├── api/
│   │   └── utils/
│   ├── integration/                 # 集成测试
│   └── e2e/                         # 端到端测试
│
├── docs/                            # 额外文档
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                   # 构建配置
├── vitest.config.ts                 # 测试配置
├── .eslintrc.js
├── .prettierrc
├── README.md
└── LICENSE
```

## 核心模块设计

### 1. EnclaveClient (主客户端)

```typescript
// src/client/EnclaveClient.ts

import { EventEmitter } from 'eventemitter3';
import { StoreManager } from '../stores/StoreManager';
import { APIClient } from '../api/APIClient';
import { ConnectionManager } from './ConnectionManager';
import { WalletManager } from '../blockchain/WalletManager';
import { ActionManager } from '../actions/ActionManager';
import type { EnclaveConfig, Signer } from '../types';

/**
 * Enclave SDK 主客户端
 * 
 * @example
 * ```typescript
 * const client = new EnclaveClient({
 *   apiUrl: 'https://api.enclave-hq.com',
 * });
 * 
 * await client.connect(privateKey);
 * const deposits = client.stores.deposits.all;
 * ```
 */
export class EnclaveClient extends EventEmitter {
  // Public API
  public readonly stores: StoreManager;
  public readonly config: EnclaveConfig;
  
  // Private modules
  private readonly api: APIClient;
  private readonly connection: ConnectionManager;
  private readonly wallet: WalletManager;
  private readonly actions: ActionManager;
  
  // State
  private authToken: string | null = null;
  private isConnected: boolean = false;
  private autoRefreshInterval: NodeJS.Timeout | null = null;

  constructor(config: EnclaveConfig) {
    super();
    
    // 验证配置
    this.config = this.validateConfig(config);
    
    // 初始化模块
    this.api = new APIClient(this.config);
    this.stores = new StoreManager(this.api);
    this.connection = new ConnectionManager(this.config, this.stores);
    this.wallet = new WalletManager(this.config);
    this.actions = new ActionManager(
      this.api,
      this.wallet,
      this.stores
    );
    
    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 连接到 Enclave
   * 
   * @param privateKeyOrSigner - 私钥字符串或 ethers Signer
   */
  async connect(privateKeyOrSigner: string | Signer): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    try {
      this.emit('connecting');
      
      // 1. 设置钱包签名器
      await this.wallet.setSigner(privateKeyOrSigner);
      const userAddress = await this.wallet.getAddress();
      
      // 2. 后端认证
      const authResult = await this.api.auth.login(
        userAddress,
        this.wallet
      );
      this.authToken = authResult.token;
      
      // 3. 更新用户 Store
      this.stores.user.setUser({
        address: userAddress,
        chainId: authResult.chainId,
        universalAddress: authResult.universalAddress,
        isAuthenticated: true,
      });
      
      // 4. 建立 WebSocket 连接
      await this.connection.connect(this.authToken);
      
      // 5. 初始数据同步
      await this.initialSync();
      
      this.isConnected = true;
      this.emit('connected', { userAddress });
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // 1. 关闭 WebSocket
      await this.connection.disconnect();
      
      // 2. 清空 Stores
      this.stores.clearAll();
      
      // 3. 清空状态
      this.authToken = null;
      this.isConnected = false;
      
      this.emit('disconnected');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Disconnect failed: ${error.message}`);
    }
  }

  /**
   * 存款操作
   */
  async deposit(params: DepositParams): Promise<DepositResult> {
    this.ensureConnected();
    return this.actions.deposit(params);
  }

  /**
   * 创建分配
   */
  async createAllocation(params: AllocationParams): Promise<CommitmentResult> {
    this.ensureConnected();
    return this.actions.createCommitment(params);
  }

  /**
   * 提现操作
   */
  async withdraw(params: WithdrawParams): Promise<WithdrawalResult> {
    this.ensureConnected();
    return this.actions.withdraw(params);
  }

  /**
   * 订阅价格更新
   */
  async subscribePrices(assetIds: string[]): Promise<void> {
    this.ensureConnected();
    await this.connection.subscribe('prices', { assetIds });
  }

  /**
   * 初始数据同步
   */
  private async initialSync(): Promise<void> {
    const syncTasks = [
      this.syncDeposits(),
      this.syncCheckbooks(),
      this.syncWithdrawals(),
      this.syncPools(),
    ];
    
    await Promise.allSettled(syncTasks);
  }

  private async syncDeposits(): Promise<void> {
    try {
      const deposits = await this.api.deposits.getByOwner();
      this.stores.deposits.upsertMany(deposits);
    } catch (error) {
      this.emit('sync:error', { type: 'deposits', error });
    }
  }

  private async syncCheckbooks(): Promise<void> {
    // 类似实现
  }

  private async syncWithdrawals(): Promise<void> {
    // 类似实现
  }

  private async syncPools(): Promise<void> {
    // 类似实现
  }

  private setupEventListeners(): void {
    // WebSocket 消息处理
    this.connection.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });

    // 重连成功后重新同步
    this.connection.on('reconnected', () => {
      this.emit('reconnected');
      this.initialSync();
    });

    // WebSocket 错误
    this.connection.on('error', (error) => {
      this.emit('ws:error', error);
    });
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'deposit_update':
        this.stores.deposits.upsert(message.data);
        this.emit('deposit:update', message.data);
        break;
        
      case 'checkbook_update':
        this.stores.checkbooks.upsert(message.data);
        this.emit('checkbook:update', message.data);
        break;
        
      case 'withdrawal_update':
        this.stores.withdrawals.upsert(message.data);
        this.emit('withdrawal:update', message.data);
        break;
        
      case 'price_update':
        this.stores.prices.updatePrice(
          message.asset_id,
          message.price,
          message.change_24h
        );
        this.emit('price:update', {
          assetId: message.asset_id,
          price: message.price,
        });
        break;
        
      default:
        this.emit('ws:message', message);
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  private validateConfig(config: EnclaveConfig): EnclaveConfig {
    if (!config.apiUrl) {
      throw new Error('apiUrl is required');
    }

    return {
      apiUrl: config.apiUrl,
      wsUrl: config.wsUrl || config.apiUrl.replace('http', 'ws') + '/api/ws',
      timeout: config.timeout || 30000,
      autoReconnect: config.autoReconnect !== false,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 1000,
      logLevel: config.logLevel || 'info',
    };
  }

  /**
   * 获取连接状态
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * 获取当前用户地址
   */
  get userAddress(): string | null {
    return this.stores.user.address;
  }
}
```

### 2. ConnectionManager (连接管理)

```typescript
// src/client/ConnectionManager.ts

import { EventEmitter } from 'eventemitter3';
import { WebSocketClient } from '../websocket/WebSocketClient';
import { SubscriptionManager } from '../websocket/SubscriptionManager';
import { ReconnectionManager } from '../websocket/ReconnectionManager';
import type { EnclaveConfig } from '../types';
import type { StoreManager } from '../stores/StoreManager';

export class ConnectionManager extends EventEmitter {
  private ws: WebSocketClient;
  private subscriptions: SubscriptionManager;
  private reconnection: ReconnectionManager;
  
  private connected: boolean = false;
  private authToken: string | null = null;

  constructor(
    private config: EnclaveConfig,
    private stores: StoreManager
  ) {
    super();
    
    this.ws = new WebSocketClient(config);
    this.subscriptions = new SubscriptionManager();
    this.reconnection = new ReconnectionManager(config);
    
    this.setupEventListeners();
  }

  async connect(authToken: string): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    this.authToken = authToken;
    
    const wsUrl = `${this.config.wsUrl}?token=${authToken}`;
    await this.ws.connect(wsUrl);
    
    this.connected = true;
    this.emit('connected');
    
    // 自动订阅用户相关数据
    await this.autoSubscribe();
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.ws.disconnect();
    this.subscriptions.clear();
    this.reconnection.stop();
    
    this.connected = false;
    this.authToken = null;
    
    this.emit('disconnected');
  }

  async subscribe(type: string, params: any): Promise<void> {
    const subscription = {
      action: 'subscribe',
      type,
      ...params,
      timestamp: Date.now(),
    };
    
    await this.ws.send(JSON.stringify(subscription));
    this.subscriptions.add(type, params);
  }

  async unsubscribe(type: string): Promise<void> {
    const message = {
      action: 'unsubscribe',
      type,
      timestamp: Date.now(),
    };
    
    await this.ws.send(JSON.stringify(message));
    this.subscriptions.remove(type);
  }

  private async autoSubscribe(): Promise<void> {
    const userAddress = this.stores.user.address;
    
    if (!userAddress) {
      return;
    }

    // 订阅用户相关的更新
    await Promise.all([
      this.subscribe('deposits', { address: userAddress }),
      this.subscribe('checkbooks', { address: userAddress }),
      this.subscribe('withdraw_requests', { address: userAddress }),
    ]);
  }

  private setupEventListeners(): void {
    // WebSocket 消息
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        this.emit('error', new Error('Invalid message format'));
      }
    });

    // WebSocket 关闭
    this.ws.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
      
      // 尝试重连
      if (this.config.autoReconnect) {
        this.handleReconnect();
      }
    });

    // WebSocket 错误
    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private handleMessage(message: any): void {
    // 转发消息给主客户端
    this.emit('message', message);
  }

  private async handleReconnect(): Promise<void> {
    if (!this.authToken) {
      return;
    }

    const shouldReconnect = await this.reconnection.shouldReconnect();
    
    if (shouldReconnect) {
      try {
        await this.connect(this.authToken);
        this.emit('reconnected');
        
        // 重新订阅
        await this.resubscribe();
        
      } catch (error) {
        this.emit('reconnect:error', error);
        
        // 继续尝试重连
        setTimeout(() => this.handleReconnect(), this.reconnection.getDelay());
      }
    } else {
      this.emit('reconnect:failed', new Error('Max reconnect attempts reached'));
    }
  }

  private async resubscribe(): Promise<void> {
    const subscriptions = this.subscriptions.getAll();
    
    for (const [type, params] of subscriptions) {
      await this.subscribe(type, params);
    }
  }
}
```

## Store 架构

详见独立章节：[Store Architecture](#store-architecture)

## API 客户端

详见独立章节：[API Client](#api-client)

## WebSocket 层

详见独立章节：[WebSocket Layer](#websocket-layer)

## 环境适配

详见独立章节：[Environment Adapters](#environment-adapters)

---

## 签名器架构

### 设计原则

**核心思想**：支持多种签名方式，用户无需暴露私钥给 SDK。

### 统一签名器接口

```typescript
// src/types/signer.ts

/**
 * 统一的签名器接口
 * 支持：私钥、Web3钱包、硬件钱包、远程签名服务等
 */
export interface ISigner {
  /**
   * 获取签名者地址
   */
  getAddress(): Promise<string>;
  
  /**
   * 签名消息（用于认证和业务操作）
   */
  signMessage(message: string | Uint8Array): Promise<string>;
  
  /**
   * 签名交易（可选，用于链上操作）
   */
  signTransaction?(transaction: TransactionRequest): Promise<string>;
}

/**
 * 签名回调配置
 * 最简单的方式：只需提供地址和签名函数
 */
export interface SignerCallback {
  address: string;
  signMessage: (message: string) => Promise<string>;
  signTransaction?: (transaction: any) => Promise<string>;
}

/**
 * 签名器类型联合
 */
export type SignerInput = string | ISigner | SignerCallback;
```

### 签名器适配器实现

```typescript
// src/blockchain/SignerAdapter.ts

import { ethers } from 'ethers';
import type { ISigner, SignerCallback, SignerInput } from '../types/signer';

/**
 * 签名器适配器
 * 统一不同签名方式的接口
 */
export class SignerAdapter implements ISigner {
  private signer: SignerInput;
  private cachedAddress?: string;
  
  constructor(signer: SignerInput) {
    this.signer = signer;
  }
  
  async getAddress(): Promise<string> {
    if (this.cachedAddress) {
      return this.cachedAddress;
    }
    
    if (typeof this.signer === 'string') {
      // 从私钥派生地址
      const wallet = new ethers.Wallet(this.signer);
      this.cachedAddress = wallet.address;
    } else if (this.isSignerCallback(this.signer)) {
      // 签名回调模式
      this.cachedAddress = this.signer.address;
    } else {
      // 签名器对象（ethers Signer）
      this.cachedAddress = await this.signer.getAddress();
    }
    
    return this.cachedAddress;
  }
  
  async signMessage(message: string | Uint8Array): Promise<string> {
    if (typeof this.signer === 'string') {
      // 私钥签名
      const wallet = new ethers.Wallet(this.signer);
      return await wallet.signMessage(message);
    } else if (this.isSignerCallback(this.signer)) {
      // 回调签名
      const messageStr = typeof message === 'string' 
        ? message 
        : ethers.hexlify(message);
      return await this.signer.signMessage(messageStr);
    } else {
      // 签名器对象
      return await this.signer.signMessage(message);
    }
  }
  
  async signTransaction(transaction: any): Promise<string> {
    if (typeof this.signer === 'string') {
      // 私钥签名交易
      const wallet = new ethers.Wallet(this.signer);
      return await wallet.signTransaction(transaction);
    } else if (this.isSignerCallback(this.signer)) {
      // 回调签名交易
      if (!this.signer.signTransaction) {
        throw new Error('signTransaction not supported by this signer');
      }
      return await this.signer.signTransaction(transaction);
    } else {
      // 签名器对象
      if (!this.signer.signTransaction) {
        throw new Error('signTransaction not supported by this signer');
      }
      return await this.signer.signTransaction(transaction);
    }
  }
  
  private isSignerCallback(signer: any): signer is SignerCallback {
    return 'address' in signer && 'signMessage' in signer;
  }
}
```

### 多种连接方式

```typescript
// src/client/EnclaveClient.ts

export class EnclaveClient extends EventEmitter {
  /**
   * 连接到 Enclave
   * 支持三种方式：
   * 1. 私钥字符串（仅限后端或测试）
   * 2. ethers Signer 对象（MetaMask、WalletConnect等）
   * 3. 签名回调（最灵活，支持任何签名方式）
   */
  async connect(signer: SignerInput): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    try {
      this.emit('connecting');
      
      // 1. 设置签名器适配器
      const signerAdapter = new SignerAdapter(signer);
      await this.wallet.setSigner(signerAdapter);
      
      const userAddress = await signerAdapter.getAddress();
      
      // 2. 后端认证（使用签名器签名）
      const authResult = await this.api.auth.login(userAddress, signerAdapter);
      this.authToken = authResult.token;
      
      // 3. 更新用户 Store
      this.stores.user.setUser({
        address: userAddress,
        chainId: authResult.chainId,
        universalAddress: authResult.universalAddress,
        isAuthenticated: true,
      });
      
      // 4. 建立 WebSocket 连接
      await this.connection.connect(this.authToken);
      
      // 5. 初始数据同步
      await this.initialSync();
      
      this.isConnected = true;
      this.emit('connected', { userAddress });
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
}
```

### 使用示例

#### 示例1: 浏览器 + MetaMask

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { ethers } from 'ethers';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 方式1: 使用 ethers Signer
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await client.connect(signer);

// 方式2: 使用签名回调
await client.connect({
  address: accounts[0],
  signMessage: async (message) => {
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    });
  },
});
```

#### 示例2: 移动端 + 远程签名服务

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 使用远程签名服务（可能需要生物识别）
await client.connect({
  address: userAddress,
  signMessage: async (message) => {
    // 调用自己的后端签名服务
    const response = await fetch('https://my-backend.com/api/sign', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` },
      body: JSON.stringify({ message }),
    });
    const { signature } = await response.json();
    return signature;
  },
});
```

#### 示例3: Node.js 后端 + 私钥

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 直接使用私钥（仅限后端）
await client.connect(process.env.PRIVATE_KEY);
```

#### 示例4: 硬件钱包（Ledger）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 初始化 Ledger
const transport = await TransportWebUSB.create();
const eth = new Eth(transport);
const { address } = await eth.getAddress("44'/60'/0'/0/0");

// 使用 Ledger 签名
await client.connect({
  address,
  signMessage: async (message) => {
    const result = await eth.signPersonalMessage(
      "44'/60'/0'/0/0",
      Buffer.from(message).toString('hex')
    );
    return '0x' + result.r + result.s + result.v.toString(16);
  },
});
```

---

## 数据格式化工具

### 设计原则

**核心思想**：SDK 内部实现数据格式化，减少 API 调用，支持离线操作。

⚠️ **重要**：所有语言的 SDK（JS/Go/Python/Rust）必须使用**完全相同**的格式化逻辑，确保跨语言一致性。

### Commitment 数据格式化器

```typescript
// src/utils/formatters/CommitmentFormatter.ts

import { keccak256, toUtf8Bytes } from 'ethers';
import type { Allocation } from '../../types';

/**
 * Commitment 数据格式化器
 * 
 * ⚠️ 跨语言一致性要求：
 * - 所有语言 SDK 必须使用相同的格式化逻辑
 * - 字段顺序、编码方式必须完全一致
 * - 版本号必须匹配
 */
export class CommitmentFormatter {
  private static readonly VERSION = 'v1';
  
  /**
   * 生成待签名的消息
   * 
   * 格式规范：
   * ```
   * Enclave Commitment v1
   * Checkbook ID: {checkbook_id}
   * Allocations Count: {count}
   * Allocations Hash: {hash}
   * Timestamp: {timestamp}
   * ```
   */
  static formatMessageToSign(params: {
    checkbookId: string;
    allocations: Allocation[];
    timestamp?: number;
  }): string {
    const timestamp = params.timestamp || Date.now();
    
    // 1. 对 allocations 进行规范化排序（确保确定性）
    const sortedAllocations = this.sortAllocations(params.allocations);
    
    // 2. 计算 allocations 的哈希
    const allocationsHash = this.hashAllocations(sortedAllocations);
    
    // 3. 构造标准消息格式
    const message = [
      `Enclave Commitment ${this.VERSION}`,
      `Checkbook ID: ${params.checkbookId}`,
      `Allocations Count: ${sortedAllocations.length}`,
      `Allocations Hash: ${allocationsHash}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');
    
    return message;
  }
  
  /**
   * 准备完整的 Commitment 数据
   * 包含待签名消息和所有必要的 payload 数据
   */
  static prepareCommitmentData(params: {
    checkbookId: string;
    allocations: Allocation[];
  }): {
    dataToSign: string;
    payload: {
      checkbook_id: string;
      allocations: Allocation[];
      allocations_hash: string;
      timestamp: number;
      version: string;
    };
    metadata: {
      totalAmount: bigint;
      recipientCount: number;
    };
  } {
    const timestamp = Date.now();
    const sortedAllocations = this.sortAllocations(params.allocations);
    const allocationsHash = this.hashAllocations(sortedAllocations);
    
    // 计算总金额
    const totalAmount = sortedAllocations.reduce(
      (sum, a) => sum + BigInt(a.amount),
      0n
    );
    
    const dataToSign = this.formatMessageToSign({
      checkbookId: params.checkbookId,
      allocations: params.allocations,
      timestamp,
    });
    
    return {
      dataToSign,
      payload: {
        checkbook_id: params.checkbookId,
        allocations: sortedAllocations,
        allocations_hash: allocationsHash,
        timestamp,
        version: this.VERSION,
      },
      metadata: {
        totalAmount,
        recipientCount: sortedAllocations.length,
      },
    };
  }
  
  /**
   * 对 allocations 进行规范化排序
   * 规则：先按 chain_id，再按 address，最后按 amount
   */
  private static sortAllocations(allocations: Allocation[]): Allocation[] {
    return [...allocations].sort((a, b) => {
      if (a.recipient_chain_id !== b.recipient_chain_id) {
        return a.recipient_chain_id - b.recipient_chain_id;
      }
      if (a.recipient_address !== b.recipient_address) {
        return a.recipient_address.localeCompare(b.recipient_address);
      }
      return a.amount.localeCompare(b.amount);
    });
  }
  
  /**
   * 计算 allocations 的 keccak256 哈希
   */
  private static hashAllocations(allocations: Allocation[]): string {
    // 将 allocations 序列化为规范字符串
    const canonical = allocations.map(a => 
      `${a.recipient_chain_id}:${a.recipient_address.toLowerCase()}:${a.amount}`
    ).join('|');
    
    return keccak256(toUtf8Bytes(canonical));
  }
}
```

### Withdraw 数据格式化器

```typescript
// src/utils/formatters/WithdrawFormatter.ts

import { keccak256, toUtf8Bytes } from 'ethers';
import type { RecipientInfo } from '../../types';

/**
 * Withdraw 数据格式化器
 * 
 * ⚠️ 跨语言一致性要求：
 * - 所有语言 SDK 必须使用相同的格式化逻辑
 * - 字段顺序、编码方式必须完全一致
 * - 版本号必须匹配
 */
export class WithdrawFormatter {
  private static readonly VERSION = 'v1';
  
  /**
   * 生成待签名的消息
   * 
   * 格式规范：
   * ```
   * Enclave Withdraw v1
   * Checkbook ID: {checkbook_id}
   * Chain ID: {chain_id}
   * Recipient: {address}
   * Amount: {amount}
   * Token: {token_symbol}
   * Timestamp: {timestamp}
   * ```
   */
  static formatMessageToSign(params: {
    checkbookId: string;
    recipient: RecipientInfo;
    timestamp?: number;
  }): string {
    const timestamp = params.timestamp || Date.now();
    const { chain_id, address, amount, token_symbol } = params.recipient;
    
    const message = [
      `Enclave Withdraw ${this.VERSION}`,
      `Checkbook ID: ${params.checkbookId}`,
      `Chain ID: ${chain_id}`,
      `Recipient: ${address.toLowerCase()}`,
      `Amount: ${amount}`,
      `Token: ${token_symbol}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');
    
    return message;
  }
  
  /**
   * 准备完整的 Withdraw 数据
   */
  static prepareWithdrawData(params: {
    checkbookId: string;
    recipient: RecipientInfo;
  }): {
    dataToSign: string;
    payload: {
      checkbook_id: string;
      recipient: RecipientInfo;
      timestamp: number;
      version: string;
    };
    metadata: {
      amount: string;
      recipient: string;
      chainId: number;
      token: string;
    };
  } {
    const timestamp = Date.now();
    
    const dataToSign = this.formatMessageToSign({
      checkbookId: params.checkbookId,
      recipient: params.recipient,
      timestamp,
    });
    
    return {
      dataToSign,
      payload: {
        checkbook_id: params.checkbookId,
        recipient: params.recipient,
        timestamp,
        version: this.VERSION,
      },
      metadata: {
        amount: params.recipient.amount,
        recipient: params.recipient.address,
        chainId: params.recipient.chain_id,
        token: params.recipient.token_symbol,
      },
    };
  }
}
```

### 业务操作层集成

```typescript
// src/client/EnclaveClient.ts

import { CommitmentFormatter } from '../utils/formatters/CommitmentFormatter';
import { WithdrawFormatter } from '../utils/formatters/WithdrawFormatter';

export class EnclaveClient extends EventEmitter {
  /**
   * 准备 Commitment 数据（SDK 内部格式化）
   */
  async prepareCommitment(params: {
    checkbookId: string;
    allocations: Allocation[];
  }): Promise<PreparedCommitmentData> {
    // SDK 内部格式化，不调用后端 API
    return CommitmentFormatter.prepareCommitmentData(params);
  }
  
  /**
   * 提交 Commitment（带签名）
   */
  async submitCommitment(params: {
    payload: CommitmentPayload;
    signature: string;
  }): Promise<CommitmentResult> {
    return await this.api.commitments.submit({
      ...params.payload,
      signature: params.signature,
    });
  }
  
  /**
   * 一步完成 Commitment（私钥模式）
   * 适用于后端服务或有私钥的场景
   */
  async createCommitment(params: {
    checkbookId: string;
    allocations: Allocation[];
  }): Promise<CommitmentResult> {
    // 1. SDK 内部准备数据
    const data = await this.prepareCommitment(params);
    
    // 2. 使用当前签名器签名
    const signature = await this.wallet.signMessage(data.dataToSign);
    
    // 3. 提交到后端
    return await this.submitCommitment({
      payload: data.payload,
      signature,
    });
  }
  
  /**
   * 准备 Withdraw 数据（SDK 内部格式化）
   */
  async prepareWithdraw(params: {
    checkbookId: string;
    recipient: RecipientInfo;
  }): Promise<PreparedWithdrawData> {
    // SDK 内部格式化，不调用后端 API
    return WithdrawFormatter.prepareWithdrawData(params);
  }
  
  /**
   * 提交 Withdraw（带签名）
   */
  async submitWithdraw(params: {
    payload: WithdrawPayload;
    signature: string;
  }): Promise<WithdrawalResult> {
    return await this.api.withdrawals.submit({
      ...params.payload,
      signature: params.signature,
    });
  }
  
  /**
   * 一步完成 Withdraw（私钥模式）
   */
  async withdraw(params: {
    checkbookId: string;
    recipient: RecipientInfo;
  }): Promise<WithdrawalResult> {
    // 1. SDK 内部准备数据
    const data = await this.prepareWithdraw(params);
    
    // 2. 使用当前签名器签名
    const signature = await this.wallet.signMessage(data.dataToSign);
    
    // 3. 提交到后端
    return await this.submitWithdraw({
      payload: data.payload,
      signature,
    });
  }
}
```

### 完整使用流程示例

#### 示例1: 分离模式（用户控制签名）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 使用 MetaMask
await client.connect({
  address: accounts[0],
  signMessage: async (message) => {
    return await window.ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    });
  },
});

// ✅ 分离流程：准备 -> 用户审查 -> 签名 -> 提交

// 1. SDK 内部准备数据（无需后端 API）
const commitmentData = await client.prepareCommitment({
  checkbookId: 'uuid',
  allocations: [
    {
      recipient_chain_id: 714,
      recipient_address: '0x...',
      amount: '1000000',
    },
  ],
});

// 2. 展示给用户审查
console.log('分配总额:', commitmentData.metadata.totalAmount);
console.log('接收人数:', commitmentData.metadata.recipientCount);
showConfirmDialog({
  message: '确认创建 Commitment？',
  details: commitmentData.metadata,
});

// 3. 用户通过 MetaMask 签名
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [commitmentData.dataToSign, accounts[0]],
});

// 4. SDK 提交到后端
const result = await client.submitCommitment({
  payload: commitmentData.payload,
  signature,
});
```

#### 示例2: 一步模式（私钥/自动签名）

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 后端服务使用私钥
await client.connect(process.env.PRIVATE_KEY);

// ✅ 一步完成（SDK 自动处理签名）
const result = await client.createCommitment({
  checkbookId: 'uuid',
  allocations: [...],
});
// SDK 内部自动: prepareCommitment -> 签名 -> submitCommitment
```

### 跨语言一致性规范

**文档位置**: `docs/DATA_FORMAT_SPEC.md` (待创建)

所有语言 SDK 必须遵守以下规范：

1. **版本号**: 当前 `v1`
2. **消息格式**: 固定的行格式和字段顺序
3. **排序算法**: allocations 排序规则必须一致
4. **哈希算法**: 使用 keccak256
5. **编码方式**: UTF-8
6. **地址格式**: 小写，带 0x 前缀
7. **时间戳**: Unix timestamp（毫秒）

**测试要求**：
- 所有语言 SDK 必须通过相同的测试向量
- 相同输入必须产生完全相同的 `dataToSign`

---

## Store 架构

### 设计原则

**双重数据同步机制**：
1. **自动推送（主要）**：WebSocket 实时推送更新
2. **主动查询（备用）**：精确查询特定数据，防止推送失败

**主键和索引设计**：
1. **主键选择**：使用后端数据库主键（UUID）
2. **辅助索引**：为业务常用查询字段建立索引
3. **数据完整性**：主键稳定，不因业务状态变化而改变

### Store 主键设计规范

#### 基本原则

**1. 使用后端数据库主键**
- ✅ 后端数据库的主键（通常是 UUID）
- ✅ 稳定不变，从创建到删除
- ✅ 全局唯一
- ❌ 不使用业务字段（如 nullifier、local_deposit_id）

**2. 辅助索引用于业务查询**
- 为业务常用的查询字段建立辅助索引
- 辅助索引映射：业务字段 → 主键
- 提供 O(1) 查询性能

**3. 数据完整性**
- 主键在所有业务状态下都存在
- 不依赖可选字段或状态相关字段
- 保证数据结构的稳定性

#### Store 主键对比表

| Store | 主键 | 辅助索引 | 原因 |
|-------|------|---------|------|
| **CheckbooksStore** | `checkbook_id` (UUID) | `local_deposit_id` → `checkbook_id` | • UUID 是数据库主键<br>• 所有 API 使用 checkbook_id<br>• Deposit 和 Checkbook 一对一 |
| **WithdrawalsStore** | `id` (UUID) | `nullifier` → `id` | • UUID 是数据库主键<br>• nullifier 可能为空<br>• 大部分 API 使用 id |

---

### 状态定义

#### CheckbookStatus（支票本状态）

支票本的生命周期状态，从存款到激活的完整流程：

| 状态 | 值 | 说明 | 用户操作 |
|------|-----|------|---------|
| **待处理** | `pending` | 存款已提交，正在处理中 | ⏳ 等待区块链确认 |
| **未签名** | `unsigned` | 存款已确认，正在安全加密中 | ⏳ 系统自动处理 |
| **可提交** | `ready_for_commitment` | 已准备好，可以设置 Commitment 信息 | ✅ 可以调用 `createCommitment()` |
| **生成证明中** | `generating_proof` | 正在生成专属隐私转账凭证 | ⏳ ZKVM 证明生成中 |
| **提交中** | `submitting_commitment` | 凭证已生成，正在保存到区块链 | ⏳ 交易已发送 |
| **确认中** | `commitment_pending` | 凭证已提交，等待区块链确认 | ⏳ 等待区块确认 |
| **已激活** | `with_checkbook` | 凭证已完成，可以创建分配 | ✅ 可以调用 `createAllocation()` |
| **证明失败** | `proof_failed` | 证明生成失败 | ✅ 可以调用 `createCommitment()` 重试 |
| **提交失败** | `submission_failed` | 提交失败 | ✅ 可以调用 `createCommitment()` 重试 |
| **已删除** | `DELETED` | 记录已删除 | 🗑️ 不可用 |

**状态流转图**：
```
pending → unsigned → ready_for_commitment → generating_proof 
    → submitting_commitment → commitment_pending → with_checkbook
    
                        ↓ (失败)
                   proof_failed / submission_failed
```

---

#### AllocationStatus（分配状态）

分配（Allocation）是从 Checkbook 中分配给特定接收者的金额。状态用于控制该 allocation 是否可以被包含到新的 WithdrawRequest 中：

| 状态 | 值 | 说明 | 是否可包含到新 WithdrawRequest |
|------|-----|------|---------------------------|
| **空闲** | `idle` | 分配已创建，尚未使用 | ✅ **可以**：可以被包含到新的 WithdrawRequest 中 |
| **处理中** | `pending` | 已包含在某个 WithdrawRequest 中 | ❌ **不可以**：正在处理中，不能重复使用 |
| **已使用** | `used` | 提现已成功完成 | ❌ **不可以**：已被消费，不能再次使用 |

**状态流转图**：
```
idle → pending → used
```

**关键特性**：
- ✅ **组合性**：一个 WithdrawRequest 可以包含**多个** idle 状态的 allocations
- ✅ **原子性**：包含在同一个 WithdrawRequest 中的所有 allocations 要么全部成功，要么全部失败
- ✅ **不可逆**：一旦进入 `used` 状态，不可再次使用
- ✅ **幂等性**：相同的 allocation 只能被提现一次

**使用场景**：

```typescript
// 场景1：创建分配（初始状态为 idle）
const allocations = await client.createAllocations(checkbookId, [
  { recipient: addr1, amount: '100' },
  { recipient: addr2, amount: '200' },
  { recipient: addr3, amount: '300' },
]);
// 所有 allocations 状态为 idle

// 场景2：创建 WithdrawRequest（包含多个 allocations）
const withdrawRequest = await client.withdraw({
  allocation_ids: [alloc1.id, alloc2.id, alloc3.id], // 包含3个 idle 状态的 allocations
  // ...
});
// 这3个 allocations 状态变为 pending

// 场景3：WithdrawRequest 完成后
// withdrawRequest.status = 'completed'
// 这3个 allocations 状态变为 used
```

---

#### WithdrawRequest 状态说明（两阶段架构）

提现请求（WithdrawRequest）可以包含**多个 Allocations**，采用**两阶段架构**：

**架构说明**：

```
┌──────────────────────────────────────────────────────┐
│  WithdrawRequest (1)                                 │
│  ├─ Allocation 1 (idle → pending → used)            │
│  ├─ Allocation 2 (idle → pending → used)            │
│  └─ Allocation 3 (idle → pending → used)            │
└──────────────────────────────────────────────────────┘
```

**阶段1：链上提现请求**
- 在原始链（Source Chain）上提交提现请求
- 状态达到 `completed` 表示**链上请求已完成**
- 所有包含的 allocations 状态从 `pending` 变为 `used`
- Nullifier 被标记为已使用

**阶段2：跨链转换（可选）**
- 如果是跨链提现，需要将资产转换到目标链
- 这个阶段由独立的转换服务处理
- 前端需要额外轮询或监听转换状态

**状态定义**：

| 阶段 | 状态 | 说明 | Allocations 状态 |
|------|------|------|-----------------|
| **阶段1** | `pending` | 正在生成提现证明 | `pending` |
| **阶段1** | `completed` | ✅ 链上提现请求已完成 | `used` |
| **阶段1** | `failed` | ❌ 提现请求失败 | 回滚到 `idle` |
| **阶段2** | （独立系统） | 跨链转换由转换服务处理 | - |

**关键字段**：
- `nullifier` - 提现凭证（唯一标识）
- `request_id` - 链上请求 ID
- `allocation_ids` - 包含的 allocation IDs（数组）
- `status` - 当前状态
- `execute_tx_hash` - 执行交易哈希
- `payout_tx_hash` - 支付交易哈希（阶段2）

**状态流转图**：
```
┌─────────────────────────────────────────────────────────┐
│  阶段1：链上提现请求                                     │
│  pending → completed (链上请求已完成)                    │
│         ↓                                               │
│      failed (失败，allocations 回滚到 idle)              │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  阶段2：跨链转换（仅跨链提现）                            │
│  转换服务：converting → converted → delivered           │
│  ⚠️ 这部分由独立服务处理，需单独查询                      │
└─────────────────────────────────────────────────────────┘
```

**状态与字段关系**：

| WithdrawRequest 状态 | Allocations 状态 | `nullifier` | `request_id` | `execute_tx_hash` | 说明 |
|---------------------|-----------------|-------------|-------------|-------------------|------|
| `pending` | `pending` | ✅ 有值 | `null` | `null` | 正在提交 |
| `completed` | `used` | ✅ 有值 | ✅ 有值 | ✅ 有值 | 链上请求完成 |
| `failed` | 回滚到 `idle` | ✅ 有值 | `null` | `null` | 提交失败，可重新创建 WithdrawRequest |

**重要说明**：
- ⚠️ `completed` **不代表资金已到账**，仅表示链上提现请求已完成
- 跨链提现需要额外监听阶段2的转换状态
- 同链提现：`completed` = 资金已到账
- 跨链提现：`completed` + 转换完成 = 资金已到账
- 如果 WithdrawRequest 失败，包含的 allocations 会回滚到 `idle`，可以重新使用

---

### BaseStore (Store 基类)

```typescript
// src/stores/BaseStore.ts

import { makeObservable, observable, action, computed } from 'mobx';
import type { APIClient } from '../api/APIClient';

/**
 * Store 基类
 * 提供通用的状态管理能力
 * 
 * 核心设计：
 * 1. 使用 Map<string, T> 存储数据，key 为后端数据库主键
 * 2. 支持辅助索引，提供业务常用字段的快速查询
 * 3. WebSocket 自动推送 + 主动查询的双重同步机制
 */
export abstract class BaseStore<T> {
  /**
   * 主存储：使用后端数据库主键作为 Map 的 key
   */
  @observable
  protected items = new Map<string, T>();
  
  @observable
  protected loading: boolean = false;
  
  @observable
  protected error: Error | null = null;

  constructor() {
    makeObservable(this);
  }

  /**
   * 获取所有项目
   */
  @computed
  get all(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * 获取项目数量
   */
  @computed
  get count(): number {
    return this.items.size;
  }

  /**
   * 是否为空
   */
  @computed
  get isEmpty(): boolean {
    return this.items.size === 0;
  }

  /**
   * 根据 ID 获取项目
   */
  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /**
   * 检查项目是否存在
   */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * 插入或更新项目
   */
  @action
  upsert(item: T): void {
    const id = this.getId(item);
    this.items.set(id, item);
  }

  /**
   * 批量插入或更新
   */
  @action
  upsertMany(items: T[]): void {
    items.forEach(item => this.upsert(item));
  }

  /**
   * 删除项目
   */
  @action
  delete(id: string): void {
    this.items.delete(id);
  }

  /**
   * 清空所有项目
   */
  @action
  clear(): void {
    this.items.clear();
    this.error = null;
  }

  /**
   * 设置加载状态
   */
  @action
  setLoading(loading: boolean): void {
    this.loading = loading;
  }

  /**
   * 设置错误
   */
  @action
  setError(error: Error | null): void {
    this.error = error;
  }

  /**
   * 查找项目
   */
  find(predicate: (item: T) => boolean): T[] {
    return this.all.filter(predicate);
  }

  /**
   * 查找单个项目
   */
  findOne(predicate: (item: T) => boolean): T | undefined {
    return this.all.find(predicate);
  }

  /**
   * 获取实体的唯一 ID（主键）
   * 子类必须实现此方法，返回后端数据库主键
   * 
   * 设计原则：
   * - 使用后端数据库主键（通常是 UUID）
   * - 主键必须稳定，不因业务状态改变
   * - 主键在整个生命周期内唯一
   */
  protected abstract getId(item: T): string;
  
  /**
   * 从 API 获取列表数据
   * 子类需要实现此方法
   */
  protected abstract fetchFromAPI(params?: any): Promise<void>;
  
  /**
   * 从 API 获取单个数据
   * 子类需要实现此方法
   */
  protected abstract fetchOneFromAPI(id: string): Promise<T | null>;
}
```

---

### CheckbooksStore (支票本状态)

```typescript
// src/stores/CheckbooksStore.ts

import { makeObservable, computed, runInAction, observable, action } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Checkbook, CheckbookDetail } from '../types';
import type { APIClient } from '../api/APIClient';

/**
 * Checkbook Store
 * 管理用户的所有支票本
 * 
 * ⚠️ 重要：Deposits 和 Checkbooks 已合并
 * 每个 Checkbook 包含关联的 Deposit 信息（local_deposit_id, gross_amount）
 * 
 * 主键设计：
 * - 主键：checkbook_id (UUID)
 * - 辅助索引：local_deposit_id → checkbook_id
 */
export class CheckbooksStore extends BaseStore<Checkbook> {
  /**
   * 辅助索引：local_deposit_id → checkbook_id
   * 用于快速通过 deposit ID 查找 checkbook
   */
  @observable
  protected depositIndex: Map<number, string> = new Map();
  
  constructor(apiClient: APIClient) {
    super();
    makeObservable(this);
  }

  /**
   * 获取实体的唯一 ID
   * 使用 checkbook_id（UUID）作为主键
   */
  protected getId(checkbook: Checkbook): string {
    return checkbook.checkbook_id;
  }
  
  /**
   * 添加或更新 checkbook
   * 同时更新 deposit 索引
   */
  @action
  override upsert(checkbook: Checkbook): void {
    const id = this.getId(checkbook);
    this.items.set(id, checkbook);
    
    // 更新 local_deposit_id 索引
    if (checkbook.local_deposit_id) {
      this.depositIndex.set(checkbook.local_deposit_id, id);
    }
  }
  
  /**
   * 通过 checkbook_id 获取（主要方式）
   */
  override get(checkbookId: string): Checkbook | undefined {
    return this.items.get(checkbookId);
  }
  
  /**
   * 通过 local_deposit_id 获取 checkbook（辅助方式）
   * 因为 Deposit 和 Checkbook 是一对一关系
   */
  getByDepositId(localDepositId: number): Checkbook | undefined {
    const checkbookId = this.depositIndex.get(localDepositId);
    if (!checkbookId) return undefined;
    return this.items.get(checkbookId);
  }

  @computed
  get issued(): Checkbook[] {
    return this.all.filter(c => c.status === 'issued');
  }

  @computed
  get withCheckbook(): Checkbook[] {
    return this.all.filter(c => c.status === 'with_checkbook');
  }
  
  /**
   * Computed: 便利方法 - 获取所有 deposit 信息
   * 从 checkbooks 中提取 deposit 相关字段
   */
  @computed
  get deposits() {
    return this.all.map(cb => ({
      depositId: cb.local_deposit_id,
      checkbookId: cb.checkbook_id,
      chainId: cb.chain_id,
      amount: cb.gross_amount,
      status: cb.status,
      owner: cb.owner,
    }));
  }
  
  /**
   * 从 API 获取列表（支持分页）
   */
  protected async fetchFromAPI(params?: {
    page?: number;
    size?: number;
    deleted?: boolean;
  }): Promise<void> {
    const response = await this.apiClient.get('/api/checkbooks', {
      params: {
        page: params?.page || 1,
        size: params?.size || 20,
        deleted: params?.deleted || false,
      },
    });
    
    const { data } = response.data;
    
    runInAction(() => {
      this.upsertMany(data);
    });
  }
  
  /**
   * 从 API 获取单个 checkbook（包含 checks）
   */
  protected async fetchOneFromAPI(checkbookId: string): Promise<Checkbook | null> {
    try {
      const response = await this.apiClient.get(
        `/api/checkbooks/id/${checkbookId}`
      );
      
      const { checkbook } = response.data.data;
      
      runInAction(() => {
        this.upsert(checkbook);
      });
      
      return checkbook;
    } catch (error) {
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * 公开方法：获取 checkbook 列表
   */
  async getList(params?: {
    page?: number;
    size?: number;
    deleted?: boolean;
  }): Promise<{ data: Checkbook[]; pagination: any }> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get('/api/checkbooks', {
        params: {
          page: params?.page || 1,
          size: params?.size || 20,
          deleted: params?.deleted || false,
        },
      });
      
      const { data, pagination } = response.data;
      
      runInAction(() => {
        this.upsertMany(data);
      });
      
      return { data, pagination };
    } catch (error) {
      this.setError(error as Error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 公开方法：获取单个 checkbook 详情
   */
  async getById(checkbookId: string): Promise<CheckbookDetail | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get(
        `/api/checkbooks/id/${checkbookId}`
      );
      
      const { checkbook, checks, checks_count } = response.data.data;
      
      runInAction(() => {
        this.upsert(checkbook);
      });
      
      return {
        checkbook,
        checks,
        checks_count,
      };
    } catch (error) {
      this.setError(error as Error);
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 删除 checkbook
   */
  async delete(checkbookId: string): Promise<void> {
    await this.apiClient.delete(`/api/checkbooks/${checkbookId}`);
    
    runInAction(() => {
      const checkbook = this.items.get(checkbookId);
      if (checkbook && checkbook.local_deposit_id) {
        this.depositIndex.delete(checkbook.local_deposit_id);
      }
      this.items.delete(checkbookId);
    });
  }
  
  /**
   * 清空时同时清空索引
   */
  @action
  override clear(): void {
    this.items.clear();
    this.depositIndex.clear();
    this.error = null;
  }
}
```

---

### AllocationsStore (分配状态)

```typescript
// src/stores/AllocationsStore.ts

import { makeObservable, computed, runInAction, observable, action } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Allocation, AllocationStatus } from '../types';
import type { APIClient } from '../api/APIClient';

/**
 * Allocation Store
 * 管理用户的所有分配
 * 
 * 核心功能：
 * - 按 token_id 和 status 查询
 * - 支持批量创建和查询
 * - 自动跟踪 withdraw_request_id
 */
export class AllocationsStore extends BaseStore<Allocation> {
  constructor(apiClient: APIClient) {
    super(apiClient);
    makeObservable(this);
  }

  /**
   * 获取实体的唯一 ID
   * 使用 id（UUID）作为主键
   */
  protected getId(allocation: Allocation): string {
    return allocation.id;
  }
  
  /**
   * 通过 id 获取
   */
  get(id: string): Allocation | undefined {
    return this.items.get(id);
  }
  
  /**
   * Computed: 按状态分组
   */
  @computed
  get byStatus(): Map<AllocationStatus, Allocation[]> {
    const map = new Map<AllocationStatus, Allocation[]>();
    this.all.forEach(allocation => {
      const list = map.get(allocation.status) || [];
      list.push(allocation);
      map.set(allocation.status, list);
    });
    return map;
  }
  
  /**
   * Computed: 按 token_id 分组
   */
  @computed
  get byTokenId(): Map<number, Allocation[]> {
    const map = new Map<number, Allocation[]>();
    this.all.forEach(allocation => {
      const list = map.get(allocation.token_id) || [];
      list.push(allocation);
      map.set(allocation.token_id, list);
    });
    return map;
  }
  
  /**
   * Computed: 按 checkbook_id 分组
   */
  @computed
  get byCheckbookId(): Map<string, Allocation[]> {
    const map = new Map<string, Allocation[]>();
    this.all.forEach(allocation => {
      const list = map.get(allocation.checkbook_id) || [];
      list.push(allocation);
      map.set(allocation.checkbook_id, list);
    });
    return map;
  }
  
  /**
   * Computed: idle 状态的所有 allocations
   */
  @computed
  get idle(): Allocation[] {
    return this.all.filter(a => a.status === 'idle');
  }
  
  /**
   * Computed: pending 状态的所有 allocations
   */
  @computed
  get pending(): Allocation[] {
    return this.all.filter(a => a.status === 'pending');
  }
  
  /**
   * Computed: used 状态的所有 allocations
   */
  @computed
  get used(): Allocation[] {
    return this.all.filter(a => a.status === 'used');
  }
  
  /**
   * 查询：按 checkbook_id 查询
   */
  getByCheckbookId(checkbookId: string): Allocation[] {
    return this.byCheckbookId.get(checkbookId) || [];
  }
  
  /**
   * 查询：按 token_id 查询
   */
  getByTokenId(tokenId: number): Allocation[] {
    return this.byTokenId.get(tokenId) || [];
  }
  
  /**
   * 查询：按 status 查询
   */
  getByStatus(status: AllocationStatus): Allocation[] {
    return this.byStatus.get(status) || [];
  }
  
  /**
   * 查询：按 token_id 和 status 查询（组合查询）
   * 例如：查询 Token ID 为 1 且状态为 idle 的所有 allocations
   */
  getByTokenIdAndStatus(tokenId: number, status: AllocationStatus): Allocation[] {
    return this.all.filter(
      a => a.token_id === tokenId && a.status === status
    );
  }
  
  /**
   * 查询：按 checkbook_id 和 status 查询
   */
  getByCheckbookIdAndStatus(checkbookId: string, status: AllocationStatus): Allocation[] {
    return this.all.filter(
      a => a.checkbook_id === checkbookId && a.status === status
    );
  }
  
  /**
   * 查询：按 checkbook_id、token_id 和 status 查询（完整组合）
   */
  getByCheckbookIdTokenIdAndStatus(
    checkbookId: string, 
    tokenId: number, 
    status: AllocationStatus
  ): Allocation[] {
    return this.all.filter(
      a => a.checkbook_id === checkbookId 
        && a.token_id === tokenId 
        && a.status === status
    );
  }
  
  /**
   * 从 API 获取列表
   */
  protected async fetchFromAPI(params?: {
    checkbook_id?: string;
    token_id?: number;
    status?: AllocationStatus;
  }): Promise<void> {
    const response = await this.apiClient.get('/api/allocations', {
      params,
    });
    
    const { allocations } = response.data;
    
    runInAction(() => {
      this.upsertMany(allocations);
    });
  }
  
  /**
   * 从 API 获取单个 allocation
   */
  protected async fetchOneFromAPI(id: string): Promise<Allocation | null> {
    try {
      const response = await this.apiClient.get(`/api/allocations/${id}`);
      const { allocation } = response.data;
      
      runInAction(() => {
        this.upsert(allocation);
      });
      
      return allocation;
    } catch (error) {
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * 公开方法：获取 allocations 列表（支持过滤）
   */
  async getList(params?: {
    checkbook_id?: string;
    token_id?: number;
    status?: AllocationStatus;
  }): Promise<Allocation[]> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get('/api/allocations', {
        params,
      });
      
      const { allocations } = response.data;
      
      runInAction(() => {
        this.upsertMany(allocations);
        this.updateSyncTime();
      });
      
      return allocations;
    } catch (error) {
      this.setError(error as Error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 公开方法：获取单个 allocation
   */
  async getById(id: string): Promise<Allocation | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get(`/api/allocations/${id}`);
      const { allocation } = response.data;
      
      runInAction(() => {
        this.upsert(allocation);
      });
      
      return allocation;
    } catch (error) {
      this.setError(error as Error);
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 创建 allocations
   */
  async createAllocations(
    checkbookId: string,
    allocations: Array<{
      recipient: { chain_id: number; data: string };
      amount: string;
      token_id: number;
    }>
  ): Promise<Allocation[]> {
    const response = await this.apiClient.post('/api/allocations', {
      checkbook_id: checkbookId,
      allocations,
    });
    
    const { allocations: created } = response.data;
    
    runInAction(() => {
      this.upsertMany(created);
    });
    
    return created;
  }
}
```

**使用示例**：

```typescript
// 示例1：查询特定 token_id 和 status 的 allocations
const idleUSDT = client.stores.allocations.getByTokenIdAndStatus(1, 'idle');
console.log(`Token ID 1 (USDT) 可用的分配数量: ${idleUSDT.length}`);

// 示例2：查询特定 checkbook 的所有 idle allocations
const checkbookIdle = client.stores.allocations.getByCheckbookIdAndStatus(
  checkbookId,
  'idle'
);

// 示例3：使用 computed 属性
const allIdle = client.stores.allocations.idle;
const allPending = client.stores.allocations.pending;
const allUsed = client.stores.allocations.used;

// 示例4：按 token_id 分组查看
const byToken = client.stores.allocations.byTokenId;
const usdtAllocations = byToken.get(1); // Token ID 1 的所有 allocations

// 示例5：完整组合查询
const specific = client.stores.allocations.getByCheckbookIdTokenIdAndStatus(
  checkbookId,
  1,      // Token ID 1 (USDT)
  'idle'  // 空闲状态
);

// 示例6：反应式查询（自动更新）
import { autorun } from 'mobx';

autorun(() => {
  const idleUSDT = client.stores.allocations.getByTokenIdAndStatus(1, 'idle');
  console.log(`可用 USDT allocations: ${idleUSDT.length}`);
  // 当 allocations 状态改变时，这个函数会自动重新执行
});

// 示例7：创建 allocations
const newAllocations = await client.stores.allocations.createAllocations(
  checkbookId,
  [
    { recipient: { chain_id: 714, data: '0x123...' }, amount: '100', token_id: 1 },
    { recipient: { chain_id: 714, data: '0x456...' }, amount: '200', token_id: 1 },
  ]
);
// 创建后，这些 allocations 自动进入 store，状态为 idle
```

---

### WithdrawalsStore (提现状态)

```typescript
// src/stores/WithdrawalsStore.ts

import { makeObservable, computed, runInAction, observable, action } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Withdrawal, WithdrawalDetail, WithdrawalStats } from '../types';
import type { APIClient } from '../api/APIClient';

/**
 * Withdrawal Store
 * 管理用户的所有提现记录
 * 
 * 主键设计：
 * - 主键：id (UUID)
 * - 辅助索引：nullifier → id
 */
export class WithdrawalsStore extends BaseStore<Withdrawal> {
  /**
   * 辅助索引：nullifier → id
   * 用于快速通过 nullifier 查找提现记录
   * 注意：nullifier 可能为空（pending 状态）
   */
  @observable
  protected nullifierIndex: Map<string, string> = new Map();
  
  constructor(apiClient: APIClient) {
    super();
    makeObservable(this);
  }

  /**
   * 获取实体的唯一 ID
   * 使用 id（UUID）作为主键
   */
  protected getId(withdrawal: Withdrawal): string {
    return withdrawal.id;
  }
  
  /**
   * 添加或更新 withdrawal
   * 同时更新 nullifier 索引
   */
  @action
  override upsert(withdrawal: Withdrawal): void {
    const id = this.getId(withdrawal);
    this.items.set(id, withdrawal);
    
    // 更新 nullifier 索引
    // 注意：只有在提现被执行后才会有 nullifier
    if (withdrawal.nullifier) {
      this.nullifierIndex.set(withdrawal.nullifier, id);
    }
  }
  
  /**
   * 通过 id 获取（主要方式）
   */
  override get(id: string): Withdrawal | undefined {
    return this.items.get(id);
  }
  
  /**
   * 通过 nullifier 获取（本地查询）
   * 先查索引，再查主存储
   */
  getByNullifierLocal(nullifier: string): Withdrawal | undefined {
    const id = this.nullifierIndex.get(nullifier);
    if (!id) return undefined;
    return this.items.get(id);
  }

  @computed
  get pending(): Withdrawal[] {
    return this.all.filter(w => w.status === 'pending');
  }

  @computed
  get completed(): Withdrawal[] {
    return this.all.filter(w => w.status === 'completed');
  }
  
  @computed
  get failed(): Withdrawal[] {
    return this.all.filter(w => w.status === 'failed');
  }
  
  /**
   * 从 API 获取列表（支持分页和过滤）
   */
  protected async fetchFromAPI(params?: {
    page?: number;
    size?: number;
    status?: string;
  }): Promise<void> {
    const response = await this.apiClient.get('/api/my/withdraw-requests', {
      params: {
        page: params?.page || 1,
        size: params?.size || 10,
        status: params?.status,
      },
    });
    
    const { withdraw_requests } = response.data;
    
    runInAction(() => {
      this.upsertMany(withdraw_requests);
    });
  }
  
  /**
   * 从 API 获取单个提现记录
   */
  protected async fetchOneFromAPI(id: string): Promise<Withdrawal | null> {
    try {
      const response = await this.apiClient.get(
        `/api/my/withdraw-requests/${id}`
      );
      
      const { withdraw_request } = response.data;
      
      runInAction(() => {
        this.upsert(withdraw_request);
      });
      
      return withdraw_request;
    } catch (error) {
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * 公开方法：获取提现列表
   */
  async getList(params?: {
    page?: number;
    size?: number;
    status?: string;
  }): Promise<{ withdraw_requests: Withdrawal[]; total: number; page: number; size: number }> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get('/api/my/withdraw-requests', {
        params,
      });
      
      const { withdraw_requests, total, page, size } = response.data;
      
      runInAction(() => {
        this.upsertMany(withdraw_requests);
      });
      
      return { withdraw_requests, total, page, size };
    } catch (error) {
      this.setError(error as Error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 公开方法：获取单个提现详情（包含 allocations）
   */
  async getById(id: string): Promise<WithdrawalDetail | null> {
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get(
        `/api/my/withdraw-requests/${id}`
      );
      
      const { withdraw_request, allocations } = response.data;
      
      runInAction(() => {
        this.upsert(withdraw_request);
      });
      
      return {
        withdraw_request,
        allocations,
      };
    } catch (error) {
      this.setError(error as Error);
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 公开方法：通过 nullifier 查询
   * 先尝试本地查询，找不到则调用 API
   */
  async getByNullifier(nullifier: string): Promise<Withdrawal | null> {
    // 先尝试从本地获取
    const local = this.getByNullifierLocal(nullifier);
    if (local) {
      return local;
    }
    
    // 本地没有，调用后端 API
    this.setLoading(true);
    this.setError(null);
    
    try {
      const response = await this.apiClient.get(
        `/api/my/withdraw-requests/by-nullifier/${nullifier}`
      );
      
      const { withdraw_request } = response.data;
      
      runInAction(() => {
        this.upsert(withdraw_request);
      });
      
      return withdraw_request;
    } catch (error) {
      this.setError(error as Error);
      if ((error as any).status === 404) {
        return null;
      }
      throw error;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * 获取提现统计
   */
  async getStats(): Promise<WithdrawalStats> {
    const response = await this.apiClient.get('/api/my/withdraw-requests/stats');
    return response.data;
  }
  
  /**
   * 重试失败的提现
   */
  async retry(id: string): Promise<any> {
    const response = await this.apiClient.post(
      `/api/my/withdraw-requests/${id}/retry`
    );
    
    // 刷新该提现记录
    await this.fetchOneFromAPI(id);
    
    return response.data;
  }
  
  /**
   * 取消提现请求
   */
  async cancel(id: string): Promise<void> {
    await this.apiClient.delete(`/api/my/withdraw-requests/${id}`);
    
    runInAction(() => {
      const withdrawal = this.items.get(id);
      if (withdrawal && withdrawal.nullifier) {
        this.nullifierIndex.delete(withdrawal.nullifier);
      }
      this.items.delete(id);
    });
  }
  
  /**
   * 清空时同时清空索引
   */
  @action
  override clear(): void {
    this.items.clear();
    this.nullifierIndex.clear();
    this.error = null;
  }
}
```

---

### 旧版 DepositsStore 示例（已废弃）

⚠️ **注意**：Deposits 已经和 Checkbooks 合并，不再需要单独的 DepositsStore。

```typescript
// ❌ 已废弃 - 仅作参考
// src/stores/DepositsStore.ts

import { makeObservable, computed } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Deposit, DepositStatus } from '../types/models';

export class DepositsStore extends BaseStore<Deposit> {
  constructor() {
    super();
    makeObservable(this);
  }

  protected getId(deposit: Deposit): string {
    // ❌ 不推荐：使用复合键
    return `${deposit.chain_id}_${deposit.local_deposit_id}`;
  }

  /**
   * 按链 ID 分组
   */
  @computed
  get byChainId(): Map<number, Deposit[]> {
    const map = new Map<number, Deposit[]>();
    
    this.all.forEach(deposit => {
      const list = map.get(deposit.chain_id) || [];
      list.push(deposit);
      map.set(deposit.chain_id, list);
    });
    
    return map;
  }

  /**
   * 按状态分组
   */
  @computed
  get byStatus(): Map<DepositStatus, Deposit[]> {
    const map = new Map<DepositStatus, Deposit[]>();
    
    this.all.forEach(deposit => {
      const list = map.get(deposit.status) || [];
      list.push(deposit);
      map.set(deposit.status, list);
    });
    
    return map;
  }

  /**
   * 可用于 Commitment 的存款
   */
  @computed
  get availableForCommitment(): Deposit[] {
    return this.find(d => 
      d.status === 'ready_for_commitment' || 
      d.status === 'with_checkbook'
    );
  }

  /**
   * 总存款金额
   */
  @computed
  get totalAmount(): bigint {
    return this.all.reduce((sum, d) => 
      sum + BigInt(d.amount), 
      0n
    );
  }

  /**
   * 按链 ID 查询
   */
  getByChainId(chainId: number): Deposit[] {
    return this.byChainId.get(chainId) || [];
  }

  /**
   * 按状态查询
   */
  getByStatus(status: DepositStatus): Deposit[] {
    return this.byStatus.get(status) || [];
  }

  /**
   * 计算指定链的总金额
   */
  getTotalAmountByChain(chainId: number): bigint {
    return this.getByChainId(chainId).reduce(
      (sum, d) => sum + BigInt(d.amount), 
      0n
    );
  }
}
```

## 类型系统

```typescript
// src/types/models.ts

// ============ 状态枚举 ============

/**
 * Checkbook（支票本）状态
 */
export enum CheckbookStatus {
  /** 待处理：存款已提交，正在处理中 */
  Pending = 'pending',
  /** 未签名：存款已确认，正在安全加密中 */
  Unsigned = 'unsigned',
  /** 可提交：已准备好，可以设置 Commitment 信息 */
  ReadyForCommitment = 'ready_for_commitment',
  /** 生成证明中：正在生成专属隐私转账凭证 */
  GeneratingProof = 'generating_proof',
  /** 提交中：凭证已生成，正在保存到区块链 */
  SubmittingCommitment = 'submitting_commitment',
  /** 确认中：凭证已提交，等待区块链确认 */
  CommitmentPending = 'commitment_pending',
  /** 已激活：凭证已完成，可以创建支票 */
  WithCheckbook = 'with_checkbook',
  /** 证明失败：证明生成失败 */
  ProofFailed = 'proof_failed',
  /** 提交失败：提交失败 */
  SubmissionFailed = 'submission_failed',
  /** 已删除：记录已删除 */
  Deleted = 'DELETED',
}

/**
 * Allocation（分配）状态
 * 从 Checkbook 中分配给特定接收者的金额
 */
export enum AllocationStatus {
  /** 空闲：分配已创建，等待提现 */
  Idle = 'idle',
  /** 处理中：提现请求已提交，正在处理 */
  Pending = 'pending',
  /** 已使用：已完成提现 */
  Used = 'used',
}

/**
 * WithdrawRequest（提现请求）状态
 * 注意：这是两阶段架构
 */
export enum WithdrawRequestStatus {
  /** 阶段1：正在生成提现证明 */
  Pending = 'pending',
  /** 阶段1：链上提现请求已完成（⚠️ 不代表资金已到账） */
  Completed = 'completed',
  /** 阶段1：提现请求失败 */
  Failed = 'failed',
}

// ============ 数据模型 ============

/**
 * 通用地址（Universal Address）
 * 支持多链地址格式
 */
export interface UniversalAddress {
  chain_id: number;  // SLIP-44 链 ID
  data: string;      // 地址数据（hex string）
}

/**
 * Checkbook 记录
 */
export interface Checkbook {
  checkbook_id: string;        // UUID 主键
  chain_id: number;            // SLIP-44 链 ID
  local_deposit_id: number;    // 关联的 deposit ID
  
  // 用户信息
  owner: UniversalAddress;     // 所有者地址
  
  // 金额信息
  gross_amount: string;        // 总金额
  allocatable_amount: string;  // 可分配金额
  fee_total_locked: string;    // 锁定手续费
  
  // Token 信息
  token_id: number;
  token_address?: string;
  
  // 状态信息
  status: CheckbookStatus;
  commitment?: string;          // Commitment hash
  proof_signature?: string;     // ZKVM proof
  
  // 存款信息
  deposit_transaction_hash?: string;
  promote_code?: string;
  
  created_at: string;
  updated_at: string;
}

/**
 * Allocation 记录
 * 从 Checkbook 中分配给特定接收者的金额
 */
export interface Allocation {
  id: string;                   // UUID 主键
  checkbook_id: string;         // 关联的 checkbook ID
  
  // 分配信息
  token_id: number;
  amount: string;
  recipient: UniversalAddress;  // 接收者地址
  
  // 状态信息
  status: AllocationStatus;     // idle, pending, used
  
  // 关联信息
  withdraw_request_id?: string; // 关联的提现请求ID（当status=pending或used时）
  
  created_at: string;
  updated_at: string;
}

/**
 * WithdrawRequest 记录
 * 两阶段架构：
 * 1. 阶段1：链上提现请求（状态：pending → completed/failed）
 * 2. 阶段2：跨链转换（由独立转换服务处理）
 */
export interface WithdrawRequest {
  id: string;                   // UUID 主键
  
  // 提现信息
  nullifier: string;            // 提现凭证（唯一标识）
  queue_root: string;           // Queue root
  
  // 用户信息
  owner_address: UniversalAddress;
  
  // 目标信息
  target_chain_id: number;      // 目标链 ID
  recipient: UniversalAddress;  // 接收者地址
  token_id: number;
  amount: string;
  
  // 阶段1：链上提现请求状态
  status: WithdrawRequestStatus;    // pending, completed, failed
  proof?: string;                   // SP1 proof data
  request_id?: string;              // 链上请求 ID（completed后有值）
  execute_tx_hash?: string;         // 执行交易哈希（completed后有值）
  execute_timestamp?: number;
  
  // 阶段2：支付信息（跨链时，由转换服务填充）
  payout_tx_hash?: string;          // 支付交易哈希（阶段2完成后）
  payout_timestamp?: number;
  
  // 关联信息
  allocation_ids: string[];         // 关联的 allocation IDs
  
  created_at: string;
  updated_at: string;
}

/**
 * WithdrawRequest 详情（包含关联的 allocations）
 */
export interface WithdrawRequestDetail {
  withdraw_request: WithdrawRequest;
  allocations: Allocation[];
}

/**
 * 旧版：存款记录（已废弃）
 * ⚠️ Deposits 已和 Checkbooks 合并，请使用 Checkbook
 */
export interface Deposit {
  id: string;
  chain_id: number;
  local_deposit_id: number;
  amount: string;
  depositor: string;
  status: DepositStatus;
  block_number: number;
  transaction_hash: string;
  created_at: string;
  updated_at: string;
}

export type DepositStatus = 
  | 'pending'
  | 'detected'
  | 'ready_for_commitment'
  | 'with_checkbook'
  | 'issued';

/**
 * Token 价格
 */
export interface TokenPrice {
  asset_id: string;
  symbol: string;
  name: string;
  price: string;
  change_24h: string;
  date: string;
  last_updated?: string;
}

/**
 * Pool/Token 信息
 */
export interface Pool {
  id: number;
  name: string;
  protocol: string;
  featured: boolean;
  chain_id: number;
  address: string;
  description?: string;
  is_active: boolean;
  is_paused: boolean;
  created_at: string;
}

export interface Token {
  id: number;
  pool_id: number;
  asset_id: string;
  symbol: string;
  name: string;
  decimals: number;
  base_token: string;
  protocol: string;
  icon_url?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * 用户信息
 */
export interface User {
  address: string;
  chainId: number;
  universalAddress: string;
  isAuthenticated: boolean;
}
```

```typescript
// src/types/config.ts

/**
 * SDK 配置
 */
export interface EnclaveConfig {
  apiUrl: string;
  wsUrl?: string;
  timeout?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  logLevel?: LogLevel;
  storage?: 'localstorage' | 'filesystem' | 'memory';
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Signer 类型 (ethers.js)
 */
export type Signer = any; // 从 ethers 导入
```

```typescript
// src/types/api.ts

/**
 * 认证相关
 */
export interface LoginRequest {
  user_address: string;
  chain_id: number;
  message: string;
  signature: string;
}

export interface LoginResponse {
  token: string;
  user_address: string;
  universal_address: string;
  chain_id: number;
  expires_in: number;
}

/**
 * 存款相关
 */
export interface DepositParams {
  chainId: number;
  tokenAddress: string;
  amount: string;
  treasuryAddress?: string;
}

export interface DepositResult {
  txHash: string;
  depositId?: number;
  success: boolean;
}

/**
 * Commitment 相关
 */
export interface AllocationParams {
  checkbookId: string;
  allocations: Allocation[];
}

export interface Allocation {
  recipient_chain_id: number;
  recipient_address: string;
  amount: string;
}

export interface CommitmentResult {
  success: boolean;
  commitmentId: string;
  txHash: string;
}

/**
 * 提现相关
 */
export interface WithdrawParams {
  allocationIds: string[];
  recipient: RecipientInfo;
}

export interface RecipientInfo {
  chain_id: number;
  address: string;
  amount: string;
  token_symbol: string;
}

export interface WithdrawalResult {
  success: boolean;
  withdrawalId: string;
  txHash?: string;
}
```

---

## API 客户端

### APIClient 基类

```typescript
// src/api/APIClient.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { EnclaveConfig } from '../types';

/**
 * HTTP API 客户端基类
 * 提供统一的请求拦截、错误处理、超时控制
 */
export class APIClient {
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;

  constructor(private config: EnclaveConfig) {
    this.axiosInstance = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // 自动添加认证 token
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        
        // 添加请求 ID（用于追踪）
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        return this.handleError(error);
      }
    );
  }

  /**
   * 设置认证 token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * 清除认证 token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * GET 请求
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * POST 请求
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * PUT 请求
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  /**
   * 错误处理
   */
  private handleError(error: any): Promise<never> {
    if (error.response) {
      // 服务器返回错误响应
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          throw new ValidationError(data.message || 'Invalid request parameters');
        case 401:
          throw new AuthenticationError(data.message || 'Authentication failed');
        case 403:
          throw new PermissionError(data.message || 'Permission denied');
        case 404:
          throw new NotFoundError(data.message || 'Resource not found');
        case 500:
          throw new ServerError(data.message || 'Internal server error');
        case 503:
          throw new ServiceUnavailableError(data.message || 'Service unavailable');
        default:
          throw new APIError(`HTTP ${status}: ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new NetworkError('No response from server');
    } else {
      // 其他错误
      throw new APIError(error.message || 'Unknown error');
    }
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 自定义错误类
 */
export class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class NetworkError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

### 认证 API

```typescript
// src/api/AuthAPI.ts

import type { APIClient } from './APIClient';
import type { LoginRequest, LoginResponse } from '../types';

export class AuthAPI {
  constructor(private client: APIClient) {}

  /**
   * 登录认证
   */
  async login(loginData: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/api/auth/login', loginData);
    return response.data;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    await this.client.post('/api/auth/logout');
  }

  /**
   * 刷新 token
   */
  async refreshToken(): Promise<{ token: string }> {
    const response = await this.client.post('/api/auth/refresh');
    return response.data;
  }
}
```

---

## WebSocket 层

### WebSocketClient

```typescript
// src/websocket/WebSocketClient.ts

import { EventEmitter } from 'eventemitter3';
import type { IWebSocketAdapter } from '../adapters/websocket/IWebSocketAdapter';

/**
 * WebSocket 客户端
 * 跨平台 WebSocket 封装
 */
export class WebSocketClient extends EventEmitter {
  private ws: IWebSocketAdapter | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private adapter: IWebSocketAdapter,
    private config: {
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
      heartbeatInterval?: number;
    } = {}
  ) {
    super();
    
    this.config = {
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  /**
   * 连接 WebSocket
   */
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = this.adapter.connect(url);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: any) => {
          this.emit('message', data);
        });

        this.ws.on('close', () => {
          this.stopHeartbeat();
          this.emit('disconnected');
          this.handleReconnect(url);
        });

        this.ws.on('error', (error: Error) => {
          this.emit('error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 发送消息
   */
  async send(data: string | object): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  /**
   * 处理重连
   */
  private handleReconnect(url: string): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      this.emit('reconnect:failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts);
      this.connect(url).catch(() => {
        // 重连失败，继续尝试
      });
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 检查连接状态
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; // OPEN
  }
}
```

---

## 环境适配

### WebSocket 适配器

```typescript
// src/adapters/websocket/IWebSocketAdapter.ts

import { EventEmitter } from 'eventemitter3';

/**
 * WebSocket 适配器接口
 */
export interface IWebSocketAdapter extends EventEmitter {
  readyState: number;
  connect(url: string): IWebSocketAdapter;
  send(data: string): void;
  close(): void;
}
```

```typescript
// src/adapters/websocket/BrowserWebSocketAdapter.ts

import { EventEmitter } from 'eventemitter3';
import type { IWebSocketAdapter } from './IWebSocketAdapter';

/**
 * 浏览器 WebSocket 适配器
 */
export class BrowserWebSocketAdapter extends EventEmitter implements IWebSocketAdapter {
  private ws: WebSocket | null = null;

  get readyState(): number {
    return this.ws?.readyState || WebSocket.CLOSED;
  }

  connect(url: string): IWebSocketAdapter {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.emit('open');
    this.ws.onmessage = (event) => this.emit('message', event.data);
    this.ws.onerror = (event) => this.emit('error', new Error('WebSocket error'));
    this.ws.onclose = () => this.emit('close');

    return this;
  }

  send(data: string): void {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

```typescript
// src/adapters/websocket/NodeWebSocketAdapter.ts

import { EventEmitter } from 'eventemitter3';
import type { IWebSocketAdapter } from './IWebSocketAdapter';

/**
 * Node.js WebSocket 适配器
 * 需要安装 ws 包: npm install ws
 */
export class NodeWebSocketAdapter extends EventEmitter implements IWebSocketAdapter {
  private ws: any = null; // WebSocket from 'ws' package

  get readyState(): number {
    return this.ws?.readyState || 3; // CLOSED
  }

  connect(url: string): IWebSocketAdapter {
    // 动态导入 ws 包
    const WebSocket = require('ws');
    this.ws = new WebSocket(url);

    this.ws.on('open', () => this.emit('open'));
    this.ws.on('message', (data: any) => this.emit('message', data.toString()));
    this.ws.on('error', (error: Error) => this.emit('error', error));
    this.ws.on('close', () => this.emit('close'));

    return this;
  }

  send(data: string): void {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(data);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### 存储适配器

```typescript
// src/adapters/storage/IStorageAdapter.ts

/**
 * 存储适配器接口
 */
export interface IStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

```typescript
// src/adapters/storage/LocalStorageAdapter.ts

import type { IStorageAdapter } from './IStorageAdapter';

/**
 * LocalStorage 适配器（浏览器）
 */
export class LocalStorageAdapter implements IStorageAdapter {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}
```

---

## 业务操作层

### ActionManager

```typescript
// src/actions/ActionManager.ts

import type { APIClient } from '../api/APIClient';
import type { WalletManager } from '../blockchain/WalletManager';
import type { StoreManager } from '../stores/StoreManager';
import { CommitmentFormatter } from '../utils/formatters/CommitmentFormatter';
import { WithdrawFormatter } from '../utils/formatters/WithdrawFormatter';

/**
 * 业务操作管理器
 * 封装复杂的业务流程
 */
export class ActionManager {
  constructor(
    private api: APIClient,
    private wallet: WalletManager,
    private stores: StoreManager
  ) {}

  /**
   * 创建 Commitment（完整流程）
   */
  async createCommitment(params: {
    checkbookId: string;
    allocations: Allocation[];
  }): Promise<CommitmentResult> {
    // 1. SDK 内部准备数据
    const preparedData = CommitmentFormatter.prepareCommitmentData(params);

    // 2. 签名
    const signature = await this.wallet.signMessage(preparedData.dataToSign);

    // 3. 提交到后端
    const response = await this.api.post('/api/commitments', {
      ...preparedData.payload,
      signature,
    });

    return response.data;
  }

  /**
   * 提现（完整流程）
   */
  async withdraw(params: {
    checkbookId: string;
    recipient: RecipientInfo;
  }): Promise<WithdrawalResult> {
    // 1. SDK 内部准备数据
    const preparedData = WithdrawFormatter.prepareWithdrawData(params);

    // 2. 签名
    const signature = await this.wallet.signMessage(preparedData.dataToSign);

    // 3. 提交到后端
    const response = await this.api.post('/api/withdrawals', {
      ...preparedData.payload,
      signature,
    });

    return response.data;
  }
}
```

---

## 平台集成

### React 集成

```typescript
// src/platforms/react/hooks.ts

import { useEffect, useState } from 'react';
import { autorun } from 'mobx';
import type { EnclaveClient } from '../../client/EnclaveClient';

/**
 * 使用 Enclave 客户端
 */
export function useEnclaveClient(client: EnclaveClient) {
  const [connected, setConnected] = useState(client.connected);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    client.on('connected', handleConnect);
    client.on('disconnected', handleDisconnect);

    return () => {
      client.off('connected', handleConnect);
      client.off('disconnected', handleDisconnect);
    };
  }, [client]);

  return { client, connected };
}

/**
 * 使用 Store 数据（自动响应）
 */
export function useStore<T>(selector: () => T): T {
  const [value, setValue] = useState<T>(selector());

  useEffect(() => {
    const dispose = autorun(() => {
      setValue(selector());
    });

    return () => dispose();
  }, [selector]);

  return value;
}

/**
 * 使用 Checkbooks
 */
export function useCheckbooks(client: EnclaveClient) {
  return useStore(() => client.stores.checkbooks.all);
}

/**
 * 使用 Allocations
 */
export function useAllocations(client: EnclaveClient) {
  return useStore(() => client.stores.allocations.all);
}
```

### Next.js 集成

```typescript
// src/platforms/nextjs/client.ts

import { EnclaveClient } from '../../client/EnclaveClient';

/**
 * Next.js 客户端工具
 * 仅在客户端运行
 */
export function createEnclaveClient(config: EnclaveConfig): EnclaveClient {
  if (typeof window === 'undefined') {
    throw new Error('EnclaveClient can only be used on the client side');
  }

  return new EnclaveClient(config);
}
```

---

## 错误处理

### 错误类型层次

```typescript
// src/errors/index.ts

/**
 * SDK 错误基类
 */
export class EnclaveSDKError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EnclaveSDKError';
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends EnclaveSDKError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

/**
 * 签名错误
 */
export class SignerError extends EnclaveSDKError {
  constructor(message: string, details?: any) {
    super(message, 'SIGNER_ERROR', details);
    this.name = 'SignerError';
  }
}

/**
 * Store 错误
 */
export class StoreError extends EnclaveSDKError {
  constructor(message: string, details?: any) {
    super(message, 'STORE_ERROR', details);
    this.name = 'StoreError';
  }
}
```

---

## 性能优化

### 1. 懒加载

```typescript
// 仅在需要时加载大型依赖
const loadEthers = async () => {
  const { ethers } = await import('ethers');
  return ethers;
};
```

### 2. 批量更新

```typescript
// Store 中使用 runInAction 批量更新
runInAction(() => {
  this.upsertMany(items);
  this.updateTimestamp();
  this.setLoading(false);
});
```

### 3. 计算属性缓存

```typescript
// MobX 自动缓存 computed 值
@computed
get totalAmount(): bigint {
  // 只在依赖变化时重新计算
  return this.all.reduce((sum, item) => sum + BigInt(item.amount), 0n);
}
```

### 4. 精确渲染

```typescript
// React 组件只在需要的数据变化时更新
const MyComponent = observer(() => {
  const checkbook = client.stores.checkbooks.get(id); // 只订阅这一个
  return <div>{checkbook.status}</div>;
});
```

---

## 测试策略

### 单元测试

```typescript
// tests/unit/stores/CheckbooksStore.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { CheckbooksStore } from '../../../src/stores/CheckbooksStore';

describe('CheckbooksStore', () => {
  let store: CheckbooksStore;

  beforeEach(() => {
    store = new CheckbooksStore(mockAPIClient);
  });

  it('should add checkbook to store', () => {
    const checkbook = createMockCheckbook();
    store.upsert(checkbook);
    
    expect(store.count).toBe(1);
    expect(store.get(checkbook.checkbook_id)).toEqual(checkbook);
  });

  it('should index by deposit_id', () => {
    const checkbook = createMockCheckbook();
    store.upsert(checkbook);
    
    const found = store.getByDepositId(checkbook.local_deposit_id!);
    expect(found).toEqual(checkbook);
  });
});
```

### 集成测试

```typescript
// tests/integration/client.test.ts

import { describe, it, expect } from 'vitest';
import { EnclaveClient } from '../../src/client/EnclaveClient';

describe('EnclaveClient Integration', () => {
  it('should connect and sync data', async () => {
    const client = new EnclaveClient({
      apiUrl: 'http://localhost:3000',
    });

    await client.connect(TEST_PRIVATE_KEY);
    
    expect(client.connected).toBe(true);
    expect(client.stores.checkbooks.all.length).toBeGreaterThan(0);
  });
});
```

---

## 总结

Enclave JavaScript SDK v2.0 采用现代化的架构设计：

### 核心特性
✅ **响应式状态管理**：MobX 自动追踪依赖，UI 自动更新  
✅ **环境无关**：支持浏览器、Node.js、React Native  
✅ **类型安全**：完整的 TypeScript 类型定义  
✅ **实时同步**：WebSocket 自动推送 + 主动查询备份  
✅ **安全第一**：私钥不离开客户端，支持多种签名方式  
✅ **离线操作**：SDK 内部格式化，支持离线签名  

### 架构优势
- **模块化**：各模块职责清晰，易于维护和扩展
- **可测试**：依赖注入，易于 Mock 和单元测试
- **高性能**：懒加载、批量更新、精确渲染
- **跨平台**：适配器模式支持不同运行环境
- **开发友好**：完整的文档、示例和类型提示

### 设计文档
- **技术设计**：[SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md)
- **API 映射**：[SDK_API_MAPPING.md](./SDK_API_MAPPING.md)
- **SDK 概览**：[SDK_OVERVIEW.md](./SDK_OVERVIEW.md)

---

**版本**: v2.0.0  
**最后更新**: 2025-01-17  
**状态**: 设计文档已完成 ✅

