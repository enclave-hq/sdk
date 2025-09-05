// ZKPay 钱包管理器 - 处理私钥、签名和账户管理

const { ethers } = require('ethers');
const { createLogger } = require('../../logger');

class ZKPayWalletManager {
    constructor(config, logger) {
        this.config = config;
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
     * 初始化区块链RPC提供者
     */
    async initializeProviders() {
        // 管理链提供者
        const managementChain = this.config.blockchain.management_chain;
        this.providers.set('management', new ethers.JsonRpcProvider(managementChain.rpc_url));
        this.logger.debug(`📡 管理链提供者已连接: ${managementChain.name}`);

        // 源链提供者
        for (const sourceChain of this.config.blockchain.source_chains) {
            this.providers.set(`source_${sourceChain.chain_id}`, new ethers.JsonRpcProvider(sourceChain.rpc_url));
            this.logger.debug(`📡 源链提供者已连接: ${sourceChain.name} (${sourceChain.chain_id})`);
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
     * 初始化测试用户钱包
     */
    async initializeWallets() {
        for (const [userName, userConfig] of Object.entries(this.config.test_users)) {
            if (!userConfig.private_key) {
                this.logger.warn(`⚠️ 用户 ${userName} 没有配置私钥，跳过`);
                continue;
            }

            try {
                // 创建钱包实例
                const wallet = new ethers.Wallet(userConfig.private_key);
                
                // 为每个链创建连接的钱包
                const walletConnections = new Map();
                
                for (const [providerName, provider] of this.providers) {
                    walletConnections.set(providerName, wallet.connect(provider));
                }

                this.wallets.set(userName, {
                    wallet: wallet,
                    connections: walletConnections,
                    address: wallet.address
                });

                this.logger.info(`👤 用户 ${userName} 钱包已加载: ${wallet.address}`);
                
                // 检查余额
                await this.checkUserBalances(userName);
                
            } catch (error) {
                this.logger.error(`❌ 用户 ${userName} 钱包初始化失败:`, error.message);
                throw error;
            }
        }
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

        // 检查管理链余额
        const managementProvider = this.providers.get('management');
        const managementBalance = await managementProvider.getBalance(userWallet.address);
        this.logger.info(`  📊 管理链 (${this.config.blockchain.management_chain.name}): ${ethers.formatEther(managementBalance)} ETH`);

        // 检查源链余额
        for (const sourceChain of this.config.blockchain.source_chains) {
            const provider = this.providers.get(`source_${sourceChain.chain_id}`);
            const balance = await provider.getBalance(userWallet.address);
            this.logger.info(`  📊 ${sourceChain.name}: ${ethers.formatEther(balance)} ETH`);
        }
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
        
        // 查找对应的提供者
        let providerName;
        if (chainId === this.config.blockchain.management_chain.chain_id) {
            providerName = 'management';
        } else {
            const sourceChain = this.config.blockchain.source_chains.find(chain => chain.chain_id === chainId);
            if (sourceChain) {
                providerName = `source_${chainId}`;
            }
        }

        if (!providerName) {
            throw new Error(`不支持的链ID: ${chainId}`);
        }

        const connectedWallet = userWallet.connections.get(providerName);
        if (!connectedWallet) {
            throw new Error(`用户 ${userName} 在链 ${chainId} 上没有连接的钱包`);
        }

        return connectedWallet;
    }

    /**
     * 获取提供者
     */
    getProvider(chainId) {
        if (chainId === this.config.blockchain.management_chain.chain_id) {
            return this.providers.get('management');
        } else {
            return this.providers.get(`source_${chainId}`);
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
        const chains = [
            this.config.blockchain?.management_chain,
            ...(this.config.blockchain?.source_chains || [])
        ];

        return chains.some(chain => chain && chain.chain_id === chainId);
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
