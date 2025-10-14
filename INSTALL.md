# ZKPay Client Library - Installation and Usage Guide

## 🚀 Quick Start

### 1. Installation

```bash
# Clone repository
git clone git@github.com:QuantrixLab/ZKPaySDK.git
cd ZKPaySDK

# Install dependencies
npm install
```

### 2. Configuration

#### Basic Configuration

```bash
cd examples
# Edit config.yaml to set API address and test parameters
# Set environment variables
export TEST_USER_PRIVATE_KEY="your_private_key_without_0x_prefix"
```

#### KMS Integration Configuration

For enterprise users, you can configure KMS service for secure key management:

**Method 1: Basic KMS Configuration**

```bash
# Set KMS service address
export KMS_BASE_URL="http://localhost:18082"

# Set KMS key configuration
export KMS_KEY_ALIAS="your_key_alias"
export KMS_ENCRYPTED_KEY="your_encrypted_key"
export KMS_USER_ADDRESS="0x..."
```

**Method 2: SAAS KMS Configuration**

```bash
# Set SAAS KMS service
export SAAS_KMS_URL="https://kms.your-saas.com"
export SAAS_ENTERPRISE_ID="your_enterprise_id"
export SAAS_K1_KEY="your_k1_key"
export SAAS_USER_ADDRESS="0x..."
export SAAS_KEY_ALIAS="enterprise_key"
```

**Method 3: Configuration File Method**
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

#### Basic Tests

```bash
# Quick test
npm test

# Full functionality test
npm run test:full

# Async functionality test
npm run test:async
```

#### KMS Integration Tests

```bash
# KMS key initialization test
node examples/kms-key-initialization-example.js

# KMS integration test
node examples/zkpay-kms-integration-example.js

# KMS full flow test
node examples/kms-full-flow-example.js --amount 10.0

# KMS test using client-provided private key
node examples/kms-full-flow-example.js --use-provided-key --private-key 0x... --amount 10.0
```

### 4. Run Examples

#### Basic Examples

```bash
# Basic example
npm run example

# Async example
npm run example:async
```

#### KMS Examples

```bash
# KMS integration example
node examples/zkpay-kms-integration-example.js

# Full KMS flow example
node examples/kms-full-flow-example.js --amount 5.0

# Multi-chain KMS management example
node examples/multi-chain-kms-example.js
```

## 📦 Use as NPM Package

```bash
npm install zkpay-client-library
```

```javascript
const { ZKPayClient } = require("zkpay-client-library");

const client = new ZKPayClient(config);
await client.initialize();
await client.login(privateKey);

// Execute operations
const result = await client.executeCommitmentSync(checkbookId, allocations);
```

## 📚 Documentation

- [README.md](./README.md) - Project overview
- [LIBRARY_OVERVIEW.md](./LIBRARY_OVERVIEW.md) - Library architecture description
- [USAGE_GUIDE.md](./USAGE_GUIDE.md) - Detailed usage guide
- [examples/README.md](./examples/README.md) - Examples and test descriptions

## 🔧 Development

```bash
# Run tests
npm test

# Run examples
npm run example

# View all available scripts
npm run
```

## 📋 System Requirements

- Node.js >= 16.0.0
- NPM or Yarn
- Connection to ZKPay backend service

## 🎯 Main Features

- ✅ Complete ZKPay backend interaction
- ✅ Deposit, Commitment, Withdrawal operations
- ✅ Synchronous and asynchronous operation modes
- ✅ Status monitoring and waiting mechanisms
- ✅ Complete test coverage
- ✅ Detailed documentation and examples
- ✅ KMS key management system integration
- ✅ SAAS enterprise-level KMS support
- ✅ Multi-chain signing and SLIP44 standard support
- ✅ Secure private key management and signing services

## 🔐 KMS Integration Features

### Supported KMS Types

- **Basic KMS**: Standard KMS service integration
- **SAAS KMS**: Enterprise-level SAAS KMS service
- **Multi-chain KMS**: Unified KMS management supporting multiple blockchain networks

### Supported Blockchain Networks

| Network  | SLIP44 ID | Signature Type | KMS Support |
| -------- | --------- | -------------- | ----------- |
| Ethereum | 60        | eip191         | ✅          |
| BSC      | 714       | eip191         | ✅          |
| Tron     | 195       | tip191t        | ✅          |
| Polygon  | 966       | eip191         | ✅          |
| Arbitrum | 42161     | eip191         | ✅          |
| Optimism | 10        | eip191         | ✅          |

### Security Features

- 🔒 Private keys never leave KMS service
- 🔐 Hardware Security Module (HSM) support
- 📝 Complete signature audit logs
- 🔑 Role-Based Access Control (RBAC)
- 🛡️ Enterprise-level security compliance support
