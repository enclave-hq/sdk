# Integration Guide: SDK + Wallet SDK

## Quick Start

### Installation

```bash
npm install @enclave-hq/sdk @enclave-hq/wallet-sdk
```

## Basic Setup

### 1. Create a Wallet Manager (wallet-sdk)

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

// Create wallet manager instance
const walletManager = new WalletManager({
  enableStorage: true,           // Auto-save connection state
  storagePrefix: 'myapp_wallet_',
  defaultChainId: 1,              // Ethereum Mainnet
  defaultTronChainId: 195,        // Tron Mainnet
});

// Connect to MetaMask
await walletManager.connect(WalletType.METAMASK);

// Or connect to TronLink
await walletManager.connect(WalletType.TRONLINK);
```

### 2. Create Enclave SDK Client

```typescript
import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';

// Create contract provider adapter
const contractProvider = new WalletSDKContractProvider(walletManager);

// Create signer adapter
const signer = {
  getAddress: async () => {
    const account = walletManager.getCurrentAccount();
    if (!account) throw new Error('No account');
    return account.nativeAddress;
  },
  signMessage: async (message: string | Uint8Array) => {
    const msg = typeof message === 'string' ? message : Buffer.from(message).toString('hex');
    return walletManager.signMessage(msg);
  },
};

// Initialize Enclave SDK
const enclaveClient = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer,           // For signing messages
  contractProvider, // For contract read/write
});

// Connect to backend
await enclaveClient.connect();
```

## React Integration

### Complete React Example

```typescript
import React, { useState, useEffect } from 'react';
import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

export function MyApp() {
  // Step 1: Create wallet manager (singleton)
  const [walletManager] = useState(() => new WalletManager());
  
  // Step 2: Track connection states
  const [walletConnected, setWalletConnected] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [enclaveClient, setEnclaveClient] = useState<EnclaveClient | null>(null);
  const [account, setAccount] = useState<string>('');

  // Step 3: Connect wallet
  const connectWallet = async () => {
    try {
      // Connect to MetaMask
      await walletManager.connect(WalletType.METAMASK);
      
      const acc = walletManager.getCurrentAccount();
      setAccount(acc?.nativeAddress || '');
      setWalletConnected(true);
      
      console.log('✅ Wallet connected:', acc?.nativeAddress);
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
    }
  };

  // Step 4: Connect to Enclave SDK
  const connectSDK = async () => {
    if (!walletConnected) {
      alert('Please connect wallet first');
      return;
    }

    try {
      // Create contract provider
      const contractProvider = new WalletSDKContractProvider(walletManager);
      
      // Create signer
      const signer = {
        getAddress: async () => {
          const acc = walletManager.getCurrentAccount();
          if (!acc) throw new Error('No account');
          return acc.nativeAddress;
        },
        signMessage: async (message: string | Uint8Array) => {
          const msg = typeof message === 'string' 
            ? message 
            : Buffer.from(message).toString('hex');
          return walletManager.signMessage(msg);
        },
      };

      // Initialize SDK
      const client = new EnclaveClient({
        apiUrl: 'https://api.enclave-hq.com',
        wsUrl: 'wss://api.enclave-hq.com/ws',
        signer,
        contractProvider,
      });

      // Connect
      await client.connect();
      
      setEnclaveClient(client);
      setSdkConnected(true);
      
      console.log('✅ SDK connected');
    } catch (error) {
      console.error('❌ SDK connection failed:', error);
    }
  };

  // Step 5: Use SDK business functions
  const createCheckbook = async () => {
    if (!enclaveClient) return;

    try {
      const result = await enclaveClient.actions.createCommitment({
        poolId: 'pool-123',
        tokenAddress: '0xUSDTAddress',
        amount: '1000000000000000000', // 1 token (18 decimals)
        allocations: [
          { amount: '500000000000000000' },
          { amount: '500000000000000000' },
        ],
      });
      
      console.log('✅ Checkbook created:', result.checkbookId);
    } catch (error) {
      console.error('❌ Create checkbook failed:', error);
    }
  };

  // Step 6: Use wallet-sdk contract functions directly
  const readTokenBalance = async () => {
    if (!walletConnected) return;

    try {
      const ERC20_ABI = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ];

      // Direct use of wallet-sdk
      const balance = await walletManager.readContract(
        '0xUSDTAddress',
        ERC20_ABI,
        'balanceOf',
        [account]
      );
      
      console.log('💰 Token balance:', balance.toString());
    } catch (error) {
      console.error('❌ Read balance failed:', error);
    }
  };

  // Listen to wallet events
  useEffect(() => {
    if (!walletManager) return;

    const handleAccountChanged = (newAccount: any) => {
      if (newAccount) {
        setAccount(newAccount.nativeAddress);
        console.log('🔄 Account changed:', newAccount.nativeAddress);
      } else {
        setAccount('');
        setWalletConnected(false);
        setSdkConnected(false);
      }
    };

    walletManager.on('accountChanged', handleAccountChanged);

    return () => {
      walletManager.off('accountChanged', handleAccountChanged);
    };
  }, [walletManager]);

  // Render
  return (
    <div>
      <h1>My Enclave App</h1>
      
      {/* Step 1: Connect Wallet */}
      {!walletConnected && (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      )}
      
      {/* Step 2: Connect SDK */}
      {walletConnected && !sdkConnected && (
        <div>
          <p>Wallet: {account}</p>
          <button onClick={connectSDK}>
            Connect to Enclave
          </button>
        </div>
      )}
      
      {/* Step 3: Use Features */}
      {sdkConnected && (
        <div>
          <p>✅ Connected: {account}</p>
          
          {/* SDK Business Logic */}
          <button onClick={createCheckbook}>
            Create Checkbook
          </button>
          
          {/* Direct Wallet Operations */}
          <button onClick={readTokenBalance}>
            Read Token Balance
          </button>
        </div>
      )}
    </div>
  );
}
```

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  }
}
```

## Common Patterns

### Pattern 1: Wallet-First Approach

```typescript
// 1. Connect wallet first
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);

// 2. Use wallet directly for simple operations
const balance = await walletManager.readContract(...);

// 3. Optionally connect SDK for business logic
const client = new EnclaveClient({
  contractProvider: new WalletSDKContractProvider(walletManager),
});
await client.connect();
```

### Pattern 2: SDK-Centric Approach

```typescript
// 1. Connect wallet
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);

// 2. Immediately connect SDK
const client = new EnclaveClient({
  contractProvider: new WalletSDKContractProvider(walletManager),
});
await client.connect();

// 3. Use SDK for everything
await client.actions.createCommitment(...);
await client.contractProvider.readContract(...);
```

### Pattern 3: Multi-Wallet Support

```typescript
const walletManager = new WalletManager();

// Connect primary wallet (EVM)
await walletManager.connect(WalletType.METAMASK);

// Connect secondary wallet (Tron)
await walletManager.connectAdditional(WalletType.TRONLINK);

// Switch primary wallet
await walletManager.switchPrimaryWallet(ChainType.TRON);

// SDK automatically uses the primary wallet
const client = new EnclaveClient({
  contractProvider: new WalletSDKContractProvider(walletManager),
});
```

## Error Handling

```typescript
try {
  // Connect wallet
  await walletManager.connect(WalletType.METAMASK);
} catch (error) {
  if (error.code === 4001) {
    // User rejected connection
    console.log('User cancelled connection');
  } else if (error.message.includes('not installed')) {
    // Wallet not installed
    console.log('Please install MetaMask');
  } else {
    // Other errors
    console.error('Connection failed:', error);
  }
}
```

## Best Practices

### 1. **Singleton Wallet Manager**
```typescript
// ✅ Good: Create once, reuse
const walletManager = new WalletManager();

// ❌ Bad: Creating multiple instances
const wallet1 = new WalletManager();
const wallet2 = new WalletManager(); // Don't do this
```

### 2. **Check Connection State**
```typescript
// Always check before operations
if (!walletManager.isConnected()) {
  throw new Error('Wallet not connected');
}

const account = walletManager.getCurrentAccount();
if (!account) {
  throw new Error('No account available');
}
```

### 3. **Handle Account/Chain Changes**
```typescript
walletManager.on('accountChanged', (newAccount) => {
  // Update UI
  // May need to refresh data
  // Consider reconnecting SDK
});

walletManager.on('chainChanged', (chainId) => {
  // Validate chain is supported
  // Update UI
  // Consider reconnecting SDK
});
```

### 4. **Cleanup on Unmount**
```typescript
useEffect(() => {
  // Setup
  const handler = (account) => { /* ... */ };
  walletManager.on('accountChanged', handler);
  
  // Cleanup
  return () => {
    walletManager.off('accountChanged', handler);
  };
}, []);
```

## Troubleshooting

### Issue: "No account connected"
**Solution**: Always connect wallet before SDK
```typescript
// 1. Connect wallet first
await walletManager.connect(WalletType.METAMASK);

// 2. Then connect SDK
const client = new EnclaveClient({ ... });
await client.connect();
```

### Issue: "Wallet not available"
**Solution**: Detect wallet availability first
```typescript
import { WalletDetector } from '@enclave-hq/wallet-sdk';

const detector = new WalletDetector();
const wallets = await detector.detectAllWallets();

const metamask = wallets.find(w => w.walletType === WalletType.METAMASK);
if (!metamask?.isAvailable) {
  alert('Please install MetaMask');
}
```

### Issue: Contract calls fail after chain switch
**Solution**: Reconnect or refresh after chain change
```typescript
walletManager.on('chainChanged', async (chainId) => {
  // Option 1: Refresh page
  window.location.reload();
  
  // Option 2: Reconnect SDK
  if (enclaveClient) {
    await enclaveClient.disconnect();
    await enclaveClient.connect();
  }
});
```

## Summary

| Step | Component | Purpose |
|------|-----------|---------|
| 1 | `WalletManager` | Connect to user's wallet |
| 2 | `WalletSDKContractProvider` | Bridge wallet-sdk to SDK |
| 3 | `EnclaveClient` | Connect to backend, use business logic |
| 4 | Use SDK or wallet-sdk directly | Depending on needs |

**Key Takeaway**: 
- Wallet-sdk handles **wallet connection** and **contract calls**
- SDK handles **business logic** and **backend communication**
- Contract Provider **bridges** the two


