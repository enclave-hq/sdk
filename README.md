# ZKPay SDK 完整指南

## 🏗️ 系统架构

```
ZKPay SDK
├── ZKPayClient (主客户端)
├── WalletManager (钱包管理 - 一个私钥对应一个钱包实例)
├── DepositManager (存款管理)
├── CommitmentManager (承诺管理)
└── WithdrawManager (提现管理)
```

## 🎯 核心功能

| 功能                  | API 方法                                              | 同步/异步 | 说明                       |
| --------------------- | ----------------------------------------------------- | --------- | -------------------------- |
| 1. 登录到后台         | `login(privateKey)`                                 | 同步      | 使用私钥登录认证           |
| 2. Approve 和 Deposit | `deposit(chainId, tokenSymbol, amount)`             | 同步      | 自动处理授权和存款         |
| 3. 读取 CheckBook     | `getUserDeposits()`                                 | 同步      | 获取用户的存款记录         |
| 4. 创建分配+签名      | `createAllocationAndSign(checkbookId, allocations)` | 同步      | 创建分配方案并签名         |
| 5. 执行 Commitment    | `executeCommitmentSync()`                           | 同步      | 等待到 with_checkbook 状态 |
| 5. 执行 Commitment    | `executeCommitmentAsync()`                          | 异步      | 立即返回，提供监控方法     |
| 6. 生成提现证明       | `generateProofSync()`                               | 同步      | 等待到 completed 状态      |
| 6. 生成提现证明       | `generateProofAsync()`                              | 异步      | 立即返回，提供监控方法     |

## 🔄 完整业务流程

### 1. 初始化和认证

```javascript
const { ZKPayClient } = require('./core/zkpay-client-library');
const client = new ZKPayClient(config, logger);
await client.initialize();

// 方式1: 使用私钥登录
await client.login(privateKey);

// 方式2: 使用KMS签名器登录
const kmsSigner = new ZKPayKMSSigner(kmsConfig);
await client.loginWithSigner(kmsSigner, userAddress);
```

### API流程概览

ZKPay的完整API流程包含以下关键步骤：

```
1. 认证登录 → 2. 存款检测 → 3. 承诺分配 → 4. 证明生成 → 5. 提现完成
     ↓              ↓              ↓              ↓              ↓
  登录后端        检测链上交易     创建分配签名     生成ZK证明     执行链上提现
```

#### 详细API调用流程

**阶段1: 初始化和认证**
```javascript
// 1.1 初始化客户端
await client.initialize();

// 1.2 用户认证 (二选一)
await client.login(privateKey);  // 直接私钥登录
// 或
await client.loginWithSigner(kmsSigner, userAddress);  // KMS签名器登录
```

**阶段2: 存款操作**
```javascript
// 2.1 检查Token余额和授权
const balance = await client.checkTokenBalance(chainId, tokenAddress);
const allowance = await client.checkTokenAllowance(chainId, tokenAddress, treasuryAddress);

// 2.2 授权Token (如果需要)
if (allowance.balance < requiredAmount) {
    await client.approveToken(chainId, tokenAddress, amount, treasuryAddress);
}

// 2.3 执行存款
const depositResult = await client.deposit(chainId, tokenAddress, amount, treasuryAddress);

// 2.4 等待后端检测存款
const depositRecord = await client.waitForDepositDetection(depositResult.txHash, chainId, 60);
```

**阶段3: 承诺分配**
```javascript
// 3.1 创建分配方案
const allocations = [{
    recipient_chain_id: targetChainId,
    recipient_address: recipientAddress,
    amount: amountInWei
}];

// 3.2 执行承诺 (同步或异步)
const commitmentResult = await client.executeCommitmentSync(
    depositRecord.checkbookId, allocations, true
);
```

**阶段4: 证明生成**
```javascript
// 4.1 准备提现信息
const recipientInfo = {
    chain_id: targetChainId,
    address: recipientAddress,
    amount: amountInWei,
    token_symbol: tokenSymbol
};

// 4.2 生成提现证明 (同步或异步)
const proofResult = await client.generateProofSync(
    depositRecord.checkbookId, recipientInfo, true
);
```

**阶段5: 状态监控**
```javascript
// 5.1 监控承诺状态
await client.waitForCommitmentStatus(checkbookId, ['with_checkbook'], 300);

// 5.2 监控证明生成状态
await client.waitForProofStatus(checkId, ['completed'], 300);
```

### 2. 存款 (Deposit)

```javascript
// 定义必要的地址和参数
const testUsdtAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
const amount = '10.0';

// 获取Token信息（包括decimals）
const tokenInfo = await client.getTokenInfo(714, testUsdtAddress);
console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);

// 检查余额和授权 (使用Token地址)
const balance = await client.checkTokenBalance(714, testUsdtAddress);
const allowance = await client.checkTokenAllowance(714, testUsdtAddress, treasuryAddress);

// 授权代币 (使用Token地址和动态decimals)
if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
    await client.approveToken(714, testUsdtAddress, amount, treasuryAddress);
}

// 执行存款 (使用Token地址)
const depositResult = await client.deposit(714, testUsdtAddress, amount, treasuryAddress);
const depositRecord = await client.waitForDepositDetection(
    depositResult.txHash, 714, 60
);
```

### 3. 承诺 (Commitment)

```javascript
// 创建分配方案
const allocations = [{
    recipient_chain_id: 714,
    recipient_address: '0x接收地址',
    amount: '10000000000000000000' // 10.0 USDT
}];

// 执行承诺
const commitmentResult = await client.executeCommitmentSync(
    depositRecord.checkbookId, allocations, true
);
```

### 4. 提现 (Withdraw)

```javascript
// 准备接收信息
const recipientInfo = {
    chain_id: 714,
    address: '0x接收地址',
    amount: '10000000000000000000',
    token_symbol: 'test_usdt'
};

// 生成提现证明
const withdrawResult = await client.generateProofSync(
    depositRecord.checkbookId, recipientInfo, true
);
```

## 🚀 使用方法

### 方法1: 分步执行

```javascript
async function stepByStepFlow() {
    const client = new ZKPayClient(config, logger);
    await client.initialize();
    await client.login(privateKey);
  
    // 定义必要的地址和参数
    const testUsdtAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
    const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
    const amount = '10.0';
  
    // 获取Token信息（包括decimals）
    const tokenInfo = await client.getTokenInfo(714, testUsdtAddress);
    console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);
  
    // 检查余额和授权 (使用Token地址)
    const balance = await client.checkTokenBalance(714, testUsdtAddress);
    const allowance = await client.checkTokenAllowance(714, testUsdtAddress, treasuryAddress);
  
    // 授权代币 (如果需要，使用Token地址和动态decimals)
    if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
        await client.approveToken(714, testUsdtAddress, amount, treasuryAddress);
    }
  
    // 存款 (使用Token地址)
    const depositResult = await client.deposit(714, testUsdtAddress, amount, treasuryAddress);
    const depositRecord = await client.waitForDepositDetection(
        depositResult.txHash, 714, 60
    );
  
    // 承诺
    const allocations = [{
        recipient_chain_id: 714,
        recipient_address: '0x接收地址',
        amount: '10000000000000000000'
    }];
    const commitmentResult = await client.executeCommitmentSync(
        depositRecord.checkbookId, allocations, true
    );
  
    // 提现
    const recipientInfo = {
        chain_id: 714,
        address: '0x接收地址',
        amount: '10000000000000000000',
        token_symbol: 'test_usdt'
    };
    const withdrawResult = await client.generateProofSync(
        depositRecord.checkbookId, recipientInfo, true
    );
  
    return { depositResult, commitmentResult, withdrawResult };
}
```

### 方法2: 便捷方法

```javascript
async function convenientFlow() {
    const client = new ZKPayClient(config, logger);
    await client.initialize();
    await client.login(privateKey);
  
    // 从存款到承诺
    const allocations = [{
        recipient_chain_id: 714,
        recipient_address: '0x接收地址',
        amount: '10000000000000000000'
    }];
  
    const depositToCommitment = await client.performFullDepositToCommitment(
        714, 'test_usdt', '10.0', allocations, { waitForCommitment: true }
    );
  
    // 从承诺到提现
    const recipientInfo = {
        chain_id: 714,
        address: '0x接收地址',
        amount: '10000000000000000000',
        token_symbol: 'test_usdt'
    };
  
    const commitmentToWithdraw = await client.performFullCommitmentToWithdraw(
        depositToCommitment.depositRecord.checkbook_id,
        recipientInfo,
        { waitForProof: true, maxWaitTime: 300 }
    );
  
    return { depositToCommitment, commitmentToWithdraw };
}
```

## 📊 状态流转

```
存款: pending → detected → ready_for_commitment → with_checkbook → issued
承诺: ready_for_commitment → submitting_commitment → commitment_pending → with_checkbook
提现: with_checkbook → generating_proof → proved → completed
```

## 🔧 核心接口

### 钱包管理

- `login(privateKey)`: 设置用户钱包
- `getCurrentUser()`: 获取当前用户信息

### 存款管理

- `getTokenInfo(chainId, tokenContractAddress)`: 获取Token信息 (地址、decimals、symbol、name)
- `checkTokenBalance(chainId, tokenContractAddress)`: 检查余额 (使用Token合约地址)
- `checkTokenAllowance(chainId, tokenContractAddress, treasuryAddress)`: 检查授权 (使用Token合约地址)
- `approveToken(chainId, tokenAddress, amount, treasuryAddress)`: 授权代币 (使用Token地址)
- `deposit(chainId, tokenAddress, amount, treasuryAddress)`: 执行存款 (使用Token地址)
- `waitForDepositDetection(txHash, chainId, maxWaitTime)`: 等待检测

### 承诺管理

- `getUserDeposits(userAddress?, chainId?)`: 获取存款记录
- `getCheckbookDetails(checkbookId)`: 获取CheckBook详情
- `executeCommitmentSync(checkbookId, allocations, waitForWithCheck)`: 同步执行承诺
- `executeCommitmentAsync(checkbookId, allocations)`: 异步执行承诺

### 提现管理

- `generateProofSync(checkbookId, recipientInfo, waitForCompleted)`: 同步生成证明
- `generateProofAsync(checkbookId, recipientInfo)`: 异步生成证明

### 便捷方法

- `performFullDepositToCommitment(chainId, tokenSymbol, amount, allocations, options)`: 存款到承诺
- `performFullCommitmentToWithdraw(checkbookId, recipientInfo, options)`: 承诺到提现

## ⚙️ 配置说明

### 完整配置结构

```javascript
const config = {
    // 1. 服务配置
    services: {
        zkpay_backend: {
            url: 'https://backend.zkpay.network',    // 必需：ZKPay后端API地址
            timeout: 300000                          // 必需：API请求超时时间(毫秒)
        }
    },

    // 2. 区块链配置
    blockchain: {
        // 源链配置数组（管理链配置已移除，统一使用source_chains）
        source_chains: [{
            chain_id: 714,                          // 必需：源链ID (SLIP44 BSC)
            rpc_url: 'https://bsc-dataseed1.binance.org',  // 必需：RPC节点地址
            contracts: {
                treasury_contract: '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8'  // 必需：Treasury合约地址
            },
            tokens: {
                test_usdt: {                          // Token配置
                    address: '0xbFBD79DbF5369D013a3D31812F67784efa6e0309',  // 必需：Token合约地址
                    decimals: 6,                        // 必需：Token精度
                    symbol: 'TUSDT',                    // 必需：Token符号
                    token_id: 65535                     // 必需：Token ID
                }
            }
        }]
    },

    // 3. 运行时配置
    runtime: {
        withdraw: {
            default_recipient_address: '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce',  // 可选：默认接收地址
            max_wait_time: 300000                   // 必需：提现最大等待时间(毫秒)
        },
        deposit: {
            confirmation_blocks: 3                  // 必需：存款确认区块数
        },
        proof_generation: {
            max_wait_time: 300000                   // 必需：证明生成最大等待时间(毫秒)
        }
    },

    // 4. 测试配置（可选）
    test: {
        users: {
            default: {
                private_key: '0x...'                // 可选：测试用户私钥
            }
        }
    }
};
```

### 配置架构优化说明

**重构后的配置架构特点：**

1. **参数化传递**：ZKPayClient和所有Manager都使用参数化配置，不再依赖复杂的config对象
2. **职责分离**：WalletManager负责RPC连接，其他Manager负责业务逻辑
3. **配置简化**：移除了management_chain配置，统一使用参数化Map结构
4. **代码清晰**：只有一套配置方式，避免兼容性混乱

**新的使用方式：**

```javascript
// 创建参数化配置
const treasuryContracts = new Map([
    [56, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8']
]);

// Token配置：只需要配置地址，decimals和symbol从合约自动读取
const tokenConfigs = new Map([
    ['56_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']
]);

// 创建客户端
const client = new ZKPayClient(logger, {
    apiConfig: {
        baseURL: 'https://backend.zkpay.network',
        timeout: 300000
    },
    treasuryContracts,
    tokenConfigs,
    confirmationBlocks: 3,
    maxWaitTime: 300000,
    defaultRecipientAddress: '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce'
});
```

### 最小配置

对于基本功能，只需要以下最小配置：

```javascript
const client = new ZKPayClient(logger, {
    apiConfig: {
        baseURL: 'https://backend.zkpay.network',
        timeout: 300000
    }
});
```

### 配置字段说明

#### 必需字段

- `apiConfig.baseURL` - ZKPay后端API地址
- `apiConfig.timeout` - API请求超时时间

#### 可选字段

- `treasuryContracts` - Treasury合约地址Map (chainId -> address)
- `tokenConfigs` - Token地址Map (chainId_symbol -> tokenAddress)
- `confirmationBlocks` - 存款确认区块数 (默认: 3)
- `maxWaitTime` - 最大等待时间 (默认: 300000ms)
- `defaultRecipientAddress` - 默认接收地址

#### Token配置说明

Token配置只需要提供合约地址，其他信息（decimals、symbol、name）会自动从合约中读取：

**配置格式**：`slip44Id_symbol -> tokenAddress`

```javascript
const tokenConfigs = new Map([
    ['714_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'],  // BSC上的测试USDT (SLIP44 714)
    ['60_usdt', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],        // Ethereum上的USDT (SLIP44 60)
    ['966_usdc', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],      // Polygon上的USDC (SLIP44 966)
    ['714_busd', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'],       // BSC上的BUSD (SLIP44 714)
    ['60_weth', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']         // Ethereum上的WETH (SLIP44 60)
]);
```

**优势**：

- ✅ **简化配置**：只需要配置合约地址
- ✅ **自动获取**：decimals、symbol、name从合约自动读取
- ✅ **避免错误**：不会因为手动配置decimals导致精度错误
- ✅ **支持任意Token**：只要是ERC20标准Token都可以使用

### 初始化示例

```javascript
// 创建参数化配置
const treasuryContracts = new Map([
    [714, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8']  // SLIP44 BSC
]);

const tokenConfigs = new Map([
    ['714_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']  // SLIP44 BSC
]);

// 初始化客户端
const client = new ZKPayClient(logger, {
    apiConfig: {
        baseURL: 'https://backend.zkpay.network',
        timeout: 300000
    },
    treasuryContracts,
    tokenConfigs,
    confirmationBlocks: 3,
    maxWaitTime: 300000
});
await client.initialize();

// 登录用户（私钥通过参数传入，不存储在配置中）
await client.login('0x你的私钥');

// 使用示例 - 所有地址直接传入
const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
const amount = '10.0';

await client.deposit(714, tokenAddress, amount, treasuryAddress);
```

## 🔢 动态获取Token Decimals示例

```javascript
// 获取Token信息
const tokenInfo = await client.getTokenInfo(714, '0xbFBD79DbF5369D013a3D31812F67784efa6e0309');
console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name})`);
console.log(`Decimals: ${tokenInfo.decimals}`);

// 使用动态decimals进行金额计算
const amount = '10.0';
const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
console.log(`${amount} ${tokenInfo.symbol} = ${amountWei.toString()} Wei`);

// 检查余额时使用动态decimals
const balance = await client.checkTokenBalance(714, tokenInfo.address);
console.log(`余额: ${balance.formatted} ${tokenInfo.symbol}`);

// 授权时使用动态decimals
if (balance.balance < amountWei) {
    console.log('余额不足，需要充值');
} else {
    await client.approveToken(714, tokenInfo.address, amount, treasuryAddress);
}
```

## 🌐 RPC URL 配置

SDK支持从环境变量获取RPC URL，或使用默认值：

### 环境变量配置

```bash
# 设置特定链的RPC URL (使用SLIP44 ID，SDK会自动转换)
export RPC_URL_714=https://bsc-dataseed1.binance.org  # SLIP44 BSC
export RPC_URL_60=https://eth.llamarpc.com            # SLIP44 Ethereum
export RPC_URL_966=https://polygon-rpc.com            # SLIP44 Polygon

# 或者使用.env文件
echo "RPC_URL_714=https://bsc-dataseed1.binance.org" >> .env
echo "RPC_URL_60=https://eth.llamarpc.com" >> .env

# 注意：环境变量使用EVM Chain ID，但SDK支持SLIP44 ID映射
# 例如：SLIP44 714 (Tron) 会自动映射到 Chain ID 56 (BSC RPC)
```

### 支持的链和SLIP44映射

| SLIP44 ID | EVM Chain ID | 链名称            | 默认RPC URL                                    |
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

### SLIP44映射说明

SDK支持SLIP44币种ID到EVM链ID的映射，主要特点：

- **SLIP44 60** → **Chain ID 1** (Ethereum主网)
- **SLIP44 714** → **Chain ID 56** (BSC主网)
- **SLIP44 966** → **Chain ID 137** (Polygon主网)
- **SLIP44 42161** → **Chain ID 42161** (Arbitrum One)
- **SLIP44 10** → **Chain ID 10** (Optimism主网)
- **SLIP44 250** → **Chain ID 250** (Fantom主网)
- **SLIP44 195** → **Chain ID 195** (Tron主网)
- **其他链**: 大部分SLIP44 ID与EVM Chain ID相同，无需映射

**使用示例**：

```javascript
// 使用SLIP44 ID访问BSC
const provider = walletManager.getProvider(714); // SLIP44 BSC ID
const network = await provider.getNetwork(); // 返回 Chain ID 56

// 使用SLIP44 ID访问Ethereum
const provider = walletManager.getProvider(60); // SLIP44 Ethereum ID  
const network = await provider.getNetwork(); // 返回 Chain ID 1

// 使用SLIP44 ID访问Polygon
const provider = walletManager.getProvider(966); // SLIP44 Polygon ID
const network = await provider.getNetwork(); // 返回 Chain ID 137

// 使用SLIP44 ID访问Tron
const provider = walletManager.getProvider(195); // SLIP44 Tron ID
const network = await provider.getNetwork(); // 返回 Chain ID 195
```

## 🔐 KMS集成

zksdk支持与外部密钥管理系统(KMS)集成，实现私钥的安全管理。支持SLIP44标准和多种签名类型：

### 基础KMS集成

```javascript
const { ZKPayClient } = require('zksdk');
const { ZKPayKMSSigner } = require('zksdk/utils/zkpay-kms-adapter');

// KMS配置 - 使用SLIP44标准
const kmsConfig = {
    baseURL: 'http://localhost:18082',
    keyAlias: 'my_bsc_key',
    encryptedKey: 'encrypted_private_key_from_kms',
    slip44Id: 714,  // BSC使用SLIP44 ID 714
    address: '0x...',
    defaultSignatureType: 'eip191'  // BSC使用EIP-191签名
};

// 创建KMS签名器
const kmsSigner = new ZKPayKMSSigner(kmsConfig);

// 使用KMS签名器登录
const client = new ZKPayClient(config);
await client.loginWithSigner(kmsSigner, kmsConfig.address);
```

### SAAS KMS集成

对于企业级用户，支持通过SAAS系统的KMS服务进行签名：

```javascript
const { SaasKMSSigner } = require('zksdk/utils/saas-kms-signer');

// SAAS KMS配置
const saasKmsConfig = {
    kmsUrl: 'https://kms.your-saas.com',
    enterpriseId: 'your_enterprise_id',
    chainId: 714,  // BSC
    userAddress: '0x...',
    keyAlias: 'enterprise_key',
    k1Key: 'your_k1_key'
};

// 创建SAAS KMS签名器
const saasSigner = new SaasKMSSigner(saasKmsConfig);

// 使用SAAS KMS签名器登录
await client.loginWithSigner(saasSigner, saasKmsConfig.userAddress);
```

### 支持的区块链网络

| 网络 | SLIP44 ID | 签名类型 | 说明 |
|------|-----------|----------|------|
| Ethereum | 60 | eip191 | 以太坊主网 |
| BSC | 714 | eip191 | 币安智能链 |
| Tron | 195 | tip191t | 波场网络 |
| Polygon | 966 | eip191 | Polygon网络 |
| Arbitrum | 42161 | eip191 | Arbitrum One |
| Optimism | 10 | eip191 | Optimism网络 |

### 多链KMS使用示例

```javascript
// 多链管理器
const { MultiChainKMSManager } = require('zksdk/examples/multi-chain-kms-example');

const manager = new MultiChainKMSManager({
    baseURL: 'http://localhost:18082',
    keyAlias: 'multi_chain'
}, logger);

// 添加不同链的配置
manager.addChain('bsc', {
    slip44Id: 714,
    encryptedKey: 'bsc_encrypted_key',
    address: '0xBSC_ADDRESS',
    defaultSignatureType: 'eip191'
});

manager.addChain('tron', {
    slip44Id: 195,
    encryptedKey: 'tron_encrypted_key',
    address: 'TRON_ADDRESS',
    defaultSignatureType: 'tip191t'
});

// 跨链签名
await manager.signMessage('bsc', 'Hello BSC!');
await manager.signMessage('tron', 'Hello Tron!');
```

## 🔒 安全使用指南

### 私钥管理

- ✅ 使用KMS系统管理私钥（推荐）
- ✅ 使用环境变量存储私钥
- ✅ 使用.env文件（不要提交到代码仓库）
- ✅ 定期轮换测试私钥
- ❌ 绝不在代码中硬编码私钥
- ❌ 绝不在公共仓库中暴露私钥

### 环境变量设置

```bash
# 设置环境变量
export TEST_USER_PRIVATE_KEY=0x你的私钥

# 或者使用.env文件
echo "TEST_USER_PRIVATE_KEY=0x你的私钥" > .env
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

- **私钥管理**: 通过Wallet Manager统一管理，一个私钥对应一个钱包实例
- **数据格式**: 金额使用字符串格式，避免精度丢失
- **超时设置**: 长时间操作有合理的超时设置
- **错误处理**: 所有方法都有完整的错误处理和日志记录
- **状态检查**: 操作前检查相关状态，确保流程正确
- **API设计统一**:
  - 所有方法都使用Token合约地址，确保API一致性
  - 不再依赖config.yaml配置文件，所有参数直接传入
  - 支持任意Token合约，无需预配置
- **动态获取Token信息**:
  - 使用 `getTokenInfo()`方法动态获取Token的decimals、symbol、name
  - 不再硬编码decimals，确保精度计算的准确性
  - 支持任意ERC20 Token，自动适配其精度

## 🔄 与原有代码的关系

这个库是在现有 E2E 自动化代码基础上构建的：

- **复用**: 完全复用现有的 manager 类
- **增强**: 添加了统一的客户端接口
- **集成**: 使用 CommitmentManager 内部签名方法
- **扩展**: 提供了同步/异步两种操作方式

## 📦 依赖

- `ethers` - 以太坊交互
- `axios` - HTTP 请求
- `dotenv` - 环境变量管理
- 现有的 logger 和 manager 组件

## 🔗 相关文件

- 原始 E2E 测试: `../zkpay-e2e-test.js`
- 日志工具: `../logger.js`
- 使用示例: `examples/zkpay-client-example.js`
