/**
 * ZKSDK KMS集成Example
 * 展示如何UseKMSSignature器替代直接Private KeyLogin
 */
const { ZKPayClientLibrary } = require('../core/zkpay-client-library');
const { KMSSignerFactory } = require('../utils/saas-kms-signer');
const { createLogger } = require('../utils/logger');

const logger = createLogger('KMSIntegrationExample');

/**
 * KMS集成Example类
 */
class KMSIntegrationExample {
    constructor() {
        this.zkpayClient = null;
        this.kmsSigner = null;
        this.config = this.loadConfig();
    }

    /**
     * 加载Configuration
     */
    loadConfig() {
        return {
            // SAASSystemConfiguration
            saasApiUrl: process.env.SAAS_API_URL || 'http://localhost:3000/api',
            enterpriseApiKey: process.env.ENTERPRISE_API_KEY || 'your_enterprise_api_key',
            enterpriseId: process.env.ENTERPRISE_ID || 'your_enterprise_id',
            
            // KMSConfiguration
            kmsUrl: process.env.KMS_SERVICE_URL || 'http://localhost:18082',
            chainId: process.env.CHAIN_ID || '714', // BSC
            
            // UserConfiguration
            userAddress: process.env.USER_ADDRESS || '0xYourUserAddress',
            
            // ZKPay后台Configuration
            zkpayApiUrl: process.env.ZKPAY_API_URL || 'http://localhost:3001',
        };
    }

    /**
     * Example1: UseFromSAASSystemGet的KMSConfiguration
     */
    async exampleWithSaasKMSConfig() {
        try {
            logger.info('🚀 Example1: UseSAASSystemKMSConfiguration');

            // 1. FromSAASSystemGetKMSSignature器
            this.kmsSigner = await KMSSignerFactory.createSignerFromSaasApi({
                saasApiUrl: this.config.saasApiUrl,
                enterpriseApiKey: this.config.enterpriseApiKey,
                enterpriseId: this.config.enterpriseId,
                userAddress: this.config.userAddress,
                chainId: this.config.chainId,
            });

            logger.info('✅ KMSSignature器Createsuccessful');

            // 2. InitializeZKPayClient
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. UseKMSSignature器Login（Instead ofPrivate Key）
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                this.config.userAddress,
                'kms_user'
            );

            logger.info('✅ UseKMSSignature器Loginsuccessful');

            // 4. Execute业务OperationExample
            await this.performBusinessOperations();

        } catch (error) {
            logger.error('❌ SAAS KMSConfigurationExamplefailed:', error.message);
            throw error;
        }
    }

    /**
     * Example2: Use手动KMSConfiguration
     */
    async exampleWithManualKMSConfig() {
        try {
            logger.info('🚀 Example2: Use手动KMSConfiguration');

            // 1. 手动CreateKMSSignature器
            this.kmsSigner = KMSSignerFactory.createSigner({
                signerType: 'enterprise-user',
                kmsUrl: this.config.kmsUrl,
                enterpriseId: this.config.enterpriseId,
                chainId: this.config.chainId,
                userAddress: this.config.userAddress,
                k1Key: process.env.USER_K1_KEY, // FromEnvironment变量GetK1Key
            });

            logger.info('✅ 手动KMSSignature器Createsuccessful');

            // 2. InitializeZKPayClient
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. UseKMSSignature器Login
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                this.config.userAddress,
                'manual_kms_user'
            );

            logger.info('✅ Use手动KMSConfigurationLoginsuccessful');

            // 4. Execute业务OperationExample
            await this.performBusinessOperations();

        } catch (error) {
            logger.error('❌ 手动KMSConfigurationExamplefailed:', error.message);
            throw error;
        }
    }

    /**
     * Example3: 企业Operation员KMSSignature器
     */
    async exampleWithEnterpriseOperatorKMS() {
        try {
            logger.info('🚀 Example3: 企业Operation员KMSSignature器');

            // 1. Create企业Operation员KMSSignature器
            this.kmsSigner = KMSSignerFactory.createSigner({
                signerType: 'enterprise-operator',
                kmsUrl: this.config.kmsUrl,
                enterpriseId: this.config.enterpriseId,
                chainId: this.config.chainId,
                userAddress: process.env.OPERATOR_ADDRESS,
                k1Key: process.env.OPERATOR_K1_KEY,
            });

            logger.info('✅ 企业Operation员KMSSignature器Createsuccessful');

            // 2. InitializeZKPayClient
            this.zkpayClient = new ZKPayClientLibrary({
                backendUrl: this.config.zkpayApiUrl,
                logger: logger,
            });

            // 3. Use企业Operation员身份Login
            await this.zkpayClient.loginWithSigner(
                this.kmsSigner,
                process.env.OPERATOR_ADDRESS,
                'enterprise_operator'
            );

            logger.info('✅ 企业Operation员Loginsuccessful');

            // 4. ExecuteManagementOperationExample
            await this.performManagementOperations();

        } catch (error) {
            logger.error('❌ 企业Operation员KMSExamplefailed:', error.message);
            throw error;
        }
    }

    /**
     * Execute业务OperationExample
     */
    async performBusinessOperations() {
        try {
            logger.info('📊 StartingExecute业务Operation...');

            // 1. GetUserBalance
            const balanceResult = await this.zkpayClient.getUserBalance();
            logger.info('💰 UserBalanceQuerysuccessful:', balanceResult);

            // 2. Query可用的CheckBook
            const availableCheckbooks = await this.zkpayClient.getAvailableCheckbooks();
            logger.info('📋 可用CheckBook:', availableCheckbooks.length);

            // 3. Mock充值Operation
            if (availableCheckbooks.length > 0) {
                const depositResult = await this.zkpayClient.processDeposit({
                    checkbookId: availableCheckbooks[0].checkbook_id,
                    amount: '1000000000000000000', // 1 USDT (18 decimals)
                    tokenId: '1',
                });
                logger.info('💸 Mock充值Operationcompleted:', depositResult.success);
            }

            // 4. QueryTransaction历史
            const transactionHistory = await this.zkpayClient.getTransactionHistory();
            logger.info('📜 Transaction历史Querysuccessful:', transactionHistory.length);

            logger.info('✅ 业务OperationExamplecompleted');

        } catch (error) {
            logger.error('❌ 业务Operationfailed:', error.message);
            throw error;
        }
    }

    /**
     * ExecuteManagementOperationExample
     */
    async performManagementOperations() {
        try {
            logger.info('🔧 StartingExecuteManagementOperation...');

            // 1. Query企业CheckBookStatus
            const checkbookStatus = await this.zkpayClient.getEnterpriseCheckbookStatus();
            logger.info('📊 企业CheckBookStatus:', checkbookStatus);

            // 2. Execute批量WithdrawOperation
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
            logger.info('💼 批量WithdrawOperationResult:', withdrawalResult.success);

            // 3. Query企业统计Data
            const enterpriseStats = await this.zkpayClient.getEnterpriseStatistics();
            logger.info('📈 企业统计Data:', enterpriseStats);

            logger.info('✅ ManagementOperationExamplecompleted');

        } catch (error) {
            logger.error('❌ ManagementOperationfailed:', error.message);
            throw error;
        }
    }

    /**
     * TestKMSSignature器Function
     */
    async testKMSSignerFunctionality() {
        try {
            logger.info('🧪 TestKMSSignature器Function...');

            if (!this.kmsSigner) {
                throw new Error('KMSSignature器未Initialize');
            }

            // 1. TestSignature器可用性
            const isAvailable = await this.kmsSigner.isAvailable();
            logger.info(`🔍 KMSSignature器可用性: ${isAvailable}`);

            // 2. GetSignature器Address
            const signerAddress = await this.kmsSigner.getAddress();
            logger.info(`📍 Signature器Address: ${signerAddress}`);

            // 3. TestMessageSignature
            const testMessage = 'Hello ZKPay KMS Integration!';
            const signature = await this.kmsSigner.signMessage(testMessage, 'eip191');
            logger.info(`✍️ MessageSignaturesuccessful: ${signature.substring(0, 20)}...`);

            // 4. TestTransactionSignature
            const testTransaction = {
                to: '0x742d35Cc6634C0532925a3b8D8d7d4C8d1B2C3D4',
                value: '1000000000000000000',
                gasLimit: 21000,
                gasPrice: '20000000000',
                nonce: 0,
                chainId: parseInt(this.config.chainId),
            };

            const txSignature = await this.kmsSigner.signTransaction(testTransaction);
            logger.info(`🔏 TransactionSignaturesuccessful: ${txSignature.substring(0, 20)}...`);

            logger.info('✅ KMSSignature器FunctionTestcompleted');

        } catch (error) {
            logger.error('❌ KMSSignature器FunctionTestfailed:', error.message);
            throw error;
        }
    }

    /**
     * CleanupResource
     */
    async cleanup() {
        try {
            if (this.zkpayClient) {
                // If有CleanupMethod，Call它
                if (typeof this.zkpayClient.cleanup === 'function') {
                    await this.zkpayClient.cleanup();
                }
            }
            logger.info('🧹 ResourceCleanupcompleted');
        } catch (error) {
            logger.error('❌ ResourceCleanupfailed:', error.message);
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const example = new KMSIntegrationExample();

    try {
        logger.info('🎯 ZKPay KMS集成ExampleStarting');

        // SelectRun的Example
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
                // 先CreateSignature器再Test
                await example.exampleWithSaasKMSConfig();
                await example.testKMSSignerFunctionality();
                break;
            
            default:
                logger.error('❌ 未知的Example类型:', exampleType);
                logger.info('💡 支持的Example类型: saas, manual, operator, test');
                return;
        }

        logger.info('🎉 ZKPay KMS集成Examplecompleted');

    } catch (error) {
        logger.error('💥 ZKPay KMS集成Examplefailed:', error.message);
        process.exit(1);
    } finally {
        await example.cleanup();
    }
}

// Process进程退出
process.on('SIGINT', async () => {
    logger.info('📡 收To退出信号，正在Cleanup...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 未Process的Promise拒绝:', reason);
    process.exit(1);
});

// Run主函数
if (require.main === module) {
    main().catch((error) => {
        logger.error('💥 主函数Executefailed:', error);
        process.exit(1);
    });
}

module.exports = {
    KMSIntegrationExample,
};
