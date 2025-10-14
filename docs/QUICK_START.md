# ZKPay Client Library - Quick Start

## 🚀 5-Minute Quick Start

### 1. Import Library

```javascript
const { ZKPayClient } = require("./zkpay-client-library");
// or
const { ZKPayClient } = require("./index");
```

### 2. Create and Initialize Client

```javascript
const client = new ZKPayClient(config);
await client.initialize();
```

### 3. Login

#### Method 1: Direct Private Key Login

```javascript
await client.login("0xYourPrivateKey", "username");
```

#### Method 2: KMS Signer Login

```javascript
// Basic KMS configuration
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
```

#### Method 3: SAAS KMS Login

```javascript
// SAAS KMS configuration
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

### 4. Execute Operations

```javascript
// Deposit
const deposit = await client.deposit(56, "test_usdt", "10.0");

// Wait for detection
const record = await client.waitForDepositDetection(deposit.deposit.txHash, 56);

// Execute Commitment
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0x接收地址",
    amount: "10000000000000000000", // 10.0 USDT
  },
];

const commitment = await client.executeCommitmentSync(
  record.checkbook_id,
  allocations
);

// 提现
const recipientInfo = {
  chain_id: 714,
  address: "0x接收地址",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

const withdraw = await client.generateProofSync(
  record.checkbook_id,
  recipientInfo
);
```

## 📋 核心功能对照表

| 需求                         | 方法                                                   | 说明                                           |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| 1. 登录到后台                | `login(privateKey, userName)`                          | 使用私钥登录认证                               |
| 2. Approve and Deposit       | `deposit(chainId, tokenSymbol, amount)`                | Automatically handle authorization and deposit |
| 3. Read CheckBook            | `getUserDeposits()`                                    | Get user's deposit records                     |
| 4. Create Allocation + Sign  | `createAllocationAndSign(checkbookId, allocations)`    | Create allocation plan and sign                |
| 5. Execute Commitment        | `executeCommitmentSync()` / `executeCommitmentAsync()` | Synchronous/asynchronous execution             |
| 6. Generate Withdrawal Proof | `generateProofSync()` / `generateProofAsync()`         | Synchronous/asynchronous proof generation      |

## 🔄 Synchronous vs Asynchronous

### Synchronous Method (Wait for Completion)

```javascript
// Execute and wait for completion
const result = await client.executeCommitmentSync(
  checkbookId,
  allocations,
  true
);
console.log("Completion status:", result.finalStatus);
```

### Asynchronous Method (Return Immediately)

```javascript
// Submit request, return immediately
const result = await client.executeCommitmentAsync(checkbookId, allocations);

// Optionally wait for completion
const final = await result.waitForCompletion(["with_checkbook"], 300);
console.log("Completion status:", final.status);
```

## ⚡ One-Click Complete Flow

```javascript
// Complete flow from deposit to commitment
const result = await client.performFullDepositToCommitment(
  56,
  "test_usdt",
  "10.0",
  allocations
);

// Complete flow from commitment to withdrawal
const withdraw = await client.performFullCommitmentToWithdraw(
  checkbookId,
  recipientInfo
);
```

## 🧪 Run Tests

### Basic Tests

```bash
# Run examples
node zkpay-client-example.js --config config.yaml --all

# Run tests
node test-zkpay-client.js --config config.yaml
```

### KMS Integration Tests

```bash
# KMS complete flow test
node kms-full-flow-example.js --amount 10.0

# KMS test using provided private key
node kms-full-flow-example.js --use-provided-key --private-key 0x... --amount 10.0

# KMS integration example
node zkpay-kms-integration-example.js

# KMS key initialization example
node kms-key-initialization-example.js
```

## 📖 More Documentation

- `ZKPAY_CLIENT_API.md` - Complete API documentation
- `README_ZKPAY_CLIENT.md` - Detailed usage instructions
- `zkpay-client-example.js` - Complete usage examples
