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

| 功能 | API 方法 | 同步/异步 | 说明 |
|------|----------|-----------|------|
| 1. 登录到后台 | `login(privateKey)` | 同步 | 使用私钥登录认证 |
| 2. Approve 和 Deposit | `deposit(chainId, tokenSymbol, amount)` | 同步 | 自动处理授权和存款 |
| 3. 读取 CheckBook | `getUserDeposits()` | 同步 | 获取用户的存款记录 |
| 4. 创建分配+签名 | `createAllocationAndSign(checkbookId, allocations)` | 同步 | 创建分配方案并签名 |
| 5. 执行 Commitment | `executeCommitmentSync()` | 同步 | 等待到 with_checkbook 状态 |
| 5. 执行 Commitment | `executeCommitmentAsync()` | 异步 | 立即返回，提供监控方法 |
| 6. 生成提现证明 | `generateProofSync()` | 同步 | 等待到 completed 状态 |
| 6. 生成提现证明 | `generateProofAsync()` | 异步 | 立即返回，提供监控方法 |

## 🔄 完整业务流程

### 1. 初始化
```javascript
const { ZKPayClient } = require('./core/zkpay-client-library');
const client = new ZKPayClient(config, logger);
await client.initialize();
await client.login(privateKey); // 设置用户钱包
```

### 2. 存款 (Deposit)
```javascript
// 定义必要的地址和参数
const testUsdtAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
const amount = '10.0';

// 获取Token信息（包括decimals）
const tokenInfo = await client.getTokenInfo(56, testUsdtAddress);
console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);

// 检查余额和授权 (使用Token地址)
const balance = await client.checkTokenBalance(56, testUsdtAddress);
const allowance = await client.checkTokenAllowance(56, testUsdtAddress, treasuryAddress);

// 授权代币 (使用Token地址和动态decimals)
if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
    await client.approveToken(56, testUsdtAddress, amount, treasuryAddress);
}

// 执行存款 (使用Token地址)
const depositResult = await client.deposit(56, testUsdtAddress, amount, treasuryAddress);
const depositRecord = await client.waitForDepositDetection(
    depositResult.txHash, 56, 60
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
    const tokenInfo = await client.getTokenInfo(56, testUsdtAddress);
    console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);
    
    // 检查余额和授权 (使用Token地址)
    const balance = await client.checkTokenBalance(56, testUsdtAddress);
    const allowance = await client.checkTokenAllowance(56, testUsdtAddress, treasuryAddress);
    
    // 授权代币 (如果需要，使用Token地址和动态decimals)
    if (allowance.balance < ethers.parseUnits(amount, tokenInfo.decimals)) {
        await client.approveToken(56, testUsdtAddress, amount, treasuryAddress);
    }
    
    // 存款 (使用Token地址)
    const depositResult = await client.deposit(56, testUsdtAddress, amount, treasuryAddress);
    const depositRecord = await client.waitForDepositDetection(
        depositResult.txHash, 56, 60
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
        56, 'test_usdt', '10.0', allocations, { waitForCommitment: true }
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

## ⚙️ 初始化要求

```javascript
// 只需要基本的服务配置
const config = {
    services: {
        zkpay_backend: {
            url: 'https://backend.zkpay.network',
            timeout: 300000
        }
    }
};

// 初始化客户端
const client = new ZKPayClient(config, logger);
await client.initialize();

// 登录用户（私钥通过参数传入，不存储在配置中）
await client.login('0x你的私钥');

// 使用示例 - 所有地址直接传入
const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
const amount = '10.0';

await client.deposit(56, tokenAddress, amount, treasuryAddress);
```

## 🔢 动态获取Token Decimals示例

```javascript
// 获取Token信息
const tokenInfo = await client.getTokenInfo(56, '0xbFBD79DbF5369D013a3D31812F67784efa6e0309');
console.log(`Token: ${tokenInfo.symbol} (${tokenInfo.name})`);
console.log(`Decimals: ${tokenInfo.decimals}`);

// 使用动态decimals进行金额计算
const amount = '10.0';
const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
console.log(`${amount} ${tokenInfo.symbol} = ${amountWei.toString()} Wei`);

// 检查余额时使用动态decimals
const balance = await client.checkTokenBalance(56, tokenInfo.address);
console.log(`余额: ${balance.formatted} ${tokenInfo.symbol}`);

// 授权时使用动态decimals
if (balance.balance < amountWei) {
    console.log('余额不足，需要充值');
} else {
    await client.approveToken(56, tokenInfo.address, amount, treasuryAddress);
}
```

## 🌐 RPC URL 配置

SDK支持从环境变量获取RPC URL，或使用默认值：

### 环境变量配置
```bash
# 设置特定链的RPC URL (使用EVM Chain ID)
export RPC_URL_56=https://bsc-dataseed1.binance.org
export RPC_URL_1=https://eth.llamarpc.com
export RPC_URL_137=https://polygon-rpc.com

# 或者使用.env文件
echo "RPC_URL_56=https://bsc-dataseed1.binance.org" >> .env
echo "RPC_URL_1=https://eth.llamarpc.com" >> .env

# 注意：环境变量使用EVM Chain ID，但SDK支持SLIP44 ID映射
# 例如：SLIP44 714 (Tron) 会自动映射到 Chain ID 56 (BSC RPC)
```

### 支持的链和SLIP44映射
| SLIP44 ID | EVM Chain ID | 链名称 | 默认RPC URL |
|-----------|--------------|--------|-------------|
| 60 | 1 | Ethereum Mainnet | https://eth.llamarpc.com |
| 60 | 3 | Ethereum Ropsten | https://ropsten.infura.io/v3/ |
| 60 | 4 | Ethereum Rinkeby | https://rinkeby.infura.io/v3/ |
| 60 | 5 | Ethereum Goerli | https://goerli.infura.io/v3/ |
| 60 | 42 | Ethereum Kovan | https://kovan.infura.io/v3/ |
| 60 | 11155111 | Ethereum Sepolia | https://sepolia.infura.io/v3/ |
| 714 | 56 | BSC Mainnet | https://bsc-dataseed1.binance.org |
| 714 | 97 | BSC Testnet | https://data-seed-prebsc-1-s1.binance.org:8545 |
| 966 | 137 | Polygon Mainnet | https://polygon-rpc.com |
| 966 | 80001 | Polygon Mumbai | https://rpc-mumbai.maticvigil.com |
| 42161 | 42161 | Arbitrum One | https://arb1.arbitrum.io/rpc |
| 42161 | 421614 | Arbitrum Sepolia | https://sepolia-rollup.arbitrum.io/rpc |
| 10 | 10 | Optimism Mainnet | https://mainnet.optimism.io |
| 10 | 420 | Optimism Sepolia | https://sepolia.optimism.io |
| 250 | 250 | Fantom Mainnet | https://rpc.ftm.tools |
| 250 | 4002 | Fantom Testnet | https://rpc.testnet.fantom.network |
| 60 | 25 | Cronos Mainnet | https://evm.cronos.org |
| 60 | 338 | Cronos Testnet | https://evm-t3.cronos.org |
| 1284 | 1284 | Moonbeam | https://rpc.api.moonbeam.network |
| 1284 | 1287 | Moonbase | https://rpc.api.moonbase.moonbeam.network |
| 60 | 43114 | Avalanche C-Chain | https://api.avax.network/ext/bc/C/rpc |
| 60 | 43113 | Avalanche Fuji | https://api.avax-test.network/ext/bc/C/rpc |
| 100 | 100 | Gnosis Chain | https://rpc.gnosischain.com |
| 100 | 10200 | Gnosis Chiado | https://rpc.chiadochain.net |
| 195 | 195 | Tron Mainnet | https://rpc.trongrid.io |
| 195 | 2494104990 | Tron Shasta | https://api.shasta.trongrid.io |

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

## 🔒 安全使用指南

### 私钥管理
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
node quick-client-library-test.js --config config.yaml

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
4. **状态监控**: 使用`checkStatus()`实时监控状态

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
  - 使用`getTokenInfo()`方法动态获取Token的decimals、symbol、name
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
- `js-yaml` - 配置文件解析
- `dotenv` - 环境变量管理
- 现有的 logger 和 manager 组件

## 🔗 相关文件

- 原始 E2E 测试: `../zkpay-e2e-test.js`
- 日志工具: `../logger.js`
- 配置文件: `../config.yaml`
- 使用示例: `examples/zkpay-client-example.js`