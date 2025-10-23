# Enclave SDK (JavaScript/TypeScript)

**Languages**: [English](./README.md) | 中文 | [日本語](./README.ja.md) | [한국어](./README.ko.md)

> 🚧 **开发中** - v2.0.0-alpha

Enclave SDK 是一套现代化的 JavaScript/TypeScript 客户端库，用于与 Enclave 隐私保护多链 DeFi 协议进行交互。

## ✨ 特性

- 🔄 **响应式状态管理** - 基于 MobX，数据自动同步
- 🔌 **实时推送** - WebSocket 自动推送更新，无需轮询
- 🌐 **环境通用** - 支持浏览器、Node.js、React Native、Electron
- ⚡ **TypeScript 优先** - 完整的类型定义和推断
- 🎯 **框架集成** - React、Vue、Next.js 等开箱即用
- 📦 **Tree-shakable** - 按需加载，减小包体积

## 📦 安装

```bash
npm install @enclave-hq/sdk

# 或
yarn add @enclave-hq/sdk
pnpm add @enclave-hq/sdk
```

## 🚀 快速开始

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

// 创建客户端
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// 连接（一步完成登录、WebSocket、数据同步）
await client.connect();

// 访问响应式 Store
const checkbooks = client.stores.checkbooks.all;
const totalAmount = client.stores.checkbooks.totalDeposited;

// 创建 Commitment
await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000', '2000000'],
  tokenId: 'token-id',
});

// 创建提现
await client.withdraw({
  allocationIds: ['allocation-1', 'allocation-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: 'withdraw',
});
```

## 📚 文档

完整文档请查看：

- [SDK 总览](./docs/SDK_OVERVIEW.md) - 架构设计、使用场景
- [技术设计文档](./docs/SDK_JS_DESIGN.md) - 详细技术设计
- [API 映射文档](./docs/SDK_API_MAPPING.md) - SDK API 与后端 API 对应关系

其他语言版本：[English](./README.en.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

## 🛠️ 开发状态

当前版本：`v2.0.0-alpha.1`

**进度**：
- [x] 文档编写
- [x] 项目初始化
- [x] 核心实现
  - [x] 类型定义
  - [x] Store 层
  - [x] API 层
  - [x] WebSocket 层
  - [x] 主客户端
- [x] 平台集成
- [x] 示例

## 📄 License

MIT © Enclave Team

