#!/usr/bin/env node

// 测试KMS私钥导入功能
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const { createLogger } = require('./logger');

async function testKMSImport() {
    const logger = createLogger('KMSImportTest');
    
    // 生成一个测试私钥（你可以替换为真实私钥）
    const testPrivateKey = '0x' + crypto.randomBytes(32).toString('hex');
    logger.info(`🔑 测试私钥: ${testPrivateKey.slice(0, 10)}...`);
    
    const kmsBaseURL = process.env.KMS_BASE_URL || 'http://localhost:18082';
    const keyAlias = `import_test_${Date.now()}`;
    
    const encryptRequest = {
        private_key: testPrivateKey,
        key_alias: keyAlias,
        chain_id: 714 // BSC
    };

    try {
        logger.info('📡 向KMS发送私钥导入请求...');
        const response = await axios.post(`${kmsBaseURL}/api/v1/encrypt`, encryptRequest, {
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                'X-Service-Name': 'zksdk'
            },
            timeout: 30000
        });

        if (response.data.success) {
            logger.info('✅ KMS私钥导入成功:');
            logger.info(`  🔑 密钥别名: ${keyAlias}`);
            logger.info(`  📍 生成地址: ${response.data.public_address}`);
            logger.info(`  🔐 加密密钥: ${response.data.encrypted_key.slice(0, 20)}...`);
            
            // 测试签名功能
            const testMessage = "Hello KMS!";
            const signRequest = {
                key_alias: keyAlias,
                data: testMessage,
                signature_type: "eip191"
            };
            
            logger.info('🔐 测试签名功能...');
            const signResponse = await axios.post(`${kmsBaseURL}/api/v1/sign`, signRequest, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                    'X-Service-Name': 'zksdk'
                }
            });
            
            if (signResponse.data.success) {
                logger.info('✅ KMS签名测试成功:');
                logger.info(`  📝 签名: ${signResponse.data.signature}`);
            } else {
                logger.error('❌ KMS签名测试失败:', signResponse.data.error);
            }
            
        } else {
            logger.error('❌ KMS私钥导入失败:', response.data.error);
        }

    } catch (error) {
        logger.error('❌ KMS测试失败:', error.response?.data || error.message);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testKMSImport().catch(console.error);
}

module.exports = { testKMSImport };
