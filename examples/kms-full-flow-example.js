#!/usr/bin/env node

// ZKPay KMS完整流程示例
// 从Deposit到Withdraw的完整KMS集成示例
// 支持客户端输入私钥或自动生成私钥

require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { ZKPayKMSSigner, ZKPayKMSSignerFactory } = require('../utils/zkpay-kms-adapter');
const { createLogger } = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

/**
 * KMS完整流程示例类
 */
class KMSFullFlowExample {
    constructor() {
        this.logger = createLogger('KMSFullFlow');
        this.client = null;
        this.kmsSigner = null;
        this.userAddress = null;
    }

    /**
     * 步骤1: 初始化KMS密钥（支持两种方式）
     */
    async initializeKMSKey(useProvidedKey = false, providedPrivateKey = null) {
        this.logger.info('🔑 步骤1: 初始化KMS密钥');
        
        const kmsBaseURL = process.env.KMS_BASE_URL || 'http://localhost:18082';
        const keyAlias = `zkpay_demo_${Date.now()}`;
        
        let privateKey;
        let keySource;
        
        if (useProvidedKey && providedPrivateKey) {
            // 方式1: 使用客户端提供的私钥
            privateKey = providedPrivateKey;
            keySource = '客户端提供';
            this.logger.info(`🔐 使用客户端提供的私钥: ${privateKey.slice(0, 10)}...`);
        } else {
            // 方式2: 自动生成新私钥
            privateKey = '0x' + crypto.randomBytes(32).toString('hex');
            keySource = '自动生成';
            this.logger.info(`🎲 自动生成新私钥: ${privateKey.slice(0, 10)}...`);
        }

        // 调用KMS加密接口
        const encryptRequest = {
            private_key: privateKey,
            key_alias: keyAlias,
            slip44_id: 714 // SLIP44标准币种ID (714=BSC)
        };

        try {
            this.logger.info('📡 向KMS发送加密请求...');
            const response = await axios.post(`${kmsBaseURL}/api/v1/encrypt`, encryptRequest, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.KMS_BEARER_TOKEN || ''}`,
                    'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                    'X-Service-Name': 'zksdk'
                },
                timeout: 30000
            });

            if (!response.data.success) {
                throw new Error(`KMS加密失败: ${response.data.error}`);
            }

            const result = response.data;
            this.userAddress = result.public_address;

            this.logger.info('✅ KMS密钥初始化成功:');
            this.logger.info(`  🏷️  密钥来源: ${keySource}`);
            this.logger.info(`  🔑 密钥别名: ${keyAlias}`);
            this.logger.info(`  📍 用户地址: ${this.userAddress}`);
            this.logger.info(`  🌐 SLIP44 ID: ${result.slip44_id}`);
            this.logger.info(`  ⛓️  EVM链ID: ${result.evm_chain_id}`);

            // 创建KMS签名器配置
            const kmsConfig = {
                baseURL: kmsBaseURL,
                keyAlias: keyAlias,
                encryptedKey: result.k1 || result.encrypted_key, // 优先使用k1，兼容旧格式
                slip44Id: 714,
                address: this.userAddress,
                defaultSignatureType: 'eip191'
            };

            // 创建KMS签名器（暂时不传入RPC提供者，稍后在客户端初始化后再设置）
            this.kmsSigner = ZKPayKMSSignerFactory.createFromExistingKey(kmsConfig, this.logger);

            return {
                success: true,
                keyAlias,
                address: this.userAddress,
                encryptedKey: result.encrypted_key,
                keySource
            };

        } catch (error) {
            this.logger.error('❌ KMS密钥初始化失败:', error.message);
            throw error;
        }
    }

    /**
     * 步骤2: 初始化ZKPay客户端并登录
     */
    async initializeZKPayClient() {
        this.logger.info('🚀 步骤2: 初始化ZKPay客户端');

        // 创建参数化配置
        const treasuryContracts = new Map([
            [714, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8'] // BSC SLIP44
        ]);
        
        const tokenConfigs = new Map([
            ['714_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']
        ]);

        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            },
            treasuryContracts,
            tokenConfigs,
            confirmationBlocks: 3,
            maxWaitTime: 300000,
            defaultRecipientAddress: process.env.TEST_RECIPIENT_ADDRESS || '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce'
        };

        // 创建客户端
        this.client = new ZKPayClient(this.logger, options);
        await this.client.initialize();

        // 为KMS签名器设置RPC提供者
        if (this.kmsSigner && this.client.walletManager && this.client.walletManager.providers) {
            // 从钱包管理器获取RPC提供者
            const rpcProviders = {};
            for (const [chainId, provider] of this.client.walletManager.providers.entries()) {
                rpcProviders[chainId] = provider;
            }
            this.kmsSigner.rpcProviders = rpcProviders;
            this.logger.info('🔗 已为KMS签名器设置RPC提供者');
        }

        // 使用KMS签名器登录
        const loginResult = await this.client.loginWithSigner(
            this.kmsSigner,
            this.userAddress,
            'kms-demo-user'
        );

        this.logger.info('✅ ZKPay客户端登录成功:', {
            address: loginResult.address,
            userName: loginResult.userName
        });

        return loginResult;
    }

    /**
     * 步骤3: 检查Token余额和授权
     */
    async checkTokenStatus() {
        this.logger.info('💰 步骤3: 检查Token状态');

        const chainId = 714; // SLIP44 BSC
        const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
        const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';

        // 检查余额
        const balance = await this.client.checkTokenBalance(chainId, tokenAddress, this.userAddress);
        this.logger.info(`💰 当前余额: ${balance.formatted} USDT`);

        // 检查授权
        const allowance = await this.client.checkTokenAllowance(chainId, tokenAddress, this.userAddress, treasuryAddress);
        this.logger.info(`🔍 当前授权: ${allowance.formatted} USDT`);

        return {
            balance,
            allowance,
            chainId,
            tokenAddress,
            treasuryAddress
        };
    }

    /**
     * 步骤4: 执行存款操作（使用KMS签名）
     */
    async performDeposit(amount = '10.0') {
        this.logger.info(`💳 步骤4: 执行存款操作 (${amount} USDT)`);

        const chainId = 714;
        const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
        const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';

        try {
            // 检查余额是否足够
            const balance = await this.client.checkTokenBalance(chainId, tokenAddress, this.userAddress);
            if (parseFloat(balance.formatted) < parseFloat(amount)) {
                throw new Error(`余额不足: 需要 ${amount}, 但只有 ${balance.formatted}`);
            }

            // 执行存款（包含授权，使用KMS签名）
            this.logger.info('🔐 使用KMS签名执行存款交易...');
            const depositResult = await this.client.deposit(chainId, tokenAddress, amount, treasuryAddress);

            this.logger.info('✅ 存款交易成功:', {
                txHash: depositResult.deposit.txHash
            });

            // 获取正确的交易哈希
            const txHash = depositResult.deposit.txHash;
            if (!txHash) {
                throw new Error('无法获取存款交易哈希');
            }

            // 等待后端检测存款
            this.logger.info('⏳ 等待后端检测存款...');
            const depositRecord = await this.client.waitForDepositDetection(
                txHash,
                chainId,
                120 // 2分钟超时
            );

            this.logger.info('✅ 存款检测完成:', {
                checkbookId: depositRecord.checkbook_id,
                status: depositRecord.status
            });

            // 等待checkbook状态变为ready_for_commitment（与zkpay-client-example.js一致）
            this.logger.info('⏳ 等待checkbook状态变为ready_for_commitment...');
            await this.client.waitForCommitmentStatus(
                depositRecord.checkbook_id,
                ['ready_for_commitment'],
                180000 // 3分钟超时（毫秒）
            );
            
            this.logger.info('✅ checkbook状态已变为ready_for_commitment，可以执行commitment操作');

            return {
                depositResult,
                depositRecord
            };

        } catch (error) {
            this.logger.error('❌ 存款操作失败:', error.message);
            throw error;
        }
    }

    /**
     * 步骤5: 等待checkbook准备完成
     */
    async waitForCheckbookReady(checkbookId) {
        this.logger.info('⏳ 步骤5: 等待checkbook准备完成');

        try {
            // 等待checkbook状态变为ready_for_commitment
            await this.client.waitForCommitmentStatus(
                checkbookId,
                ['ready_for_commitment'],
                300000 // 5分钟超时
            );

            this.logger.info('✅ checkbook已准备完成，可以执行commitment');

            return true;

        } catch (error) {
            this.logger.error('❌ 等待checkbook准备失败:', error.message);
            throw error;
        }
    }

    /**
     * 步骤6: 执行Commitment（使用KMS签名）
     */
    async executeCommitment(checkbookId, amount = '10.0') {
        this.logger.info('📝 步骤6: 执行Commitment（使用KMS签名）');

        try {
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: process.env.TEST_RECIPIENT_ADDRESS || '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce',
                amount: (parseFloat(amount) * Math.pow(10, 18)).toString() // 转换为wei
            }];

            this.logger.info('🔐 使用KMS签名执行commitment...');

            // 执行Commitment（同步，等待完成）
            const commitmentResult = await this.client.executeCommitmentSync(
                checkbookId,
                allocations,
                true // 等待到with_checkbook状态
            );

            this.logger.info('✅ Commitment执行成功:', {
                checkbookId,
                status: commitmentResult.status,
                finalStatus: commitmentResult.finalStatus
            });

            return commitmentResult;

        } catch (error) {
            this.logger.error('❌ Commitment执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 步骤7: 生成提现证明（使用KMS签名）
     */
    async generateWithdrawProof(checkbookId, amount = '10.0') {
        this.logger.info('🔍 步骤7: 生成提现证明（使用KMS签名）');

        try {
            const recipientInfo = {
                chain_id: 714,
                address: this.userAddress, // 提现到自己地址
                amount: (parseFloat(amount) * Math.pow(10, 18)).toString(),
                token_symbol: 'test_usdt'
            };

            this.logger.info('🔐 使用KMS签名生成提现证明...');

            // 生成证明（同步，等待完成）
            const proofResult = await this.client.generateProofSync(
                checkbookId,
                recipientInfo,
                true // 等待到completed状态
            );

            this.logger.info('✅ 提现证明生成成功:', {
                checkId: proofResult.checkId,
                finalStatus: proofResult.finalStatus
            });

            if (proofResult.completionResult?.transaction_hash) {
                this.logger.info('💰 提现交易哈希:', proofResult.completionResult.transaction_hash);
            }

            return proofResult;

        } catch (error) {
            this.logger.error('❌ 提现证明生成失败:', error.message);
            throw error;
        }
    }

    /**
     * 运行完整流程
     */
    async runFullFlow(useProvidedKey = false, providedPrivateKey = null, depositAmount = '10.0') {
        this.logger.info('🚀 开始KMS完整流程测试...');
        this.logger.info(`🔐 密钥模式: ${useProvidedKey ? '客户端提供私钥' : '自动生成私钥'}`);
        this.logger.info(`💰 存款金额: ${depositAmount} USDT`);

        const results = {};

        try {
            // 步骤1: 初始化KMS密钥
            results.keyInit = await this.initializeKMSKey(useProvidedKey, providedPrivateKey);

            // 步骤2: 初始化ZKPay客户端
            results.clientInit = await this.initializeZKPayClient();

            // 步骤3: 检查Token状态
            results.tokenStatus = await this.checkTokenStatus();

            // 步骤4: 执行存款
            results.deposit = await this.performDeposit(depositAmount);

            // 步骤5: 执行Commitment（checkbook状态已在存款步骤中等待完成）
            results.commitment = await this.executeCommitment(
                results.deposit.depositRecord.checkbook_id,
                depositAmount
            );

            // 步骤7: 生成提现证明
            results.withdraw = await this.generateWithdrawProof(
                results.deposit.depositRecord.checkbook_id,
                depositAmount
            );

            this.logger.info('🎉 KMS完整流程测试成功完成！');

            return {
                success: true,
                results
            };

        } catch (error) {
            this.logger.error('❌ KMS完整流程测试失败:', error.message);
            return {
                success: false,
                error: error.message,
                results
            };
        } finally {
            // 清理资源
            if (this.client) {
                await this.client.cleanup();
            }
        }
    }

    /**
     * 显示测试总结
     */
    displaySummary(result) {
        console.log('\n📊 ====== KMS完整流程测试总结 ======');
        
        if (result.success) {
            console.log('✅ 测试状态: 成功');
            
            if (result.results.keyInit) {
                console.log(`🔑 密钥来源: ${result.results.keyInit.keySource}`);
                console.log(`📍 用户地址: ${result.results.keyInit.address}`);
            }
            
            if (result.results.deposit) {
                console.log(`💳 存款交易: ${result.results.deposit.depositResult.txHash}`);
                console.log(`📋 CheckBook ID: ${result.results.deposit.depositRecord.checkbook_id}`);
            }
            
            if (result.results.commitment) {
                console.log(`📝 Commitment状态: ${result.results.commitment.finalStatus}`);
            }
            
            if (result.results.withdraw) {
                console.log(`🔍 提现状态: ${result.results.withdraw.finalStatus}`);
                if (result.results.withdraw.completionResult?.transaction_hash) {
                    console.log(`💰 提现交易: ${result.results.withdraw.completionResult.transaction_hash}`);
                }
            }
            
        } else {
            console.log('❌ 测试状态: 失败');
            console.log(`🐛 错误信息: ${result.error}`);
        }
        
        console.log('=====================================\n');
    }
}

// 命令行接口
if (require.main === module) {
    const { Command } = require('commander');
    const program = new Command();

    program
        .name('kms-full-flow-example')
        .description('ZKPay KMS完整流程示例 - 从Deposit到Withdraw')
        .version('1.0.0');

    program
        .option('--use-provided-key', '使用提供的私钥而不是自动生成')
        .option('--private-key <key>', '要使用的私钥（需要配合--use-provided-key）')
        .option('--amount <amount>', '存款金额', '10.0')
        .action(async (options) => {
            const example = new KMSFullFlowExample();
            
            // 验证参数
            if (options.useProvidedKey && !options.privateKey) {
                console.error('❌ 使用--use-provided-key时必须提供--private-key参数');
                process.exit(1);
            }

            try {
                const result = await example.runFullFlow(
                    options.useProvidedKey,
                    options.privateKey,
                    options.amount
                );
                
                example.displaySummary(result);
                process.exit(result.success ? 0 : 1);
                
            } catch (error) {
                console.error('❌ 示例运行失败:', error.message);
                process.exit(1);
            }
        });

    program.parse();
}

module.exports = { KMSFullFlowExample };
