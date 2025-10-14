/**
 * TestCommitmentSignatureMessageGenerate和KMSSignature
 */

const { ZKPayCommitmentManager } = require('../managers/zkpay-commitment-manager');
const { createLogger } = require('../utils/logger');
const ZKPayKMSAdapter = require('../utils/zkpay-kms-adapter');

async function testCommitmentSignature() {
    const logger = createLogger('TestCommitmentSignature');
    
    // 1. CreateCommitmentManagement器（Mock）
    const mockWalletManager = {
        getUserAddress: () => '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2'
    };
    
    const commitmentManager = new ZKPayCommitmentManager(mockWalletManager, logger);
    
    // 2. 根据Provide的commitmentInformation构造SignatureMessage
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
    
    // 3. GenerateSignatureMessage
    logger.info('🔍 GenerateCommitmentSignatureMessage...');
    
    const signatureMessage = commitmentManager.generateFullSignMessage(
        commitmentData.allocations,
        commitmentData.deposit_id,
        commitmentData.token_symbol,
        commitmentData.token_decimals,
        commitmentData.owner_address,
        commitmentData.lang
    );
    
    console.log('\n🔍 Generate的SignatureMessage:');
    console.log('=====================================');
    console.log(signatureMessage);
    console.log('=====================================');
    console.log(`MessageLength: ${signatureMessage.length} Characters`);
    console.log(`MessageHexadecimal: 0x${Buffer.from(signatureMessage, 'utf8').toString('hex')}`);
    
    // 4. 如果有KMSConfiguration，TestKMSSignature
    if (process.env.KMS_BASE_URL) {
        try {
            logger.info('🔐 UseKMSTestSignature...');
            
            // UseTestKeyConfiguration
            const kmsConfig = {
                baseURL: process.env.KMS_BASE_URL || 'http://localhost:18082',
                keyAlias: 'test_commitment_signature',
                encryptedKey: 'test_encrypted_key',
                slip44Id: 714,
                address: '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2',
                defaultSignatureType: 'eip191'
            };
            
            const kmsAdapter = new ZKPayKMSAdapter(kmsConfig, logger);
            
            // 注意：这需要实际的KMSService和有效的EncryptionKey
            // const signature = await kmsAdapter.signMessage(signatureMessage, kmsConfig.address);
            // logger.info(`✅ KMSSignatureResult: ${signature}`);
            
            logger.warn('⚠️ KMSSignatureTest需要有效的EncryptionKey，跳过实际Signature');
            
        } catch (error) {
            logger.error('❌ KMSSignatureTestfailed:', error.message);
        }
    } else {
        logger.info('ℹ️ 未ConfigurationKMS_BASE_URL，跳过KMSSignatureTest');
    }
    
    // 5. Compare已知Signature
    const expectedSignature = commitmentData.signature.signature_data;
    logger.info(`🎯 期望的Signature: ${expectedSignature}`);
    
    // 6. CalculateMessageHash（用于Verify）
    const crypto = require('crypto');
    const messageBuffer = Buffer.from(signatureMessage, 'utf8');
    const messageHash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
    logger.info(`📝 MessageSHA256Hash: ${messageHash}`);
    
    return {
        message: signatureMessage,
        messageHex: '0x' + Buffer.from(signatureMessage, 'utf8').toString('hex'),
        messageLength: signatureMessage.length,
        messageHash,
        expectedSignature
    };
}

// 运行Test
if (require.main === module) {
    testCommitmentSignature()
        .then(result => {
            console.log('\n✅ Testcompleted');
            console.log('📊 ResultSummary:');
            console.log(`  MessageLength: ${result.messageLength}`);
            console.log(`  MessageHash: ${result.messageHash}`);
            console.log(`  期望Signature: ${result.expectedSignature}`);
        })
        .catch(error => {
            console.error('❌ Testfailed:', error);
            process.exit(1);
        });
}

module.exports = { testCommitmentSignature };
