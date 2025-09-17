// ZKPay Withdraw 管理器 - 处理提现证明生成和执行流程

const axios = require('axios');
const { ethers } = require('ethers');
const { createLogger } = require('../utils/logger');
const AddressFormatter = require('../utils/address-formatter');

// Treasury Contract ABI for payout function
const TREASURY_ABI = [
    "function payout(address token, uint256 amount, address recipient) external",
    "event PayoutExecuted(address indexed recipient, address indexed token, uint256 amount, bytes32 indexed nullifier)"
];

class ZKPayWithdrawManager {
    constructor(walletManager, logger, options = {}) {
        this.walletManager = walletManager;
        this.logger = logger || createLogger('WithdrawManager');
        this.apiClient = null;
        
        // 参数化配置
        this.maxWaitTime = options.maxWaitTime || 300000;
        this.apiConfig = options.apiConfig || {
            baseURL: process.env.ZKPAY_API_URL || 'https://backend.zkpay.network',
            timeout: parseInt(process.env.ZKPAY_API_TIMEOUT) || 300000
        };
        this.treasuryContracts = options.treasuryContracts || new Map();
        this.tokenConfigs = options.tokenConfigs || new Map();
    }

    /**
     * 初始化Withdraw管理器
     */
    async initialize() {
        this.logger.info('💸 初始化Withdraw管理器...');
        
        // 初始化API客户端
        this.apiClient = axios.create({
            baseURL: this.apiConfig.baseURL,
            timeout: this.apiConfig.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 设置请求拦截器
        this.apiClient.interceptors.request.use(
            (config) => {
                this.logger.debug(`📤 API请求: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                this.logger.error(`❌ API请求错误:`, error.message);
                return Promise.reject(error);
            }
        );

        // 设置响应拦截器
        this.apiClient.interceptors.response.use(
            (response) => {
                this.logger.debug(`📥 API响应: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'NO_RESPONSE';
                const url = error.config?.url || 'UNKNOWN_URL';
                this.logger.error(`❌ API响应错误: ${status} ${url} - ${error.message}`);
                return Promise.reject(error);
            }
        );

        this.logger.info('✅ Withdraw管理器初始化完成');
    }

    /**
     * 生成提现证明
     */
    async generateWithdrawProof(checkId) {
        this.logger.info(`🧮 开始生成提现证明...`);
        this.logger.info(`   Check ID: ${checkId}`);

        try {
            const requestData = {
                check_id: checkId
            };

            this.logger.info(`📤 发送提现证明生成请求...`);
            this.logger.info(`🔍 请求数据: ${JSON.stringify(requestData, null, 2)}`);

            const response = await this.apiClient.post('/api/v2/checks/generate-proof', requestData, {
                timeout: 300000  // 5分钟超时，与commitment一致
            });
            const result = response.data;

            this.logger.info(`✅ 提现证明生成成功:`);
            this.logger.info(`   Check ID: ${result.check_id || checkId}`);
            this.logger.info(`   状态: ${result.status || '未知'}`);
            
            if (result.proof_ready !== undefined) {
                this.logger.info(`   证明就绪: ${result.proof_ready}`);
            }

            if (result.recipient_info) {
                this.logger.info(`   接收信息:`);
                this.logger.info(`     链ID: ${result.recipient_info.chain_id}`);
                this.logger.info(`     地址: ${result.recipient_info.address}`);
                this.logger.info(`     金额: ${result.recipient_info.amount}`);
                this.logger.info(`     Token ID: ${result.recipient_info.token_id}`);
            }

            return result;

        } catch (error) {
            this.logger.error(`❌ 生成提现证明失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 执行提现
     */
    async executeWithdraw(checkId) {
        this.logger.info(`🚀 开始执行提现...`);
        this.logger.info(`   Check ID: ${checkId}`);

        try {
            const response = await this.apiClient.post(`/api/v2/checks/${checkId}/execute`);
            const result = response.data;

            this.logger.info(`✅ 提现执行成功:`);
            this.logger.info(`   Check ID: ${result.check_id || checkId}`);
            this.logger.info(`   状态: ${result.status}`);

            if (result.transaction_hash) {
                this.logger.info(`   交易哈希: ${result.transaction_hash}`);
            }

            return result;

        } catch (error) {
            this.logger.error(`❌ 执行提现失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 提交Withdraw请求
     */
    async submitWithdraw(checkbookId) {
        this.logger.info(`📤 开始提交Withdraw请求...`);
        this.logger.info(`   Checkbook ID: ${checkbookId}`);

        try {
            const requestData = {
                checkbook_id: checkbookId
            };

            const response = await this.apiClient.post('/api/v2/withdraws', requestData);
            const result = response.data;

            this.logger.info(`✅ Withdraw请求提交成功:`);
            this.logger.info(`   Withdraw ID: ${result.withdraw_id}`);
            this.logger.info(`   Nullifier: ${result.nullifier}`);
            this.logger.info(`   状态: ${result.status}`);

            if (result.recipient) {
                this.logger.info(`   接收信息:`);
                this.logger.info(`     链ID: ${result.recipient.chain_id}`);
                this.logger.info(`     地址: ${result.recipient.address}`);
            }

            return result;

        } catch (error) {
            this.logger.error(`❌ 提交Withdraw请求失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 获取Withdraw状态
     */
    async getWithdrawStatus(withdrawId) {
        try {
            const response = await this.apiClient.get(`/api/v2/withdraws/${withdrawId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取Withdraw状态失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 获取Check状态
     */
    async getCheckStatus(checkId) {
        try {
            const response = await this.apiClient.get(`/api/v2/checks/${checkId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取Check状态失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 等待提现完成 - 使用deposits/by-owner接口查询状态
     */
    async waitForWithdrawCompletion(checkId, maxWaitTime = 180, userAddress = null) {
        this.logger.info(`⏳ 等待提现完成 (最大等待时间: ${maxWaitTime}秒)...`);
        this.logger.info(`   Check ID: ${checkId}`);

        const startTime = Date.now();
        const pollInterval = 10000; // 10秒轮询一次
        
        // 使用传入的用户地址，如果没有则使用默认地址
        const ownerAddress = userAddress || '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2';
        const OWNER_DATA = AddressFormatter.toUniversalAddress(714, ownerAddress);

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                // 使用deposits/by-owner接口查询状态
                const response = await this.apiClient.get(`/api/v2/deposits/by-owner?chain_id=714&owner_data=${OWNER_DATA}&page=1&size=10&deleted=false`);
                const deposits = response.data.data || response.data;
                
                // 找到包含目标checkId的存款记录
                let targetCheck = null;
                let targetDeposit = null;
                
                for (const deposit of deposits) {
                    if (deposit.checks && deposit.checks.length > 0) {
                        const check = deposit.checks.find(c => c.id === checkId);
                        if (check) {
                            targetCheck = check;
                            targetDeposit = deposit;
                            break;
                        }
                    }
                }

                if (!targetCheck) {
                    this.logger.debug(`📋 Check ${checkId} 暂未找到，继续等待...`);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                }

                this.logger.debug(`📊 当前Check状态: ${targetCheck.status}`);
                this.logger.debug(`📊 存款状态: ${targetDeposit.status}`);

                // 检查是否已完成
                if (targetCheck.status === 'completed') {
                    this.logger.info(`✅ 提现已完成! Check状态: ${targetCheck.status}, 存款状态: ${targetDeposit.status}`);
                    if (targetCheck.transaction_hash) {
                        this.logger.info(`   交易哈希: ${targetCheck.transaction_hash}`);
                    }
                    return {
                        ...targetCheck,
                        deposit_status: targetDeposit.status,
                        transaction_hash: targetCheck.transaction_hash || targetDeposit.transaction_hash
                    };
                }

                // 检查是否失败
                if (targetCheck.status && targetCheck.status.includes('failed')) {
                    this.logger.error(`❌ 提现失败! 状态: ${targetCheck.status}`);
                    throw new Error(`提现失败: ${targetCheck.status}`);
                }

                // 显示进度信息
                const statusDisplay = this.getCheckStatusDisplay(targetCheck.status || 'unknown');
                this.logger.info(`📈 提现进行中: ${statusDisplay} (Check状态: ${targetCheck.status}, 存款状态: ${targetDeposit.status})`);

                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (error) {
                this.logger.error(`❌ 检查提现状态失败:`, error.message);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`提现完成等待超时 (${maxWaitTime}秒)`);
    }

    /**
     * 获取Check状态的用户友好显示
     */
    getCheckStatusDisplay(status) {
        const statusMap = {
            'idle': '等待处理',
            'pending_proof': '正在生成提现证明',
            'submitting_to_management': '正在提交到管理链',
            'management_pending': '管理链处理中',
            'cross_chain_processing': '跨链转账处理中',
            'completed': '提现已完成',
            'proof_failed': '证明生成失败',
            'submission_failed': '提交失败',
            'cross_chain_failed': '跨链转账失败'
        };
        
        return statusMap[status] || status;
    }

    /**
     * 验证提现交易
     */
    async verifyWithdrawTransaction(transactionHash, targetChainId, expectedRecipient, expectedAmount) {
        this.logger.info(`🔍 验证提现交易...`);
        this.logger.info(`   交易哈希: ${transactionHash}`);
        this.logger.info(`   目标链: ${targetChainId}`);

        try {
            const provider = this.walletManager.getProvider(targetChainId);
            
            // 获取交易收据
            const receipt = await provider.getTransactionReceipt(transactionHash);
            if (!receipt) {
                throw new Error(`交易收据未找到: ${transactionHash}`);
            }

            this.logger.info(`📄 交易收据获取成功:`);
            this.logger.info(`   状态: ${receipt.status === 1 ? '成功' : '失败'}`);
            this.logger.info(`   Gas使用: ${receipt.gasUsed.toString()}`);
            this.logger.info(`   区块号: ${receipt.blockNumber}`);

            if (receipt.status !== 1) {
                throw new Error(`交易执行失败: ${transactionHash}`);
            }

            // 查找目标链的Treasury合约配置
            const treasuryAddress = this.treasuryContracts.get(targetChainId);

            if (!treasuryAddress) {
                this.logger.warn(`⚠️ 目标链 ${targetChainId} 没有配置Treasury合约，跳过事件验证`);
                return {
                    verified: true,
                    receipt,
                    transactionHash,
                    warning: '无法验证Payout事件'
                };
            }

            // 创建Treasury合约实例来解析事件
            const treasuryContract = new ethers.Contract(
                treasuryAddress,
                TREASURY_ABI,
                provider
            );

            // 解析Payout事件
            let payoutEvent = null;
            for (const log of receipt.logs) {
                try {
                    const parsedLog = treasuryContract.interface.parseLog(log);
                    if (parsedLog.name === 'PayoutExecuted') {
                        payoutEvent = {
                            recipient: parsedLog.args.recipient,
                            token: parsedLog.args.token,
                            amount: parsedLog.args.amount,
                            nullifier: parsedLog.args.nullifier
                        };
                        break;
                    }
                } catch (e) {
                    // 忽略解析失败的日志
                    continue;
                }
            }

            if (payoutEvent) {
                this.logger.info(`✅ Payout事件解析成功:`);
                this.logger.info(`   接收者: ${payoutEvent.recipient}`);
                this.logger.info(`   Token: ${payoutEvent.token}`);
                this.logger.info(`   金额: ${payoutEvent.amount.toString()}`);
                this.logger.info(`   Nullifier: ${payoutEvent.nullifier}`);

                // 验证接收者地址
                if (expectedRecipient && payoutEvent.recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
                    this.logger.warn(`⚠️ 接收者地址不匹配: 预期 ${expectedRecipient}, 实际 ${payoutEvent.recipient}`);
                }

                // 验证金额 (如果提供了期望金额)
                if (expectedAmount) {
                    const expectedAmountWei = ethers.parseUnits(expectedAmount.toString(), 18); // 假设18位精度
                    if (payoutEvent.amount.toString() !== expectedAmountWei.toString()) {
                        this.logger.warn(`⚠️ 金额不匹配: 预期 ${expectedAmountWei.toString()}, 实际 ${payoutEvent.amount.toString()}`);
                    }
                }

                return {
                    verified: true,
                    receipt,
                    transactionHash,
                    payoutEvent
                };
            } else {
                this.logger.warn(`⚠️ 未找到PayoutExecuted事件`);
                return {
                    verified: false,
                    receipt,
                    transactionHash,
                    warning: '未找到Payout事件'
                };
            }

        } catch (error) {
            this.logger.error(`❌ 验证提现交易失败:`, error.message);
            throw error;
        }
    }

    /**
     * 等待Checkbook状态变化
     */
    async waitForCheckbookStatus(checkbookId, targetStatus, maxWaitTime = 180) {
        this.logger.info(`⏳ 等待Checkbook状态变为: ${targetStatus}`);
        this.logger.info(`   Checkbook ID: ${checkbookId}`);
        this.logger.info(`   最大等待时间: ${maxWaitTime}秒`);

        const startTime = Date.now();
        const pollInterval = 3000; // 3秒轮询一次

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                const ownerData = AddressFormatter.toUniversalAddress(714, '0x6302a773ad151472bdc2340412716a883cffe434');
                const response = await this.apiClient.get(`/api/v2/deposits/by-owner?chain_id=714&owner_data=${ownerData}&page=1&size=5&deleted=false`);
                const deposits = response.data.data || response.data;
                
                // 找到对应的存款记录
                const deposit = deposits.find(d => d.checkbook_id === checkbookId);
                if (!deposit) {
                    throw new Error(`未找到 checkbook_id ${checkbookId} 对应的存款记录`);
                }
                
                const checkbook = deposit; // 存款记录包含 checkbook 状态信息

                this.logger.debug(`📊 当前Checkbook状态: ${checkbook.status}`);

                if (checkbook.status === targetStatus) {
                    this.logger.info(`✅ Checkbook状态已变为: ${checkbook.status}`);
                    return checkbook;
                }

                // 检查是否失败状态
                if (checkbook.status.includes('failed')) {
                    this.logger.error(`❌ Checkbook状态失败: ${checkbook.status}`);
                    throw new Error(`Checkbook状态失败: ${checkbook.status}`);
                }

                // 显示进度信息
                this.logger.info(`📈 Checkbook状态: ${checkbook.status} → 等待 ${targetStatus}`);

                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (error) {
                if (error.response?.status === 404) {
                    this.logger.debug(`📋 Checkbook ${checkbookId} 暂未找到，继续等待...`);
                } else {
                    this.logger.error(`❌ 检查Checkbook状态失败:`, error.message);
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`Checkbook状态等待超时 (${maxWaitTime}秒): ${checkbookId}`);
    }

    /**
     * 检查目标地址余额变化
     */
    async checkBalanceChange(chainId, tokenSymbol, recipientAddress, beforeBalance) {
        this.logger.info(`💰 检查目标地址余额变化...`);

        try {
            // 查找目标链配置
            const tokenKey = `${chainId}_${tokenSymbol}`;
            const tokenAddress = this.tokenConfigs.get(tokenKey);

            if (!tokenAddress) {
                this.logger.warn(`⚠️ 目标链 ${chainId} 不支持Token ${tokenSymbol}，跳过余额检查`);
                return null;
            }
            const provider = this.walletManager.getProvider(chainId);

            // 创建Token合约实例
            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    "function balanceOf(address account) external view returns (uint256)",
                    "function decimals() external view returns (uint8)",
                    "function symbol() external view returns (string)"
                ],
                provider
            );

            // 获取当前余额
            const currentBalance = await tokenContract.balanceOf(recipientAddress);
            const decimals = await tokenContract.decimals();
            const symbol = await tokenContract.symbol();

            // 计算余额变化
            const balanceChange = currentBalance - beforeBalance;
            const formattedBefore = ethers.formatUnits(beforeBalance, decimals);
            const formattedCurrent = ethers.formatUnits(currentBalance, decimals);
            const formattedChange = ethers.formatUnits(balanceChange, decimals);

            this.logger.info(`📊 余额变化详情:`);
            this.logger.info(`   之前余额: ${formattedBefore} ${symbol}`);
            this.logger.info(`   当前余额: ${formattedCurrent} ${symbol}`);
            this.logger.info(`   余额变化: ${formattedChange} ${symbol}`);

            return {
                beforeBalance,
                currentBalance,
                balanceChange,
                formattedBefore,
                formattedCurrent,
                formattedChange,
                symbol,
                decimals
            };

        } catch (error) {
            this.logger.error(`❌ 检查余额变化失败:`, error.message);
            throw error;
        }
    }

    /**
     * 状态驱动的完整提现流程 - 支持乱序withdraw隐私保护测试
     */
    async performFullWithdrawFlow(checkbookId, recipientInfo, withdrawOrder = null) {
        this.logger.info(`🚀 开始完整提现流程...`);

        const results = {
            generateProof: null,
            waitCompletion: null,
            verifyTransaction: null,
            checkBalance: null,
            checkbookId,
            recipientInfo,
            checkId: null
        };

        try {
            // 记录目标地址的初始余额
            let beforeBalance = null;
            try {
                if (recipientInfo.chain_id && recipientInfo.token_symbol) {
                    const provider = this.walletManager.getProvider(recipientInfo.chain_id);
                    const tokenKey = `${recipientInfo.chain_id}_${recipientInfo.token_symbol}`;
                    const tokenAddress = this.tokenConfigs.get(tokenKey);
                    
                    if (tokenAddress) {
                        const tokenContract = new ethers.Contract(
                            tokenAddress,
                            [
                                "function balanceOf(address account) external view returns (uint256)",
                                "function decimals() external view returns (uint8)"
                            ],
                            provider
                        );
                        beforeBalance = await tokenContract.balanceOf(recipientInfo.address);
                        const decimals = await tokenContract.decimals();
                        this.logger.info(`💰 目标地址初始余额: ${ethers.formatUnits(beforeBalance, decimals)} ${recipientInfo.token_symbol}`);
                    }
                }
            } catch (error) {
                this.logger.warn(`⚠️ 获取初始余额失败:`, error.message);
            }

            // 注意：专注于BSC和Anvil测试，不再支持TRON

            // 使用 test-withdraw-api.js 中验证工作的逻辑
            this.logger.info(`📋 步骤1: 查询存款记录状态`);
            
            const OWNER_DATA = AddressFormatter.toUniversalAddress(714, '0x6302a773ad151472bdc2340412716a883cffe434');
            const depositsResponse = await this.apiClient.get(`/api/v2/deposits/by-owner?chain_id=714&owner_data=${OWNER_DATA}&page=1&size=10&deleted=false`);
            const deposits = depositsResponse.data.data || depositsResponse.data;
            
            const deposit = deposits.find(d => d.checkbook_id === checkbookId);
            if (!deposit) {
                throw new Error(`未找到 checkbook_id ${checkbookId} 对应的存款记录`);
            }

            this.logger.info(`✅ 找到存款记录:`);
            this.logger.info(`   状态: ${deposit.status}`);
            this.logger.info(`   Local Deposit ID: ${deposit.local_deposit_id}`);
            this.logger.info(`   Token ID: ${deposit.token_id}`);
            this.logger.info(`   Check数量: ${deposit.checks?.length || 0}`);

            // 显示Check记录详情
            if (deposit.checks && deposit.checks.length > 0) {
                this.logger.info(`📝 Check记录详情:`);
                deposit.checks.forEach((check, index) => {
                    this.logger.info(`   Check ${index + 1}:`);
                    this.logger.info(`     ID: ${check.id}`);
                    this.logger.info(`     状态: ${check.status || '未知'}`);
                    this.logger.info(`     金额: ${check.amount || '未知'}`);
                    this.logger.info(`     接收者链ID: ${check.recipient?.chain_id || '未知'}`);
                    this.logger.info(`     接收者地址: ${check.recipient?.address || '未知'}`);
                });
            }

            // 步骤2: 根据状态决定下一步操作
            if (deposit.status === 'with_checkbook' && deposit.checks && deposit.checks.length > 0) {
                const checkId = deposit.checks[0].id;
                this.logger.info(`📋 步骤2: 生成提现证明`);
                this.logger.info(`   使用Check ID: ${checkId}`);

                results.checkId = checkId;
                results.checkRecord = deposit.checks[0];
                
                // 步骤3: 生成提现证明
                results.generateProof = await this.generateWithdrawProof(checkId);
            } else if (deposit.status === 'submitting_commitment' || deposit.status === 'commitment_pending') {
                this.logger.info(`⏳ 当前状态为 ${deposit.status}，等待变为 with_checkbook...`);
                // 等待状态变化的逻辑
                const maxWaitTime = 180; // 3分钟
                const startTime = Date.now();
                const pollInterval = 3000; // 3秒轮询一次
                
                while (Date.now() - startTime < maxWaitTime * 1000) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    
                    // 重新查询状态
                    const updatedResponse = await this.apiClient.get(`/api/v2/deposits/by-owner?chain_id=714&owner_data=${OWNER_DATA}&page=1&size=10&deleted=false`);
                    const updatedDeposits = updatedResponse.data.data || updatedResponse.data;
                    const updatedDeposit = updatedDeposits.find(d => d.checkbook_id === checkbookId);
                    
                    if (updatedDeposit && updatedDeposit.status === 'with_checkbook' && updatedDeposit.checks && updatedDeposit.checks.length > 0) {
                        this.logger.info(`✅ 状态已变为 with_checkbook，找到Check记录`);
                        const checkId = updatedDeposit.checks[0].id;
                        this.logger.info(`📋 步骤2: 生成提现证明`);
                        this.logger.info(`   使用Check ID: ${checkId}`);
                        
                        results.checkId = checkId;
                        results.checkRecord = updatedDeposit.checks[0];
                        
                        // 步骤3: 生成提现证明
                        results.generateProof = await this.generateWithdrawProof(checkId);
                        break;
                    } else {
                        this.logger.info(`📈 当前状态: ${updatedDeposit?.status || '未知'} → 等待 with_checkbook`);
                    }
                }
                
                if (!results.generateProof) {
                    throw new Error(`等待状态变为 with_checkbook 超时 (${maxWaitTime}秒)`);
                }
            } else {
                this.logger.warn(`⚠️ 存款状态不正确: ${deposit.status}`);
                this.logger.warn(`   期望状态: with_checkbook、submitting_commitment 或 commitment_pending`);
                throw new Error(`存款状态不正确: ${deposit.status}`);
            }

            // 等待证明生成完成
            this.logger.info(`⏸️ 等待证明生成完成...`);
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 步骤3: 等待证明生成完成并检查状态
            this.logger.info(`📋 步骤3: 等待证明生成完成`);
            const checkId = results.checkId;
            results.waitCompletion = await this.waitForWithdrawCompletion(
                checkId, 
                this.maxWaitTime
            );

            // 步骤4: 验证提现交易
            if (results.waitCompletion.transaction_hash) {
                this.logger.info(`📋 步骤4: 验证提现交易`);
                results.verifyTransaction = await this.verifyWithdrawTransaction(
                    results.waitCompletion.transaction_hash,
                    recipientInfo.chain_id,
                    recipientInfo.address,
                    recipientInfo.amount
                );
            }

            // 步骤5: 检查余额变化
            if (beforeBalance !== null) {
                this.logger.info(`📋 步骤5: 检查余额变化`);
                results.checkBalance = await this.checkBalanceChange(
                    recipientInfo.chain_id,
                    recipientInfo.token_symbol,
                    recipientInfo.address,
                    beforeBalance
                );
            }

            this.logger.info(`🎉 完整提现流程成功完成!`);
            this.logger.info(`   Check ID: ${checkId}`);
            this.logger.info(`   最终状态: ${results.waitCompletion.status}`);
            if (results.waitCompletion.transaction_hash) {
                this.logger.info(`   交易哈希: ${results.waitCompletion.transaction_hash}`);
            }

            return {
                ...results,
                checkId,
                success: true
            };

        } catch (error) {
            this.logger.error(`❌ 完整提现流程失败:`, error.message);
            results.error = error;
            results.success = false;
            throw error;
        }
    }

    /**
     * 重试失败的提现操作
     */
    async retryWithdrawOperation(checkId, operation = 'generate_proof') {
        this.logger.info(`🔄 重试提现操作: ${operation} for Check ${checkId}`);

        try {
            let result;
            
            if (operation === 'generate_proof') {
                result = await this.generateWithdrawProof(checkId);
            } else if (operation === 'execute') {
                result = await this.executeWithdraw(checkId);
            } else {
                throw new Error(`不支持的重试操作: ${operation}`);
            }

            this.logger.info(`✅ 重试操作成功:`, result);
            return result;

        } catch (error) {
            this.logger.error(`❌ 重试操作失败:`, error.message);
            throw error;
        }
    }

    /**
     * 获取提现历史
     */
    async getWithdrawHistory(userAddress, chainId = null) {
        try {
            const params = { user_address: userAddress };
            if (chainId) {
                params.chain_id = chainId;
            }

            const response = await this.apiClient.get('/api/v2/withdraws', { params });
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取提现历史失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理Withdraw管理器资源...');
        this.logger.info('✅ Withdraw管理器清理完成');
    }
}

module.exports = { ZKPayWithdrawManager };
