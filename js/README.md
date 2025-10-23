# Enclave SDK (JavaScript/TypeScript)

**Languages**: English | [中文](./README.zh.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

> 🚧 **Work in Progress** - v2.0.0-alpha

Enclave SDK is a modern JavaScript/TypeScript client library for interacting with the Enclave privacy-preserving multi-chain DeFi protocol.

## ✨ Features

- 🔄 **Reactive State Management** - Based on MobX, automatic data synchronization
- 🔌 **Real-time Push** - WebSocket automatic push updates, no polling required
- 🌐 **Universal Environment** - Supports Browser, Node.js, React Native, Electron
- ⚡ **TypeScript First** - Complete type definitions and inference
- 🎯 **Framework Integration** - React, Vue, Next.js out of the box
- 📦 **Tree-shakable** - Load on demand, reduce bundle size

## 📦 Installation

```bash
npm install @enclave-hq/sdk

# or
yarn add @enclave-hq/sdk
pnpm add @enclave-hq/sdk
```

## 🚀 Quick Start

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

// Create client
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// Connect (login, WebSocket, data sync all in one step)
await client.connect();

// Access reactive Stores
const checkbooks = client.stores.checkbooks.all;
const totalAmount = client.stores.checkbooks.totalDeposited;

// Create commitment
await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000', '2000000'],
  tokenId: 'token-id',
});

// Create withdrawal
await client.withdraw({
  allocationIds: ['allocation-1', 'allocation-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: 'withdraw',
});
```

## 📚 Documentation

Full documentation:

- [SDK Overview](./docs/SDK_OVERVIEW.md) - Architecture design and use cases
- [Technical Design](./docs/SDK_JS_DESIGN.md) - Detailed technical design
- [API Mapping](./docs/SDK_API_MAPPING.md) - SDK API to backend API mapping

## 🛠️ Development Status

Current Version: `v2.0.0-alpha.1`

**Progress**:
- [x] Documentation
- [x] Project initialization
- [x] Core implementation
  - [x] Type definitions
  - [x] Store layer
  - [x] API layer
  - [x] WebSocket layer
  - [x] Main client
- [x] Platform integration
- [x] Examples

## 📄 License

MIT © Enclave Team

