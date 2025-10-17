# Enclave JavaScript SDK - Technical Design Document

**Languages**: English | [中文](./SDK_JS_DESIGN.zh-CN.md) | [日本語](./SDK_JS_DESIGN.ja.md) | [한국어](./SDK_JS_DESIGN.ko.md)

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Core Module Design](#core-module-design)
- [Signer Architecture](#signer-architecture)
- [Data Formatters](#data-formatters)
- [Type System](#type-system)
- [Store Architecture](#store-architecture)
- [API Client](#api-client)
- [WebSocket Layer](#websocket-layer)
- [Environment Adapters](#environment-adapters)
- [Business Operations Layer](#business-operations-layer)
- [Platform Integration](#platform-integration)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Testing Strategy](#testing-strategy)

## Overview

Enclave JavaScript SDK v2.0 is a brand new SDK based on **reactive architecture** and **MobX state management**, providing a unified and easy-to-use API for interacting with Enclave backend services.

### Core Design Principles

1. **Reactive First**: Based on MobX, data changes automatically trigger UI updates
2. **Environment Agnostic**: Supports browsers, Node.js, React Native, and all JS runtime environments
3. **TypeScript First**: Complete type definitions provide excellent developer experience
4. **Real-time Sync**: WebSocket automatically pushes updates, no manual polling required
5. **Simple to Use**: A single `connect()` completes all initialization

### Architecture Principles

- **Single Responsibility**: Each module is responsible for only one core function
- **Dependency Injection**: Modules communicate through interfaces, easy to test and replace
- **Event-Driven**: Use EventEmitter for inter-module communication
- **Defensive Programming**: Comprehensive error handling and boundary checking
- **Performance Priority**: Lazy loading, batch updates, precise rendering

## Tech Stack

### Core Dependencies

```json
{
  "dependencies": {
    "mobx": "^6.12.0",           // Reactive state management
    "ethers": "^6.10.0",         // Blockchain interaction
    "axios": "^1.6.0",           // HTTP client
    "eventemitter3": "^5.0.1"    // Event system
  },
  "peerDependencies": {
    "ws": "^8.0.0",              // Node.js WebSocket (optional)
    "react": ">=16.8.0",         // React integration (optional)
    "vue": ">=3.0.0"             // Vue integration (optional)
  },
  "devDependencies": {
    "typescript": "^5.3.0",      // TypeScript
    "tsup": "^8.0.0",            // Build tool
    "vitest": "^1.0.0",          // Test framework
    "eslint": "^8.56.0",         // Code linter
    "prettier": "^3.1.0"         // Code formatter
  }
}
```

### Why These Technologies?

| Technology | Reason | Alternative Comparison |
|------|------|-------------|
| **MobX** | Reactive, automatic dependency tracking, framework-agnostic | Redux (too heavy), Zustand (fewer features) |
| **ethers.js v6** | Mature and stable, excellent TypeScript support | web3.js (less modern API) |
| **axios** | Interceptors, request cancellation, timeout control | fetch (fewer features) |
| **tsup** | Fast, zero-config, multiple output formats | webpack (complex config), rollup (more configuration) |
| **vitest** | Fast, Jest-compatible API, native ESM | Jest (slower) |

## SDK Export Strategy

The SDK adopts a clear export strategy, exporting core classes, status enums, and type definitions for client use:

```typescript
// src/index.ts - Main entry file

// ============ Core Client ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ Status Enums (for client use) ============
export { 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from './types/models';

// ============ Data Model Types ============
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

// ============ Configuration Types ============
export type {
  EnclaveConfig,
  SignerInput,
  ISigner,
  SignerCallback,
} from './types';
```

### Why Export Status Enums?

1. ✅ **Type Safety**: TypeScript checks status value correctness at compile time
2. ✅ **Code Hints**: IDE provides auto-completion and documentation
3. ✅ **Readability**: `CheckbookStatus.WithCheckbook` is clearer than `'with_checkbook'`
4. ✅ **Refactoring Friendly**: When status values change, only need to modify enum definition, all references update automatically
5. ✅ **Avoid Magic Strings**: Eliminates hardcoded strings, reduces errors

### Client Usage Examples

```typescript
import { 
  EnclaveClient, 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave/sdk';

// Create client
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 1. Use enum for status comparison
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook activated, can create allocations');
}

// 2. Use enum for queries
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. Use enum for conditional logic
const withdrawal = client.stores.withdrawals.get(withdrawId);
switch (withdrawal.status) {
  case WithdrawRequestStatus.Pending:
    console.log('⏳ Withdrawal processing...');
    break;
  case WithdrawRequestStatus.Completed:
    console.log('✅ Withdrawal completed');
    break;
  case WithdrawRequestStatus.Failed:
    console.log('❌ Withdrawal failed, can retry');
    break;
}

// 4. Use enum in React UI
function CheckbookStatusBadge({ status }: { status: CheckbookStatus }) {
  const config = {
    [CheckbookStatus.Pending]: { text: 'Processing', color: 'blue' },
    [CheckbookStatus.ReadyForCommitment]: { text: 'Ready', color: 'yellow' },
    [CheckbookStatus.WithCheckbook]: { text: 'Active', color: 'green' },
    [CheckbookStatus.ProofFailed]: { text: 'Proof Failed', color: 'red' },
  };
  
  const { text, color } = config[status] || { text: 'Unknown', color: 'gray' };
  return <Badge color={color}>{text}</Badge>;
}

// 5. State transition control
function canCreateAllocation(checkbook: Checkbook): boolean {
  return checkbook.status === CheckbookStatus.WithCheckbook;
}

function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 6. TypeScript type safety
function processCheckbook(status: CheckbookStatus) {
  // TypeScript ensures only valid CheckbookStatus values can be passed
}

// ❌ Error: TypeScript will report an error
processCheckbook('invalid_status'); // Type 'string' is not assignable to type 'CheckbookStatus'

// ✅ Correct
processCheckbook(CheckbookStatus.Pending);
```

---

## Directory Structure

```
sdk/js/
├── src/
│   ├── client/                      # Client core
│   │   ├── EnclaveClient.ts         # Main client entry
│   │   └── ConnectionManager.ts     # Connection management
│   │
│   ├── stores/                      # MobX Store layer
│   │   ├── BaseStore.ts             # Store base class
│   │   ├── StoreManager.ts          # Store manager
│   │   ├── DepositsStore.ts         # Deposit state
│   │   ├── CheckbooksStore.ts       # Checkbook state
│   │   ├── WithdrawalsStore.ts      # Withdrawal state
│   │   ├── PricesStore.ts           # Price state
│   │   ├── PoolsStore.ts            # Pool/Token state
│   │   └── UserStore.ts             # User state
│   │
│   ├── api/                         # REST API layer
│   │   ├── APIClient.ts             # HTTP client base class
│   │   ├── AuthAPI.ts               # Authentication API
│   │   ├── DepositsAPI.ts           # Deposits API
│   │   ├── CheckbooksAPI.ts         # Checkbook API
│   │   ├── WithdrawalsAPI.ts        # Withdrawals API
│   │   ├── PoolsAPI.ts              # Pool/Token API
│   │   └── KMSAPI.ts                # KMS API
│   │
│   ├── websocket/                   # WebSocket layer
│   │   ├── WebSocketClient.ts       # WS client
│   │   ├── SubscriptionManager.ts   # Subscription management
│   │   ├── MessageHandler.ts        # Message handler
│   │   └── ReconnectionManager.ts   # Reconnection management
│   │
│   ├── blockchain/                  # Blockchain interaction layer
│   │   ├── WalletManager.ts         # Wallet management
│   │   ├── SignerAdapter.ts         # Signer adapter
│   │   ├── ContractManager.ts       # Contract interaction
│   │   └── TransactionBuilder.ts    # Transaction builder
│   │
│   ├── actions/                     # Business operations layer
│   │   ├── ActionManager.ts         # Operation manager
│   │   ├── DepositAction.ts         # Deposit operations
│   │   ├── CommitmentAction.ts      # Commitment operations
│   │   └── WithdrawalAction.ts      # Withdrawal operations
│   │
│   ├── adapters/                    # Environment adapter layer
│   │   ├── websocket/
│   │   │   ├── IWebSocketAdapter.ts
│   │   │   ├── BrowserWebSocketAdapter.ts
│   │   │   └── NodeWebSocketAdapter.ts
│   │   └── storage/
│   │       ├── IStorageAdapter.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── FileStorageAdapter.ts
│   │
│   ├── platforms/                   # Platform-specific integration
│   │   ├── react/
│   │   │   ├── hooks.ts             # React Hooks
│   │   │   ├── provider.tsx         # Context Provider
│   │   │   └── index.ts
│   │   ├── vue/
│   │   │   ├── composables.ts       # Vue Composables
│   │   │   ├── plugin.ts            # Vue Plugin
│   │   │   └── index.ts
│   │   └── nextjs/
│   │       ├── server.ts            # Server-side utilities
│   │       ├── client.ts            # Client-side utilities
│   │       └── index.ts
│   │
│   ├── types/                       # TypeScript type definitions
│   │   ├── models.ts                # Data models
│   │   ├── api.ts                   # API types
│   │   ├── config.ts                # Configuration types
│   │   ├── events.ts                # Event types
│   │   ├── websocket.ts             # WebSocket types
│   │   └── index.ts
│   │
│   ├── utils/                       # Utility functions
│   │   ├── address.ts               # Address formatting
│   │   ├── amount.ts                # Amount handling
│   │   ├── logger.ts                # Logging utility
│   │   ├── retry.ts                 # Retry mechanism
│   │   ├── validators.ts            # Data validation
│   │   ├── environment.ts           # Environment detection
│   │   └── index.ts
│   │
│   └── index.ts                     # Main export file
│
├── examples/                        # Usage examples
│   ├── basic-usage.ts               # Basic usage
│   ├── react-app/                   # React example
│   ├── nextjs-app/                  # Next.js example
│   ├── nodejs-backend.ts            # Node.js backend
│   └── kms-integration.ts           # KMS integration
│
├── tests/                           # Tests
│   ├── unit/                        # Unit tests
│   │   ├── stores/
│   │   ├── api/
│   │   └── utils/
│   ├── integration/                 # Integration tests
│   └── e2e/                         # End-to-end tests
│
├── docs/                            # Additional documentation
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                   # Build configuration
├── vitest.config.ts                 # Test configuration
├── .eslintrc.js
├── .prettierrc
├── README.md
└── LICENSE
```

## Core Module Design

### 1. EnclaveClient (Main Client)

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
 * Enclave SDK Main Client
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
    
    // Validate configuration
    this.config = this.validateConfig(config);
    
    // Initialize modules
    this.api = new APIClient(this.config);
    this.stores = new StoreManager(this.api);
    this.connection = new ConnectionManager(this.config, this.stores);
    this.wallet = new WalletManager(this.config);
    this.actions = new ActionManager(
      this.api,
      this.wallet,
      this.stores
    );
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Connect to Enclave
   * 
   * @param privateKeyOrSigner - Private key string or ethers Signer
   */
  async connect(privateKeyOrSigner: string | Signer): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    try {
      this.emit('connecting');
      
      // 1. Setup wallet signer
      await this.wallet.setSigner(privateKeyOrSigner);
      const userAddress = await this.wallet.getAddress();
      
      // 2. Backend authentication
      const authResult = await this.api.auth.login(
        userAddress,
        this.wallet
      );
      this.authToken = authResult.token;
      
      // 3. Update user Store
      this.stores.user.setUser({
        address: userAddress,
        chainId: authResult.chainId,
        universalAddress: authResult.universalAddress,
        isAuthenticated: true,
      });
      
      // 4. Establish WebSocket connection
      await this.connection.connect(this.authToken);
      
      // 5. Initial data synchronization
      await this.initialSync();
      
      this.isConnected = true;
      this.emit('connected', { userAddress });
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // 1. Close WebSocket
      await this.connection.disconnect();
      
      // 2. Clear Stores
      this.stores.clearAll();
      
      // 3. Clear state
      this.authToken = null;
      this.isConnected = false;
      
      this.emit('disconnected');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Disconnect failed: ${error.message}`);
    }
  }

  /**
   * Deposit operation
   */
  async deposit(params: DepositParams): Promise<DepositResult> {
    this.ensureConnected();
    return this.actions.deposit(params);
  }

  /**
   * Create allocation
   */
  async createAllocation(params: AllocationParams): Promise<CommitmentResult> {
    this.ensureConnected();
    return this.actions.createCommitment(params);
  }

  /**
   * Withdraw operation
   */
  async withdraw(params: WithdrawParams): Promise<WithdrawalResult> {
    this.ensureConnected();
    return this.actions.withdraw(params);
  }

  /**
   * Subscribe to price updates
   */
  async subscribePrices(assetIds: string[]): Promise<void> {
    this.ensureConnected();
    await this.connection.subscribe('prices', { assetIds });
  }

  /**
   * Initial data synchronization
   */
  private async initialSync(): Promise<void> {
    const syncTasks = [
      this.syncDeposits(),
      this.syncCheckbooks(),
      this.syncWithdrawals(),
      this.syncPrices(),
    ];
    
    await Promise.allSettled(syncTasks);
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}
```

**Key Design Points**:

1. **Single Entry Point**: All SDK functionality accessed through `EnclaveClient`
2. **Lifecycle Management**: Clear `connect()` and `disconnect()` lifecycle
3. **Event Emission**: Emit events for connection state changes for external monitoring
4. **Automatic Sync**: Automatically complete initial data synchronization after connection
5. **Error Isolation**: Each operation has independent error handling

### 2. ConnectionManager (Connection Manager)

```typescript
// src/client/ConnectionManager.ts

import { EventEmitter } from 'eventemitter3';
import { WebSocketClient } from '../websocket/WebSocketClient';
import { SubscriptionManager } from '../websocket/SubscriptionManager';
import { MessageHandler } from '../websocket/MessageHandler';
import { ReconnectionManager } from '../websocket/ReconnectionManager';
import type { StoreManager } from '../stores/StoreManager';
import type { EnclaveConfig } from '../types';

/**
 * Connection Manager
 * Responsible for managing WebSocket connections and message routing
 */
export class ConnectionManager extends EventEmitter {
  private ws: WebSocketClient;
  private subscriptions: SubscriptionManager;
  private messageHandler: MessageHandler;
  private reconnection: ReconnectionManager;

  constructor(
    private config: EnclaveConfig,
    private stores: StoreManager
  ) {
    super();
    
    // Initialize WebSocket components
    this.ws = new WebSocketClient(config);
    this.subscriptions = new SubscriptionManager();
    this.messageHandler = new MessageHandler(stores);
    this.reconnection = new ReconnectionManager(config);
    
    this.setupEventHandlers();
  }

  async connect(authToken: string): Promise<void> {
    try {
      // 1. Establish WebSocket connection
      await this.ws.connect(authToken);
      
      // 2. Subscribe to user data streams
      await this.subscribeToUserStreams();
      
    this.emit('connected');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // 1. Unsubscribe all
    this.subscriptions.unsubscribeAll();

    // 2. Close WebSocket
    await this.ws.disconnect();
    
    this.emit('disconnected');
  }

  /**
   * Subscribe to specific data stream
   */
  async subscribe(topic: string, params: any): Promise<void> {
    const subscription = {
      topic,
      params,
      id: this.subscriptions.generateId(),
    };
    
    await this.ws.send({
      type: 'subscribe',
      data: subscription,
    });
    
    this.subscriptions.add(subscription);
  }

  /**
   * Automatically subscribe to user-related data streams
   */
  private async subscribeToUserStreams(): Promise<void> {
    const userAddress = this.stores.user.address;
    
    // Subscribe to deposits, checkbooks, withdrawals, prices
    await Promise.all([
      this.subscribe('deposits', { userAddress }),
      this.subscribe('checkbooks', { userAddress }),
      this.subscribe('withdrawals', { userAddress }),
      this.subscribe('prices', {}),
    ]);
  }

  private setupEventHandlers(): void {
    // Handle incoming WebSocket messages
    this.ws.on('message', (message) => {
      this.messageHandler.handle(message);
    });
    
    // Handle connection loss
    this.ws.on('close', () => {
      this.reconnection.handleDisconnect();
    });
    
    // Handle reconnection success
    this.reconnection.on('reconnected', async () => {
      await this.subscribeToUserStreams();
    });
  }
}
```

**Key Design Points**:

1. **Component Separation**: WebSocket, subscriptions, message handling are independent modules
2. **Automatic Subscription**: Automatically subscribe to user-related data streams after connection
3. **Reconnection Logic**: Automatically handle connection loss and resubscription
4. **Type Safety**: All messages and subscriptions are type-safe

---

## Signer Architecture

The Enclave SDK supports multiple signing methods without exposing private keys, achieved through the `ISigner` interface and `SignerAdapter`.

### Design Goals

1. **Security**: SDK never stores or logs private keys
2. **Flexibility**: Supports multiple signing methods (private key, MetaMask, Ledger, remote signing service)
3. **Compatibility**: Works with existing Web3 wallets and hardware wallets
4. **Offline Support**: Supports signing without network connection

### Core Interfaces

```typescript
// src/types/config.ts

/**
 * Signer callback function signature
 * @param message - Message to sign (hex string or Uint8Array)
 * @returns Signature (hex string)
 */
export type SignerCallback = (message: string | Uint8Array) => Promise<string>;

/**
 * Signer interface
 */
export interface ISigner {
  /**
   * Get signer address
   */
  getAddress(): Promise<string>;
  
  /**
   * Sign message
   * @param message - Message to sign
   * @returns Signature
   */
  signMessage(message: string | Uint8Array): Promise<string>;
  
  /**
   * Sign transaction (optional)
   */
  signTransaction?(transaction: any): Promise<string>;
}

/**
 * Flexible signer input type
 * - string: Private key (hex format, with or without 0x prefix)
 * - SignerCallback: Custom signing function
 * - ISigner: Object implementing ISigner interface (e.g., ethers.Signer)
 */
export type SignerInput = string | SignerCallback | ISigner;
```

### SignerAdapter Implementation

```typescript
// src/blockchain/SignerAdapter.ts

import { ethers } from 'ethers';
import { SignerError } from '../utils/errors';
import type { ISigner, SignerInput, SignerCallback } from '../types';

/**
 * Signer Adapter
 * Unifies different signing methods into a common interface
 */
export class SignerAdapter implements ISigner {
  private signer: ISigner;
  
  constructor(input: SignerInput) {
    this.signer = this.createSigner(input);
  }
  
  /**
   * Create appropriate signer based on input type
   */
  private createSigner(input: SignerInput): ISigner {
    // 1. If already ISigner interface, use directly
    if (this.isISigner(input)) {
      return input;
    }
    
    // 2. If function, wrap as callback signer
    if (typeof input === 'function') {
      return new CallbackSigner(input);
    }
    
    // 3. If string, treat as private key
    if (typeof input === 'string') {
      return this.createPrivateKeySigner(input);
    }
    
    throw new SignerError('Invalid signer input type');
  }
  
  /**
   * Check if object implements ISigner interface
   */
  private isISigner(obj: any): obj is ISigner {
    return (
      obj &&
      typeof obj.getAddress === 'function' &&
      typeof obj.signMessage === 'function'
    );
  }
  
  /**
   * Create private key signer
   */
  private createPrivateKeySigner(privateKey: string): ISigner {
    try {
      // Remove 0x prefix if present
      const cleanKey = privateKey.startsWith('0x') 
        ? privateKey.slice(2) 
        : privateKey;
      
      // Validate private key format
      if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        throw new Error('Invalid private key format');
      }
      
      // Create ethers Wallet
      const wallet = new ethers.Wallet('0x' + cleanKey);
      
      // Wrap as ISigner
      return {
        async getAddress() {
          return wallet.address;
        },
        async signMessage(message: string | Uint8Array) {
          return wallet.signMessage(message);
        },
        async signTransaction(tx: any) {
          return wallet.signTransaction(tx);
        },
      };
      
    } catch (error) {
      throw new SignerError(`Failed to create private key signer: ${error.message}`);
    }
  }
  
  async getAddress(): Promise<string> {
    return this.signer.getAddress();
  }
  
  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.signer.signMessage(message);
  }
  
  async signTransaction(transaction: any): Promise<string> {
    if (this.signer.signTransaction) {
      return this.signer.signTransaction(transaction);
    }
    throw new SignerError('signTransaction not supported by this signer');
  }
}

/**
 * Callback Signer
 * Wraps a signing function as ISigner interface
 */
class CallbackSigner implements ISigner {
  private address: string | null = null;
  
  constructor(
    private callback: SignerCallback,
    private addressGetter?: () => Promise<string>
  ) {}
  
  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address;
    }
    
    if (this.addressGetter) {
      this.address = await this.addressGetter();
      return this.address;
    }
    
    throw new SignerError('Address getter not provided for callback signer');
  }
  
  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.callback(message);
  }
}
```

### Usage Examples

#### Example 1: Use MetaMask Signer

```typescript
import { EnclaveClient } from '@enclave/sdk';
import { BrowserProvider } from 'ethers';

async function connectWithMetaMask() {
  // Get MetaMask provider
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Create SDK client, pass ethers Signer directly
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: signer, // ethers.Signer implements ISigner interface
  });
  
  await client.connect();
  console.log('✅ Connected with MetaMask');
}
```

#### Example 2: Use Remote Signing Service

```typescript
import { EnclaveClient } from '@enclave/sdk';

async function connectWithRemoteSigner() {
  // Custom signing function
  const remoteSigner = async (message: string | Uint8Array) => {
    // Call remote signing service API
    const response = await fetch('https://my-signing-service.com/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: typeof message === 'string' ? message : Buffer.from(message).toString('hex'),
        userId: 'user123',
      }),
    });
    
    const { signature } = await response.json();
    return signature;
  };
  
  // Create SDK client, pass signing function
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: remoteSigner, // Pass signing function directly
  });
  
  await client.connect();
  console.log('✅ Connected with remote signer');
}
```

#### Example 3: Node.js Backend Private Key

```typescript
import { EnclaveClient } from '@enclave/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function connectWithPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  
  // Create SDK client, pass private key directly
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: privateKey, // Pass private key string directly
});

  await client.connect();
  console.log('✅ Connected with private key');
}
```

#### Example 4: Ledger Hardware Wallet

```typescript
import { EnclaveClient } from '@enclave/sdk';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';

async function connectWithLedger() {
  // Initialize Ledger
const transport = await TransportWebUSB.create();
const eth = new Eth(transport);
  const path = "m/44'/60'/0'/0/0";
  
  // Get Ledger address
  const { address } = await eth.getAddress(path);
  
  // Create custom signer
  const ledgerSigner = {
    async getAddress() {
      return address;
    },
    async signMessage(message: string | Uint8Array) {
      const messageHex = typeof message === 'string' 
        ? message 
        : Buffer.from(message).toString('hex');
      const result = await eth.signPersonalMessage(path, messageHex);
      return '0x' + result.r + result.s + result.v.toString(16).padStart(2, '0');
    },
  };
  
  // Create SDK client
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: ledgerSigner, // Pass Ledger signer
  });
  
  await client.connect();
  console.log('✅ Connected with Ledger');
}
```

### EnclaveClient Constructor Update

```typescript
export interface EnclaveConfig {
  apiUrl: string;
  wsUrl?: string;
  signer?: SignerInput; // Support signer in constructor
  autoRefreshInterval?: number;
  storageAdapter?: IStorageAdapter;
  websocketAdapter?: IWebSocketAdapter;
}

export class EnclaveClient {
  constructor(config: EnclaveConfig) {
    // ... other initialization
    
    // If signer provided, set directly
    if (config.signer) {
      this.wallet = new WalletManager(config.signer);
    }
  }
  
  /**
   * connect() method can be called with or without signer
   */
  async connect(signer?: SignerInput): Promise<void> {
    // If signer not provided in constructor, must provide in connect()
    if (!this.wallet && !signer) {
      throw new Error('Signer required. Provide in constructor or connect()');
    }
    
    // If signer provided here, override constructor signer
    if (signer) {
      this.wallet = new WalletManager(signer);
    }
    
    // ... rest of connection logic
  }
}
```

### Security Best Practices

1. **Private Key Management**:
```typescript
// ❌ Bad: Hardcode private key
const client = new EnclaveClient({
  signer: '0x1234567890abcdef...',
});

// ✅ Good: Use environment variables
const client = new EnclaveClient({
  signer: process.env.PRIVATE_KEY,
});

// ✅ Better: Use secure vault
const privateKey = await getSecretFromVault('ENCLAVE_PRIVATE_KEY');
const client = new EnclaveClient({ signer: privateKey });
```

2. **Signing Function Error Handling**:
```typescript
const safeSigner = async (message: string | Uint8Array) => {
  try {
    // Call external signing service
    return await externalSigningService.sign(message);
  } catch (error) {
    console.error('Signing failed:', error);
    throw new SignerError('External signing service unavailable');
  }
};
```

3. **Ledger User Confirmation**:
```typescript
// Show user-friendly prompt
console.log('📱 Please confirm signing on your Ledger device...');
const signature = await ledgerSigner.signMessage(message);
console.log('✅ Signed successfully');
```

---

## Data Formatters

To reduce backend API dependencies and support offline operations, the SDK implements data formatters internally for generating signed messages and payloads for commitments and withdrawals.

### Design Goals

1. **Consistency**: Data formatting logic is consistent across all language SDKs (JS, Go, Python, etc.)
2. **Offline Support**: Message generation doesn't require backend API calls
3. **Transparency**: Developers can clearly see data structure and signing content
4. **Security**: All hashing and signature generation are local, no sensitive data transmitted

### CommitmentFormatter (Commitment Data Formatter)

```typescript
// src/formatters/CommitmentFormatter.ts

import { keccak256, toUtf8Bytes, concat, zeroPadValue, toBeHex } from 'ethers';
import type { Allocation } from '../types/models';

/**
 * Commitment Data Formatter
 * Generates signed messages for Commitment operations
 */
export class CommitmentFormatter {
  /**
   * Prepare Commitment signing data
   * 
   * @param allocations - Allocation list
   * @param checkbookAddress - Checkbook contract address
   * @param chainId - Chain ID
   * @returns Signing message and sorted allocations
   */
  static prepareCommitmentData(
    allocations: Allocation[],
    checkbookAddress: string,
    chainId: number
  ): {
    message: string;
    sortedAllocations: Allocation[];
    commitmentsHash: string;
  } {
    // 1. Sort allocations (by token_id, then by value)
    const sortedAllocations = this.sortAllocations(allocations);
    
    // 2. Generate commitments hash
    const commitmentsHash = this.hashCommitments(sortedAllocations);
    
    // 3. Generate signing message
    const message = this.formatMessage(
      checkbookAddress,
      commitmentsHash,
      chainId
    );
    
    return {
      message,
      sortedAllocations,
      commitmentsHash,
    };
  }
  
  /**
   * Sort allocations
   * Sort rules: first by token_id, then by value
   */
  private static sortAllocations(allocations: Allocation[]): Allocation[] {
    return [...allocations].sort((a, b) => {
      // First compare token_id
      if (a.token_id !== b.token_id) {
        return a.token_id < b.token_id ? -1 : 1;
      }
      // If token_id same, compare value
      if (a.value !== b.value) {
        return a.value < b.value ? -1 : 1;
      }
      return 0;
    });
  }
  
  /**
   * Calculate commitments hash
   * Hash each allocation, then hash concatenated result
   */
  private static hashCommitments(allocations: Allocation[]): string {
    const hashes = allocations.map(allocation => {
      // Each allocation format: keccak256(token_id + value + salt + nullifier)
      const packed = concat([
        zeroPadValue(toBeHex(allocation.token_id), 32),      // uint256
        zeroPadValue(toBeHex(allocation.value), 32),         // uint256
        allocation.salt,                                      // bytes32
        allocation.nullifier,                                 // bytes32
      ]);
      return keccak256(packed);
    });
    
    // Concatenate all hashes and hash again
    const concatenated = concat(hashes);
    return keccak256(concatenated);
  }
  
  /**
   * Format signing message
   */
  private static formatMessage(
    checkbookAddress: string,
    commitmentsHash: string,
    chainId: number
  ): string {
    // EIP-712 style structured data
    const domain = {
      name: 'Enclave',
      version: '1',
      chainId: chainId,
      verifyingContract: checkbookAddress,
    };
    
    const message = {
      commitmentsHash: commitmentsHash,
    };
    
    // Note: Actual implementation should use ethers.TypedDataEncoder
    // Simplified example here
    const packed = concat([
      toUtf8Bytes('Enclave Commitment'),
      zeroPadValue(toBeHex(chainId), 32),
      checkbookAddress,
      commitmentsHash,
    ]);
    
    return keccak256(packed);
  }
  
  /**
   * Generate submission payload
   */
  static createSubmitPayload(
    sortedAllocations: Allocation[],
    signature: string,
    checkbookAddress: string
  ) {
      return {
      checkbook_address: checkbookAddress,
      allocations: sortedAllocations.map(a => ({
        token_id: a.token_id,
        value: a.value,
        salt: a.salt,
        nullifier: a.nullifier,
      })),
      signature: signature,
    };
  }
}
```

### WithdrawFormatter (Withdrawal Data Formatter)

```typescript
// src/formatters/WithdrawFormatter.ts

import { keccak256, concat, zeroPadValue, toBeHex } from 'ethers';
import type { Allocation, WithdrawIntent } from '../types/models';

/**
 * Withdrawal Data Formatter
 * Generates signed messages for withdrawal operations
 */
export class WithdrawFormatter {
  /**
   * Prepare withdrawal signing data
   * 
   * @param allocations - Allocation list to withdraw
   * @param intent - Withdrawal intent parameters
   * @param chainId - Chain ID
   * @returns Signing message and formatted data
   */
  static prepareWithdrawData(
    allocations: Allocation[],
    intent: WithdrawIntent,
    chainId: number
  ): {
    message: string;
    nullifiersHash: string;
    merkleRoot: string;
    intentHash: string;
  } {
    // 1. Generate nullifiers hash
    const nullifiersHash = this.hashNullifiers(allocations);
    
    // 2. Calculate Merkle root
    const merkleRoot = this.calculateMerkleRoot(allocations);
    
    // 3. Generate intent hash
    const intentHash = this.hashIntent(intent);
    
    // 4. Generate signing message
    const message = this.formatMessage(
      nullifiersHash,
      merkleRoot,
      intentHash,
      chainId
    );
    
    return {
      message,
      nullifiersHash,
      merkleRoot,
      intentHash,
    };
  }
  
  /**
   * Calculate nullifiers hash
   */
  private static hashNullifiers(allocations: Allocation[]): string {
    const nullifiers = allocations.map(a => a.nullifier);
    const concatenated = concat(nullifiers);
    return keccak256(concatenated);
  }
  
  /**
   * Calculate Merkle root
   * Note: Actual implementation should use complete Merkle tree algorithm
   */
  private static calculateMerkleRoot(allocations: Allocation[]): string {
    // Simplified version: hash all allocation data
    const leaves = allocations.map(allocation => {
      const packed = concat([
        zeroPadValue(toBeHex(allocation.token_id), 32),
        zeroPadValue(toBeHex(allocation.value), 32),
        allocation.nullifier,
      ]);
      return keccak256(packed);
    });
    
    // Build Merkle tree (simplified)
    return this.buildMerkleTree(leaves);
  }
  
  /**
   * Build Merkle tree
   */
  private static buildMerkleTree(leaves: string[]): string {
    if (leaves.length === 0) {
      return '0x' + '0'.repeat(64);
    }
    
    if (leaves.length === 1) {
      return leaves[0];
    }
    
    const newLevel: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      if (i + 1 < leaves.length) {
        newLevel.push(keccak256(concat([leaves[i], leaves[i + 1]])));
      } else {
        newLevel.push(leaves[i]);
      }
    }
    
    return this.buildMerkleTree(newLevel);
  }
  
  /**
   * Calculate intent hash
   */
  private static hashIntent(intent: WithdrawIntent): string {
    const packed = concat([
      intent.target_address,                               // address
      zeroPadValue(toBeHex(intent.target_chain_id), 32),  // uint256
      zeroPadValue(toBeHex(intent.token_id), 32),         // uint256
      zeroPadValue(toBeHex(intent.min_amount_out), 32),   // uint256
    ]);
    return keccak256(packed);
  }
  
  /**
   * Format signing message
   */
  private static formatMessage(
    nullifiersHash: string,
    merkleRoot: string,
    intentHash: string,
    chainId: number
  ): string {
    const packed = concat([
      toUtf8Bytes('Enclave Withdrawal'),
      zeroPadValue(toBeHex(chainId), 32),
      nullifiersHash,
      merkleRoot,
      intentHash,
    ]);
    return keccak256(packed);
  }
  
  /**
   * Generate submission payload
   */
  static createSubmitPayload(
    allocations: Allocation[],
    intent: WithdrawIntent,
    signature: string,
    merkleRoot: string,
    nullifiersHash: string
  ) {
    return {
      allocation_ids: allocations.map(a => a.id),
      intent: {
        target_address: intent.target_address,
        target_chain_id: intent.target_chain_id,
        token_id: intent.token_id,
        min_amount_out: intent.min_amount_out,
      },
      merkle_root: merkleRoot,
      nullifiers_hash: nullifiersHash,
      signature: signature,
    };
  }
}
```

### Usage in EnclaveClient

```typescript
// src/client/EnclaveClient.ts

import { CommitmentFormatter } from '../formatters/CommitmentFormatter';
import { WithdrawFormatter } from '../formatters/WithdrawFormatter';

export class EnclaveClient {
  /**
   * Prepare commitment data (no backend call)
   */
  async prepareCommitment(
    allocations: Allocation[],
    checkbookAddress: string
  ): Promise<{
    message: string;
    sortedAllocations: Allocation[];
    commitmentsHash: string;
  }> {
    const chainId = this.stores.user.chainId;
    return CommitmentFormatter.prepareCommitmentData(
        allocations,
      checkbookAddress,
      chainId
    );
  }
  
  /**
   * Sign and submit commitment
   */
  async submitCommitment(
    preparedData: ReturnType<typeof CommitmentFormatter.prepareCommitmentData>,
    checkbookAddress: string
  ): Promise<any> {
    // 1. User signs
    const signature = await this.wallet.signMessage(preparedData.message);
    
    // 2. Generate payload
    const payload = CommitmentFormatter.createSubmitPayload(
      preparedData.sortedAllocations,
      signature,
      checkbookAddress
    );
    
    // 3. Submit to backend
    return this.api.commitments.create(payload);
  }
  
  /**
   * Complete commitment process (one-step)
   */
  async createCommitment(
    allocations: Allocation[],
    checkbookAddress: string
  ): Promise<any> {
    const preparedData = await this.prepareCommitment(allocations, checkbookAddress);
    return this.submitCommitment(preparedData, checkbookAddress);
  }
  
  /**
   * Prepare withdrawal data (no backend call)
   */
  async prepareWithdraw(
    allocations: Allocation[],
    intent: WithdrawIntent
  ): Promise<ReturnType<typeof WithdrawFormatter.prepareWithdrawData>> {
    const chainId = this.stores.user.chainId;
    return WithdrawFormatter.prepareWithdrawData(allocations, intent, chainId);
  }
  
  /**
   * Sign and submit withdrawal
   */
  async submitWithdraw(
    allocations: Allocation[],
    intent: WithdrawIntent,
    preparedData: ReturnType<typeof WithdrawFormatter.prepareWithdrawData>
  ): Promise<any> {
    // 1. User signs
    const signature = await this.wallet.signMessage(preparedData.message);
    
    // 2. Generate payload
    const payload = WithdrawFormatter.createSubmitPayload(
      allocations,
      intent,
      signature,
      preparedData.merkleRoot,
      preparedData.nullifiersHash
    );
    
    // 3. Submit to backend
    return this.api.withdrawals.create(payload);
  }
  
  /**
   * Complete withdrawal process (one-step)
   */
  async withdraw(
    allocations: Allocation[],
    intent: WithdrawIntent
  ): Promise<any> {
    const preparedData = await this.prepareWithdraw(allocations, intent);
    return this.submitWithdraw(allocations, intent, preparedData);
  }
}
```

### Cross-Language Consistency Specification

**To ensure data formatting logic consistency across all language SDKs, follow these rules:**

| Step | Operation | Specification | Example |
|------|------|------|------|
| 1 | Allocation sorting | Sort by `token_id` ASC, then `value` ASC | `[{token:1,val:100}, {token:1,val:200}, {token:2,val:50}]` |
| 2 | Hash single allocation | `keccak256(token_id ‖ value ‖ salt ‖ nullifier)` | Each field padded to 32 bytes |
| 3 | Hash allocation list | Hash each allocation, concatenate, hash again | `keccak256(hash1 ‖ hash2 ‖ ...)` |
| 4 | Merkle tree | Standard binary Merkle tree, left-right hash pairing | Duplicate rightmost node if odd number |
| 5 | Intent hash | `keccak256(target_address ‖ target_chain_id ‖ token_id ‖ min_amount_out)` | Each uint256 padded to 32 bytes |
| 6 | Signing message | `keccak256(domain ‖ chainId ‖ hash_data)` | Follow EIP-712 style |

**Test Vectors** (Test data to ensure consistency):

```typescript
// Test case 1: Single allocation commitment
const testAllocation = {
  token_id: 1,
  value: 1000000000000000000n, // 1 token
  salt: '0x1234...', // 32 bytes
  nullifier: '0x5678...', // 32 bytes
};

// Expected hash
const expectedHash = '0xabcd...';

// Test case 2: Multiple allocations
const testAllocations = [
  { token_id: 2, value: 500n },
  { token_id: 1, value: 1000n },
  { token_id: 1, value: 500n },
];

// Expected sorted order
const expectedSorted = [
  { token_id: 1, value: 500n },
  { token_id: 1, value: 1000n },
  { token_id: 2, value: 500n },
];

// Expected commitments hash
const expectedCommitmentsHash = '0x9876...';
```

### SDK Internal Implementation vs Backend API

| Operation | SDK Internal | Backend API | Reason |
|------|---------|---------|------|
| Generate commitment message | ✅ `prepareCommitment()` | ❌ | Support offline signing |
| Sign commitment | ✅ `wallet.signMessage()` | ❌ | Private key never leaves client |
| Submit commitment | ❌ | ✅ `POST /api/commitments` | Need backend verification & storage |
| Generate withdrawal message | ✅ `prepareWithdraw()` | ❌ | Support offline signing |
| Sign withdrawal | ✅ `wallet.signMessage()` | ❌ | Private key never leaves client |
| Submit withdrawal | ❌ | ✅ `POST /api/withdrawals` | Need backend processing & on-chain execution |
| Calculate Merkle root | ✅ `calculateMerkleRoot()` | ❌ | Client verification, backend will recalculate |

**Design Trade-offs**:

1. **Offline Support**: Users can generate signing data without network
2. **Transparency**: Users can clearly see what they're signing
3. **Security**: Private keys never transmitted to backend
4. **Verification**: Backend will recalculate and verify all hashes
5. **Consistency**: Ensure cross-language SDK consistency through standardized algorithms

---

## Additional Chapters

The following chapters provide comprehensive coverage of the SDK's remaining architecture components:

### API Client

**APIClient Base Class**
- Unified HTTP client with axios
- Request/response interceptors
- Automatic authentication token management
- Error handling and status code mapping

**Error Types**
- `ValidationError`, `AuthenticationError`, `PermissionError`
- `NotFoundError`, `ServerError`, `NetworkError`
- Unified error handling strategy

---

### WebSocket Layer

**WebSocketClient**
- Cross-platform WebSocket abstraction
- Automatic reconnection with exponential backoff
- Heartbeat mechanism for connection keepalive
- Event-driven message handling

**Features**
- Configurable reconnection attempts
- Connection state management
- Message queueing during reconnection

---

### Environment Adapters

**WebSocket Adapters**
- `BrowserWebSocketAdapter` - Native browser WebSocket
- `NodeWebSocketAdapter` - Node.js `ws` package integration
- `IWebSocketAdapter` interface for custom implementations

**Storage Adapters**
- `LocalStorageAdapter` - Browser localStorage
- `IStorageAdapter` interface for custom storage (e.g., React Native AsyncStorage)

---

### Business Operations Layer

**ActionManager**
- Encapsulates complex business workflows
- Combines data preparation, signing, and submission
- Methods: `createCommitment()`, `withdraw()`

**Benefits**
- Simplified API for common operations
- Consistent error handling
- Automatic Store updates

---

### Platform Integration

**React Integration**
- `useEnclaveClient()` - Client connection hook
- `useStore()` - Reactive Store data hook
- `useCheckbooks()`, `useAllocations()` - Specific Store hooks
- Automatic re-rendering with MobX observer

**Next.js Integration**
- Client-side only utilities
- SSR-safe client creation
- Environment detection

---

### Error Handling

**Error Hierarchy**
- `EnclaveSDKError` - Base error class
- `ConnectionError` - WebSocket/network errors
- `SignerError` - Signing operation failures
- `StoreError` - Data management errors

**Error Codes**
- Structured error codes for programmatic handling
- Optional error details for debugging

---

### Performance Optimization

**Strategies**
1. **Lazy Loading** - Dynamic imports for large dependencies
2. **Batch Updates** - MobX `runInAction` for multiple mutations
3. **Computed Caching** - Automatic caching of derived values
4. **Precise Rendering** - Fine-grained reactivity with MobX

---

### Testing Strategy

**Unit Tests**
- Store logic testing
- Utility function tests
- Mock API clients

**Integration Tests**
- Full client connection flow
- End-to-end data synchronization
- WebSocket reconnection scenarios

---

## Summary

Enclave JavaScript SDK v2.0 provides:

### Core Features
✅ **Reactive State Management**: MobX auto-tracking, automatic UI updates  
✅ **Environment Agnostic**: Browser, Node.js, React Native support  
✅ **Type Safety**: Complete TypeScript definitions  
✅ **Real-time Sync**: WebSocket push + explicit query backup  
✅ **Security First**: Private keys never leave client, multiple signer options  
✅ **Offline Support**: SDK-internal formatting, offline signing capability  

### Architecture Benefits
- **Modular**: Clear separation of concerns, easy to maintain
- **Testable**: Dependency injection, easy mocking
- **High Performance**: Lazy loading, batch updates, precise rendering
- **Cross-platform**: Adapter pattern for different environments
- **Developer Friendly**: Complete docs, examples, and type hints

### Documentation
- **Technical Design**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md) (This document)
- **API Mapping**: [SDK_API_MAPPING.md](./SDK_API_MAPPING.md)
- **SDK Overview**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md)

---

**For complete technical details with full code examples, please refer to the Chinese version**: [SDK_JS_DESIGN.zh-CN.md](./SDK_JS_DESIGN.zh-CN.md)

---

**Version**: v2.0.0  
**Last Updated**: 2025-01-17  
**Status**: Complete ✅
