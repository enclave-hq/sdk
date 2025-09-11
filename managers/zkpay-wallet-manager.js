// ZKPay 钱包管理器 - 处理私钥、签名和账户管理

const { ethers } = require('ethers');
const { createLogger } = require('../utils/logger');

class ZKPayWalletManager {
    constructor(logger) {
        this.logger = logger || createLogger('WalletManager');
        this.wallets = new Map();
        this.providers = new Map();
        this.tronEnergyManager = null;
    }

    /**
     * 初始化钱包管理器
     */
    async initialize() {
        this.logger.info('🔐 初始化钱包管理器...');
        
        // 初始化RPC提供者
        await this.initializeProviders();
        
        // 初始化测试用户钱包
        await this.initializeWallets();
        
        // 注意：专注于BSC和Anvil，不再初始化TRON能量管理器
        
        this.logger.info('✅ 钱包管理器初始化完成');
    }

    /**
     * SLIP44币种ID到实际链ID的映射表
     * 注意：SLIP44是币种ID标准，不是链ID标准
     * 某些币种使用SLIP44 ID，但需要通过不同的链ID进行RPC交互
     */
    getActualChainId(slip44CoinId) {
        const slip44ToChainMapping = {
            // 只保留必要的映射
            60: 1,    // Ethereum Mainnet (SLIP44 60 -> Chain ID 1)
            714: 56,  // BSC Mainnet (SLIP44 714 -> Chain ID 56)
            195: 195, // Tron Mainnet (SLIP44 195 -> Chain ID 195)
        };
        
        return slip44ToChainMapping[slip44CoinId] || slip44CoinId;
    }

    /**
     * 获取RPC URL（优先从环境变量，然后使用默认值）
     */
    getRpcUrl(chainId) {
        // 首先检查是否是SLIP44 ID，如果是则转换为实际链ID
        const actualChainId = this.getActualChainId(chainId);
        
        // 只保留必要的链的RPC URL
        const defaultRpcUrls = {
            1: 'https://eth.llamarpc.com', // Ethereum Mainnet (SLIP44 60)
            56: 'https://bsc-dataseed1.binance.org', // BSC Mainnet (SLIP44 714)
            195: 'https://api.trongrid.io/jsonrpc', // Tron Mainnet (SLIP44 195)
        };

        // 优先从环境变量获取（使用原始chainId）
        const envVarName = `RPC_URL_${chainId}`;
        const envRpcUrl = process.env[envVarName];
        
        if (envRpcUrl) {
            this.logger.debug(`📡 使用环境变量RPC URL: ${envVarName} = ${envRpcUrl}`);
            return envRpcUrl;
        }

        // 使用默认RPC URL（使用实际链ID）
        const defaultUrl = defaultRpcUrls[actualChainId];
        if (defaultUrl) {
            if (actualChainId !== chainId) {
                this.logger.debug(`📡 SLIP44映射: ${chainId} -> ${actualChainId}, 使用RPC: ${defaultUrl}`);
            } else {
                this.logger.debug(`📡 使用默认RPC URL: Chain ${chainId} = ${defaultUrl}`);
            }
            return defaultUrl;
        }

        throw new Error(`未找到链 ${chainId} (实际链ID: ${actualChainId}) 的RPC URL，请设置环境变量 ${envVarName} 或使用支持的链ID`);
    }

    /**
     * 初始化区块链RPC提供者
     */
    async initializeProviders() {
        // 只支持必要的链：714(BSC), 195(TRON), 60(ETH)
        const supportedChains = [714, 195, 60];
        
        for (const chainId of supportedChains) {
            try {
                const rpcUrl = this.getRpcUrl(chainId);
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                
                // 测试连接
                const network = await provider.getNetwork();
                this.providers.set(chainId.toString(), provider);
                this.logger.debug(`📡 链 ${chainId} RPC提供者已连接: ${rpcUrl} (实际链ID: ${network.chainId})`);
            } catch (error) {
                this.logger.warn(`⚠️ 链 ${chainId} RPC连接失败: ${error.message}`);
            }
        }

        // 测试连接
        for (const [name, provider] of this.providers) {
            try {
                const network = await provider.getNetwork();
                this.logger.info(`🌐 ${name} 网络连接成功: Chain ID ${network.chainId}`);
            } catch (error) {
                this.logger.error(`❌ ${name} 网络连接失败:`, error.message);
                throw error;
            }
        }
    }

    /**
     * 初始化测试用户钱包（现在通过login方法动态创建）
     */
    async initializeWallets() {
        // 不再从config初始化钱包，改为通过login方法动态创建
        this.logger.info('📝 钱包将通过login方法动态创建，无需预初始化');
    }

    /**
     * 检查用户在各链上的余额
     */
    async checkUserBalances(userName) {
        const userWallet = this.wallets.get(userName);
        if (!userWallet) {
            throw new Error(`用户 ${userName} 不存在`);
        }

        this.logger.info(`💰 检查用户 ${userName} 的余额:`);

        // 检查所有已连接的链的余额
        for (const [chainId, provider] of this.providers) {
            try {
                const balance = await provider.getBalance(userWallet.address);
                this.logger.info(`  📊 链 ${chainId}: ${ethers.formatEther(balance)} ETH`);
            } catch (error) {
                this.logger.warn(`  ⚠️ 链 ${chainId} 余额检查失败: ${error.message}`);
            }
        }
    }

    /**
     * 设置用户钱包
     */
    setUserWallet(userName, wallet, address) {
        this.wallets.set(userName, {
            wallet: wallet,
            address: address
        });
        this.logger.debug(`👤 用户钱包已设置: ${userName} -> ${address}`);
    }

    /**
     * 获取用户钱包
     */
    getUserWallet(userName = 'default') {
        const userWallet = this.wallets.get(userName);
        if (!userWallet) {
            throw new Error(`用户 ${userName} 不存在`);
        }
        return userWallet;
    }

    /**
     * 获取连接到指定链的钱包
     */
    getWalletForChain(chainId, userName = 'default') {
        const userWallet = this.getUserWallet(userName);
        
        // 直接使用链ID获取提供者
        const provider = this.getProvider(chainId);
        const connectedWallet = userWallet.wallet.connect(provider);
        
        return connectedWallet;
    }

    /**
     * 获取提供者
     */
    getProvider(chainId) {
        // 首先尝试从已初始化的提供者中获取
        const existingProvider = this.providers.get(chainId.toString());
        if (existingProvider) {
            return existingProvider;
        }

        // 如果不存在，动态创建提供者
        try {
            const rpcUrl = this.getRpcUrl(chainId);
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            this.providers.set(chainId.toString(), provider);
            this.logger.debug(`📡 动态创建链 ${chainId} 的RPC提供者: ${rpcUrl}`);
            return provider;
        } catch (error) {
            throw new Error(`无法为链 ${chainId} 创建RPC提供者: ${error.message}`);
        }
    }

    /**
     * 签名消息
     */
    async signMessage(message, userName = 'default') {
        const userWallet = this.getUserWallet(userName);
        return await userWallet.wallet.signMessage(message);
    }

    /**
     * 签名类型化数据
     */
    async signTypedData(domain, types, value, userName = 'default') {
        const userWallet = this.getUserWallet(userName);
        return await userWallet.wallet.signTypedData(domain, types, value);
    }

    /**
     * 获取用户地址
     */
    getUserAddress(userName = 'default') {
        const userWallet = this.getUserWallet(userName);
        return userWallet.address;
    }

    /**
     * 格式化地址显示
     */
    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * 验证地址
     */
    isValidAddress(address) {
        return ethers.isAddress(address);
    }

    /**
     * 等待交易确认
     */
    async waitForTransaction(txHash, chainId, confirmations = 1) {
        const provider = this.getProvider(chainId);
        this.logger.info(`⏳ 等待交易确认: ${txHash} (需要 ${confirmations} 个确认)`);
        
        const receipt = await provider.waitForTransaction(txHash, confirmations);
        
        if (receipt.status === 1) {
            this.logger.info(`✅ 交易确认成功: ${txHash}`);
            return receipt;
        } else {
            this.logger.error(`❌ 交易失败: ${txHash}`);
            throw new Error(`交易失败: ${txHash}`);
        }
    }

    /**
     * 估算Gas费用
     */
    async estimateGas(transaction, chainId, userName = 'default') {
        const wallet = this.getWalletForChain(chainId, userName);
        return await wallet.estimateGas(transaction);
    }

    /**
     * 获取Gas价格
     */
    async getGasPrice(chainId) {
        const provider = this.getProvider(chainId);
        const feeData = await provider.getFeeData();
        return feeData.gasPrice;
    }

    /**
     * 检查是否为支持的链（仅BSC主网）
     */
    isSupportedChain(chainId) {
        const supportedChains = [56]; // BSC Mainnet
        return supportedChains.includes(chainId);
    }

    /**
     * 检查链配置是否有效
     */
    isValidChain(chainId) {
        // 检查是否在支持的链列表中
        const supportedChains = [1, 56, 97, 137, 42161, 421614, 10, 420, 4002, 25, 338, 1284, 1287, 43114, 43113, 100, 10200, 714];
        return supportedChains.includes(chainId);
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理钱包管理器资源...');
        
        // 清理提供者连接
        for (const [name, provider] of this.providers) {
            try {
                if (provider.destroy) {
                    await provider.destroy();
                }
            } catch (error) {
                this.logger.warn(`⚠️ 清理提供者 ${name} 时出错:`, error.message);
            }
        }

        // 注意：已移除TRON能量管理器，专注BSC和Anvil

        this.wallets.clear();
        this.providers.clear();
        this.tronEnergyManager = null;
        
        this.logger.info('✅ 钱包管理器清理完成');
    }
}

module.exports = { ZKPayWalletManager };
