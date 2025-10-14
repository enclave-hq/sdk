# ZKPay Client Library Examples and Tests

This directory contains core usage examples and test code for ZKPay Client Library.

## 🚨 Important Security Warning

⚠️ **Never write private keys directly in configuration files!**
⚠️ **Please use environment variables or .env files to store sensitive information!**
⚠️ **Only use test accounts and test networks!**

## 📁 File Description

### 🌟 **Core Examples**

- **`zkpay-client-example.js`** - Complete usage example, demonstrating 8 different use cases (deposit, commitment, withdrawal, etc.)
- **`async-usage-example.js`** - Asynchronous method usage example, showing how to use await to call async methods

### 🔐 **KMS Integration Examples**

- **`kms-key-initialization-example.js`** - KMS key initialization example
- **`zkpay-kms-integration-example.js`** - ZKPay and KMS service integration example
- **`kms-full-flow-example.js`** - Complete KMS flow example (Deposit→Commitment→Withdraw)

### 🧪 **Test Files**

- **`quick-client-library-test.js`** - Quick functionality verification test, including complete E2E flow
- **`test-async-features.js`** - Asynchronous functionality test, demonstrating various usage of async methods
- **`ready-checkbook-test.js`** - Complete flow test using existing ready checkbook

### 🚀 **Tools and Configuration**

- **`run-client-library-test.sh`** - Shell script for running tests
- **`setup-test-env.sh`** - Test environment setup script
- **`bsc-testnet-config.env`** - BSC testnet configuration environment variables
- **`logger.js`** - Log manager (provides unified logging functionality)

## 🔧 Usage

### 1. Run Complete Example

```bash
cd zksdk/examples
node zkpay-client-example.js --all
```

### 2. Run Quick Test

```bash
cd zksdk/examples
./run-client-library-test.sh quick
```

### 3. Run Async Function Test

```bash
cd zksdk/examples
node test-async-features.js
```

### 4. Run KMS Integration Example

```bash
cd zksdk/examples
node zkpay-kms-integration-example.js
```

### 5. Run KMS Complete Flow Example

```bash
cd zksdk/examples
# Use auto-generated private key
node kms-full-flow-example.js --amount 10.0

# Use client provided private key
node kms-full-flow-example.js --use-provided-key --private-key 0x1234... --amount 10.0
```

### 6. Run Ready CheckBook Test

```bash
cd zksdk/examples
node ready-checkbook-test.js
```

## 📋 Test Coverage

### Complete Function Tests Include:

- ✅ Client initialization
- ✅ User login
- ✅ Token operations (balance query, authorization check)
- ✅ CheckBook query and details
- ✅ Deposit operations (authorization → deposit)
- ✅ Deposit detection (backend confirmation)
- ✅ Wait for checkbook ready
- ✅ Allocation and signature (commitment execution)
- ✅ Commitment status verification
- ✅ Withdrawal proof generation
- ✅ Withdrawal completion confirmation

### Async Function Tests Include:

- 🔄 Commitment async submission and wait
- 🔄 Withdraw async submission and wait
- 🔄 Status polling and monitoring
- 🔄 Timeout handling

## 💡 Tips

- Ensure correct environment variables are set before running tests (such as `TEST_USER_PRIVATE_KEY`)
- Tests need to connect to ZKPay backend service
- Complete function tests will execute actual blockchain transactions, requiring small gas fees

## 📊 Directory Structure

```
examples/
├── README.md                           # This file
├── logger.js                           # Log manager
├── zkpay-client-example.js             # Complete usage example
├── async-usage-example.js              # Async method example
├── kms-key-initialization-example.js   # KMS key initialization example
├── zkpay-kms-integration-example.js    # KMS integration example
├── kms-full-flow-example.js            # KMS complete flow example
├── quick-client-library-test.js        # Quick function test
├── test-async-features.js              # Async function test
├── ready-checkbook-test.js             # Ready CheckBook test
├── run-client-library-test.sh          # Run script
├── setup-test-env.sh                   # Environment setup script
└── bsc-testnet-config.env              # BSC testnet configuration
```
