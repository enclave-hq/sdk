#!/usr/bin/env node

// TestKMSPrivate Key导入Function
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const { createLogger } = require('./logger');

async function testKMSImport() {
    const logger = createLogger('KMSImportTest');
    
    // Generate一个TestPrivate Key（你Can替换为真实Private Key）
    const testPrivateKey = '0x' + crypto.randomBytes(32).toString('hex');
    logger.info(`🔑 TestPrivate Key: ${testPrivateKey.slice(0, 10)}...`);
    
    const kmsBaseURL = process.env.KMS_BASE_URL || 'http://localhost:18082';
    const keyAlias = `import_test_${Date.now()}`;
    
    const encryptRequest = {
        private_key: testPrivateKey,
        key_alias: keyAlias,
        chain_id: 714 // BSC
    };

    try {
        logger.info('📡 向KMSSendPrivate Key导入Request...');
        const response = await axios.post(`${kmsBaseURL}/api/v1/encrypt`, encryptRequest, {
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                'X-Service-Name': 'zksdk'
            },
            timeout: 30000
        });

        if (response.data.success) {
            logger.info('✅ KMSPrivate Key导入successful:');
            logger.info(`  🔑 KeyAlias: ${keyAlias}`);
            logger.info(`  📍 GenerateAddress: ${response.data.public_address}`);
            logger.info(`  🔐 EncryptionKey: ${response.data.encrypted_key.slice(0, 20)}...`);
            
            // TestSignatureFunction
            const testMessage = "Hello KMS!";
            const signRequest = {
                key_alias: keyAlias,
                data: testMessage,
                signature_type: "eip191"
            };
            
            logger.info('🔐 TestSignatureFunction...');
            const signResponse = await axios.post(`${kmsBaseURL}/api/v1/sign`, signRequest, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                    'X-Service-Name': 'zksdk'
                }
            });
            
            if (signResponse.data.success) {
                logger.info('✅ KMSSignatureTestsuccessful:');
                logger.info(`  📝 Signature: ${signResponse.data.signature}`);
            } else {
                logger.error('❌ KMSSignatureTestfailed:', signResponse.data.error);
            }
            
        } else {
            logger.error('❌ KMSPrivate Key导入failed:', response.data.error);
        }

    } catch (error) {
        logger.error('❌ KMSTestfailed:', error.response?.data || error.message);
    }
}

// If直接Run此脚本
if (require.main === module) {
    testKMSImport().catch(console.error);
}

module.exports = { testKMSImport };
