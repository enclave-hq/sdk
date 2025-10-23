# Contract Provider Architecture

## Overview

The SDK uses an **abstraction layer** for contract interactions through the `IContractProvider` interface. This allows flexibility in choosing different wallet/provider solutions while keeping the SDK independent.

## Design Principles

### 1. **Independence**
- `@enclave-hq/wallet-sdk` does NOT depend on `@enclave-hq/sdk`
- `wallet-sdk` can be used independently in any project
- No circular dependencies

### 2. **Abstraction**
- SDK defines `IContractProvider` interface
- Multiple implementations can coexist
- Users choose their preferred provider

### 3. **Adapter Pattern**
- SDK provides adapters to bridge different providers
- `WalletSDKContractProvider`: Bridges wallet-sdk → IContractProvider
- `EthersContractProvider`: Bridges ethers.js → IContractProvider
- Custom adapters can be created

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│          @enclave-hq/sdk (Main SDK)             │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │    IContractProvider (Interface)         │  │
│  │  - readContract()                        │  │
│  │  - writeContract()                       │  │
│  │  - waitForTransaction()                  │  │
│  │  - getAddress()                          │  │
│  │  - getChainId()                          │  │
│  └──────────────────────────────────────────┘  │
│                     ▲                           │
│                     │                           │
│        ┌────────────┴──────────────┐            │
│        │                           │            │
│  ┌─────┴─────────┐      ┌──────────┴────────┐  │
│  │  WalletSDK    │      │  Ethers           │  │
│  │  Contract     │      │  Contract         │  │
│  │  Provider     │      │  Provider         │  │
│  │  (Adapter)    │      │  (Adapter)        │  │
│  └───────────────┘      └───────────────────┘  │
│        │                          │             │
└────────┼──────────────────────────┼─────────────┘
         │                          │
         │ delegates to             │ delegates to
         ▼                          ▼
┌────────────────────┐     ┌────────────────────┐
│ @enclave-hq/       │     │   ethers.js        │
│ wallet-sdk         │     │                    │
│ (Independent)      │     │   (Independent)    │
│                    │     │                    │
│ - WalletManager    │     │   - Provider       │
│ - readContract()   │     │   - Contract       │
│ - writeContract()  │     │   - Signer         │
└────────────────────┘     └────────────────────┘
```

## Interface Definition

```typescript
// SDK defines this interface
export interface IContractProvider {
  readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[]
  ): Promise<T>;

  writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string | bigint;
      gas?: string | bigint;
      gasPrice?: string | bigint;
    }
  ): Promise<string>;

  waitForTransaction(
    txHash: string,
    confirmations?: number
  ): Promise<TransactionReceipt>;

  getAddress(): Promise<string>;
  getChainId(): Promise<number>;
  isConnected(): boolean;
}
```

## Usage Examples

### Option 1: Use wallet-sdk with SDK

```typescript
import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

// 1. Connect wallet
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);

// 2. Create contract provider adapter
const contractProvider = new WalletSDKContractProvider(walletManager);

// 3. Initialize SDK
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  contractProvider, // Pass adapter
});

// 4. Use SDK (internally uses wallet-sdk for contracts)
await client.actions.createCommitment({ ... });
```

### Option 2: Use wallet-sdk directly (without SDK)

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

// Connect wallet
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);

// Read contract directly
const balance = await walletManager.readContract(
  tokenAddress,
  ERC20_ABI,
  'balanceOf',
  [userAddress]
);

// Write contract directly
const txHash = await walletManager.writeContract(
  tokenAddress,
  ERC20_ABI,
  'transfer',
  [recipient, amount]
);
```

### Option 3: Use ethers.js with SDK

```typescript
import { EnclaveClient, EthersContractProvider } from '@enclave-hq/sdk';
import { ethers } from 'ethers';

// 1. Setup ethers
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// 2. Create contract provider adapter
const contractProvider = new EthersContractProvider(signer);

// 3. Initialize SDK
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  contractProvider, // Pass adapter
});

// 4. Use SDK (internally uses ethers for contracts)
await client.actions.createCommitment({ ... });
```

## Benefits

### For wallet-sdk
- ✅ Remains independent and reusable
- ✅ No dependency on SDK
- ✅ Can be used in any project
- ✅ Simpler API surface

### For SDK
- ✅ Supports multiple providers
- ✅ Not locked into one solution
- ✅ Users have choice
- ✅ Easy to add new providers

### For Users
- ✅ Flexibility to choose
- ✅ Can migrate between providers
- ✅ Clear separation of concerns
- ✅ Better testability

## Creating Custom Providers

You can create your own contract provider:

```typescript
import type { IContractProvider, TransactionReceipt } from '@enclave-hq/sdk';

export class MyCustomContractProvider implements IContractProvider {
  async readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[]
  ): Promise<T> {
    // Your implementation
  }

  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: any
  ): Promise<string> {
    // Your implementation
  }

  async waitForTransaction(
    txHash: string,
    confirmations?: number
  ): Promise<TransactionReceipt> {
    // Your implementation
  }

  async getAddress(): Promise<string> {
    // Your implementation
  }

  async getChainId(): Promise<number> {
    // Your implementation
  }

  isConnected(): boolean {
    // Your implementation
  }
}
```

## Summary

| Component | Role | Dependencies |
|-----------|------|--------------|
| `wallet-sdk` | Wallet connection & contract calls | None (independent) |
| `SDK` | Business logic & backend | Defines `IContractProvider` |
| `WalletSDKContractProvider` | Adapter | Bridges wallet-sdk → SDK |
| `EthersContractProvider` | Adapter | Bridges ethers → SDK |

This architecture ensures:
- **Decoupling**: Components remain independent
- **Flexibility**: Users choose their provider
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to add new providers

