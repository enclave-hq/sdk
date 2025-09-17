/**
 * ZKSDK KMS集成示例
 * 展示如何使用KMS签名器替代直接私钥登录
 */
const { ZKPayClientLibrary } = require('../core/zkpay-client-library');
const { KMSSignerFactory } = require('../utils/saas-kms-signer');
const { createLogger } = require('../utils/logger');

const logger = createLogger('KMSIntegrationExample');

/**
 * KMS集成示例类
 */
class KMSIntegrationExample {
    constructor() {
        this.zkpayClient = null;
        this.kmsSigner = null;
        this.config = this.loadConfig();
    }

    /**
     * 加载配置
     */
    loadConfig() {
        return {
            // SAAS系统配置
            saasApiUrl: process.env.SAAS_API_URL || 'http://localhost:3000/api',
            enterpriseApiKey: process.env.ENTERPRISE_API_KEY || 'your_enterprise_api_key',
            enterpriseId: process.env.ENTERPRISE_ID || 'your_enterprise_id',
            
            // KMS配置
            kmsUrl: process.env.KMS_SERVICE_URL || 'http://localhost:18082',
            chainId: process.env.CHAIN_ID || '714', // BSC
            
            // 用户配置
            userAddress: process.env.USER_ADDRESS || '0xYourUserAddress',
            
            // ZKPay后台配置
            zkpayApiUrl: process.env.ZKPAY_API_URL || 'http://localhost:3001',
        };
    }

    /**
     * 示例1: 使用从SAAS系统获取的KMS配置
     */
    async exampleWithSaasKMSConfig() {
        try {
            logger.info('🚀 示例1: 使用SAAS系统KMS配置');

            // 1. 从SAAS系统获取KMS签名器
            this.kmsSigner = await KMSSignerFactory.createSignerFromSaasApi({
                saasApiUrl: this.config.saasApiUrl,
                enterpriseApiKey: this.config.enterpriseApiKey,
                enterpriseId: this.config.enterpriseId,
                userAddress: this.config.userAddress,
                chainId: this.config.chainId,
            });

            logger.info('✅ KMS签名器创建成功');

            // 2. 初始化ZKPay客户端
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. 使用KMS签名器登录（而不是私钥）
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                this.config.userAddress,
                'kms_user'
            );

            logger.info('✅ 使用KMS签名器登录成功');

            // 4. 执行业务操作示例
            await this.performBusinessOperations();

        } catch (error) {
            logger.error('❌ SAAS KMS配置示例失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例2: 使用手动KMS配置
     */
    async exampleWithManualKMSConfig() {
        try {
            logger.info('🚀 示例2: 使用手动KMS配置');

            // 1. 手动创建KMS签名器
            this.kmsSigner = KMSSignerFactory.createSigner({
                signerType: 'enterprise-user',
                kmsUrl: this.config.kmsUrl,
                enterpriseId: this.config.enterpriseId,
                chainId: this.config.chainId,
                userAddress: this.config.userAddress,
                k1Key: process.env.USER_K1_KEY, // 从环境变量获取K1密钥
            });

            logger.info('✅ 手动KMS签名器创建成功');

            // 2. 初始化ZKPay客户端
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. 使用KMS签名器登录
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                this.config.userAddress,
                'manual_kms_user'
            );

            logger.info('✅ 使用手动KMS配置登录成功');

            // 4. 执行业务操作示例
            await this.performBusinessOperations();

        } catch (error) {
            logger.error('❌ 手动KMS配置示例失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例3: 企业操作员KMS签名器
     */
    async exampleWithEnterpriseOperatorKMS() {
        try {
            logger.info('🚀 示例3: 企业操作员KMS签名器');

            // 1. 创建企业操作员KMS签名器
            this.kmsSigner = KMSSignerFactory.createSigner({
                signerType: 'enterprise-operator',
                kmsUrl: this.config.kmsUrl,
                enterpriseId: this.config.enterpriseId,
                chainId: this.config.chainId,
                userAddress: process.env.OPERATOR_ADDRESS,
                k1Key: process.env.OPERATOR_K1_KEY,
            });

            logger.info('✅ 企业操作员KMS签名器创建成功');

            // 2. 初始化ZKPay客户端
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. 使用企业操作员身份登录
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                process.env.OPERATOR_ADDRESS,
                'enterprise_operator'
            );

            logger.info('✅ 企业操作员登录成功');

            // 4. 执行管理操作示例
            await this.performManagementOperations();

        } catch (error) {
            logger.error('❌ 企业操作员KMS示例失败:', error.message);
            throw error;
        }
    }

    /**
     * 执行业务操作示例
     */
    async performBusinessOperations() {
        try {
            logger.info('📊 开始执行业务操作...');

            // 1. 获取用户余额
            const balanceResult = await this.zkpayClient.getUserBalance();
            logger.info('💰 用户余额查询成功:', balanceResult);

            // 2. 查询可用的CheckBook
            const availableCheckbooks = await this.zkpayClient.getAvailableCheckbooks();
            logger.info('📋 可用CheckBook:', availableCheckbooks.length);

            // 3. 模拟充值操作
            if (availableCheckbooks.length > 0) {
                const depositResult = await this.zkpayClient.processDeposit({
                    checkbookId: availableCheckbooks[0].checkbook_id,
                    amount: '1000000000000000000', // 1 USDT (18 decimals)
                    tokenId: '1',
                });
                logger.info('💸 模拟充值操作完成:', depositResult.success);
            }

            // 4. 查询交易历史
            const transactionHistory = await this.zkpayClient.getTransactionHistory();
            logger.info('📜 交易历史查询成功:', transactionHistory.length);

            logger.info('✅ 业务操作示例完成');

        } catch (error) {
            logger.error('❌ 业务操作失败:', error.message);
            throw error;
        }
    }

    /**
     * 执行管理操作示例
     */
    async performManagementOperations() {
        try {
            logger.info('🔧 开始执行管理操作...');

            // 1. 查询企业CheckBook状态
            const checkbookStatus = await this.zkpayClient.getEnterpriseCheckbookStatus();
            logger.info('📊 企业CheckBook状态:', checkbookStatus);

            // 2. 执行批量提现操作
            const withdrawalResult = await this.zkpayClient.processBatchWithdrawal({
                withdrawals: [
                    {
                        recipient: '0xRecipientAddress1',
                        amount: '500000000000000000', // 0.5 USDT
                        tokenId: '1',
                    },
                    {
                        recipient: '0xRecipientAddress2',
                        amount: '300000000000000000', // 0.3 USDT
                        tokenId: '1',
                    },
                ],
            });
            logger.info('💼 批量提现操作结果:', withdrawalResult.success);

            // 3. 查询企业统计数据
            const enterpriseStats = await this.zkpayClient.getEnterpriseStatistics();
            logger.info('📈 企业统计数据:', enterpriseStats);

            logger.info('✅ 管理操作示例完成');

        } catch (error) {
            logger.error('❌ 管理操作失败:', error.message);
            throw error;
        }
    }

    /**
     * 测试KMS签名器功能
     */
    async testKMSSignerFunctionality() {
        try {
            logger.info('🧪 测试KMS签名器功能...');

            if (!this.kmsSigner) {
                throw new Error('KMS签名器未初始化');
            }

            // 1. 测试签名器可用性
            const isAvailable = await this.kmsSigner.isAvailable();
            logger.info(`🔍 KMS签名器可用性: ${isAvailable}`);

            // 2. 获取签名器地址
            const signerAddress = await this.kmsSigner.getAddress();
            logger.info(`📍 签名器地址: ${signerAddress}`);

            // 3. 测试消息签名
            const testMessage = 'Hello ZKPay KMS Integration!';
            const signature = await this.kmsSigner.signMessage(testMessage, 'eip191');
            logger.info(`✍️ 消息签名成功: ${signature.substring(0, 20)}...`);

            // 4. 测试交易签名
            const testTransaction = {
                to: '0x742d35Cc6634C0532925a3b8D8d7d4C8d1B2C3D4',
                value: '1000000000000000000',
                gasLimit: 21000,
                gasPrice: '20000000000',
                nonce: 0,
                chainId: parseInt(this.config.chainId),
            };

            const txSignature = await this.kmsSigner.signTransaction(testTransaction);
            logger.info(`🔏 交易签名成功: ${txSignature.substring(0, 20)}...`);

            logger.info('✅ KMS签名器功能测试完成');

        } catch (error) {
            logger.error('❌ KMS签名器功能测试失败:', error.message);
            throw error;
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.zkpayClient) {
                // 如果有清理方法，调用它
                if (typeof this.zkpayClient.cleanup === 'function') {
                    await this.zkpayClient.cleanup();
                }
            }
            logger.info('🧹 资源清理完成');
        } catch (error) {
            logger.error('❌ 资源清理失败:', error.message);
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const example = new KMSIntegrationExample();

    try {
        logger.info('🎯 ZKPay KMS集成示例开始');

        // 选择运行的示例
        const exampleType = process.env.EXAMPLE_TYPE || 'saas';

        switch (exampleType) {
            case 'saas':
                await example.exampleWithSaasKMSConfig();
                break;
            
            case 'manual':
                await example.exampleWithManualKMSConfig();
                break;
            
            case 'operator':
                await example.exampleWithEnterpriseOperatorKMS();
                break;
            
            case 'test':
                // 先创建签名器再测试
                await example.exampleWithSaasKMSConfig();
                await example.testKMSSignerFunctionality();
                break;
            
            default:
                logger.error('❌ 未知的示例类型:', exampleType);
                logger.info('💡 支持的示例类型: saas, manual, operator, test');
                return;
        }

        logger.info('🎉 ZKPay KMS集成示例完成');

    } catch (error) {
        logger.error('💥 ZKPay KMS集成示例失败:', error.message);
        process.exit(1);
    } finally {
        await example.cleanup();
    }
}

// 处理进程退出
process.on('SIGINT', async () => {
    logger.info('📡 收到退出信号，正在清理...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 未处理的Promise拒绝:', reason);
    process.exit(1);
});

// 运行主函数
if (require.main === module) {
    main().catch((error) => {
        logger.error('💥 主函数执行失败:', error);
        process.exit(1);
    });
}

module.exports = {
    KMSIntegrationExample,
};
