# ZKPay Client Operation Library

This is a complete client library for interacting with ZKPay backend, providing unified interfaces for login, deposit, commitment, withdrawal and other functions.

## Features

✅ **Complete Operation Flow Support**

- User login and authentication
- Token authorization and deposit
- Read user CheckBook records
- Create allocation plans and signatures
- Execute Commitment (synchronous/asynchronous)
- Generate withdrawal proofs (synchronous/asynchronous)

✅ **Easy-to-Use API**

- Unified error handling
- Detailed logging
- Flexible configuration options
- Comprehensive documentation and examples

✅ **Advanced Features**

- Complete flow encapsulation
- Status monitoring and waiting
- Automatic resource cleanup
- Concurrent operation support

## Quick Start

### 1. Install Dependencies

```bash
npm install ethers axios js-yaml
```

### 2. Basic Usage

```javascript
const { ZKPayClient } = require("./zkpay-client-library");

async function example() {
  // Create client
  const client = new ZKPayClient(config);

  try {
    // Initialize
    await client.initialize();

    // Login
    await client.login("0x...", "user1");

    // Execute deposit
    const depositResult = await client.deposit(56, "test_usdt", "10.0");

    // Wait for detection
    const depositRecord = await client.waitForDepositDetection(
      depositResult.deposit.txHash,
      56,
      60
    );

    // Create allocation and execute Commitment
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

    // Generate withdrawal proof
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

    console.log("Complete flow executed successfully!");
  } finally {
    await client.cleanup();
  }
}
```

## File Structure

```
e2e-automation/
├── zkpay-client-library.js      # Core client library
├── zkpay-client-example.js      # Detailed usage examples
├── test-zkpay-client.js         # Functional test script
├── ZKPAY_CLIENT_API.md          # Complete API documentation
└── README_ZKPAY_CLIENT.md       # This file
```

## Core API

### Authentication

- `initialize()` - Initialize client
- `login(privateKey, userName)` - User login
- `isLoggedIn()` - Check login status
- `logout()` - Logout

### Token Operations

- `checkTokenBalance(chainId, tokenSymbol)` - Check balance
- `checkTokenAllowance(chainId, tokenSymbol)` - Check allowance
- `approveToken(chainId, tokenSymbol, amount)` - Approve token
- `deposit(chainId, tokenSymbol, amount)` - Execute deposit

### CheckBook Operations

- `getUserDeposits(userAddress?, chainId?)` - Get deposit records
- `getCheckbookDetails(checkbookId)` - Get CheckBook details
- `waitForDepositDetection(txHash, chainId, maxWaitTime?)` - Wait for deposit detection

### Commitment Operations (Sync/Async)

- `executeCommitmentSync(checkbookId, allocations, waitForWithCheck?)` - Synchronous execution
- `executeCommitmentAsync(checkbookId, allocations)` - Asynchronous execution
- `createAllocationAndSign(checkbookId, allocations)` - Create allocation and sign

### Withdrawal Operations (Sync/Async)

- `generateProofSync(checkbookId, recipientInfo, waitForCompleted?)` - Synchronous proof generation
- `generateProofAsync(checkbookId, recipientInfo)` - Asynchronous proof generation

### Advanced Features

- `performFullDepositToCommitment(...)` - Complete flow from deposit to commitment
- `performFullCommitmentToWithdraw(...)` - Complete flow from commitment to withdrawal

## Synchronous vs Asynchronous Operations

### Synchronous Method (Wait for Completion)

```javascript
// Execute Commitment and wait for completion
const result = await client.executeCommitmentSync(
  checkbookId,
  allocations,
  true
);
console.log("Commitment completed:", result.finalStatus);

// Generate proof and wait for completion
const proofResult = await client.generateProofSync(
  checkbookId,
  recipientInfo,
  true
);
console.log("Withdrawal completed:", proofResult.completionResult.transaction_hash);
```

### Asynchronous Method (Return Immediately)

```javascript
// Submit Commitment request, return immediately
const commitmentResult = await client.executeCommitmentAsync(
  checkbookId,
  allocations
);
console.log("Commitment submitted:", commitmentResult.status);

// Wait for completion in background
commitmentResult
  .waitForCompletion(["with_checkbook"], 300)
  .then((result) => {
    console.log("Commitment completed:", result.status);

    // Continue to next operation
    return client.generateProofAsync(checkbookId, recipientInfo);
  })
  .then((proofResult) => {
    return proofResult.waitForCompletion(300);
  })
  .then((completionResult) => {
    console.log("Withdrawal completed:", completionResult.transaction_hash);
  });

// Main thread can continue other operations...
```

## Running Examples

### Run Complete Example

```bash
node zkpay-client-example.js --config config.yaml --all
```

### Run Single Example

```bash
node zkpay-client-example.js --config config.yaml --example example1
```

### Run Functional Tests

```bash
node test-zkpay-client.js --config config.yaml
```

## Configuration Requirements

The client library requires the following configuration structure (`config.yaml`):

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

## Error Handling

All API methods throw exceptions, it's recommended to use try-catch for error handling:

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

## Important Notes

1. **Login Status**: Most operations require calling the `login()` method first
2. **Async Operations**: The difference between sync and async methods is whether to wait for operation completion
3. **Error Handling**: All methods may throw exceptions, proper error handling is required
4. **Resource Cleanup**: Call `cleanup()` method to clean up resources after use
5. **Amount Precision**: Token amounts need to consider precision, typically 18 decimals
6. **Chain ID**: Use SLIP-44 standard chain IDs (e.g., BSC is 714)

## Development and Debugging

### Enable Debug Logging

```javascript
const logger = createLogger("ZKPayClient", { level: "debug" });
const client = new ZKPayClient(config, logger);
```

### Run Tests

```bash
# Run functional tests
node test-zkpay-client.js --config config.yaml

# JSON format output
node test-zkpay-client.js --config config.yaml --json
```

### Check API Connection

```javascript
await client.initialize();
await client.testApiConnection();
```

## Support and Contributing

For questions or suggestions, please refer to:

- `ZKPAY_CLIENT_API.md` - Complete API documentation
- `zkpay-client-example.js` - Detailed usage examples
- `test-zkpay-client.js` - Functional test code

## Changelog

- **v1.0.0** - Initial version, supporting complete ZKPay operation flow
  - User authentication and login
  - Token authorization and deposit
  - CheckBook query and management
  - Allocation creation and signing
  - Commitment execution (sync/async)
  - Withdrawal proof generation (sync/async)
  - Advanced flow encapsulation
  - Complete error handling and logging
