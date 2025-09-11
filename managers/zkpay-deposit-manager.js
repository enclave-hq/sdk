// ZKPay 存款管理器 - 处理 Token Approve 和 Deposit 流程

const { ethers } = require('ethers');
const { createLogger } = require('../utils/logger');

// ERC20 Token ABI (只包含需要的方法)
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function transfer(address to, uint256 amount) external returns (bool)"
];

// Treasury Contract ABI (简化版)
const TREASURY_ABI = [
    "function deposit(address tokenAddress, uint256 amount, bytes6 promoteCode) external",
    "function getTokenId(address token) external view returns (uint256)",
    "function isTokenSupported(address token) external view returns (bool)",
    "event DepositReceived(address indexed user, address indexed token, uint256 amount, uint256 tokenId, uint256 indexed depositId)"
];

class ZKPayDepositManager {
    constructor(walletManager, logger, options = {}) {
        this.walletManager = walletManager;
        this.logger = logger || createLogger('DepositManager');
        this.contracts = new Map();
        
        // 参数化配置
        this.confirmationBlocks = options.confirmationBlocks || 3;
        this.treasuryContracts = options.treasuryContracts || new Map();
        this.tokenConfigs = options.tokenConfigs || new Map();
        
        // 调试配置设置
        console.log('🔍 DepositManager构造函数配置:');
        console.log('  treasuryContracts:', Array.from(this.treasuryContracts.entries()));
        console.log('  tokenConfigs:', Array.from(this.tokenConfigs.entries()));
    }

    /**
     * 初始化存款管理器
     */
    async initialize() {
        this.logger.info('💰 初始化存款管理器...');
        
        // 初始化合约实例
        await this.initializeContracts();
        
        this.logger.info('✅ 存款管理器初始化完成');
    }

    /**
     * 初始化合约实例
     */
    async initializeContracts() {
        // 为每个配置的链初始化Treasury合约
        for (const [chainId, treasuryAddress] of this.treasuryContracts) {
            try {
                const provider = this.walletManager.getProvider(chainId);
                const contract = new ethers.Contract(
                    treasuryAddress,
                    TREASURY_ABI,
                    provider
                );

                this.contracts.set(`treasury_${chainId}`, contract);
                this.logger.debug(`📜 Treasury合约已加载: 链 ${chainId} - ${treasuryAddress}`);

                // 初始化Token合约
                for (const [tokenKey, tokenAddress] of this.tokenConfigs) {
                    if (tokenKey.startsWith(`${chainId}_`)) {
                        const tokenSymbol = tokenKey.split('_')[1];
                        const tokenContract = new ethers.Contract(
                            tokenAddress,
                            ERC20_ABI,
                            provider
                        );
                        
                        this.contracts.set(`token_${chainId}_${tokenSymbol}`, tokenContract);
                        this.logger.debug(`🪙 Token合约已加载: 链 ${chainId} - ${tokenSymbol} - ${tokenAddress}`);
                    }
                }

            } catch (error) {
                this.logger.error(`❌ 初始化链 ${chainId} 的合约失败:`, error.message);
                throw error;
            }
        }
    }

    /**
     * 检查Token余额
     */
    async checkTokenBalance(chainId, tokenContractAddress, userAddress) {
        const provider = this.walletManager.getProvider(chainId);
        const tokenContract = new ethers.Contract(tokenContractAddress, ERC20_ABI, provider);

        const balance = await tokenContract.balanceOf(userAddress);
        const decimals = await tokenContract.decimals();
        const symbol = await tokenContract.symbol();

        return {
            balance,
            decimals,
            symbol,
            formatted: ethers.formatUnits(balance, decimals)
        };
    }

    /**
     * 检查Token授权额度
     */
    async checkTokenAllowance(chainId, tokenContractAddress, userAddress, spenderAddress) {
        const provider = this.walletManager.getProvider(chainId);
        const tokenContract = new ethers.Contract(tokenContractAddress, ERC20_ABI, provider);

        const allowance = await tokenContract.allowance(userAddress, spenderAddress);
        const decimals = await tokenContract.decimals();
        const symbol = await tokenContract.symbol();

        return {
            allowance,
            decimals,
            symbol,
            formatted: ethers.formatUnits(allowance, decimals)
        };
    }

    /**
     * 授权Token
     */
    async approveToken(chainId, tokenAddress, spenderAddress, amount, userName = 'default') {
        this.logger.info(`🔓 开始授权Token: ${tokenAddress} 在链 ${chainId}`);
        this.logger.info(`   授权给: ${spenderAddress}`);
        this.logger.info(`   授权金额: ${amount}`);

        const wallet = this.walletManager.getWalletForChain(chainId, userName);
        
        // 直接使用Token地址创建合约实例
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

        // 获取Token信息
        const decimals = await tokenContract.decimals();
        const symbol = await tokenContract.symbol();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);

        this.logger.info(`📊 Token信息: ${symbol}, 精度: ${decimals}`);
        this.logger.info(`💎 授权数量: ${amountWei.toString()} Wei`);

        // 检查当前余额
        const balance = await tokenContract.balanceOf(wallet.address);
        this.logger.info(`💰 当前余额: ${ethers.formatUnits(balance, decimals)} ${symbol}`);

        if (balance < amountWei) {
            throw new Error(`余额不足: 需要 ${amount} ${symbol}, 但只有 ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        }

        // 检查当前授权额度
        const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
        this.logger.info(`🔍 当前授权额度: ${ethers.formatUnits(currentAllowance, decimals)} ${symbol}`);

        if (currentAllowance >= amountWei) {
            this.logger.info(`✅ 授权额度充足，无需重新授权`);
            return {
                txHash: null,
                message: '授权额度充足',
                allowance: currentAllowance
            };
        }

        try {
            // 估算Gas
            const gasEstimate = await tokenContract.approve.estimateGas(spenderAddress, amountWei);
            this.logger.info(`⛽ 预估Gas: ${gasEstimate.toString()}`);

            // 发送授权交易
            const tx = await tokenContract.approve(spenderAddress, amountWei, {
                gasLimit: gasEstimate * 12n / 10n // 加20%的Gas余量
            });

            this.logger.info(`📤 授权交易已发送: ${tx.hash}`);
            this.logger.info(`⏳ 等待交易确认...`);

            // 等待交易确认
            const receipt = await this.walletManager.waitForTransaction(
                tx.hash, 
                chainId, 
                this.confirmationBlocks
            );

            // 验证授权结果
            const newAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
            this.logger.info(`✅ 授权成功! 新授权额度: ${ethers.formatUnits(newAllowance, decimals)} ${symbol}`);

            return {
                txHash: tx.hash,
                receipt,
                allowance: newAllowance,
                gasUsed: receipt.gasUsed
            };

        } catch (error) {
            this.logger.error(`❌ Token授权失败:`, error.message);
            throw error;
        }
    }

    /**
     * 执行存款
     */
    async executeDeposit(chainId, tokenAddress, amount, recipientAddress, userName = 'default') {
        this.logger.info(`💰 开始执行存款: ${amount} ${tokenAddress} 在链 ${chainId}`);
        this.logger.info(`   接收地址: ${recipientAddress}`);

        const wallet = this.walletManager.getWalletForChain(chainId, userName);
        
        // 获取Treasury合约地址
        let treasuryAddress = this.treasuryContracts.get(chainId);
        if (!treasuryAddress) {
            const actualChainId = this.walletManager.getActualChainId(chainId);
            treasuryAddress = this.treasuryContracts.get(actualChainId);
        }
        
        if (!treasuryAddress) {
            throw new Error(`链 ${chainId} 没有配置Treasury合约`);
        }
        
        const treasuryContract = new ethers.Contract(treasuryAddress, TREASURY_ABI, wallet);

        // 动态获取Token的decimals
        const provider = this.walletManager.getProvider(chainId);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);

        this.logger.info(`🎯 存款参数:`);
        this.logger.info(`   Token地址: ${tokenAddress}`);
        this.logger.info(`   存款数量: ${amountWei.toString()} Wei`);
        this.logger.info(`   接收地址: ${recipientAddress}`);

        try {
            // 获取Token ID (如果返回0则说明不支持)
            const tokenId = await treasuryContract.getTokenId(tokenAddress);
            this.logger.info(`🆔 Token ID: ${tokenId.toString()}`);
            
            if (tokenId.toString() === '0') {
                throw new Error(`Token ${tokenSymbol} (${tokenAddress}) 不被Treasury合约支持`);
            }

            // 估算Gas (添加promoteCode参数)
            const promoteCode = "0x000000000000"; // 默认推广码 (bytes6)
            const gasEstimate = await treasuryContract.deposit.estimateGas(
                tokenAddress, 
                amountWei, 
                promoteCode
            );
            this.logger.info(`⛽ 预估Gas: ${gasEstimate.toString()}`);

            // 发送存款交易
            const tx = await treasuryContract.deposit(tokenAddress, amountWei, promoteCode, {
                gasLimit: gasEstimate * 12n / 10n // 加20%的Gas余量
            });

            this.logger.info(`📤 存款交易已发送: ${tx.hash}`);
            this.logger.info(`⏳ 等待交易确认...`);

            // 等待交易确认
            const receipt = await this.walletManager.waitForTransaction(
                tx.hash, 
                chainId, 
                this.confirmationBlocks
            );

            // 解析存款事件
            const depositEvent = await this.parseDepositEvent(receipt, treasuryContract);

            this.logger.info(`✅ 存款成功!`);
            this.logger.info(`   交易哈希: ${tx.hash}`);
            this.logger.info(`   Gas消耗: ${receipt.gasUsed.toString()}`);
            if (depositEvent) {
                this.logger.info(`   存款ID: ${depositEvent.depositId}`);
                this.logger.info(`   Token ID: ${depositEvent.tokenId}`);
            }

            return {
                txHash: tx.hash,
                receipt,
                gasUsed: receipt.gasUsed,
                depositEvent,
                tokenId,
                amount: amountWei
            };

        } catch (error) {
            this.logger.error(`❌ 存款执行失败:`, error.message);
            throw error;
        }
    }

    /**
     * 解析存款事件
     */
    async parseDepositEvent(receipt, treasuryContract) {
        try {
            this.logger.info(`🔍 解析存款事件，日志数量: ${receipt.logs.length}`);
            
            // 查找DepositReceived事件
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                this.logger.info(`🔍 日志 ${i}: 地址=${log.address}, 主题数量=${log.topics.length}`);
                
                try {
                    const parsedLog = treasuryContract.interface.parseLog(log);
                    if (parsedLog) {
                        this.logger.info(`🔍 解析成功: ${parsedLog.name}`);
                        
                        if (parsedLog.name === 'DepositReceived') {
                            this.logger.info(`✅ 找到DepositReceived事件:`, {
                                user: parsedLog.args.user,
                                token: parsedLog.args.token,
                                amount: parsedLog.args.amount.toString(),
                                tokenId: parsedLog.args.tokenId.toString(),
                                depositId: parsedLog.args.depositId.toString()
                            });
                            
                            return {
                                user: parsedLog.args.user,
                                token: parsedLog.args.token,
                                amount: parsedLog.args.amount,
                                tokenId: parsedLog.args.tokenId,
                                depositId: parsedLog.args.depositId
                            };
                        }
                    } else {
                        this.logger.info(`🔍 日志 ${i} 解析返回null，尝试手动解析事件签名`);
                        // 手动解析事件签名
                        if (log.topics.length > 0) {
                            const eventSignature = log.topics[0];
                            this.logger.info(`🔍 事件签名: ${eventSignature}`);
                            
                            // 检查是否是DepositReceived事件
                            const expectedSignature = treasuryContract.interface.getEvent('DepositReceived').topicHash;
                            this.logger.info(`🔍 期望签名: ${expectedSignature}`);
                            
                            if (eventSignature === expectedSignature) {
                                this.logger.info(`✅ 事件签名匹配，但解析失败，可能是参数问题`);
                            }
                        }
                    }
                } catch (e) {
                    this.logger.info(`🔍 日志 ${i} 解析失败: ${e.message}`);
                    // 忽略解析失败的日志
                    continue;
                }
            }
            
            this.logger.warn(`⚠️ 未找到DepositReceived事件`);
            return null;
            
        } catch (error) {
            this.logger.error(`❌ 解析存款事件失败:`, error.message);
            return null;
        }
    }

    /**
     * 完整的存款流程（包含授权）- 参考webserver实现
     */
    async performFullDeposit(chainId, tokenAddress, amount, recipientAddress, userName = 'default') {
        this.logger.info(`🚀 开始完整存款流程: ${amount} ${tokenAddress} 在链 ${chainId}`);

        const results = {
            approve: null,
            deposit: null,
            chainId,
            tokenAddress,
            amount,
            recipientAddress,
            userName
        };

        try {
            // 获取Treasury合约地址 - 支持SLIP44转换
            this.logger.info(`🔍 调试: 查找链 ${chainId} 的Treasury配置`);
            this.logger.info(`🔍 调试: treasuryContracts类型:`, typeof this.treasuryContracts);
            this.logger.info(`🔍 调试: treasuryContracts大小:`, this.treasuryContracts.size);
            this.logger.info(`🔍 调试: treasuryContracts内容:`, Array.from(this.treasuryContracts.entries()));
            this.logger.info(`🔍 调试: 查找的chainId类型:`, typeof chainId);
            this.logger.info(`🔍 调试: 查找的chainId值:`, chainId);
            
            // 首先尝试直接使用SLIP44 ID查找
            let treasuryAddress = this.treasuryContracts.get(chainId);
            
            // 如果没有找到，尝试转换为实际ChainID再查找
            if (!treasuryAddress) {
                const actualChainId = this.walletManager.getActualChainId(chainId);
                treasuryAddress = this.treasuryContracts.get(actualChainId);
                this.logger.info(`🔍 调试: SLIP44转换 ${chainId} -> ${actualChainId}, 找到Treasury: ${treasuryAddress}`);
            }
            
            this.logger.info(`🔍 调试: 最终找到的Treasury地址: ${treasuryAddress}`);
            
            if (!treasuryAddress) {
                throw new Error(`链 ${chainId} (实际链ID: ${this.walletManager.getActualChainId(chainId)}) 没有配置Treasury合约`);
            }

            // 步骤1: 检查并授权Token（如果需要）
            this.logger.info(`📋 步骤1: 检查Token授权状态`);
            const wallet = this.walletManager.getWalletForChain(chainId, userName);
            
            // 检查当前授权额度
            const allowanceResult = await this.checkTokenAllowance(
                chainId, 
                tokenAddress, 
                wallet.address, 
                treasuryAddress
            );
            
            this.logger.info(`🔍 当前授权额度: ${allowanceResult.formatted} ${allowanceResult.symbol}`);
            
            // 如果授权不足，进行授权
            if (parseFloat(allowanceResult.formatted) < parseFloat(amount)) {
                this.logger.info(`📋 步骤1a: 授权Token给Treasury合约`);
                results.approve = await this.approveToken(
                    chainId, 
                    tokenAddress, 
                    treasuryAddress, 
                    amount, 
                    userName
                );
            } else {
                this.logger.info(`✅ 授权额度充足，跳过授权步骤`);
                results.approve = { message: '授权额度充足', allowance: allowanceResult.allowance };
            }

            // 步骤2: 执行存款到Treasury合约
            this.logger.info(`📋 步骤2: 执行存款到Treasury合约`);
            results.deposit = await this.executeDeposit(
                chainId, 
                tokenAddress, 
                amount, 
                recipientAddress, 
                userName
            );

            this.logger.info(`🎉 完整存款流程成功完成!`);
            this.logger.info(`   交易哈希: ${results.deposit.txHash}`);
            this.logger.info(`   存款ID: ${results.deposit.depositEvent?.depositId}`);
            return results;

        } catch (error) {
            this.logger.error(`❌ 完整存款流程失败:`, error.message);
            results.error = error;
            throw error;
        }
    }

    /**
     * 批量存款
     */
    async performBatchDeposits(deposits, userName = 'default') {
        this.logger.info(`📦 开始批量存款: ${deposits.length} 笔存款`);

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < deposits.length; i++) {
            const deposit = deposits[i];
            this.logger.info(`📋 处理存款 ${i + 1}/${deposits.length}: ${deposit.amount} ${deposit.tokenSymbol} 在链 ${deposit.chainId}`);

            try {
                const result = await this.performFullDeposit(
                    deposit.chainId,
                    deposit.tokenSymbol,
                    deposit.amount,
                    deposit.recipientAddress,
                    userName
                );
                
                results.push({ ...result, index: i, status: 'success' });
                successCount++;
                
                this.logger.info(`✅ 存款 ${i + 1} 成功`);

            } catch (error) {
                results.push({ 
                    ...deposit, 
                    index: i, 
                    status: 'failed', 
                    error: error.message 
                });
                failureCount++;
                
                this.logger.error(`❌ 存款 ${i + 1} 失败: ${error.message}`);
            }

            // 在存款之间添加延迟，避免nonce冲突
            if (i < deposits.length - 1) {
                this.logger.info(`⏸️ 等待 2 秒后处理下一笔存款...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        this.logger.info(`📊 批量存款完成: 成功 ${successCount}, 失败 ${failureCount}`);
        return {
            results,
            summary: {
                total: deposits.length,
                success: successCount,
                failure: failureCount,
                successRate: ((successCount / deposits.length) * 100).toFixed(2)
            }
        };
    }

    /**
     * 获取存款历史
     */
    async getDepositHistory(chainId, userAddress, fromBlock = 0, toBlock = 'latest') {
        const treasuryContract = this.contracts.get(`treasury_${chainId}`);
        if (!treasuryContract) {
            throw new Error(`Treasury合约不存在: 链 ${chainId}`);
        }

        try {
            const filter = treasuryContract.filters.DepositReceived(userAddress);
            const events = await treasuryContract.queryFilter(filter, fromBlock, toBlock);

            return events.map(event => ({
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                user: event.args.user,
                token: event.args.token,
                amount: event.args.amount,
                tokenId: event.args.tokenId,
                depositId: event.args.depositId
            }));

        } catch (error) {
            this.logger.error(`❌ 获取存款历史失败:`, error.message);
            throw error;
        }
    }
}

module.exports = { ZKPayDepositManager };
