# Enclave SDK Examples

This directory contains examples demonstrating different use cases and integration patterns for the Enclave SDK.

## Overview

| Example | Description | Use Case | Tech Stack |
|---------|-------------|----------|------------|
| [`quickstart.ts`](#quickstart) | Quick start guide | Get started quickly | SDK + wallet-sdk |
| [`basic-usage.ts`](#basic-usage) | Basic SDK operations | Backend/CLI usage | SDK + Private Key |
| [`authentication.ts`](#authentication) | Authentication flow | Custom auth implementation | SDK + ethers.js |
| [`react-example.tsx`](#react-integration) | React hooks integration | React apps (simple) | SDK + React Hooks |
| [`wallet-sdk-integration.tsx`](#wallet-sdk-integration) | Full wallet integration | React apps (production) | SDK + wallet-sdk + React |

---

## Examples

### 1. Quickstart
**File**: `quickstart.ts`  
**Use Case**: Get started with SDK + wallet-sdk integration in 5 minutes  
**Best For**: New users, quick prototyping

```bash
npm install @enclave-hq/sdk @enclave-hq/wallet-sdk
ts-node examples/quickstart.ts
```

**Key Features**:
- ✅ Minimal setup
- ✅ Wallet connection
- ✅ Contract operations
- ✅ SDK business logic
- ✅ Step-by-step comments

**When to use**:
- First time using Enclave
- Learning the integration flow
- Building a quick proof of concept

---

### 2. Basic Usage
**File**: `basic-usage.ts`  
**Use Case**: Backend services, CLI tools, automated scripts  
**Best For**: Server-side applications, automation

```bash
PRIVATE_KEY=0x... ts-node examples/basic-usage.ts
```

**Key Features**:
- ✅ Private key signer
- ✅ Fetch checkbooks & allocations
- ✅ Create commitments
- ✅ Create withdrawals
- ✅ Query prices

**When to use**:
- Backend services
- Automated trading bots
- Batch processing
- Server-side operations
- No browser environment

---

### 3. Authentication
**File**: `authentication.ts`  
**Use Case**: Custom authentication implementation  
**Best For**: Custom auth flows, understanding the protocol

```bash
PRIVATE_KEY=0x... ts-node examples/authentication.ts
```

**Key Features**:
- ✅ Nonce generation
- ✅ Message signing (EIP-191)
- ✅ Token-based authentication
- ✅ Token verification
- ✅ WebSocket connection

**When to use**:
- Building custom wallet integration
- Understanding authentication protocol
- Implementing custom signer
- Debugging auth issues

---

### 4. React Integration
**File**: `react-example.tsx`  
**Use Case**: React applications with built-in hooks  
**Best For**: Simple React apps, quick integration

```tsx
import { EnclaveProvider, useEnclave } from '@enclave-hq/sdk/platforms/react';

function App() {
  return (
    <EnclaveProvider config={{ ... }}>
      <Dashboard />
    </EnclaveProvider>
  );
}
```

**Key Features**:
- ✅ React Context & Hooks
- ✅ `useEnclave()` - Main client hook
- ✅ `useCheckbooks()` - Reactive checkbooks
- ✅ `useAllocations()` - Reactive allocations
- ✅ `usePrices()` - Real-time prices
- ✅ Auto-reconnection

**When to use**:
- React applications
- Need reactive data
- Want automatic state management
- Simple wallet integration

**Limitations**:
- Requires window.ethereum (MetaMask)
- Single wallet support
- Less control over wallet state

---

### 5. Wallet SDK Integration (Recommended ⭐)
**File**: `wallet-sdk-integration.tsx`  
**Use Case**: Production React apps with multi-wallet support  
**Best For**: Production applications, complex wallet requirements

```tsx
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';
import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';

// Full control over wallet connection
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);

// Bridge to SDK
const contractProvider = new WalletSDKContractProvider(walletManager);
const client = new EnclaveClient({ contractProvider });
```

**Key Features**:
- ✅ Multi-wallet support (MetaMask, TronLink, WalletConnect)
- ✅ Multi-chain support (EVM, Tron)
- ✅ Primary + secondary wallets
- ✅ Wallet state management
- ✅ Chain switching
- ✅ Account change detection
- ✅ Contract read/write operations
- ✅ Event-driven updates

**When to use**:
- Production applications
- Need multi-wallet support
- Need multi-chain support (EVM + Tron)
- Want full control over wallet state
- Complex wallet requirements
- Best user experience

**Advantages over simple React integration**:
- 🎯 Support multiple wallet types
- 🎯 Support multiple chains simultaneously
- 🎯 Better wallet state management
- 🎯 More flexible and extensible
- 🎯 Better error handling
- 🎯 Production-ready

---

## Comparison Table

| Feature | Basic Usage | Authentication | React Hooks | Wallet SDK Integration |
|---------|-------------|----------------|-------------|----------------------|
| **Environment** | Node.js | Node.js | Browser | Browser |
| **Wallet Support** | Private Key | ethers.js | window.ethereum | Multi-wallet |
| **Chain Support** | Single | Single | Single | Multi-chain |
| **UI Framework** | None | None | React | React |
| **State Management** | Manual | Manual | Auto (Hooks) | Auto (MobX + Hooks) |
| **Contract Calls** | Via SDK | Via SDK | Via SDK | Via wallet-sdk or SDK |
| **Production Ready** | ⚠️ Backend only | ⚠️ Custom | ⚠️ Simple apps | ✅ Yes |
| **Complexity** | Low | Medium | Low | Medium-High |

---

## Quick Decision Guide

### Choose **Basic Usage** if:
- ❓ Building backend service
- ❓ No browser/wallet needed
- ❓ Automated scripts

### Choose **Authentication** if:
- ❓ Building custom auth
- ❓ Need to understand protocol
- ❓ Custom signer implementation

### Choose **React Integration** if:
- ❓ Simple React app
- ❓ Only MetaMask support needed
- ❓ Single chain (EVM)
- ❓ Want quick setup

### Choose **Wallet SDK Integration** if:
- ❓ Production application
- ❓ Need multiple wallets (MetaMask, TronLink, etc.)
- ❓ Need multiple chains (EVM + Tron)
- ❓ Want best user experience
- ❓ Need robust wallet management

---

## Getting Started

### 1. For Backend/Automation
Start with `basic-usage.ts`:
```bash
npm install @enclave-hq/sdk
PRIVATE_KEY=0x... ts-node examples/basic-usage.ts
```

### 2. For React Apps (Simple)
Start with `react-example.tsx`:
```bash
npm install @enclave-hq/sdk
# Copy and adapt to your app
```

### 3. For React Apps (Production) ⭐
Start with `wallet-sdk-integration.tsx`:
```bash
npm install @enclave-hq/sdk @enclave-hq/wallet-sdk
# Follow the integration guide
```

See [`INTEGRATION_GUIDE.md`](../docs/INTEGRATION_GUIDE.md) for detailed setup instructions.

---

## Architecture Overview

### Backend Architecture (Basic Usage)
```
┌─────────────────┐
│   Your App      │
│   (Node.js)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enclave SDK    │
│  + Private Key  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enclave API    │
└─────────────────┘
```

### Frontend Architecture (Wallet SDK)
```
┌──────────────────────┐
│   Your React App     │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌──────────────┐
│ Wallet  │  │  Enclave SDK │
│ SDK     │  └──────┬───────┘
└────┬────┘         │
     │              │
     │  ┌───────────┘
     │  │
     ▼  ▼
┌──────────────┐
│ MetaMask/    │
│ TronLink     │
└──────────────┘
     │
     ▼
┌──────────────┐
│ Blockchain   │
└──────────────┘
```

### Integration Pattern (Adapter)
```
┌────────────────────────────────┐
│        Your Application        │
└───────────┬────────────────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐   ┌──────────────────┐
│ Wallet  │   │   Enclave SDK    │
│ SDK     │   │                  │
└────┬────┘   │  ┌─────────────┐ │
     │        │  │ Contract    │ │
     │        │  │ Provider    │ │
     │        │  │ (Adapter)   │ │
     │        │  └──────┬──────┘ │
     │        └─────────┼────────┘
     │                  │
     └──────────────────┘
            │
            ▼
     ┌──────────────┐
     │  Enclave API │
     └──────────────┘
```

---

## Next Steps

1. **Read the docs**: [`docs/INTEGRATION_GUIDE.md`](../docs/INTEGRATION_GUIDE.md)
2. **Try quickstart**: `ts-node examples/quickstart.ts`
3. **Build your app**: Start with the appropriate example
4. **Join Discord**: Get help from the community

---

## Support

- 📖 [Documentation](../docs/)
- 💬 [Discord](https://discord.gg/enclave)
- 🐛 [Issues](https://github.com/enclave-hq/enclave/issues)
- 📧 [Email](mailto:support@enclave-hq.com)


