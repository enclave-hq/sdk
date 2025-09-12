#!/usr/bin/env node

// KMS密钥初始化完整示例
// 演示如何从零开始在KMS中创建和管理密钥

const { ZKPayKMSSigner, ZKPayKMSSignerFactory } = require('../utils/zkpay-kms-adapter');
const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../logger');
const crypto = require('crypto');
const axios = require('axios');

/**
 * 示例1: 生成新私钥并在KMS中初始化
 */
async function initializeNewKeyInKMS() {
    const logger = createLogger('KMSKeyInit');
    logger.info('🚀 示例1: 生成新私钥并在KMS中初始化');

    try {
        // 1. 生成新的私钥
        const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
        logger.info(`🔑 生成新私钥: ${privateKey.slice(0, 10)}...`);

        // 2. 配置KMS初始化参数
        const initConfig = {
            baseURL: 'http://localhost:18082',
            privateKey: privateKey,
            keyAlias: `zksdk_${Date.now()}`, // 使用时间戳确保唯一性
            slip44Id: 714, // BSC网络
            timeout: 30000,
            // 可选的认证配置
            bearerToken: process.env.KMS_BEARER_TOKEN,
            serviceKey: process.env.KMS_SERVICE_KEY
        };

        logger.info(`📝 KMS配置:`, {
            keyAlias: initConfig.keyAlias,
            slip44Id: initConfig.slip44Id,
            baseURL: initConfig.baseURL
        });

        // 3. 调用KMS加密接口初始化密钥
        logger.info('🔐 正在向KMS发送加密请求...');
        
        const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(initConfig, logger);
        
        logger.info('✅ 密钥已成功在KMS中初始化');
        logger.info(`📍 生成的地址: ${kmsSigner.getAddress()}`);
        logger.info(`🔗 链信息: ${JSON.stringify(kmsSigner.getChainInfo(714))}`);
        logger.info(`📋 签名类型: ${kmsSigner.config.defaultSignatureType}`);

        return {
            signer: kmsSigner,
            keyAlias: initConfig.keyAlias,
            address: kmsSigner.getAddress(),
            encryptedKey: kmsSigner.config.encryptedKey
        };

    } catch (error) {
        logger.error('❌ KMS密钥初始化失败:', error.message);
        
        // 提供详细的错误诊断
        if (error.response) {
            logger.error('🔍 KMS服务响应:', error.response.data);
            logger.error('📡 HTTP状态码:', error.response.status);
        } else if (error.request) {
            logger.error('🔍 网络连接失败，请检查KMS服务是否运行在 http://localhost:18082');
        }
        
        throw error;
    }
}

/**
 * 示例2: 批量初始化多链密钥
 */
async function initializeMultiChainKeys() {
    const logger = createLogger('MultiChainInit');
    logger.info('🚀 示例2: 批量初始化多链密钥');

    const chains = [
        { name: 'Ethereum', slip44Id: 60, signatureType: 'eip191' },
        { name: 'BSC', slip44Id: 714, signatureType: 'eip191' },
        { name: 'Tron', slip44Id: 195, signatureType: 'tip191t' },
        { name: 'Polygon', slip44Id: 966, signatureType: 'eip191' }
    ];

    const results = [];

    for (const chain of chains) {
        try {
            logger.info(`\n🔗 初始化 ${chain.name} 密钥 (SLIP44: ${chain.slip44Id})`);

            // 为每条链生成独立的私钥
            const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
            const keyAlias = `${chain.name.toLowerCase()}_key_${Date.now()}`;

            const initConfig = {
                baseURL: 'http://localhost:18082',
                privateKey: privateKey,
                keyAlias: keyAlias,
                slip44Id: chain.slip44Id,
                defaultSignatureType: chain.signatureType,
                timeout: 30000
            };

            // 调用KMS初始化
            const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(initConfig, logger);

            logger.info(`  ✅ ${chain.name} 密钥初始化成功`);
            logger.info(`  📍 地址: ${kmsSigner.getAddress()}`);
            logger.info(`  🔐 密钥别名: ${keyAlias}`);

            results.push({
                chain: chain.name,
                slip44Id: chain.slip44Id,
                keyAlias: keyAlias,
                address: kmsSigner.getAddress(),
                signatureType: chain.signatureType,
                status: 'SUCCESS'
            });

            // 添加延迟避免KMS服务过载
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            logger.error(`  ❌ ${chain.name} 密钥初始化失败: ${error.message}`);
            
            results.push({
                chain: chain.name,
                slip44Id: chain.slip44Id,
                status: 'FAILED',
                error: error.message
            });
        }
    }

    logger.info('\n📊 多链密钥初始化结果:');
    console.table(results);

    return results;
}

/**
 * 示例3: 从现有私钥在KMS中创建密钥
 */
async function initializeFromExistingPrivateKey() {
    const logger = createLogger('ExistingKeyInit');
    logger.info('🚀 示例3: 从现有私钥在KMS中创建密钥');

    try {
        // 使用现有的私钥（实际应用中从安全存储获取）
        const existingPrivateKey = process.env.EXISTING_PRIVATE_KEY || 
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

        logger.info('🔑 使用现有私钥进行KMS初始化');
        
        // 支持多种网络的初始化
        const networkConfigs = [
            {
                name: 'BSC主网',
                slip44Id: 714,
                keyAlias: 'production_bsc_key'
            },
            {
                name: 'Tron主网', 
                slip44Id: 195,
                keyAlias: 'production_tron_key'
            }
        ];

        const initializedKeys = [];

        for (const config of networkConfigs) {
            logger.info(`\n🔗 在 ${config.name} 上初始化密钥`);

            const initConfig = {
                baseURL: 'http://localhost:18082',
                privateKey: existingPrivateKey,
                keyAlias: config.keyAlias,
                slip44Id: config.slip44Id,
                timeout: 30000
            };

            try {
                const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(initConfig, logger);

                logger.info(`  ✅ ${config.name} 密钥初始化成功`);
                logger.info(`  📍 地址: ${kmsSigner.getAddress()}`);
                logger.info(`  🔐 别名: ${config.keyAlias}`);

                initializedKeys.push({
                    network: config.name,
                    signer: kmsSigner,
                    keyAlias: config.keyAlias
                });

            } catch (error) {
                logger.warn(`  ⚠️ ${config.name} 初始化失败: ${error.message}`);
            }
        }

        return initializedKeys;

    } catch (error) {
        logger.error('❌ 从现有私钥初始化失败:', error.message);
        throw error;
    }
}

/**
 * 示例4: KMS密钥状态检查和验证
 */
async function verifyKMSKeyStatus() {
    const logger = createLogger('KMSKeyVerify');
    logger.info('🚀 示例4: KMS密钥状态检查和验证');

    try {
        // 测试密钥配置
        const testKeys = [
            {
                keyAlias: 'test_bsc_key',
                encryptedKey: 'mock_encrypted_key_bsc',
                slip44Id: 714,
                address: '0x1234567890123456789012345678901234567890'
            },
            {
                keyAlias: 'test_tron_key', 
                encryptedKey: 'mock_encrypted_key_tron',
                slip44Id: 195,
                address: 'TRON1234567890123456789012345678901234'
            }
        ];

        const verificationResults = [];

        for (const keyConfig of testKeys) {
            logger.info(`\n🔍 验证密钥: ${keyConfig.keyAlias}`);

            try {
                // 创建签名器实例
                const kmsSigner = new ZKPayKMSSigner({
                    baseURL: 'http://localhost:18082',
                    ...keyConfig
                }, logger);

                // 检查配置
                const chainInfo = kmsSigner.getChainInfo(keyConfig.slip44Id);
                const signatureType = kmsSigner.config.defaultSignatureType;

                logger.info(`  ✅ 配置有效`);
                logger.info(`  🔗 链: ${chainInfo.name} (${chainInfo.nativeCoin})`);
                logger.info(`  📋 签名类型: ${signatureType}`);
                logger.info(`  📍 地址: ${keyConfig.address}`);

                // 尝试测试签名（模拟）
                logger.info(`  🧪 签名能力测试: 准备就绪`);

                verificationResults.push({
                    keyAlias: keyConfig.keyAlias,
                    chain: chainInfo.name,
                    slip44Id: keyConfig.slip44Id,
                    signatureType: signatureType,
                    status: 'VERIFIED'
                });

            } catch (error) {
                logger.error(`  ❌ 验证失败: ${error.message}`);
                
                verificationResults.push({
                    keyAlias: keyConfig.keyAlias,
                    slip44Id: keyConfig.slip44Id,
                    status: 'FAILED',
                    error: error.message
                });
            }
        }

        logger.info('\n📊 密钥验证结果:');
        console.table(verificationResults);

        return verificationResults;

    } catch (error) {
        logger.error('❌ KMS密钥验证失败:', error.message);
        throw error;
    }
}

/**
 * 示例5: KMS服务连接测试
 */
async function testKMSServiceConnection() {
    const logger = createLogger('KMSConnection');
    logger.info('🚀 示例5: KMS服务连接测试');

    const kmsBaseURL = 'http://localhost:18082';

    try {
        // 1. 测试KMS服务是否运行
        logger.info('🔍 检查KMS服务连接...');
        
        const client = axios.create({
            baseURL: kmsBaseURL,
            timeout: 5000
        });

        // 测试健康检查端点
        try {
            const healthResponse = await client.get('/health');
            logger.info('✅ KMS服务健康检查通过:', healthResponse.data);
        } catch (error) {
            logger.warn('⚠️ 健康检查端点不可用，尝试其他端点...');
        }

        // 2. 测试API端点可用性
        const endpoints = [
            { path: '/api/v1/encrypt', method: 'POST', name: '密钥加密' },
            { path: '/api/v1/sign', method: 'POST', name: '消息签名' },
            { path: '/api/v1/sign-transaction', method: 'POST', name: '交易签名' }
        ];

        const endpointResults = [];

        for (const endpoint of endpoints) {
            try {
                // 发送测试请求（预期会因参数不足而失败，但证明端点存在）
                await client[endpoint.method.toLowerCase()](endpoint.path, {});
                
                endpointResults.push({
                    endpoint: endpoint.path,
                    name: endpoint.name,
                    status: 'AVAILABLE'
                });

            } catch (error) {
                if (error.response && error.response.status !== 404) {
                    // 非404错误说明端点存在但参数有问题，这是预期的
                    endpointResults.push({
                        endpoint: endpoint.path,
                        name: endpoint.name,
                        status: 'AVAILABLE',
                        note: '端点可用（参数验证失败为正常现象）'
                    });
                } else {
                    endpointResults.push({
                        endpoint: endpoint.path,
                        name: endpoint.name,
                        status: 'NOT_FOUND'
                    });
                }
            }
        }

        logger.info('\n📊 KMS API端点检查结果:');
        console.table(endpointResults);

        // 3. 连接总结
        const availableEndpoints = endpointResults.filter(r => r.status === 'AVAILABLE').length;
        const totalEndpoints = endpointResults.length;

        logger.info(`\n📈 连接总结:`);
        logger.info(`  KMS服务地址: ${kmsBaseURL}`);
        logger.info(`  可用端点: ${availableEndpoints}/${totalEndpoints}`);
        
        if (availableEndpoints === totalEndpoints) {
            logger.info(`  ✅ KMS服务完全可用，可以进行密钥初始化`);
        } else {
            logger.warn(`  ⚠️ 部分端点不可用，请检查KMS服务版本`);
        }

        return {
            serviceAvailable: availableEndpoints > 0,
            endpointResults: endpointResults,
            baseURL: kmsBaseURL
        };

    } catch (error) {
        logger.error('❌ KMS服务连接失败:', error.message);
        logger.error('🔧 请确保KMS服务正在运行在:', kmsBaseURL);
        
        return {
            serviceAvailable: false,
            error: error.message,
            baseURL: kmsBaseURL
        };
    }
}

/**
 * 主函数：运行所有KMS密钥初始化示例
 */
async function runAllKMSInitializationExamples() {
    console.log('🌟 KMS密钥初始化完整示例');
    console.log('=====================================');

    try {
        // 1. 首先测试KMS服务连接
        const connectionTest = await testKMSServiceConnection();
        
        if (!connectionTest.serviceAvailable) {
            console.log('❌ KMS服务不可用，跳过密钥初始化示例');
            console.log('💡 请先启动KMS服务，然后重新运行此示例');
            return;
        }

        // 2. 验证现有密钥状态
        await verifyKMSKeyStatus();

        // 3. 生成新密钥并初始化（如果KMS服务可用）
        if (process.env.ENABLE_REAL_KMS_INIT === 'true') {
            await initializeNewKeyInKMS();
            await initializeMultiChainKeys();
            await initializeFromExistingPrivateKey();
        } else {
            console.log('\n💡 要启用真实的KMS初始化，请设置环境变量:');
            console.log('   export ENABLE_REAL_KMS_INIT=true');
        }

        console.log('\n✅ 所有KMS密钥初始化示例演示完成！');

    } catch (error) {
        console.error('❌ KMS初始化示例运行失败:', error.message);
        throw error;
    }
}

// 导出所有示例函数
module.exports = {
    initializeNewKeyInKMS,
    initializeMultiChainKeys,
    initializeFromExistingPrivateKey,
    verifyKMSKeyStatus,
    testKMSServiceConnection,
    runAllKMSInitializationExamples
};

// 如果直接运行此文件
if (require.main === module) {
    runAllKMSInitializationExamples()
        .then(() => {
            console.log('\n🎉 示例运行完成');
        })
        .catch(error => {
            console.error('💥 示例运行异常:', error);
            process.exit(1);
        });
}
