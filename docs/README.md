# ZKPay SDK Documentation Center

## 🎯 Feature Overview

ZKPay SDK is a complete privacy payment solution that provides a full suite of tools and services from private key management to cross-chain privacy transfers. Supports multiple authentication methods, including direct private key login and enterprise-level KMS integration.

### Core Features

1. **Wallet Management** - Supports multiple authentication methods including direct private key and KMS signers
2. **Deposit Process** - Automatically executes Token authorization and deposit operations
3. **Commitment Process** - Automatically generates privacy proofs and submits commitments
4. **Withdrawal Process** - Automatically generates withdrawal proofs and executes cross-chain withdrawals
5. **End-to-End Testing** - Complete workflow automation testing
6. **Stress Testing** - Multi-user concurrent testing support
7. **Result Verification** - Automatically verifies transaction results and balance changes
8. **KMS Integration** - Enterprise-level key management system support
9. **Multi-Chain Support** - Unified management supporting multiple blockchain networks

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Wallet Manager │    │ Deposit Manager │    │Commitment Mgr   │
│                 │    │                 │    │                 │
│ • Private Key Mgmt│   │ • Token Approval │   │ • Proof Generation│
│ • Multi-chain Conn│   │ • Deposit Exec   │   │ • Commitment Sub │
│ • Balance Check   │   │ • Event Listen   │   │ • Status Monitor │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
              ┌─────────────────────────────────────┐
              │           E2E Test Engine          │
              │                                     │
              │ • Test Orchestration                │
              │ • Result Recording                  │
              │ • Error Handling                    │
              │ • Report Generation                 │
              └─────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Withdraw Manager│    │   Logger System │    │Environment Check│
│                 │    │                 │    │                 │
│ • Withdraw Proof │    │ • Structured Log │    │ • Config Verify │
│ • Cross-chain Exec│   │ • Test Results   │    │ • Network Check │
│ • Transaction Ver │    │ • Error Tracking │    │ • Service Check │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Enter zksdk directory
cd zksdk

# Install dependencies
npm install

# Check environment
npm run check-env
```

### 2. Configuration Setup

#### Basic Configuration

Copy and edit environment variable configuration:

```bash
cp env.example .env
# Edit .env file, set your private key and RPC URL
```

Edit `config.yaml` file according to your test environment.

#### KMS Configuration

For enterprise users, KMS service can be configured:

**Environment Variable Method:**

```bash
# SAAS KMS configuration
export SAAS_KMS_URL="https://kms.your-saas.com"
export SAAS_ENTERPRISE_ID="your_enterprise_id"
export SAAS_K1_KEY="your_k1_key"
export SAAS_USER_ADDRESS="0x..."
export SAAS_KEY_ALIAS="enterprise_key"
```

**Configuration File Method:**
Create `kms-config.json` file:

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

### 3. Run Tests

#### Basic End-to-End Tests

```bash
# Run complete E2E test
npm test

# Or run directly with node
node zkpay-e2e-test.js
```

#### Custom Test Parameters

```bash
# Specify test user and amount
node zkpay-e2e-test.js --user default --amount 5.0 --token usdt

# Specify source and target chains
node zkpay-e2e-test.js --source-chain 31337 --target-chain 97

# Skip certain phases
node zkpay-e2e-test.js --skip-deposit  # Only test Commitment and Withdraw
node zkpay-e2e-test.js --skip-withdraw # Only test Deposit and Commitment
```

#### Stress Testing

```bash
# Run stress test (2 users, 3 transactions per user)
node zkpay-e2e-test.js --stress-test --concurrent-users 2 --tx-per-user 3
```

#### Out-of-Order Withdrawal Testing

```bash
# Run out-of-order withdrawal test (create 3 commitments, withdraw in order 2,0,1)
node zkpay-e2e-test.js --out-of-order-test --commitment-count 3 --withdraw-order 2,0,1

# Custom out-of-order test
node zkpay-e2e-test.js --out-of-order-test --commitment-count 5 --withdraw-order 4,1,0,3,2
```

## 📋 Detailed Usage

### Command Line Options

| Option                     | Description               | Default       |
| -------------------------- | ------------------------- | ------------- |
| `-c, --config <file>`      | Configuration file path   | `config.yaml` |
| `-u, --user <name>`        | Test user name            | `default`     |
| `-s, --source-chain <id>`  | Source chain ID           | `31337`       |
| `-t, --target-chain <id>`  | Target chain ID           | `97`          |
| `--token <symbol>`         | Token symbol              | `usdt`        |
| `-a, --amount <amount>`    | Test amount               | `10.0`        |
| `--skip-deposit`           | Skip deposit phase        | false         |
| `--skip-withdraw`          | Skip withdraw phase       | false         |
| `--stress-test`            | Run stress test           | false         |
| `--out-of-order-test`      | Run out-of-order withdraw test | false    |
| `--concurrent-users <num>` | Concurrent user count     | `2`           |
| `--tx-per-user <num>`      | Transactions per user     | `3`           |
| `--commitment-count <num>` | Commitment count          | `5`           |
| `--withdraw-order <order>` | Withdraw order            | `4,1,0,3,2`   |

### Test Flow Description

#### 1. Deposit Phase

- ✅ Check token balance
- ✅ Approve token to Treasury contract
- ✅ Execute deposit transaction
- ✅ Listen for deposit events
- ✅ Record deposit ID and related information

#### 2. Commitment Phase

- ✅ Create deposit record to backend
- ✅ Generate privacy proof (zero-knowledge proof)
- ✅ Submit commitment to management chain
- ✅ Wait for blockchain confirmation
- ✅ Monitor status changes

#### 3. Withdraw Phase

- ✅ Create check (withdrawal voucher)
- ✅ Generate withdrawal proof
- ✅ Execute cross-chain withdrawal
- ✅ Verify target chain transaction
- ✅ Check balance changes

### Supported Test Scenarios

1. **Single User Complete Flow** - Test complete ZKPay usage flow for one user
2. **Multi-user Concurrent Test** - Test system stability with concurrent users
3. **Cross-chain Test** - Test fund transfers between different chains
4. **Out-of-order Withdrawal Test** - Create multiple commitments, then execute withdrawals out of order to verify privacy and security
5. **BSC Mainnet Functionality Test** - Verify all functions work correctly in BSC mainnet environment
6. **Failure Recovery Test** - Test system's recovery capability in failure scenarios
7. **Performance Stress Test** - Test system's performance limits

## 🔗 Supported Blockchain Networks

### Production Networks

**BSC Mainnet** - Production Mainnet

- Chain ID: 56
- RPC: https://bsc-dataseed1.binance.org
- Real gas fees and network environment
- Complete EVM compatibility
- Production-level performance and stability

### Network Features

- **Real Environment**: Use real BSC mainnet for testing
- **Gas Fees**: Requires real BNB to pay gas fees
- **High Reliability**: Production-level network stability
- **Complete Functionality**: Verify all functions work in real environment

## 📊 Test Results

### Log Output

All information during testing is output to:

- Console (real-time display)
- Log file `e2e-test.log`
- Test result file `test-results-<timestamp>.json`

### Result Analysis

After testing completes, a detailed result report is generated, including:

```json
{
  "totalTests": 1,
  "completedTests": 1,
  "failedTests": 0,
  "successRate": "100.00",
  "totalDuration": 45000,
  "avgDuration": "45000.00",
  "results": [
    {
      "name": "FullE2ETest",
      "status": "completed",
      "duration": 45000,
      "steps": [
        { "name": "Deposit flow completed", "status": "completed" },
        { "name": "Commitment flow completed", "status": "completed" },
        { "name": "Withdraw flow completed", "status": "completed" }
      ],
      "metadata": {
        "userAddress": "0x...",
        "sourceChainId": 31337,
        "targetChainId": 97,
        "tokenSymbol": "usdt",
        "amount": "10.0"
      }
    }
  ]
}
```

## ⚙️ Configuration

### Environment Variable Configuration

Required environment variables:

```bash
# Test user private key
export TEST_USER_PRIVATE_KEY="0x..."

# BSC Testnet RPC
export BSC_TESTNET_RPC="https://data-seed-prebsc-1-s1.binance.org:8545"

# ZKPay backend service
export ZKPAY_BACKEND_URL="http://localhost:3001"
```

### Configuration File Description

`config.yaml` file contains all test configuration items:

- **environment** - Test environment information
- **services** - Backend service configuration
- **blockchain** - Blockchain network configuration
- **test_users** - Test user configuration
- **test_config** - Test parameter configuration
- **logging** - Logging configuration

## 🔧 Troubleshooting

### Common Issues

1. **Private Key Format Error**

   ```bash
   # Ensure private key format is correct (64-bit hexadecimal with 0x prefix)
   export TEST_USER_PRIVATE_KEY="0x1234567890abcdef..."
   ```

2. **Network Connection Failed**

   ```bash
   # Check if RPC URL is accessible
   curl -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        $BSC_TESTNET_RPC
   ```

3. **Insufficient Balance**

   ```bash
   # Ensure test account has enough BNB and test tokens
   # BSC Testnet can obtain test coins through faucets
   ```

4. **Service Unavailable**
   ```bash
   # Check if ZKPay backend service is running
   curl $ZKPAY_BACKEND_URL/health
   ```

### Debug Mode

Enable verbose logging:

```bash
# Set log level to debug
export LOG_LEVEL=debug
node zkpay-e2e-test.js
```

## 🔐 Security Considerations

1. **Private Key Security**

   - Only use test network private keys
   - Do not use real private keys in production environment
   - Do not commit private keys to code repository

2. **Network Security**

   - Use trusted RPC endpoints
   - Be mindful of network security when running on public networks

3. **Test Data**
   - All tests only use test networks
   - Test tokens have no real value

## 📝 Development Guide

### Adding New Test Scenarios

1. Add new test methods in `zkpay-e2e-test.js`
2. Add corresponding parameters in configuration file
3. Add new options in command line interface

### Extending Manager Functionality

Each manager is an independent module that can be extended separately:

- `zkpay-wallet-manager.js` - Wallet and private key management
- `zkpay-deposit-manager.js` - Deposit and token operations
- `zkpay-commitment-manager.js` - Privacy proof and commitment
- `zkpay-withdraw-manager.js` - Withdrawal and cross-chain operations

## 📈 Performance Optimization

### Concurrency Optimization

- Use connection pools to manage RPC connections
- Set reasonable delays between transactions
- Avoid nonce conflicts

### Error Handling

- Automatic retry mechanism
- Graceful error recovery
- Detailed error logging

## 🤝 Contribution Guide

1. Fork the project
2. Create feature branch
3. Submit changes
4. Create Pull Request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

If you have questions or suggestions, please:

1. Check the troubleshooting section
2. Review log files
3. Submit an Issue or contact the development team
