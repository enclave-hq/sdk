/**
 * 测试Commitment签名消息生成和KMS签名
 */

const { ZKPayCommitmentManager } = require('../managers/zkpay-commitment-manager');
const { createLogger } = require('../utils/logger');
const ZKPayKMSAdapter = require('../utils/zkpay-kms-adapter');

async function testCommitmentSignature() {
    const logger = createLogger('TestCommitmentSignature');
    
    // 1. 创建Commitment管理器（模拟）
    const mockWalletManager = {
        getUserAddress: () => '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2'
    };
    
    const commitmentManager = new ZKPayCommitmentManager(mockWalletManager, logger);
    
    // 2. 根据提供的commitment信息构造签名消息
    const commitmentData = {
        "allocations": [
            {
                "recipient_chain_id": 714,
                "recipient_address": "0x0000000000000000000000000848d929b9d35bfb7aa50641d392a4ad83e145ce",
                "amount": "15000000000000000000",
                "token_id": 65535
            }
        ],
        "deposit_id": "000000000000000000000000000000000000000000000000000000000117987c",
        "signature": {
            "chain_id": 714,
            "signature_data": "65e0bef7ef3dc20746690d2e50050c345d6e1ee411ca535d187abf4de1bebda05d657065232de9b7e1d76f02c40cd0cd54bbd9ce0162cc1089b756dadb443ee31c",
            "public_key": null
        },
        "owner_address": {
            "chain_id": 714,
            "address": "0x000000000000000000000000aaf9cb43102654126aeff96a4ad25f23e7c969a2"
        },
        "token_symbol": "TUSDT",
        "token_decimals": 18,
        "lang": 2
    };
    
    // 3. 生成签名消息
    logger.info('🔍 生成Commitment签名消息...');
    
    const signatureMessage = commitmentManager.generateFullSignMessage(
        commitmentData.allocations,
        commitmentData.deposit_id,
        commitmentData.token_symbol,
        commitmentData.token_decimals,
        commitmentData.owner_address,
        commitmentData.lang
    );
    
    console.log('\n🔍 生成的签名消息:');
    console.log('=====================================');
    console.log(signatureMessage);
    console.log('=====================================');
    console.log(`消息长度: ${signatureMessage.length} 字符`);
    console.log(`消息十六进制: 0x${Buffer.from(signatureMessage, 'utf8').toString('hex')}`);
    
    // 4. 如果有KMS配置，测试KMS签名
    if (process.env.KMS_BASE_URL) {
        try {
            logger.info('🔐 使用KMS测试签名...');
            
            // 使用测试密钥配置
            const kmsConfig = {
                baseURL: process.env.KMS_BASE_URL || 'http://localhost:18082',
                keyAlias: 'test_commitment_signature',
                encryptedKey: 'test_encrypted_key',
                slip44Id: 714,
                address: '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2',
                defaultSignatureType: 'eip191'
            };
            
            const kmsAdapter = new ZKPayKMSAdapter(kmsConfig, logger);
            
            // 注意：这需要实际的KMS服务和有效的加密密钥
            // const signature = await kmsAdapter.signMessage(signatureMessage, kmsConfig.address);
            // logger.info(`✅ KMS签名结果: ${signature}`);
            
            logger.warn('⚠️ KMS签名测试需要有效的加密密钥，跳过实际签名');
            
        } catch (error) {
            logger.error('❌ KMS签名测试失败:', error.message);
        }
    } else {
        logger.info('ℹ️ 未配置KMS_BASE_URL，跳过KMS签名测试');
    }
    
    // 5. 对比已知签名
    const expectedSignature = commitmentData.signature.signature_data;
    logger.info(`🎯 期望的签名: ${expectedSignature}`);
    
    // 6. 计算消息哈希（用于验证）
    const crypto = require('crypto');
    const messageBuffer = Buffer.from(signatureMessage, 'utf8');
    const messageHash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
    logger.info(`📝 消息SHA256哈希: ${messageHash}`);
    
    return {
        message: signatureMessage,
        messageHex: '0x' + Buffer.from(signatureMessage, 'utf8').toString('hex'),
        messageLength: signatureMessage.length,
        messageHash,
        expectedSignature
    };
}

// 运行测试
if (require.main === module) {
    testCommitmentSignature()
        .then(result => {
            console.log('\n✅ 测试完成');
            console.log('📊 结果摘要:');
            console.log(`  消息长度: ${result.messageLength}`);
            console.log(`  消息哈希: ${result.messageHash}`);
            console.log(`  期望签名: ${result.expectedSignature}`);
        })
        .catch(error => {
            console.error('❌ 测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testCommitmentSignature };
