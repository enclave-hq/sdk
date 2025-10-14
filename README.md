# ZKPay SDK Complete Guide

## 🏗️ System Architecture

```
ZKPay SDK
├── ZKPayClient (Main Client)
├── WalletManager (Wallet Management - One private key corresponds to one wallet instance)
├── DepositManager (Deposit Management)
├── CommitmentManager (Commitment Management)
└── WithdrawManager (Withdrawal Management)
```

## 🎯 Core Features

| Feature                    | API Method                                          | Sync/Async | Description                               |
| -------------------------- | --------------------------------------------------- | ---------- | ----------------------------------------- |
| 1. Backend Login           | `login(privateKey)`                                 | Sync       | Login authentication using private key    |
| 2. Approve and Deposit     | `deposit(chainId, tokenSymbol, amount)`             | Sync       | Automatically handle approval and deposit |
| 3. Read CheckBook          | `getUserDeposits()`                                 | Sync       | Get user's deposit records                |
| 4. Create Allocation+Sign  | `createAllocationAndSign(checkbookId, allocations)` | Sync       | Create allocation plan and sign           |
| 5. Execute Commitment      | `executeCommitmentSync()`                           | Sync       | Wait until with_checkbook status          |
| 5. Execute Commitment      | `executeCommitmentAsync()`                          | Async      | Return immediately, provide monitoring    |
| 6. Generate Withdraw Proof | `generateProofSync()`                               | Sync       | Wait until completed status               |
| 6. Generate Withdraw Proof | `generateProofAsync()`                              | Async      | Return immediately, provide monitoring    |

## 🔄 Complete Business Flow

### 1. Initialization and Authentication

```javascript
const { ZKPayClient } = require("./core/zkpay-client-library");
const client = new ZKPayClient(config, logger);
await client.initialize();

// Method 1: Login with private key
await client.login(privateKey);

// Method 2: Login with KMS signer
const kmsSigner = new ZKPayKMSSigner(kmsConfig);
await client.loginWithSigner(kmsSigner, userAddress);
```

### API Flow Overview

ZKPay's complete API flow includes the following key steps:

```
1. Auth Login → 2. Deposit Detection → 3. Commitment Allocation → 4. Proof Generation → 5. Withdrawal Complete
     ↓              ↓                    ↓                      ↓                    ↓
  Backend Login   Detect On-chain Tx   Create Allocation Sign   Generate ZK Proof   Execute On-chain Withdrawal
```

#### Detailed API Call Flow

**Phase 1: Initialization and Authentication**

```javascript
// 1.1 Initialize client
await client.initialize();

// 1.2 User authentication (choose one)
await client.login(privateKey); // Direct private key login
// or
await client.loginWithSigner(kmsSigner, userAddress); // KMS signer login
```

**Phase 2: Deposit Operations**

```javascript
// 2.1 Check token balance and allowance
const balance = await client.checkTokenBalance(chainId, tokenAddress);
const allowance = await client.checkTokenAllowance(
  chainId,
  tokenAddress,
  treasuryAddress
);

// 2.2 Approve token (if needed)
if (allowance.balance < requiredAmount) {
  await client.approveToken(chainId, tokenAddress, amount, treasuryAddress);
}

// 2.3 Execute deposit
const depositResult = await client.deposit(
  chainId,
  tokenAddress,
  amount,
  treasuryAddress
);

// 2.4 Wait for backend deposit detection
const depositRecord = await client.waitForDepositDetection(
  depositResult.txHash,
  chainId,
  60
);
```

**Phase 3: Commitment Allocation**

```javascript
// 3.1 Create allocation plan
const allocations = [
  {
    recipient_chain_id: targetChainId,
    recipient_address: recipientAddress,
    amount: amountInWei,
  },
];

// 3.2 Execute commitment (sync or async)
const commitmentResult = await client.executeCommitmentSync(
  depositRecord.checkbookId,
  allocations,
  true
);
```

**Phase 4: Proof Generation**

```javascript
// 4.1 Prepare withdrawal information
const recipientInfo = {
  chain_id: targetChainId,
  address: recipientAddress,
  amount: amountInWei,
  token_symbol: tokenSymbol,
};

// 4.2 Generate withdrawal proof (sync or async)
const proofResult = await client.generateProofSync(
  depositRecord.checkbookId,
  recipientInfo,
  true
);
```

**Phase 5: Status Monitoring**

```javascript
// 5.1 Monitor commitment status
await client.waitForCommitmentStatus(checkbookId, ["with_checkbook"], 300);

// 5.2 Monitor proof generation status
await client.waitForProofStatus(checkId, ["completed"], 300);
```

### 2. Deposit

```javascript
// Define necessary addresses and parameters
const testUsdtAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";
const amount = "10.0";

// Get token information (including decimals)
const tokenInfo = await client.getTokenInfo(714, testUsdtAddress);
console.log(
  `Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`
);

// Check balance and allowance (using token address)
const balance = await client.checkTokenBalance(714, testUsdtAddress);
const allowance = await client.checkTokenAllowance(
  714,
  testUsdtAddress,
  treasuryAddress
);

// Approve token (using token address and dynamic decimals)
if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
  await client.approveToken(714, testUsdtAddress, amount, treasuryAddress);
}

// Execute deposit (using token address)
const depositResult = await client.deposit(
  714,
  testUsdtAddress,
  amount,
  treasuryAddress
);
const depositRecord = await client.waitForDepositDetection(
  depositResult.txHash,
  714,
  60
);
```

### 3. Commitment

```javascript
// Create allocation plan
const allocations = [
  {
    recipient_chain_id: 714,
    recipient_address: "0xRecipientAddress",
    amount: "10000000000000000000", // 10.0 USDT
  },
];

// Execute commitment
const commitmentResult = await client.executeCommitmentSync(
  depositRecord.checkbookId,
  allocations,
  true
);
```

### 4. Withdrawal

```javascript
// Prepare recipient information
const recipientInfo = {
  chain_id: 714,
  address: "0xRecipientAddress",
  amount: "10000000000000000000",
  token_symbol: "test_usdt",
};

// Generate withdrawal proof
const withdrawResult = await client.generateProofSync(
  depositRecord.checkbookId,
  recipientInfo,
  true
);
```

## 🚀 Usage Methods

### Method 1: Step-by-Step Execution

```javascript
async function stepByStepFlow() {
  const client = new ZKPayClient(config, logger);
  await client.initialize();
  await client.login(privateKey);

  // Define necessary addresses and parameters
  const testUsdtAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
  const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";
  const amount = "10.0";

  // Get token information (including decimals)
  const tokenInfo = await client.getTokenInfo(714, testUsdtAddress);
  console.log(
    `Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`
  );

  // Check balance and allowance (using token address)
  const balance = await client.checkTokenBalance(714, testUsdtAddress);
  const allowance = await client.checkTokenAllowance(
    714,
    testUsdtAddress,
    treasuryAddress
  );

  // Approve token (if needed, using token address and dynamic decimals)
  if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
    await client.approveToken(714, testUsdtAddress, amount, treasuryAddress);
  }

  // Deposit (using token address)
  const depositResult = await client.deposit(
    714,
    testUsdtAddress,
    amount,
    treasuryAddress
  );
  const depositRecord = await client.waitForDepositDetection(
    depositResult.txHash,
    714,
    60
  );

  // Commitment
  const allocations = [
    {
      recipient_chain_id: 714,
      recipient_address: "0xRecipientAddress",
      amount: "10000000000000000000",
    },
  ];
  const commitmentResult = await client.executeCommitmentSync(
    depositRecord.checkbookId,
    allocations,
    true
  );

  // Withdrawal
  const recipientInfo = {
    chain_id: 714,
    address: "0xRecipientAddress",
    amount: "10000000000000000000",
    token_symbol: "test_usdt",
  };
  const withdrawResult = await client.generateProofSync(
    depositRecord.checkbookId,
    recipientInfo,
    true
  );

  return { depositResult, commitmentResult, withdrawResult };
}
```

### Method 2: Convenient Methods

```javascript
async function convenientFlow() {
  const client = new ZKPayClient(config, logger);
  await client.initialize();
  await client.login(privateKey);

  // From deposit to commitment
  const allocations = [
    {
      recipient_chain_id: 714,
      recipient_address: "0xRecipientAddress",
      amount: "10000000000000000000",
    },
  ];

  const depositToCommitment = await client.performFullDepositToCommitment(
    714,
    "test_usdt",
    "10.0",
    allocations,
    { waitForCommitment: true }
  );

  // From commitment to withdrawal
  const recipientInfo = {
    chain_id: 714,
    address: "0xRecipientAddress",
    amount: "10000000000000000000",
    token_symbol: "test_usdt",
  };

  const commitmentToWithdraw = await client.performFullCommitmentToWithdraw(
    depositToCommitment.depositRecord.checkbook_id,
    recipientInfo,
    { waitForProof: true, maxWaitTime: 300 }
  );

  return { depositToCommitment, commitmentToWithdraw };
}
```

## 📊 Status Flow

```
Deposit: pending → detected → ready_for_commitment → with_checkbook → issued
Commitment: ready_for_commitment → submitting_commitment → commitment_pending → with_checkbook
Withdrawal: with_checkbook → generating_proof → proved → completed
```

## 🔧 Core Interfaces

### Wallet Management

- `login(privateKey)`: Set user wallet
- `getCurrentUser()`: Get current user information

### Deposit Management

- `getTokenInfo(chainId, tokenContractAddress)`: Get token information (address, decimals, symbol, name)
- `checkTokenBalance(chainId, tokenContractAddress)`: Check balance (using token contract address)
- `checkTokenAllowance(chainId, tokenContractAddress, treasuryAddress)`: Check allowance (using token contract address)
- `approveToken(chainId, tokenAddress, amount, treasuryAddress)`: Approve token (using token address)
- `deposit(chainId, tokenAddress, amount, treasuryAddress)`: Execute deposit (using token address)
- `waitForDepositDetection(txHash, chainId, maxWaitTime)`: Wait for detection

### Commitment Management

- `getUserDeposits(userAddress?, chainId?)`: Get deposit records
- `getCheckbookDetails(checkbookId)`: Get CheckBook details
- `executeCommitmentSync(checkbookId, allocations, waitForWithCheck)`: Synchronously execute commitment
- `executeCommitmentAsync(checkbookId, allocations)`: Asynchronously execute commitment

### Withdrawal Management

- `generateProofSync(checkbookId, recipientInfo, waitForCompleted)`: Synchronously generate proof
- `generateProofAsync(checkbookId, recipientInfo)`: Asynchronously generate proof

### Convenient Methods

- `performFullDepositToCommitment(chainId, tokenSymbol, amount, allocations, options)`: Deposit to commitment
- `performFullCommitmentToWithdraw(checkbookId, recipientInfo, options)`: Commitment to withdrawal

## ⚙️ Configuration Guide

### Complete Configuration Structure

```javascript
const config = {
  // 1. Service Configuration
  services: {
    zkpay_backend: {
      url: "https://backend.zkpay.network", // Required: ZKPay backend API address
      timeout: 300000, // Required: API request timeout (milliseconds)
    },
  },

  // 2. Blockchain Configuration
  blockchain: {
    // Source chain configuration array (management chain config removed, unified use of source_chains)
    source_chains: [
      {
        chain_id: 714, // Required: Source chain ID (SLIP44 BSC)
        rpc_url: "https://bsc-dataseed1.binance.org", // Required: RPC node address
        contracts: {
          treasury_contract: "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8", // Required: Treasury contract address
        },
        tokens: {
          test_usdt: {
            // Token configuration
            address: "0xbFBD79DbF5369D013a3D31812F67784efa6e0309", // Required: Token contract address
            decimals: 6, // Required: Token decimals
            symbol: "TUSDT", // Required: Token symbol
            token_id: 65535, // Required: Token ID
          },
        },
      },
    ],
  },

  // 3. Runtime Configuration
  runtime: {
    withdraw: {
      default_recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce", // Optional: Default recipient address
      max_wait_time: 300000, // Required: Maximum withdrawal wait time (milliseconds)
    },
    deposit: {
      confirmation_blocks: 3, // Required: Deposit confirmation blocks
    },
    proof_generation: {
      max_wait_time: 300000, // Required: Maximum proof generation wait time (milliseconds)
    },
  },

  // 4. Test Configuration (Optional)
  test: {
    users: {
      default: {
        private_key: "0x...", // Optional: Test user private key
      },
    },
  },
};
```

### Configuration Architecture Optimization Description

**Refactored Configuration Architecture Features:**

1. **Parameterized Passing**: ZKPayClient and all Managers use parameterized configuration, no longer dependent on complex config objects
2. **Responsibility Separation**: WalletManager handles RPC connections, other Managers handle business logic
3. **Configuration Simplification**: Removed management_chain configuration, unified use of parameterized Map structure
4. **Code Clarity**: Only one configuration method, avoiding compatibility confusion

**New Usage Method:**

```javascript
// Create parameterized configuration
const treasuryContracts = new Map([
  [56, "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8"],
]);

// Token configuration: Only need to configure address, decimals and symbol are automatically read from contract
const tokenConfigs = new Map([
  ["56_test_usdt", "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"],
]);

// Create client
const client = new ZKPayClient(logger, {
  apiConfig: {
    baseURL: "https://backend.zkpay.network",
    timeout: 300000,
  },
  treasuryContracts,
  tokenConfigs,
  confirmationBlocks: 3,
  maxWaitTime: 300000,
  defaultRecipientAddress: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
});
```

### 最小配置

对于基本功能，只需要以下最小配置：

```javascript
const client = new ZKPayClient(logger, {
  apiConfig: {
    baseURL: "https://backend.zkpay.network",
    timeout: 300000,
  },
});
```

### 配置字段说明

#### 必需字段

- `apiConfig.baseURL` - ZKPay 后端 API 地址
- `apiConfig.timeout` - API 请求超时时间

#### 可选字段

- `treasuryContracts` - Treasury 合约地址 Map (chainId -> address)
- `tokenConfigs` - Token 地址 Map (chainId_symbol -> tokenAddress)
- `confirmationBlocks` - 存款确认区块数 (默认: 3)
- `maxWaitTime` - 最大等待时间 (默认: 300000ms)
- `defaultRecipientAddress` - 默认接收地址

#### Token 配置说明

Token 配置只需要提供合约地址，其他信息（decimals、symbol、name）会自动从合约中读取：

**配置格式**：`slip44Id_symbol -> tokenAddress`

```javascript
const tokenConfigs = new Map([
  ["714_test_usdt", "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"], // BSC上的测试USDT (SLIP44 714)
  ["60_usdt", "0xdAC17F958D2ee523a2206206994597C13D831ec7"], // Ethereum上的USDT (SLIP44 60)
  ["966_usdc", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"], // Polygon上的USDC (SLIP44 966)
  ["714_busd", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"], // BSC上的BUSD (SLIP44 714)
  ["60_weth", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], // Ethereum上的WETH (SLIP44 60)
]);
```

**优势**：

- ✅ **简化配置**：只需要配置合约地址
- ✅ **自动获取**：decimals、symbol、name 从合约自动读取
- ✅ **避免错误**：不会因为手动配置 decimals 导致精度错误
- ✅ **支持任意 Token**：只要是 ERC20 标准 Token 都可以使用

### Initialization Example

```javascript
// Create parameterized configuration
const treasuryContracts = new Map([
  [714, "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8"], // SLIP44 BSC
]);

const tokenConfigs = new Map([
  ["714_test_usdt", "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"], // SLIP44 BSC
]);

// Initialize client
const client = new ZKPayClient(logger, {
  apiConfig: {
    baseURL: "https://backend.zkpay.network",
    timeout: 300000,
  },
  treasuryContracts,
  tokenConfigs,
  confirmationBlocks: 3,
  maxWaitTime: 300000,
});
await client.initialize();

// Login user (private key passed as parameter, not stored in configuration)
await client.login("0xYourPrivateKey");

// Usage example - All addresses passed directly
const tokenAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";
const amount = "10.0";

await client.deposit(714, tokenAddress, amount, treasuryAddress);
```

## 🔢 动态获取 Token Decimals 示例

```javascript
// 获取Token信息
const tokenInfo = await client.getTokenInfo(
  714,
  "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"
);
console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name})`);
console.log(`Decimals: ${tokenInfo.decimals}`);

// 使用动态decimals进行金额计算
const amount = "10.0";
const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
console.log(`${amount} ${tokenInfo.symbol} = ${amountWei.toString()} Wei`);

// 检查余额时使用动态decimals
const balance = await client.checkTokenBalance(714, tokenInfo.address);
console.log(`余额: ${balance.formatted} ${tokenInfo.symbol}`);

// 授权时使用动态decimals
if (balance.balance < amountWei) {
  console.log("余额不足，需要充值");
} else {
  await client.approveToken(714, tokenInfo.address, amount, treasuryAddress);
}
```

## 🌐 RPC URL 配置

SDK 支持从环境变量获取 RPC URL，或使用默认值：

### 环境变量配置

```bash
# Set specific chain RPC URL (using SLIP44 ID, SDK will automatically convert)
export RPC_URL_714=https://bsc-dataseed1.binance.org  # SLIP44 BSC
export RPC_URL_60=https://eth.llamarpc.com            # SLIP44 Ethereum
export RPC_URL_966=https://polygon-rpc.com            # SLIP44 Polygon

# Or use .env file
echo "RPC_URL_714=https://bsc-dataseed1.binance.org" >> .env
echo "RPC_URL_60=https://eth.llamarpc.com" >> .env

# 注意：环境变量使用EVM Chain ID，但SDK支持SLIP44 ID映射
# 例如：SLIP44 714 (Tron) 会自动映射到 Chain ID 56 (BSC RPC)
```

### 支持的链和 SLIP44 映射

| SLIP44 ID | EVM Chain ID | 链名称            | 默认 RPC URL                                   |
| --------- | ------------ | ----------------- | ---------------------------------------------- |
| 60        | 1            | Ethereum Mainnet  | https://eth.llamarpc.com                       |
| 60        | 3            | Ethereum Ropsten  | https://ropsten.infura.io/v3/                  |
| 60        | 4            | Ethereum Rinkeby  | https://rinkeby.infura.io/v3/                  |
| 60        | 5            | Ethereum Goerli   | https://goerli.infura.io/v3/                   |
| 60        | 42           | Ethereum Kovan    | https://kovan.infura.io/v3/                    |
| 60        | 11155111     | Ethereum Sepolia  | https://sepolia.infura.io/v3/                  |
| 714       | 56           | BSC Mainnet       | https://bsc-dataseed1.binance.org              |
| 714       | 97           | BSC Testnet       | https://data-seed-prebsc-1-s1.binance.org:8545 |
| 966       | 137          | Polygon Mainnet   | https://polygon-rpc.com                        |
| 966       | 80001        | Polygon Mumbai    | https://rpc-mumbai.maticvigil.com              |
| 42161     | 42161        | Arbitrum One      | https://arb1.arbitrum.io/rpc                   |
| 42161     | 421614       | Arbitrum Sepolia  | https://sepolia-rollup.arbitrum.io/rpc         |
| 10        | 10           | Optimism Mainnet  | https://mainnet.optimism.io                    |
| 10        | 420          | Optimism Sepolia  | https://sepolia.optimism.io                    |
| 250       | 250          | Fantom Mainnet    | https://rpc.ftm.tools                          |
| 250       | 4002         | Fantom Testnet    | https://rpc.testnet.fantom.network             |
| 60        | 25           | Cronos Mainnet    | https://evm.cronos.org                         |
| 60        | 338          | Cronos Testnet    | https://evm-t3.cronos.org                      |
| 1284      | 1284         | Moonbeam          | https://rpc.api.moonbeam.network               |
| 1284      | 1287         | Moonbase          | https://rpc.api.moonbase.moonbeam.network      |
| 60        | 43114        | Avalanche C-Chain | https://api.avax.network/ext/bc/C/rpc          |
| 60        | 43113        | Avalanche Fuji    | https://api.avax-test.network/ext/bc/C/rpc     |
| 100       | 100          | Gnosis Chain      | https://rpc.gnosischain.com                    |
| 100       | 10200        | Gnosis Chiado     | https://rpc.chiadochain.net                    |
| 195       | 195          | Tron Mainnet      | https://rpc.trongrid.io                        |
| 195       | 2494104990   | Tron Shasta       | https://api.shasta.trongrid.io                 |

### SLIP44 映射说明

SDK 支持 SLIP44 币种 ID 到 EVM 链 ID 的映射，主要特点：

- **SLIP44 60** → **Chain ID 1** (Ethereum 主网)
- **SLIP44 714** → **Chain ID 56** (BSC 主网)
- **SLIP44 966** → **Chain ID 137** (Polygon 主网)
- **SLIP44 42161** → **Chain ID 42161** (Arbitrum One)
- **SLIP44 10** → **Chain ID 10** (Optimism 主网)
- **SLIP44 250** → **Chain ID 250** (Fantom 主网)
- **SLIP44 195** → **Chain ID 195** (Tron 主网)
- **其他链**: 大部分 SLIP44 ID 与 EVM Chain ID 相同，无需映射

**Usage Example:**

```javascript
// Use SLIP44 ID to access BSC
const provider = walletManager.getProvider(714); // SLIP44 BSC ID
const network = await provider.getNetwork(); // Returns Chain ID 56

// Use SLIP44 ID to access Ethereum
const provider = walletManager.getProvider(60); // SLIP44 Ethereum ID
const network = await provider.getNetwork(); // Returns Chain ID 1

// Use SLIP44 ID to access Polygon
const provider = walletManager.getProvider(966); // SLIP44 Polygon ID
const network = await provider.getNetwork(); // Returns Chain ID 137

// Use SLIP44 ID to access Tron
const provider = walletManager.getProvider(195); // SLIP44 Tron ID
const network = await provider.getNetwork(); // Returns Chain ID 195
```

## 🔐 KMS 集成

zksdk 支持与外部密钥管理系统(KMS)集成，实现私钥的安全管理。支持 SLIP44 标准和多种签名类型：

### 基础 KMS 集成

```javascript
const { ZKPayClient } = require("zksdk");
const { ZKPayKMSSigner } = require("zksdk/utils/zkpay-kms-adapter");

// KMS configuration - using SLIP44 standard
const kmsConfig = {
  baseURL: "http://localhost:18082",
  keyAlias: "my_bsc_key",
  encryptedKey: "encrypted_private_key_from_kms",
  slip44Id: 714, // BSC uses SLIP44 ID 714
  address: "0x...",
  defaultSignatureType: "eip191", // BSC uses EIP-191 signature
};

// Create KMS signer
const kmsSigner = new ZKPayKMSSigner(kmsConfig);

// Login using KMS signer
const client = new ZKPayClient(config);
await client.loginWithSigner(kmsSigner, kmsConfig.address);
```

### SAAS KMS 集成

对于企业级用户，支持通过 SAAS 系统的 KMS 服务进行签名：

```javascript
const { SaasKMSSigner } = require("zksdk/utils/saas-kms-signer");

// SAAS KMS配置
const saasKmsConfig = {
  kmsUrl: "https://kms.your-saas.com",
  enterpriseId: "your_enterprise_id",
  chainId: 714, // BSC
  userAddress: "0x...",
  keyAlias: "enterprise_key",
  k1Key: "your_k1_key",
};

// 创建SAAS KMS签名器
const saasSigner = new SaasKMSSigner(saasKmsConfig);

// 使用SAAS KMS签名器登录
await client.loginWithSigner(saasSigner, saasKmsConfig.userAddress);
```

### 支持的区块链网络

| 网络     | SLIP44 ID | 签名类型 | 说明          |
| -------- | --------- | -------- | ------------- |
| Ethereum | 60        | eip191   | 以太坊主网    |
| BSC      | 714       | eip191   | 币安智能链    |
| Tron     | 195       | tip191t  | 波场网络      |
| Polygon  | 966       | eip191   | Polygon 网络  |
| Arbitrum | 42161     | eip191   | Arbitrum One  |
| Optimism | 10        | eip191   | Optimism 网络 |

### Multi-chain KMS Usage Example

```javascript
// 多链管理器
const {
  MultiChainKMSManager,
} = require("zksdk/examples/multi-chain-kms-example");

const manager = new MultiChainKMSManager(
  {
    baseURL: "http://localhost:18082",
    keyAlias: "multi_chain",
  },
  logger
);

// 添加不同链的配置
manager.addChain("bsc", {
  slip44Id: 714,
  encryptedKey: "bsc_encrypted_key",
  address: "0xBSC_ADDRESS",
  defaultSignatureType: "eip191",
});

manager.addChain("tron", {
  slip44Id: 195,
  encryptedKey: "tron_encrypted_key",
  address: "TRON_ADDRESS",
  defaultSignatureType: "tip191t",
});

// 跨链签名
await manager.signMessage("bsc", "Hello BSC!");
await manager.signMessage("tron", "Hello Tron!");
```

## 🔒 安全使用指南

### 私钥管理

- ✅ 使用 KMS 系统管理私钥（推荐）
- ✅ 使用环境变量存储私钥
- ✅ 使用.env 文件（不要提交到代码仓库）
- ✅ 定期轮换测试私钥
- ❌ 绝不在代码中硬编码私钥
- ❌ 绝不在公共仓库中暴露私钥

### 环境变量设置

```bash
# Set environment variable
export TEST_USER_PRIVATE_KEY=0xYourPrivateKey

# Or use .env file
echo "TEST_USER_PRIVATE_KEY=0xYourPrivateKey" > .env
```

### 安全检查清单

- [ ] 所有私钥通过环境变量传递
- [ ] 配置文件中没有硬编码的敏感信息
- [ ] .env 文件在 .gitignore 中
- [ ] 只使用测试网络和测试账户
- [ ] 定期轮换测试私钥

## 🧪 测试和示例

### 运行测试

```bash
# 进入examples目录
cd examples

# 运行基础功能测试
node quick-client-library-test.js

# 运行完整示例
node zkpay-client-example.js --all

# 运行特定示例
node zkpay-client-example.js --example example1
```

### 测试脚本

- `test-simple-commitment.js`: 简单承诺测试
- `test-commitment-retry.js`: 承诺重试测试
- `test-commitment-fixed.js`: 修复版承诺测试
- `test-withdraw.js`: 提现测试

## 🎯 使用建议

1. **开发阶段**: 使用分步执行，便于调试
2. **生产环境**: 使用便捷方法，简化代码
3. **长时间操作**: 使用异步方式，避免阻塞
4. **状态监控**: 使用 `checkStatus()`实时监控状态

## 📝 注意事项

- **私钥管理**: 通过 Wallet Manager 统一管理，一个私钥对应一个钱包实例
- **数据格式**: 金额使用字符串格式，避免精度丢失
- **超时设置**: 长时间操作有合理的超时设置
- **错误处理**: 所有方法都有完整的错误处理和日志记录
- **状态检查**: 操作前检查相关状态，确保流程正确
- **API 设计统一**:
  - 所有方法都使用 Token 合约地址，确保 API 一致性
  - 不再依赖 config.yaml 配置文件，所有参数直接传入
  - 支持任意 Token 合约，无需预配置
- **动态获取 Token 信息**:
  - 使用 `getTokenInfo()`方法动态获取 Token 的 decimals、symbol、name
  - 不再硬编码 decimals，确保精度计算的准确性
  - 支持任意 ERC20 Token，自动适配其精度

## 🔄 Relationship with Existing Code

This library is built on top of existing E2E automation code:

- **Reuse**: Fully reuses existing manager classes
- **Enhancement**: Added unified client interface
- **Integration**: Uses CommitmentManager internal signing methods
- **Extension**: Provides both synchronous/asynchronous operation modes

## 📦 Dependencies

- `ethers` - Ethereum interaction
- `axios` - HTTP requests
- `dotenv` - Environment variable management
- Existing logger and manager components

## 🔗 Related Files

- Original E2E test: `../zkpay-e2e-test.js`
- Logging utility: `../logger.js`
- Usage example: `examples/zkpay-client-example.js`
