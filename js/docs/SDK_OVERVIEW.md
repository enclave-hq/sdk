# Enclave SDK Overview

**Languages**: [English](./SDK_OVERVIEW.md) | [中文](./SDK_OVERVIEW.zh-CN.md) | [日本語](./SDK_OVERVIEW.ja.md) | [한국어](./SDK_OVERVIEW.ko.md)

## 🎯 Overview

Enclave SDK is a multi-language client library suite for interacting with the Enclave privacy-preserving multi-chain DeFi protocol. The SDK provides a unified and easy-to-use API, supporting complete business processes including deposits, commitment creation, and withdrawals.

## 🏗️ Architecture Design

### Core Philosophy

**From Imperative to Reactive**: Enclave SDK v2.0 adopts a brand new reactive architecture based on the Store pattern and WebSocket real-time synchronization, eliminating the need for developers to worry about data polling and state management.

```
Traditional Imperative API       Reactive Store-Driven
┌─────────────────┐          ┌─────────────────┐
│ Call API        │          │ Connect Once    │
│ Wait Response   │   ═══>   │ Store Auto-Sync │
│ Manual UI Update│          │ UI Auto-Respond │
│ Need Polling    │          │ WebSocket Push  │
└─────────────────┘          └─────────────────┘
```

### Tech Stack

| Component | Technology | Reason |
|-----------|-----------|---------|
| **State Management** | MobX | Reactive, auto dependency tracking, framework-agnostic |
| **Real-time Communication** | WebSocket | Based on backend WebSocket API, supports subscription |
| **Blockchain Interaction** | ethers.js v6 | Mature, stable, excellent TypeScript support |
| **HTTP Client** | axios | Interceptors, request cancellation, timeout control |
| **Type System** | TypeScript | Type safety, excellent IDE support |
| **Build Tool** | tsup | Fast, supports multiple output formats |

## 🌍 Multi-Language Support

### Language Matrix

```
enclave/sdk/
├── js/          JavaScript/TypeScript SDK (v2.0) ✅ Completed
├── go/          Go SDK (Planned)
├── python/      Python SDK (Planned)
└── rust/        Rust SDK (Planned)
```

### JavaScript SDK Features

- ✅ **Universal Environment**: Supports Browser, Node.js, React Native, Electron
- ✅ **Framework Integration**: React, Vue, Next.js, Svelte, etc.
- ✅ **TypeScript**: Complete type definitions and inference
- ✅ **Tree-shakable**: Load on demand, reduce bundle size
- ✅ **Reactive**: Automatic state management based on MobX

### Go SDK (Future)

- High-performance backend service integration
- gRPC support
- Concurrency-friendly
- Suitable for Go microservices architecture

### Python SDK (Future)

- Data analysis and scripting
- Flask/Django backend integration
- Jupyter Notebook support
- Machine learning scenarios

## 📊 Architecture Diagram

### Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Frontend │  │ Mobile App   │  │ Backend API  │      │
│  │ (React/Vue)  │  │ (React Native)│  │ (Next.js)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ EnclaveClient
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enclave SDK (Core Layer)                  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    EnclaveClient                      │  │
│  │  - connect() / disconnect()                          │  │
│  │  - createCommitment() / withdraw()                   │  │
│  │  - Event Emitter                                     │  │
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
│  [Reactive]  [REST API]  [Real-time]   [On-chain]         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Enclave Backend Services                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │   Database   │      │
│  │  (Go Gin)    │  │  (Sub/Push)  │  │ (PostgreSQL) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Blockchain Network Layer                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   BSC    │  │ zkSync   │  │ Ethereum │  │   ...    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### JavaScript SDK Internal Architecture

```
EnclaveClient
    │
    ├── StoreManager (State Management)
    │   ├── CheckbooksStore     (Checkbook State)
    │   ├── AllocationsStore    (Allocation State)
    │   ├── WithdrawalsStore    (Withdrawal State)
    │   ├── PricesStore         (Price State)
    │   ├── PoolsStore          (Pool/Token State)
    │   └── UserStore           (User State)
    │
    ├── ConnectionManager (Connection Management)
    │   ├── WebSocketClient     (WebSocket Connection)
    │   ├── SubscriptionManager (Subscription Management)
    │   └── MessageHandler      (Message Processing)
    │
    ├── APIClient (REST API)
    │   ├── AuthAPI             (Authentication)
    │   ├── CheckbooksAPI       (Checkbooks)
    │   ├── AllocationsAPI      (Allocations)
    │   ├── WithdrawalsAPI      (Withdrawals)
    │   ├── PoolsAPI            (Pools/Tokens)
    │   └── KMSAPI              (KMS)
    │
    ├── WalletManager (Wallet Management)
    │   ├── SignerAdapter       (Signer Adapter)
    │   └── ContractManager     (Contract Interaction)
    │
    ├── ActionManager (Business Operations)
    │   ├── CommitmentAction    (Commitment Flow)
    │   └── WithdrawalAction    (Withdrawal Flow)
    │
    └── Adapters (Environment Adaptation)
        ├── WebSocketAdapter    (WS Adapter: Browser/Node)
        └── StorageAdapter      (Storage Adapter: LocalStorage/FS)
```

## 🎯 Use Cases

### Use Case 1: Web Frontend Application

**Tech Stack**: React + Next.js + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';

// Create global client instance
const client = new EnclaveClient({
  apiUrl: process.env.NEXT_PUBLIC_ENCLAVE_API,
  wsUrl: process.env.NEXT_PUBLIC_ENCLAVE_WS,
  signer: privateKey,
});

await client.connect();

// Component automatically responds to Store changes
const CheckbooksView = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <div>
      <h1>My Checkbooks ({checkbooks.count})</h1>
      <p>Total Amount: {checkbooks.totalDeposited.toString()}</p>
      {checkbooks.all.map(c => (
        <CheckbookCard key={c.id} checkbook={c} />
      ))}
    </div>
  );
});
```

**Advantages**:
- ✅ Real-time updates (WebSocket)
- ✅ No manual state management needed
- ✅ TypeScript type safety
- ✅ Automatic render performance optimization

### Use Case 2: Node.js Backend Service

**Tech Stack**: Next.js API Routes / Express / Nest.js

```typescript
// app/api/checkbooks/route.ts
import { EnclaveClient } from '@enclave-hq/sdk';

// Server-side singleton instance
const serverClient = new EnclaveClient({
  apiUrl: process.env.ENCLAVE_API_URL,
  wsUrl: process.env.ENCLAVE_WS_URL,
  signer: process.env.SERVER_PRIVATE_KEY,
});

await serverClient.connect();

export async function GET(request: Request) {
  // Read directly from Store (WebSocket real-time sync)
  const checkbooks = serverClient.stores.checkbooks.all;
  
  return Response.json({
    checkbooks,
    total: serverClient.stores.checkbooks.totalDeposited.toString(),
  });
}

export async function POST(request: Request) {
  const { checkbookId, amounts, tokenId } = await request.json();
  
  // Execute commitment creation
  const result = await serverClient.createCommitment({
    checkbookId,
    amounts,
    tokenId,
  });
  
  return Response.json(result);
}
```

**Advantages**:
- ✅ Server-side long connection reuse
- ✅ Automatic data synchronization
- ✅ Reduced API call frequency
- ✅ Suitable for microservices architecture

### Use Case 3: React Native Mobile App

**Tech Stack**: React Native + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';
import { View, Text, FlatList } from 'react-native';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// Use biometric or secure storage to get private key
const privateKey = await SecureStore.getItemAsync('private_key');
await client.connect();

const CheckbooksScreen = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <View>
      <Text>My Checkbooks ({checkbooks.count})</Text>
      <FlatList
        data={checkbooks.all}
        renderItem={({ item }) => <CheckbookCard checkbook={item} />}
        keyExtractor={item => item.id}
      />
    </View>
  );
});
```

**Advantages**:
- ✅ Cross-platform (iOS + Android)
- ✅ Offline support (Store persistence)
- ✅ Real-time push
- ✅ Native performance

## 🔄 Data Flow

### Commitment Creation Flow

```
User Action
    │
    ├─> client.createCommitment(params)
    │       │
    │       ├─> 1. Prepare sign data
    │       ├─> 2. Wallet signs message
    │       ├─> 3. Submit to backend
    │       └─> 4. Create allocations
    │
    ▼
Backend Processing
    │
    ├─> Verify signature
    │       │
    │       └─> Create Allocation records
    │
    ▼
WebSocket Push
    │
    ├─> Backend pushes allocation_update message
    │       │
    │       └─> SDK receives message
    │
    ▼
Store Update
    │
    ├─> AllocationsStore.updateAllocation(allocation)
    │       │
    │       └─> Trigger 'change' event
    │
    ▼
UI Auto-Update
    │
    └─> React/Vue components automatically re-render
```

### Price Subscription Flow

```
Initialization
    │
    ├─> client.connect()
    │       │
    │       └─> WebSocket connection established
    │
    ▼
Subscribe to Prices
    │
    ├─> Auto-subscribe to price channel
    │       │
    │       └─> Send subscription message to backend
    │
    ▼
Periodic Push
    │
    ├─> Backend pushes price updates every minute
    │       │
    │       └─> SDK receives price_update message
    │
    ▼
Store Update
    │
    ├─> PricesStore.updatePrice(...)
    │       │
    │       └─> Auto-trigger dependency updates
    │
    ▼
UI Response
    │
    └─> Price charts/lists automatically refresh
```

## 📦 Package Structure

### npm Package Publishing

```bash
@enclave-hq/sdk
├── dist/
│   ├── index.js         # CommonJS
│   ├── index.mjs        # ES Module
│   ├── index.d.ts       # TypeScript Definitions
│   ├── react.js         # React Integration
│   ├── vue.js           # Vue Integration
│   └── nextjs.js        # Next.js Utils
├── package.json
└── README.md
```

### On-Demand Import

```typescript
// Core client
import { EnclaveClient } from '@enclave-hq/sdk';

// React Hooks
import { useEnclave, useCheckbooks } from '@enclave-hq/sdk/react';

// Next.js Utils
import { createServerClient } from '@enclave-hq/sdk/nextjs';

// Vue Composables
import { useEnclave } from '@enclave-hq/sdk/vue';
```

## 🔐 Security Considerations

### Private Key Management

- ✅ **Browser**: Use MetaMask and other wallets, don't store private keys
- ✅ **Node.js**: Use environment variables or KMS
- ✅ **Mobile**: Use device secure storage (SecureStore)
- ❌ **Never**: Hard-code private keys in code

### WebSocket Security

- ✅ JWT Token authentication
- ✅ Automatic reconnection and token refresh
- ✅ Message signature verification
- ✅ Rate limiting

### Data Validation

- ✅ All input parameter validation
- ✅ Amount range checking
- ✅ Address format validation
- ✅ ChainID mapping validation

## 🚀 Performance Optimization

### Store Optimization

- ✅ **Computed Values**: Auto-cache calculation results
- ✅ **Precise Updates**: Only update changed parts
- ✅ **Batch Operations**: Merge multiple updates
- ✅ **Lazy Loading**: Load data on demand

### WebSocket Optimization

- ✅ **Message Queue**: Buffer high-frequency messages
- ✅ **Auto Reconnection**: Disconnect reconnection mechanism
- ✅ **Heartbeat Detection**: Keep connection active
- ✅ **Subscription Management**: Smart subscribe/unsubscribe

### Bundle Size Optimization

- ✅ **Tree-shaking**: Unused code not bundled
- ✅ **Code Splitting**: React/Vue integration loaded on demand
- ✅ **Compression**: gzip + brotli
- ✅ **Dependency Optimization**: Minimize external dependencies

| Module | Size (gzipped) |
|--------|----------------|
| Core SDK | ~40KB |
| React Integration | +5KB |
| Vue Integration | +5KB |
| Next.js Utils | +3KB |

## 📚 Related Documentation

- [JavaScript SDK Technical Design](./SDK_JS_DESIGN.md) - Detailed technical design
- [API Mapping Documentation](./SDK_API_MAPPING.md) - SDK API to backend API mapping
- [Backend API Documentation](../../backend/API_DOCUMENTATION.md) - Backend REST API reference
- [WebSocket Integration](../../backend/WEBSOCKET_INTEGRATION.md) - WebSocket protocol specification

## 🛣️ Roadmap

### Phase 1: JavaScript SDK v2.0 ✅ Completed

- [x] Architecture design
- [x] Core implementation
  - [x] Store layer
  - [x] API layer
  - [x] WebSocket layer
  - [x] Main client
- [x] Platform integration
  - [x] React
  - [x] Next.js
- [x] Documentation and examples

### Phase 2: Go SDK (Planned)

- [ ] Architecture design
- [ ] Core implementation
- [ ] gRPC support
- [ ] Examples and documentation
- [ ] Publish to pkg.go.dev

### Phase 3: Python SDK (Planned)

- [ ] Architecture design
- [ ] Core implementation
- [ ] Flask/Django integration
- [ ] Examples and documentation
- [ ] Publish to PyPI

### Phase 4: Rust SDK (Planned)

- [ ] Architecture design
- [ ] Core implementation
- [ ] WASM support
- [ ] Examples and documentation
- [ ] Publish to crates.io

## 📞 Support

- GitHub Issues: https://github.com/enclave-hq/enclave/issues
- Documentation: https://docs.enclave-hq.com
- Discord: https://discord.gg/enclave

---

**Version**: v2.0.0-alpha  
**Last Updated**: 2025-01-17  
**Maintainer**: Enclave Team
