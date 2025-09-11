// ZKPay 客户端操作库 - 统一的后台交互接口
// 整合了钱包管理、存款、Commitment、提现等功能

const axios = require('axios');
const { ethers } = require('ethers');
const { createLogger } = require('../utils/logger');

// 导入现有的管理器
const { ZKPayWalletManager } = require('../managers/zkpay-wallet-manager');
const { ZKPayDepositManager } = require('../managers/zkpay-deposit-manager');
const { ZKPayCommitmentManager } = require('../managers/zkpay-commitment-manager');
const { ZKPayWithdrawManager } = require('../managers/zkpay-withdraw-manager');

// 注意：签名消息生成现在使用CommitmentManager内部的方法

/**
 * ZKPay 客户端库 - 提供完整的ZKPay操作接口
 */
class ZKPayClient {
    constructor(logger, options = {}) {
        this.logger = logger || createLogger('ZKPayClient');
        
        // 参数化配置
        this.apiConfig = options.apiConfig || {
            baseURL: process.env.ZKPAY_API_URL || 'https://backend.zkpay.network',
            timeout: parseInt(process.env.ZKPAY_API_TIMEOUT) || 300000
        };
        this.treasuryContracts = options.treasuryContracts || new Map();
        this.tokenConfigs = options.tokenConfigs || new Map();
        this.runtimeConfig = {
            confirmationBlocks: options.confirmationBlocks || 3,
            maxWaitTime: options.maxWaitTime || 300000,
            defaultRecipientAddress: options.defaultRecipientAddress
        };
        
        // 管理器实例
        this.walletManager = null;
        this.depositManager = null;
        this.commitmentManager = null;
        this.withdrawManager = null;
        
        // API客户端
        this.apiClient = null;
        
        // 认证状态
        this.isAuthenticated = false;
        this.authToken = null;
        this.currentUser = null;
        
        // 初始化状态
        this.isInitialized = false;
    }

    /**
     * 初始化客户端库
     */
    async initialize() {
        if (this.isInitialized) {
            this.logger.warn('⚠️ ZKPay客户端已经初始化过了');
            return;
        }

        this.logger.info('🚀 初始化ZKPay客户端库...');
        
        try {
            // 初始化API客户端
            await this.initializeApiClient();
            
            // 初始化各个管理器
            await this.initializeManagers();
            
            this.isInitialized = true;
            this.logger.info('✅ ZKPay客户端库初始化完成');
            
        } catch (error) {
            this.logger.error('❌ ZKPay客户端库初始化失败:', error.message);
            throw error;
        }
    }

    /**
     * 初始化API客户端
     */
    async initializeApiClient() {
        this.apiClient = axios.create({
            baseURL: this.apiConfig.baseURL,
            timeout: this.apiConfig.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 请求拦截器 - 添加认证token
        this.apiClient.interceptors.request.use(
            (config) => {
                if (this.authToken) {
                    config.headers.Authorization = `Bearer ${this.authToken}`;
                }
                this.logger.debug(`📤 API请求: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                this.logger.error(`❌ API请求错误:`, error.message);
                return Promise.reject(error);
            }
        );

        // 响应拦截器 - 处理认证错误
        this.apiClient.interceptors.response.use(
            (response) => {
                this.logger.debug(`📥 API响应: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'NO_RESPONSE';
                const url = error.config?.url || 'UNKNOWN_URL';
                
                if (status === 401) {
                    this.logger.warn('🔐 认证过期，需要重新登录');
                    this.isAuthenticated = false;
                    this.authToken = null;
                    this.currentUser = null;
                }
                
                // 静默处理预期的404错误（如单独checkbook查询API尚未实现）
                if (status === 404 && url.includes('/api/v2/checkbooks/')) {
                    // 静默处理，不记录错误日志
                } else {
                    this.logger.error(`❌ API响应错误: ${status} ${url} - ${error.message}`);
                }
                return Promise.reject(error);
            }
        );

        // 测试API连接
        const apiTest = await this.testApiConnection();
        if (!apiTest.success) {
            throw new Error(`API连接失败: ${apiTest.error}`);
        }
    }

    /**
     * 测试API连接
     */
    async testApiConnection() {
        try {
            const response = await this.apiClient.get('/health');
            this.logger.info(`🔗 API连接测试成功: ${response.data?.message || 'OK'}`);
            return { success: true, message: response.data?.message || 'OK' };
        } catch (error) {
            this.logger.error(`❌ API连接测试失败:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 初始化各个管理器
     */
    async initializeManagers() {
        // 初始化钱包管理器
        this.walletManager = new ZKPayWalletManager(this.logger);
        await this.walletManager.initialize();
        
        // 初始化存款管理器
        this.depositManager = new ZKPayDepositManager(this.walletManager, this.logger, {
            confirmationBlocks: this.runtimeConfig.confirmationBlocks,
            treasuryContracts: this.treasuryContracts,
            tokenConfigs: this.tokenConfigs
        });
        await this.depositManager.initialize();
        
        // 初始化Commitment管理器
        this.commitmentManager = new ZKPayCommitmentManager(this.walletManager, this.logger, {
            defaultRecipientAddress: this.runtimeConfig.defaultRecipientAddress,
            maxWaitTime: this.runtimeConfig.maxWaitTime,
            apiConfig: this.apiConfig
        });
        await this.commitmentManager.initialize();
        
        // 初始化提现管理器
        this.withdrawManager = new ZKPayWithdrawManager(this.walletManager, this.logger, {
            maxWaitTime: this.runtimeConfig.maxWaitTime,
            apiConfig: this.apiConfig,
            treasuryContracts: this.treasuryContracts,
            tokenConfigs: this.tokenConfigs
        });
        await this.withdrawManager.initialize();
        
        this.logger.info('📋 所有管理器初始化完成');
    }

    // ==================== 1. 登录到后台 ====================

    /**
     * 设置用户钱包（直接使用私钥）
     * @param {string} privateKey - 用户私钥
     */
    async login(privateKey) {
        this.logger.info('🔐 设置用户钱包...');
        
        try {
            // 创建钱包实例
            const wallet = new ethers.Wallet(privateKey);
            const userAddress = wallet.address;
            
            this.logger.info(`👤 用户地址: ${userAddress}`);
            
            // 设置当前用户（ZKPay直接使用钱包地址，无需登录API）
            this.isAuthenticated = true;
            this.currentUser = {
                address: userAddress,
                privateKey: privateKey,
                wallet: wallet,
                userName: 'default' // 设置默认用户名
            };
            
            // 将钱包设置到钱包管理器中
            this.walletManager.setUserWallet('default', wallet, userAddress);
            
            this.logger.info(`✅ 用户钱包设置成功: ${userAddress}`);
            
            return {
                success: true,
                address: userAddress
            };
            
        } catch (error) {
            this.logger.error('❌ 用户钱包设置失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查登录状态
     */
    isLoggedIn() {
        return this.isAuthenticated && this.currentUser !== null;
    }

    /**
     * 获取当前用户信息
     */
    getCurrentUser() {
        if (!this.isLoggedIn()) {
            throw new Error('用户未登录');
        }
        return this.currentUser;
    }

    /**
     * 退出登录
     */
    logout() {
        this.logger.info('🚪 退出登录');
        this.isAuthenticated = false;
        this.authToken = null;
        this.currentUser = null;
    }

    // ==================== 2. 实现Approve和Deposit ====================

    /**
     * 执行Token授权
     * @param {number} chainId - 链ID
     * @param {string} tokenSymbol - Token符号
     * @param {string} amount - 授权金额
     */
    async approveToken(chainId, tokenSymbol, amount) {
        this.ensureLoggedIn();
        this.logger.info(`🔓 执行Token授权: ${amount} ${tokenSymbol} 在链 ${chainId}`);
        
        try {
            const result = await this.depositManager.approveToken(
                chainId,
                tokenSymbol,
                this.getTreasuryAddress(chainId),
                amount,
                this.currentUser.userName
            );
            
            this.logger.info('✅ Token授权成功');
            return result;
            
        } catch (error) {
            this.logger.error('❌ Token授权失败:', error.message);
            throw error;
        }
    }

    /**
     * 执行存款
     * @param {number} chainId - 链ID
     * @param {string} tokenAddress - Token合约地址
     * @param {string} amount - 存款金额
     * @param {string} treasuryAddress - Treasury合约地址
     */
    async deposit(chainId, tokenAddress, amount, treasuryAddress) {
        this.ensureLoggedIn();
        this.logger.info(`💰 执行存款: ${amount} ${tokenAddress} 在链 ${chainId}`);
        this.logger.info(`   Token地址: ${tokenAddress}`);
        this.logger.info(`   Treasury地址: ${treasuryAddress}`);
        
        try {
            const result = await this.depositManager.performFullDeposit(
                chainId,
                tokenAddress,
                amount,
                this.currentUser.address,
                treasuryAddress,
                this.currentUser.privateKey
            );
            
            this.logger.info('✅ 存款成功');
            return result;
            
        } catch (error) {
            this.logger.error('❌ 存款失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查Token余额
     * @param {number} chainId - 链ID
     * @param {string} tokenContractAddress - Token合约地址
     */
    async checkTokenBalance(chainId, tokenContractAddress) {
        this.ensureLoggedIn();
        
        try {
            const result = await this.depositManager.checkTokenBalance(
                chainId,
                tokenContractAddress,
                this.currentUser.address
            );
            
            this.logger.info(`💰 Token余额: ${result.formatted} ${result.symbol}`);
            return result;
            
        } catch (error) {
            this.logger.error('❌ 检查Token余额失败:', error.message);
            throw error;
        }
    }

    /**
     * 检查Token授权额度
     * @param {number} chainId - 链ID
     * @param {string} tokenContractAddress - Token合约地址
     */
    async checkTokenAllowance(chainId, tokenContractAddress) {
        this.ensureLoggedIn();
        
        try {
            const result = await this.depositManager.checkTokenAllowance(
                chainId,
                tokenContractAddress,
                this.currentUser.address,
                this.getTreasuryAddress(chainId)
            );
            
            this.logger.info(`🔍 Token授权额度: ${result.formatted} ${result.symbol}`);
            return result;
            
        } catch (error) {
            this.logger.error('❌ 检查Token授权额度失败:', error.message);
            throw error;
        }
    }

    // ==================== 3. 读取本地址对应的CheckBook ====================

    /**
     * 获取用户的存款记录（CheckBook）
     * @param {number} chainId - 链ID (可选，默认为714)
     */
    async getUserDeposits(userAddress = null, chainId = 714) {
        const targetAddress = userAddress || (this.isLoggedIn() ? this.currentUser.address : null);
        if (!targetAddress) {
            throw new Error('需要提供用户地址或先登录');
        }
        
        this.logger.info(`📋 获取用户存款记录: ${targetAddress}`);
        
        try {
            const deposits = await this.commitmentManager.getUserDeposits(targetAddress, chainId);
            
            this.logger.info(`✅ 找到 ${deposits.length} 条存款记录`);
            
            // 格式化返回数据，提供更友好的接口
            return deposits.map(deposit => ({
                id: deposit.id,
                checkbookId: deposit.checkbook_id,
                localDepositId: deposit.local_deposit_id,
                status: deposit.status,
                chainId: deposit.chain_id,
                tokenId: deposit.token_id,
                tokenSymbol: this.commitmentManager.getTokenSymbolById(deposit.token_id),
                grossAmount: deposit.gross_amount,
                allocatableAmount: deposit.allocatable_amount,
                commitment: deposit.commitment,
                depositTxHash: deposit.deposit_tx_hash,
                createdAt: deposit.created_at,
                updatedAt: deposit.updated_at,
                checks: deposit.checks || [],
                // 原始数据
                raw: deposit
            }));
            
        } catch (error) {
            this.logger.error('❌ 获取用户存款记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取特定的CheckBook详情
     * @param {string} checkbookId - CheckBook ID
     */
    async getCheckbookDetails(checkbookId) {
        this.logger.info(`📋 获取CheckBook详情: ${checkbookId}`);
        
        try {
            // 使用正确的API端点：通过用户存款记录查找对应的checkbook
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                throw new Error('用户未登录，无法获取CheckBook详情');
            }
            
            const deposits = await this.getUserDeposits(currentUser.address, 714);
            const targetDeposit = deposits.find(d => d.checkbookId === checkbookId || d.checkbook_id === checkbookId);
            
            if (!targetDeposit) {
                throw new Error(`未找到CheckBook: ${checkbookId}`);
            }
            
            this.logger.info(`✅ CheckBook详情获取成功: 状态 ${targetDeposit.status}`);
            return targetDeposit;
            
        } catch (error) {
            this.logger.error('❌ 获取CheckBook详情失败:', error.message);
            throw error;
        }
    }

    /**
     * 等待存款被后端检测并创建记录
     * @param {string} txHash - 交易哈希
     * @param {number} chainId - 链ID
     * @param {number} maxWaitTime - 最大等待时间（秒）
     */
    async waitForDepositDetection(txHash, chainId, maxWaitTime = 60) {
        this.ensureLoggedIn();
        
        try {
            const deposit = await this.commitmentManager.waitForDepositDetection(
                txHash,
                chainId,
                this.currentUser.address,
                maxWaitTime
            );
            
            this.logger.info('✅ 存款检测完成');
            return deposit;
            
        } catch (error) {
            this.logger.error('❌ 等待存款检测失败:', error.message);
            throw error;
        }
    }

    // ==================== 4. 创建分配，然后签名 ====================

    /**
     * 创建分配方案并签名
     * @param {string} checkbookId - CheckBook ID
     * @param {Array} allocations - 分配方案数组
     * @param {Object} options - 选项
     */
    async createAllocationAndSign(checkbookId, allocations, options = {}) {
        this.ensureLoggedIn();
        this.logger.info(`📝 创建分配方案并签名: CheckBook ${checkbookId}`);
        
        try {
            // 获取CheckBook详情
            const deposits = await this.getUserDeposits();
            const deposit = deposits.find(d => d.checkbookId === checkbookId);
            
            if (!deposit) {
                throw new Error(`未找到CheckBook: ${checkbookId}`);
            }
            
            // 验证分配方案
            console.log(`[DEBUG] createAllocationAndSign - allocations: ${JSON.stringify(allocations)}`);
            console.log(`[DEBUG] createAllocationAndSign - deposit: ${JSON.stringify(deposit)}`);
            this.validateAllocations(allocations, deposit);
            
            // 使用CommitmentManager内部的签名方法来生成签名消息
            const signatureMessage = this.commitmentManager.generateCommitmentSignatureMessage(
                deposit.raw,
                allocations[0].recipient_address, // 假设单一接收者
                allocations[0].amount,
                allocations[0].recipient_chain_id
            );
            
            // 签名
            const signature = await this.walletManager.signMessage(
                signatureMessage,
                this.currentUser.userName
            );
            
            this.logger.info('✅ 分配方案创建和签名完成');
            
            return {
                checkbookId,
                allocations,
                signature,
                signatureMessage,
                deposit
            };
            
        } catch (error) {
            this.logger.error('❌ 创建分配方案和签名失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证分配方案
     */
    validateAllocations(allocations, deposit) {
        if (!allocations || allocations.length === 0) {
            throw new Error('分配方案不能为空');
        }
        
        // 验证总金额
        let totalAmount = BigInt(0);
        for (const allocation of allocations) {
            totalAmount += BigInt(allocation.amount);
        }
        
        const availableAmount = BigInt(deposit.allocatableAmount || deposit.grossAmount);
        if (totalAmount > availableAmount) {
            throw new Error(`分配总金额 ${totalAmount.toString()} 超过可用金额 ${availableAmount.toString()}`);
        }
        
        // 验证分配项格式
        for (const allocation of allocations) {
            if (!allocation.recipient_chain_id || !allocation.recipient_address || !allocation.amount) {
                throw new Error('分配项缺少必要字段: recipient_chain_id, recipient_address, amount');
            }
        }
    }

    // ==================== 5. 判定状态，执行commitment ====================

    /**
     * 执行Commitment（同步方式 - 等待完成）
     * @param {string} checkbookId - CheckBook ID
     * @param {Array} allocations - 分配方案
     * @param {boolean} waitForWithCheck - 是否等待到with_checkbook状态
     */
    async executeCommitmentSync(checkbookId, allocations, waitForWithCheck = true) {
        this.ensureLoggedIn();
        this.logger.info(`🔗 执行Commitment（同步）: CheckBook ${checkbookId}`);
        
        try {
            // 获取存款记录
            const deposits = await this.getUserDeposits();
            const deposit = deposits.find(d => d.checkbookId === checkbookId);
            
            if (!deposit) {
                throw new Error(`未找到CheckBook: ${checkbookId}`);
            }
            
            // 使用原始E2E测试的方法：直接调用commitmentManager的方法
            const result = await this.commitmentManager.submitCommitmentV2WithDepositInfo(
                deposit.raw,  // 使用原始存款记录
                this.currentUser.address
            );
            
            this.logger.info(`✅ Commitment提交成功: 状态 ${result.status}`);
            this.logger.info(`🔗 Commitment哈希: ${result.commitment}`);
            
            // 如果需要等待到with_checkbook状态
            if (waitForWithCheck && result.status !== 'with_checkbook') {
                this.logger.info('⏳ 等待状态变为with_checkbook...');
                
                const finalResult = await this.waitForCommitmentStatus(
                    checkbookId,
                    ['with_checkbook', 'issued'],
                    300 // 5分钟超时
                );
                
                return {
                    ...result,
                    commitmentHash: result.commitment, // 明确返回commitment哈希
                    finalStatus: finalResult.status,
                    waitResult: finalResult
                };
            }
            
            return {
                ...result,
                commitmentHash: result.commitment // 明确返回commitment哈希
            };
            
        } catch (error) {
            this.logger.error('❌ 执行Commitment（同步）失败:', error.message);
            throw error;
        }
    }

    /**
     * 执行Commitment（异步方式 - 立即返回）
     * @param {string} checkbookId - CheckBook ID
     * @param {Array} allocations - 分配方案
     */
    async executeCommitmentAsync(checkbookId, allocations) {
        this.ensureLoggedIn();
        this.logger.info(`🔗 执行Commitment（异步）: CheckBook ${checkbookId}`);
        
        try {
            // 获取存款记录
            const deposits = await this.getUserDeposits();
            const deposit = deposits.find(d => d.checkbookId === checkbookId);
            
            if (!deposit) {
                throw new Error(`未找到CheckBook: ${checkbookId}`);
            }
            
            // 使用与同步方法相同的逻辑：调用commitmentManager的方法
            const result = await this.commitmentManager.submitCommitmentV2WithDepositInfo(
                deposit.raw,  // 使用原始存款记录
                this.currentUser.address
            );
            
            this.logger.info(`✅ Commitment提交成功（异步）: 状态 ${result.status}`);
            this.logger.info(`🔗 Commitment哈希: ${result.commitment}`);
            
            // 返回结果和状态监控方法
            return {
                ...result,
                commitmentHash: result.commitment, // 明确返回commitment哈希
                // 提供状态监控方法
                waitForCompletion: (targetStatuses = ['with_checkbook', 'issued'], maxWaitTime = 300) => {
                    return this.waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime);
                },
                // 提供状态查询方法
                checkStatus: () => {
                    return this.getCheckbookDetails(checkbookId);
                },
                // 提供等待并返回最终结果的方法
                waitUntilCompleted: async (targetStatuses = ['with_checkbook', 'issued'], maxWaitTime = 300) => {
                    const finalResult = await this.waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime);
                    return {
                        ...result,
                        commitmentHash: result.commitment,
                        finalStatus: finalResult.status,
                        completedAt: new Date().toISOString(),
                        waitResult: finalResult
                    };
                }
            };
            
        } catch (error) {
            this.logger.error('❌ 执行Commitment（异步）失败:', error.message);
            throw error;
        }
    }

    /**
     * 等待Commitment状态变化
     */
    async waitForCommitmentStatus(checkbookId, targetStatuses, maxWaitTime = 300) {
        this.logger.info(`⏳ 等待Commitment状态变化: ${targetStatuses.join(', ')}`);
        
        const startTime = Date.now();
        const pollInterval = 3000; // 3秒轮询一次
        
        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                const deposits = await this.getUserDeposits();
                const deposit = deposits.find(d => d.checkbookId === checkbookId);
                
                if (deposit && targetStatuses.includes(deposit.status)) {
                    this.logger.info(`✅ Commitment状态已变为: ${deposit.status}`);
                    return deposit;
                }
                
                // 检查失败状态
                if (deposit && deposit.status.includes('failed')) {
                    throw new Error(`Commitment失败: ${deposit.status}`);
                }
                
                this.logger.debug(`📈 当前状态: ${deposit?.status || '未知'} → 等待 ${targetStatuses.join('/')}`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
            } catch (error) {
                if (error.message.includes('Commitment失败')) {
                    throw error;
                }
                this.logger.warn(`⚠️ 轮询状态时出错: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        
        throw new Error(`等待Commitment状态变化超时 (${maxWaitTime}秒)`);
    }

    /**
     * 构建Commitment请求数据
     */
    buildCommitmentRequest(allocationResult) {
        const { checkbookId, allocations, signature, deposit } = allocationResult;
        
        return {
            checkbook_id: checkbookId,
            chain_id: 714, // 目标链ID
            local_deposit_id: deposit.localDepositId,
            allocations: allocations.map(allocation => ({
                recipient_chain_id: allocation.recipient_chain_id,
                recipient_address: this.convertToUniversalAddress(allocation.recipient_chain_id, allocation.recipient_address), // 保留32字节格式
                amount: allocation.amount,
                token_id: deposit.tokenId
            })),
            signature: {
                chain_id: 714,
                signature_data: signature.replace(/^0x/, ''),
                public_key: null
            },
            owner_address: {
                chain_id: 714,
                address: deposit.raw.owner?.data || this.convertToUniversalAddress(714, this.currentUser.address) // 保留32字节格式
            },
            token_symbol: deposit.tokenSymbol,
            token_decimals: 18,
            lang: 2
        };
    }

    // ==================== 6. 判定状态，执行generate_proof ====================

    /**
     * 生成提现证明（同步方式 - 等待完成）
     * @param {string} checkbookId - CheckBook ID
     * @param {Object} recipientInfo - 接收者信息
     * @param {boolean} waitForCompleted - 是否等待到completed状态
     */
    async generateProofSync(checkbookId, recipientInfo, waitForCompleted = true) {
        this.ensureLoggedIn();
        this.logger.info(`🧮 生成提现证明（同步）: CheckBook ${checkbookId}`);
        
        try {
            // 获取Check ID
            const checkId = await this.getCheckIdFromCheckbook(checkbookId);
            
            // 生成证明
            const proofResult = await this.withdrawManager.generateWithdrawProof(checkId);
            this.logger.info(`✅ 证明生成请求提交成功`);
            
            // 如果需要等待到completed状态
            if (waitForCompleted) {
                this.logger.info('⏳ 等待证明生成完成...');
                
                const completionResult = await this.withdrawManager.waitForWithdrawCompletion(
                    checkId,
                    300, // 5分钟超时
                    this.currentUser.address
                );
                
                return {
                    ...proofResult,
                    checkId,
                    completionResult,
                    finalStatus: completionResult.status
                };
            }
            
            return {
                ...proofResult,
                checkId
            };
            
        } catch (error) {
            this.logger.error('❌ 生成提现证明（同步）失败:', error.message);
            throw error;
        }
    }

    /**
     * 生成提现证明（异步方式 - 立即返回）
     * @param {string} checkbookId - CheckBook ID
     * @param {Object} recipientInfo - 接收者信息
     */
    async generateProofAsync(checkbookId, recipientInfo) {
        this.ensureLoggedIn();
        this.logger.info(`🧮 生成提现证明（异步）: CheckBook ${checkbookId}`);
        
        try {
            // 获取Check ID
            const checkId = await this.getCheckIdFromCheckbook(checkbookId);
            
            // 生成证明（不等待完成）
            const proofResult = await this.withdrawManager.generateWithdrawProof(checkId);
            this.logger.info(`✅ 证明生成请求提交成功（异步）`);
            
            // 返回结果和状态监控方法
            return {
                ...proofResult,
                checkId,
                // 提供状态监控方法
                waitForCompletion: (maxWaitTime = 300) => {
                    return this.withdrawManager.waitForWithdrawCompletion(checkId, maxWaitTime, this.currentUser.address);
                },
                // 提供状态查询方法
                checkStatus: () => {
                    return this.withdrawManager.getCheckStatus(checkId);
                },
                // 提供等待并返回最终结果的方法
                waitUntilCompleted: async (maxWaitTime = 300) => {
                    this.logger.info(`⏳ 开始等待提现完成 (最大等待时间: ${maxWaitTime}秒)...`);
                    const completionResult = await this.withdrawManager.waitForWithdrawCompletion(checkId, maxWaitTime, this.currentUser.address);
                    return {
                        ...proofResult,
                        checkId,
                        finalStatus: completionResult.status,
                        transactionHash: completionResult.transaction_hash, // 明确返回交易哈希
                        completedAt: new Date().toISOString(),
                        completionResult
                    };
                }
            };
            
        } catch (error) {
            this.logger.error('❌ 生成提现证明（异步）失败:', error.message);
            throw error;
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 确保用户已登录
     */
    ensureLoggedIn() {
        if (!this.isLoggedIn()) {
            throw new Error('用户未登录，请先调用login()方法');
        }
    }

    /**
     * 获取Treasury合约地址
     */
    getTreasuryAddress(chainId) {
        const treasuryAddress = this.treasuryContracts.get(chainId);
        
        if (!treasuryAddress) {
            throw new Error(`链 ${chainId} 没有配置Treasury合约`);
        }
        
        return treasuryAddress;
    }

    /**
     * 获取Token合约地址
     */
    getTokenAddress(chainId, tokenSymbol) {
        const tokenKey = `${chainId}_${tokenSymbol}`;
        const tokenAddress = this.tokenConfigs.get(tokenKey);
        
        if (!tokenAddress) {
            throw new Error(`链 ${chainId} 的Token ${tokenSymbol} 没有配置合约地址`);
        }
        
        return tokenAddress;
    }

    /**
     * 从CheckBook获取Check ID
     */
    async getCheckIdFromCheckbook(checkbookId) {
        const deposits = await this.getUserDeposits();
        const deposit = deposits.find(d => d.checkbookId === checkbookId);
        
        if (!deposit) {
            throw new Error(`未找到CheckBook: ${checkbookId}`);
        }
        
        if (!deposit.checks || deposit.checks.length === 0) {
            throw new Error(`CheckBook ${checkbookId} 没有关联的Check记录`);
        }
        
        return deposit.checks[0].id;
    }

    /**
     * 获取支持的链列表
     */
    getSupportedChains() {
        return Array.from(this.treasuryContracts.keys());
    }

    /**
     * 获取支持的Token列表
     */
    getSupportedTokens(chainId) {
        const chain = this.getSupportedChains().find(c => c.chain_id === chainId);
        return chain?.tokens || {};
    }

    // ==================== 高级功能 ====================

    /**
     * 完整的存款到Commitment流程
     * @param {number} chainId - 链ID
     * @param {string} tokenSymbol - Token符号
     * @param {string} amount - 金额
     * @param {Array} allocations - 分配方案
     * @param {Object} options - 选项
     */
    async performFullDepositToCommitment(chainId, tokenSymbol, amount, allocations, options = {}) {
        const {
            waitForCommitment = true,
            maxWaitTime = 300
        } = options;
        
        this.ensureLoggedIn();
        this.logger.info(`🚀 执行完整的存款到Commitment流程`);
        
        try {
            // 步骤1: 执行存款
            this.logger.info('📋 步骤1: 执行存款');
            const treasuryAddress = this.getTreasuryAddress(chainId);
            const tokenAddress = this.getTokenAddress(chainId, tokenSymbol);
            const depositResult = await this.deposit(chainId, tokenAddress, amount, treasuryAddress);
            
            // 步骤2: 等待后端检测存款
            this.logger.info('📋 步骤2: 等待后端检测存款');
            const depositRecord = await this.waitForDepositDetection(
                depositResult.deposit.txHash,
                chainId,
                60
            );
            
            // 步骤3: 执行Commitment
            this.logger.info('📋 步骤3: 执行Commitment');
            const commitmentResult = waitForCommitment 
                ? await this.executeCommitmentSync(depositRecord.checkbook_id, allocations, true)
                : await this.executeCommitmentAsync(depositRecord.checkbook_id, allocations);
            
            this.logger.info('🎉 完整流程执行成功');
            
            return {
                deposit: depositResult,
                depositRecord,
                commitment: commitmentResult,
                success: true
            };
            
        } catch (error) {
            this.logger.error('❌ 完整流程执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 完整的Commitment到提现流程
     * @param {string} checkbookId - CheckBook ID
     * @param {Object} recipientInfo - 接收者信息
     * @param {Object} options - 选项
     */
    async performFullCommitmentToWithdraw(checkbookId, recipientInfo, options = {}) {
        const {
            waitForProof = true,
            maxWaitTime = 300
        } = options;
        
        this.ensureLoggedIn();
        this.logger.info(`🚀 执行完整的Commitment到提现流程`);
        
        try {
            // 检查CheckBook状态
            const deposits = await this.getUserDeposits();
            const deposit = deposits.find(d => d.checkbookId === checkbookId);
            
            if (!deposit) {
                throw new Error(`未找到CheckBook: ${checkbookId}`);
            }
            
            // 如果还没有with_checkbook状态，先等待
            if (deposit.status !== 'with_checkbook' && deposit.status !== 'issued') {
                this.logger.info('⏳ 等待CheckBook状态变为with_checkbook...');
                await this.waitForCommitmentStatus(checkbookId, ['with_checkbook', 'issued'], maxWaitTime);
            }
            
            // 执行提现证明生成
            this.logger.info('📋 执行提现证明生成');
            const proofResult = waitForProof 
                ? await this.generateProofSync(checkbookId, recipientInfo, true)
                : await this.generateProofAsync(checkbookId, recipientInfo);
            
            this.logger.info('🎉 完整提现流程执行成功');
            
            return {
                checkbook: deposit,
                proof: proofResult,
                success: true
            };
            
        } catch (error) {
            this.logger.error('❌ 完整提现流程执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 从CheckBook获取Check ID
     */
    async getCheckIdFromCheckbook(checkbookId) {
        const deposits = await this.getUserDeposits();
        const deposit = deposits.find(d => d.checkbookId === checkbookId);
        
        if (!deposit) {
            throw new Error(`未找到CheckBook: ${checkbookId}`);
        }
        
        if (!deposit.checks || deposit.checks.length === 0) {
            throw new Error(`CheckBook ${checkbookId} 没有关联的Check记录`);
        }
        
        return deposit.checks[0].id;
    }

    /**
     * 转换地址为Universal Address格式
     */
    convertToUniversalAddress(chainId, address) {
        const cleanAddress = address.replace(/^0x/, '').toLowerCase();
        return '0x' + '000000000000000000000000' + cleanAddress;
    }

    // ==================== 10. 等待状态变化 ====================

    /**
     * 等待Checkbook状态变为ready_for_commitment
     * @param {string} checkbookId - Checkbook ID
     * @param {number} timeout - 超时时间（毫秒），默认60秒
     * @returns {Promise<Object>} 返回最终的checkbook状态
     */
    async waitForCheckbookReady(checkbookId, timeout = 60000) {
        this.ensureLoggedIn();
        this.logger.info(`⏳ 等待Checkbook ${checkbookId} 状态变为ready_for_commitment...`);
        
        const startTime = Date.now();
        const pollInterval = 5000; // 5秒轮询一次
        
        while (Date.now() - startTime < timeout) {
            try {
                // 查询checkbook状态（优先使用单独API，回退到列表查询）
                let checkbook;
                try {
                    const response = await this.apiClient.get(`/api/v2/checkbooks/${checkbookId}`);
                    checkbook = response.data;
                } catch (error) {
                    // 如果单独API不存在(404)，静默回退到用户存款列表查询
                    if (error.response?.status === 404) {
                        // 第一次404时记录信息，后续静默处理
                        if (Date.now() - startTime < 1000) {
                            this.logger.info('📋 使用存款列表查询方式（单独checkbook API尚未实现）');
                        }
                        const deposits = await this.getUserDeposits(this.currentUser.address);
                        checkbook = deposits.find(d => d.checkbookId === checkbookId || d.checkbook_id === checkbookId);
                    } else {
                        // 非404错误才抛出
                        this.logger.error(`❌ 查询Checkbook失败: ${error.message}`);
                        throw error;
                    }
                }
                
                if (!checkbook) {
                    throw new Error(`未找到Checkbook: ${checkbookId}`);
                }
                
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                this.logger.info(`📊 Checkbook状态: ${checkbook.status} (已等待${elapsed}秒)`);
                
                if (checkbook.status === 'ready_for_commitment') {
                    this.logger.info(`✅ Checkbook已准备好进行Commitment操作`);
                    return checkbook;
                }
                
                // 如果是错误状态，直接返回
                if (['proof_failed', 'submission_failed'].includes(checkbook.status)) {
                    this.logger.warn(`⚠️ Checkbook状态为${checkbook.status}，可以重试Commitment`);
                    return checkbook;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
            } catch (error) {
                this.logger.error(`❌ 查询Checkbook状态失败: ${error.message}`);
                throw error;
            }
        }
        
        throw new Error(`等待Checkbook状态变为ready_for_commitment超时 (${timeout/1000}秒)`);
    }

    /**
     * 等待Check状态变为特定状态
     * @param {string} checkId - Check ID  
     * @param {Array<string>} targetStatuses - 目标状态数组
     * @param {number} timeout - 超时时间（毫秒），默认60秒
     * @returns {Promise<Object>} 返回最终的check状态
     */
    async waitForCheckReady(checkId, targetStatuses = ['completed'], timeout = 60000) {
        this.ensureLoggedIn();
        this.logger.info(`⏳ 等待Check ${checkId} 状态变为 ${targetStatuses.join(' 或 ')}...`);
        
        const startTime = Date.now();
        const pollInterval = 5000; // 5秒轮询一次
        
        while (Date.now() - startTime < timeout) {
            try {
                // 查询check状态（这里需要根据实际API调整）
                const response = await this.apiClient.get(`/api/v2/checks/${checkId}`);
                const check = response.data;
                
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                this.logger.info(`📊 Check状态: ${check.status} (已等待${elapsed}秒)`);
                
                if (targetStatuses.includes(check.status)) {
                    this.logger.info(`✅ Check已达到目标状态: ${check.status}`);
                    return check;
                }
                
                // 如果是错误状态，直接返回
                if (['failed', 'error'].includes(check.status)) {
                    this.logger.warn(`⚠️ Check状态为${check.status}`);
                    return check;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
            } catch (error) {
                this.logger.error(`❌ 查询Check状态失败: ${error.message}`);
                throw error;
            }
        }
        
        throw new Error(`等待Check状态变为${targetStatuses.join(' 或 ')}超时 (${timeout/1000}秒)`);
    }

    // ==================== 11. 清理资源 ====================

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理ZKPay客户端资源...');
        
        try {
            if (this.walletManager) {
                await this.walletManager.cleanup();
            }
            if (this.commitmentManager) {
                await this.commitmentManager.cleanup();
            }
            if (this.withdrawManager) {
                await this.withdrawManager.cleanup();
            }
        } catch (error) {
            this.logger.warn('⚠️ 清理资源时出错:', error.message);
        }
        
        // 重置状态
        this.isAuthenticated = false;
        this.authToken = null;
        this.currentUser = null;
        this.isInitialized = false;
        
        this.logger.info('✅ ZKPay客户端清理完成');
    }
}

module.exports = { ZKPayClient };
