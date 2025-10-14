# ZKPay Client Library API Documentation

ZKPay client library provides complete backend interaction interfaces, including login, deposit, commitment, withdrawal and other functions.

## Quick Start

### Basic Usage

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

// Create client
const client = new ZKPayClient(config, logger);

// Initialize
await client.initialize();

// Method 1: Direct private key login
await client.login(privateKey, "user1");

// Execute operations...
```

### KMS Integration Usage

```javascript
// Method 2: Basic KMS login
const { ZKPayKMSSigner } = require("../utils/zkpay-kms-adapter");

const kmsConfig = {
  baseURL: "http://localhost:18082",
  keyAlias: "my_bsc_key",
  encryptedKey: "encrypted_private_key_from_kms",
  slip44Id: 714, // BSC
  address: "0x...",
  defaultSignatureType: "eip191",
};

const kmsSigner = new ZKPayKMSSigner(kmsConfig);
await client.loginWithSigner(kmsSigner, kmsConfig.address);

// Method 3: SAAS KMS login
const { SaasKMSSigner } = require("../utils/saas-kms-signer");

const saasKmsConfig = {
  kmsUrl: "https://kms.your-saas.com",
  enterpriseId: "your_enterprise_id",
  chainId: 714,
  userAddress: "0x...",
  keyAlias: "enterprise_key",
  k1Key: "your_k1_key",
};

const saasSigner = new SaasKMSSigner(saasKmsConfig);
await client.loginWithSigner(saasSigner, saasKmsConfig.userAddress);
```

## API Reference

### 1. Initialization and Authentication

#### `initialize()`

Initialize client library

```javascript
await client.initialize();
```

#### `login(privateKey, userName?)`

Login to backend using private key

```javascript
const result = await client.login("0x...", "user1");
// Returns: { success: true, address: '0x...', userName: 'user1', token: '...' }
```

#### `loginWithSigner(signer, userAddress)`

Login to backend using KMS signer

```javascript
// Basic KMS signer
const kmsSigner = new ZKPayKMSSigner(kmsConfig);
const result = await client.loginWithSigner(kmsSigner, userAddress);

// SAAS KMS signer
const saasSigner = new SaasKMSSigner(saasKmsConfig);
const result = await client.loginWithSigner(saasSigner, userAddress);
// Returns: { success: true, address: '0x...', userName: 'auto', token: '...' }
```

#### `isLoggedIn()`

Check login status

```javascript
const loggedIn = client.isLoggedIn(); // true/false
```

#### `getCurrentUser()`

Get current user information

```javascript
const user = client.getCurrentUser();
// Returns: { address: '0x...', privateKey: '0x...', userName: 'user1', wallet: Wallet }
```

#### `logout()`

Logout

```javascript
client.logout();
```

### 2. Token Operations

#### `checkTokenBalance(chainId, tokenSymbol)`

Check token balance

```javascript
const balance = await client.checkTokenBalance(56, "test_usdt");
// Returns: { balance: BigInt, decimals: 18, symbol: 'TUSDT', formatted: '100.0' }
```

#### `checkTokenAllowance(chainId, tokenSymbol)`

Check token allowance

```javascript
const allowance = await client.checkTokenAllowance(56, "test_usdt");
// Returns: { allowance: BigInt, decimals: 18, formatted: '50.0' }
```

#### `approveToken(chainId, tokenSymbol, amount)`

Approve token

```javascript
const result = await client.approveToken(56, "test_usdt", "100.0");
// Returns: { txHash: '0x...', receipt: {...}, allowance: BigInt, gasUsed: BigInt }
```

### 3. Deposit Operations

#### `deposit(chainId, tokenSymbol, amount)`

Execute deposit (includes automatic approval)

```javascript
const result = await client.deposit(56, "test_usdt", "10.0");
// Returns: { approve: {...}, deposit: {...}, chainId: 56, tokenSymbol: 'test_usdt', amount: '10.0' }
```

#### `waitForDepositDetection(txHash, chainId, maxWaitTime?)`

Wait for backend to detect deposit

```javascript
const deposit = await client.waitForDepositDetection("0x...", 56, 60);
// Returns: deposit record object
```

### 4. CheckBook Operations

#### `getUserDeposits(userAddress?, chainId?)`

Get user's deposit records (CheckBook)

```javascript
const deposits = await client.getUserDeposits();
// Returns: [{ id, checkbookId, localDepositId, status, chainId, tokenId, ... }]
```

#### `getCheckbookDetails(checkbookId)`

Get specific CheckBook details

```javascript
const checkbook = await client.getCheckbookDetails("checkbook_123");
// Returns: CheckBook detailed information
```

### 5. Allocation and Signing

#### `createAllocationAndSign(checkbookId, allocations, options?)`

Create allocation plan and sign

```javascript
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x...",
    amount: "10000000000000000000", // 10.0 USDT (18 decimals)
  },
];

const result = await client.createAllocationAndSign(
  "checkbook_123",
  allocations
);
// Returns: { checkbookId, allocations, signature, signatureMessage, deposit }
```

### 6. Commitment Operations

#### `executeCommitmentSync(checkbookId, allocations, waitForWithCheck?)`

Execute Commitment (synchronous mode, wait for completion)

```javascript
const result = await client.executeCommitmentSync(
  "checkbook_123",
  allocations,
  true
);
// Returns: { status: 'with_checkbook', finalStatus: 'with_checkbook', ... }
```

#### `executeCommitmentAsync(checkbookId, allocations)`

Execute Commitment (asynchronous mode, return immediately)

```javascript
const result = await client.executeCommitmentAsync(
  "checkbook_123",
  allocations
);
// Returns: {
//   status: 'submitted',
//   waitForCompletion: (targetStatuses, maxWaitTime) => Promise,
//   checkStatus: () => Promise
// }

// Optional: wait for completion
const finalResult = await result.waitForCompletion(["with_checkbook"], 300);
```

#### `waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime?)`

Wait for Commitment status change

```javascript
const result = await client.waitForCommitmentStatus(
  "checkbook_123",
  ["with_checkbook", "issued"],
  300
);
```

### 7. Withdrawal Proof Operations

#### `generateProofSync(checkbookId, recipientInfo, waitForCompleted?)`

Generate withdrawal proof (synchronous mode, wait for completion)

```javascript
const recipientInfo = {
  chain_id: 714,
  address: "0x...",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const result = await client.generateProofSync(
  "checkbook_123",
  recipientInfo,
  true
);
// Returns: { checkId, completionResult, finalStatus: 'completed', ... }
```

#### `generateProofAsync(checkbookId, recipientInfo)`

Generate withdrawal proof (asynchronous mode, return immediately)

```javascript
const result = await client.generateProofAsync("checkbook_123", recipientInfo);
// Returns: {
//   checkId: 'check_456',
//   waitForCompletion: (maxWaitTime) => Promise,
//   checkStatus: () => Promise
// }

// Optional: wait for completion
const completionResult = await result.waitForCompletion(300);
```

### 8. Advanced Operations

#### `performFullDepositToCommitment(chainId, tokenSymbol, amount, allocations, options?)`

Complete flow from deposit to Commitment

```javascript
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x...",
    amount: "10000000000000000000",
  },
];

const result = await client.performFullDepositToCommitment(
  56,
  "test_usdt",
  "10.0",
  allocations,
  { waitForCommitment: true, maxWaitTime: 300 }
);
// Returns: { deposit: {...}, depositRecord: {...}, commitment: {...}, success: true }
```

#### `performFullCommitmentToWithdraw(checkbookId, recipientInfo, options?)`

Complete flow from Commitment to withdrawal

```javascript
const recipientInfo = {
  chain_id: 714,
  address: "0x...",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const result = await client.performFullCommitmentToWithdraw(
  "checkbook_123",
  recipientInfo,
  { waitForProof: true, maxWaitTime: 300 }
);
// Returns: { checkbook: {...}, proof: {...}, success: true }
```

### 9. Utility Methods

#### `getSupportedChains()`

Get list of supported chains

```javascript
const chains = client.getSupportedChains();
// Returns: [{ chain_id: 56, name: 'BSC', ... }, ...]
```

#### `getSupportedTokens(chainId)`

Get list of supported tokens for specified chain

```javascript
const tokens = client.getSupportedTokens(56);
// Returns: { 'test_usdt': { address: '0x...', decimals: 18 }, ... }
```

#### `cleanup()`

Clean up resources

```javascript
await client.cleanup();
```

## 📊 API Call Flow

### Complete API Call Flow Diagram

```
Stage 1: Init/Auth    Stage 2: Deposit      Stage 3: Commitment   Stage 4: Proof Gen    Stage 5: Monitoring
      ↓                    ↓                    ↓                    ↓                    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ initialize  │    │checkBalance │    │createAlloc  │    │generateProof│    │waitForStatus│
│             │    │             │    │AndSign      │    │Sync/Async   │    │             │
│ login/      │    │checkAllowance│   │             │    │             │    │checkStatus  │
│ loginWith   │    │             │    │executeCommit│    │             │    │             │
│ Signer      │    │approveToken │    │ment         │    │             │    │             │
│             │    │             │    │Sync/Async   │    │             │    │             │
│             │    │deposit      │    │             │    │             │    │             │
│             │    │             │    │             │    │             │    │             │
│             │    │waitForDeposit│   │             │    │             │    │             │
│             │    │Detection    │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Stage Details

#### Stage 1: Initialization and Authentication

1. **Client Initialization**: `await client.initialize()`
2. **User Authentication** (3 methods):
   - Direct private key: `await client.login(privateKey)`
   - Basic KMS: `await client.loginWithSigner(kmsSigner, userAddress)`
   - SAAS KMS: `await client.loginWithSigner(saasSigner, userAddress)`

#### Stage 2: Deposit Operations

1. **Check Token Balance**: `await client.checkTokenBalance(chainId, tokenAddress)`
2. **Check Token Allowance**: `await client.checkTokenAllowance(chainId, tokenAddress, treasuryAddress)`
3. **Approve Token** (if needed): `await client.approveToken(chainId, tokenAddress, amount, treasuryAddress)`
4. **Execute Deposit**: `await client.deposit(chainId, tokenAddress, amount, treasuryAddress)`
5. **Wait for Backend Detection**: `await client.waitForDepositDetection(txHash, chainId, maxWaitTime)`

#### Stage 3: Commitment Allocation

1. **Create Allocation Plan**: Define allocations array
2. **Create Allocation and Sign**: `await client.createAllocationAndSign(checkbookId, allocations)`
3. **Execute Commitment** (choose one):
   - Synchronous: `await client.executeCommitmentSync(checkbookId, allocations, waitForWithCheck)`
   - Asynchronous: `await client.executeCommitmentAsync(checkbookId, allocations)`

#### Stage 4: Proof Generation

1. **Prepare Recipient Info**: Define recipientInfo object
2. **Generate Withdrawal Proof** (choose one):
   - Synchronous: `await client.generateProofSync(checkbookId, recipientInfo, waitForCompleted)`
   - Asynchronous: `await client.generateProofAsync(checkbookId, recipientInfo)`

#### Stage 5: Status Monitoring

1. **Monitor Commitment Status**: `await client.waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime)`
2. **Monitor Proof Status**: `await client.waitForProofStatus(checkId, targetStatuses, maxWaitTime)`
3. **Check Current Status**: `await client.checkStatus()`

### API Call Sequence Diagram

```
Client          WalletManager    DepositManager   CommitmentManager   WithdrawManager
  │                    │               │                 │                 │
  │─── initialize() ───│               │                 │                 │
  │                    │               │                 │                 │
  │─── login() ────────│               │                 │                 │
  │                    │               │                 │                 │
  │─── checkBalance ───┼───────────────│                 │                 │
  │                    │               │                 │                 │
  │─── deposit() ──────┼───────────────│                 │                 │
  │                    │               │                 │                 │
  │─── executeCommitment() ────────────┼─────────────────│                 │
  │                    │               │                 │                 │
  │─── generateProof() ────────────────┼─────────────────┼─────────────────│
  │                    │               │                 │                 │
```

## Usage Examples

### Complete Flow Example

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

async function fullExample() {
  const client = new ZKPayClient(config);

  try {
    // 1. Initialize
    await client.initialize();

    // 2. Login
    await client.login("0x...", "user1");

    // 3. Check balance
    const balance = await client.checkTokenBalance(56, "test_usdt");
    console.log("Balance:", balance.formatted);

    // 4. Execute deposit
    const depositResult = await client.deposit(56, "test_usdt", "10.0");
    console.log("Deposit successful:", depositResult.deposit.txHash);

    // 5. Wait for detection
    const depositRecord = await client.waitForDepositDetection(
      depositResult.deposit.txHash,
      56,
      60
    );

    // 6. Create allocation and execute Commitment
    const allocations = [
      {
        recipient_chain_id: 714,
        recipient_address: "0x...",
        amount: "10000000000000000000",
      },
    ];

    const commitmentResult = await client.executeCommitmentSync(
      depositRecord.checkbook_id,
      allocations,
      true
    );
    console.log("Commitment successful:", commitmentResult.status);

    // 7. Generate withdrawal proof
    const recipientInfo = {
      chain_id: 714,
      address: client.getCurrentUser().address,
      amount: "10000000000000000000",
      token_symbol: "test_usdt",
    };

    const proofResult = await client.generateProofSync(
      depositRecord.checkbook_id,
      recipientInfo,
      true
    );
    console.log(
      "Withdrawal successful:",
      proofResult.completionResult.transaction_hash
    );
  } finally {
    await client.cleanup();
  }
}
```

### Asynchronous Operation Example

```javascript
async function asyncExample() {
  const client = new ZKPayClient(config);

  try {
    await client.initialize();
    await client.login("0x...", "user1");

    // 异步执行Commitment
    const commitmentResult = await client.executeCommitmentAsync(
      "checkbook_123",
      allocations
    );

    console.log("Commitment submitted:", commitmentResult.status);

    // Wait for completion in background
    commitmentResult
      .waitForCompletion(["with_checkbook"], 300)
      .then((result) => {
        console.log("Commitment completed:", result.status);

        // Continue to withdrawal
        return client.generateProofAsync("checkbook_123", recipientInfo);
      })
      .then((proofResult) => {
        console.log("Withdrawal proof submitted:", proofResult.checkId);

        return proofResult.waitForCompletion(300);
      })
      .then((completionResult) => {
        console.log("Withdrawal completed:", completionResult.transaction_hash);
      })
      .catch((error) => {
        console.error("Async operation failed:", error.message);
      });

    // Main thread can continue other operations...
  } finally {
    await client.cleanup();
  }
}
```

## Error Handling

All methods may throw exceptions, it is recommended to use try-catch for error handling:

```javascript
try {
  const result = await client.deposit(56, "test_usdt", "10.0");
  console.log("Operation successful:", result);
} catch (error) {
  console.error("Operation failed:", error.message);

  // Check specific error types
  if (error.message.includes("Insufficient balance")) {
    console.log("Please deposit tokens first");
  } else if (error.message.includes("Not logged in")) {
    console.log("Please login first");
  }
}
```

## Configuration Requirements

### Basic Configuration

The client library requires the following basic configuration structure:

```yaml
environment:
  name: "development"

services:
  zkpay_backend:
    url: "http://localhost:3001"
    timeout: 30000

blockchain:
  management_chain:
    chain_id: 714
    name: "BSC"
    rpc_url: "https://bsc-dataseed1.binance.org/"
    contracts:
      treasury_contract: "0x..."
    tokens:
      test_usdt:
        address: "0x..."
        decimals: 18

  source_chains:
    - chain_id: 56
      name: "BSC Mainnet"
      rpc_url: "https://bsc-dataseed1.binance.org/"
      contracts:
        treasury_contract: "0x..."
      tokens:
        test_usdt:
          address: "0x..."
          decimals: 18

test_users:
  default:
    private_key: "0x..."
    address: "0x..."

test_config:
  deposit:
    default_amount: "10.0"
    confirmation_blocks: 1
  withdraw:
    max_wait_time: 180

logging:
  level: "info"
```

### KMS Configuration

#### Basic KMS Configuration

```json
{
  "kms": {
    "type": "basic",
    "config": {
      "baseURL": "http://localhost:18082",
      "keyAlias": "my_bsc_key",
      "encryptedKey": "encrypted_private_key_from_kms",
      "slip44Id": 714,
      "address": "0x...",
      "defaultSignatureType": "eip191"
    }
  }
}
```

#### SAAS KMS Configuration

```json
{
  "kms": {
    "type": "saas",
    "config": {
      "kmsUrl": "https://kms.your-saas.com",
      "enterpriseId": "your_enterprise_id",
      "chainId": 714,
      "userAddress": "0x...",
      "keyAlias": "enterprise_key",
      "k1Key": "your_k1_key"
    }
  }
}
```

#### Multi-chain KMS Configuration

```json
{
  "kms": {
    "type": "multi_chain",
    "chains": {
      "bsc": {
        "slip44Id": 714,
        "encryptedKey": "bsc_encrypted_key",
        "address": "0xBSC_ADDRESS",
        "defaultSignatureType": "eip191"
      },
      "ethereum": {
        "slip44Id": 60,
        "encryptedKey": "eth_encrypted_key",
        "address": "0xETH_ADDRESS",
        "defaultSignatureType": "eip191"
      },
      "tron": {
        "slip44Id": 195,
        "encryptedKey": "tron_encrypted_key",
        "address": "TRON_ADDRESS",
        "defaultSignatureType": "tip191t"
      }
    }
  }
}
```

### Supported KMS Signature Types

| Network  | SLIP44 ID | Signature Type | Description                           |
| -------- | --------- | -------------- | ------------------------------------- |
| Ethereum | 60        | eip191         | Ethereum EIP-191 standard signature   |
| BSC      | 714       | eip191         | Binance Smart Chain EIP-191 signature |
| Tron     | 195       | tip191t        | Tron TIP-191T signature               |
| Polygon  | 966       | eip191         | Polygon EIP-191 签名                  |
| Arbitrum | 42161     | eip191         | Arbitrum EIP-191 签名                 |
| Optimism | 10        | eip191         | Optimism EIP-191 签名                 |

## Important Notes

### Basic Usage Notes

1. **Login Status**: Most operations require calling `login()` 或 `loginWithSigner()` 方法
2. **Async Operations**: The difference between sync and async methods is whether to wait for operation completion
3. **Error Handling**: All methods may throw exceptions, proper error handling is required
4. **Resource Cleanup**: Call `cleanup()` method to clean up resources after use
5. **Amount Precision**: Token amounts need to consider precision, typically 18 decimals
6. **Chain ID**: Use SLIP-44 standard chain ID (e.g., BSC is 714)

### KMS Integration Notes

7. **KMS Connection**: Ensure KMS service is accessible with stable network connection
8. **Signature Type**: Different blockchain networks require corresponding signature types (eip191/tip191t)
9. **Key Management**: Key alias (keyAlias) in KMS must be unique and correctly configured
10. **Enterprise Authentication**: SAAS KMS requires valid enterprise ID and K1 key for authentication
11. **Multi-chain Support**: When using multi-chain KMS, ensure each chain is configured correctly
12. **Security**: KMS signer automatically handles private key security, no need to manually manage private keys
13. **Error Retry**: KMS service may fail due to network issues, implement retry mechanism is recommended
14. **Logging**: KMS operations generate detailed logs for debugging and auditing

## More Examples

See `zkpay-client-example.js` file for more detailed usage examples.
