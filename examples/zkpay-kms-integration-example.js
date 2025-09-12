// ZKPay KMS服务集成示例
// 演示如何使用您现有的KMS服务与zksdk集成

const { ZKPayClient } = require('../core/zkpay-client-library');
const { ZKPayKMSSigner, ZKPayKMSSignerFactory } = require('../utils/zkpay-kms-adapter');
const { createLogger } = require('../utils/logger');

/**
 * 示例1: 使用现有KMS密钥创建签名器
 */
async function useExistingKMSKey() {
    const logger = createLogger('KMSIntegration');
    logger.info('🚀 示例1: 使用现有KMS密钥');

    try {
        // 1. KMS配置（使用您已经存储在KMS中的密钥）
        const kmsConfig = {
            baseURL: 'http://localhost:18082',
            keyAlias: 'bsc_relayer',           // 您在KMS中的密钥别名
            encryptedKey: 'YWRzZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGY=', // 从KMS获取的加密密钥
            slip44Id: 714,                     // BSC使用SLIP44 ID 714
            address: '0x4Da7cf999162ecb79749D0186E5759c7a6BD4477', // 对应的地址
            // 可选的签名配置
            defaultSignatureType: 'eip191',    // BSC使用EIP-191签名
            // 可选的认证配置
            // bearerToken: 'your-bearer-token',
            // serviceKey: 'zkpay-service-key-your-service',
            // serviceName: 'zksdk'
        };

        // 2. 创建KMS签名器
        const kmsSigner = ZKPayKMSSignerFactory.createFromExistingKey(kmsConfig, logger);

        // 3. 验证KMS配置
        const isValid = await kmsSigner.validateConfig();
        if (!isValid) {
            throw new Error('KMS配置验证失败');
        }

        // 4. 创建ZKPay客户端并使用KMS签名器登录
        const client = new ZKPayClient(logger);
        await client.initialize();

        const loginResult = await client.loginWithSigner(
            kmsSigner,
            kmsConfig.address,
            'kms-user'
        );

        logger.info('✅ KMS登录成功:', loginResult);

        // 5. 现在所有操作都会使用KMS签名
        return { client, kmsSigner };

    } catch (error) {
        logger.error('❌ 示例1失败:', error.message);
        throw error;
    }
}

/**
 * 示例2: 创建新的KMS密钥并使用
 */
async function createNewKMSKey() {
    const logger = createLogger('KMSNewKey');
    logger.info('🚀 示例2: 创建新的KMS密钥');

    try {
        // 1. 新密钥配置
        const newKeyConfig = {
            baseURL: 'http://localhost:18082',
            privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // 要加密存储的私钥
            keyAlias: 'zksdk_user_001',        // 新的密钥别名
            slip44Id: 714,                     // BSC使用SLIP44 ID 714
            defaultSignatureType: 'eip191',    // BSC使用EIP-191签名
            timeout: 30000
        };

        // 2. 创建KMS签名器（会自动加密并存储私钥）
        const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(newKeyConfig, logger);

        // 3. 使用新创建的签名器
        const client = new ZKPayClient(logger);
        await client.initialize();

        const loginResult = await client.loginWithSigner(
            kmsSigner,
            kmsSigner.getAddress(),
            'new-kms-user'
        );

        logger.info('✅ 新KMS密钥创建并登录成功:', loginResult);

        return { client, kmsSigner };

    } catch (error) {
        logger.error('❌ 示例2失败:', error.message);
        throw error;
    }
}

/**
 * 示例3: 完整的存款和提现流程（使用KMS签名）
 */
async function fullKMSWorkflow() {
    const logger = createLogger('KMSWorkflow');
    logger.info('🚀 示例3: 完整的KMS工作流程');

    try {
        // 1. 使用现有KMS密钥
        const { client } = await useExistingKMSKey();

        // 2. 执行存款（ERC20交易会使用KMS的signTransaction）
        logger.info('📋 步骤1: 执行存款...');
        const depositResult = await client.deposit(
            714,                    // BSC链ID (SLIP44)
            'USDT',                 // Token符号
            '100.50',               // 金额
            '0x1234567890123456789012345678901234567890' // Treasury地址
        );
        
        logger.info('✅ 存款交易已发送:', depositResult.txHash);

        // 3. 等待存款检测
        logger.info('📋 步骤2: 等待存款检测...');
        const depositRecord = await client.waitForDepositDetection(
            depositResult.txHash,
            714,
            60 // 超时时间（秒）
        );

        logger.info('✅ 存款已检测到:', depositRecord.checkbookId);

        // 4. 创建分配方案并提交Commitment（消息签名会使用KMS的signMessage）
        logger.info('📋 步骤3: 提交Commitment...');
        const allocations = [{
            recipient_address: '0x9876543210987654321098765432109876543210',
            recipient_chain_id: 714,
            amount: '100.50'
        }];

        const commitmentResult = await client.submitCommitment(
            depositRecord.checkbookId,
            allocations,
            true // 自动提交
        );

        logger.info('✅ Commitment已提交:', commitmentResult.signature.slice(0, 20) + '...');

        // 5. 执行提现
        logger.info('📋 步骤4: 执行提现...');
        const withdrawResult = await client.performWithdraw(
            depositRecord.checkbookId,
            {
                recipient_address: '0x9876543210987654321098765432109876543210',
                recipient_chain_id: 714,
                amount: '100.50'
            },
            true // 自动提交
        );

        logger.info('✅ 提现完成:', withdrawResult);

        return {
            deposit: depositResult,
            commitment: commitmentResult,
            withdraw: withdrawResult
        };

    } catch (error) {
        logger.error('❌ 完整KMS工作流程失败:', error.message);
        throw error;
    }
}

/**
 * 示例4: KMS健康检查和密钥管理
 */
async function kmsManagementExample() {
    const logger = createLogger('KMSManagement');
    logger.info('🚀 示例4: KMS管理功能');

    try {
        // 1. 创建KMS签名器
        const kmsConfig = {
            baseURL: 'http://localhost:18082',
            keyAlias: 'management_test',
            encryptedKey: 'sample_encrypted_key',
            chainId: 56,
            address: '0x1234567890123456789012345678901234567890'
        };

        const kmsSigner = new ZKPayKMSSigner(kmsConfig, logger);

        // 2. 健康检查
        const isHealthy = await kmsSigner.isAvailable();
        logger.info(`🔍 KMS服务健康状态: ${isHealthy ? '✅ 健康' : '❌ 不健康'}`);

        // 3. 获取密钥列表
        const keysList = await kmsSigner.getKeysList();
        logger.info('📋 KMS中的密钥列表:');
        keysList.forEach((key, index) => {
            logger.info(`  ${index + 1}. ${key.key_alias} (Chain ${key.chain_id}) - ${key.public_address}`);
        });

        // 4. 配置验证
        const isValidConfig = await kmsSigner.validateConfig();
        logger.info(`🔍 KMS配置验证: ${isValidConfig ? '✅ 有效' : '❌ 无效'}`);

        return {
            isHealthy,
            keysList,
            isValidConfig
        };

    } catch (error) {
        logger.error('❌ KMS管理示例失败:', error.message);
        throw error;
    }
}

/**
 * 示例5: 错误处理和重试机制
 */
async function errorHandlingExample() {
    const logger = createLogger('KMSErrorHandling');
    logger.info('🚀 示例5: KMS错误处理');

    try {
        // 1. 使用无效配置测试错误处理
        const invalidConfig = {
            baseURL: 'http://localhost:18082',
            keyAlias: 'non_existent_key',
            encryptedKey: 'invalid_encrypted_key',
            chainId: 56,
            address: '0x0000000000000000000000000000000000000000'
        };

        const kmsSigner = new ZKPayKMSSigner(invalidConfig, logger);

        // 2. 测试健康检查
        try {
            const isHealthy = await kmsSigner.isAvailable();
            logger.info(`健康检查结果: ${isHealthy}`);
        } catch (error) {
            logger.warn('健康检查异常:', error.message);
        }

        // 3. 测试无效签名
        try {
            await kmsSigner.signMessage('test message', invalidConfig.address);
        } catch (error) {
            logger.info('✅ 正确捕获签名错误:', error.message);
        }

        // 4. 测试配置验证
        try {
            const isValid = await kmsSigner.validateConfig();
            logger.info(`配置验证结果: ${isValid}`);
        } catch (error) {
            logger.info('✅ 正确捕获配置错误:', error.message);
        }

        return true;

    } catch (error) {
        logger.error('❌ 错误处理示例失败:', error.message);
        throw error;
    }
}

// 导出所有示例函数
module.exports = {
    useExistingKMSKey,
    createNewKMSKey,
    fullKMSWorkflow,
    kmsManagementExample,
    errorHandlingExample
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
    (async () => {
        try {
            console.log('🔐 ZKPay KMS集成示例');
            console.log('=====================================');
            
            // 选择要运行的示例
            const examples = [
                { name: '使用现有KMS密钥', fn: useExistingKMSKey },
                { name: '创建新KMS密钥', fn: createNewKMSKey },
                { name: '完整KMS工作流程', fn: fullKMSWorkflow },
                { name: 'KMS管理功能', fn: kmsManagementExample },
                { name: '错误处理', fn: errorHandlingExample }
            ];

            // 取消注释要运行的示例
            // await examples[0].fn(); // 示例1
            // await examples[1].fn(); // 示例2
            // await examples[2].fn(); // 示例3
            // await examples[3].fn(); // 示例4
            // await examples[4].fn(); // 示例5

            console.log('✅ 所有示例已准备就绪，请根据需要取消注释相应的示例');
            
        } catch (error) {
            console.error('❌ 示例运行失败:', error.message);
        }
    })();
}
