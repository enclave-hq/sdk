#!/usr/bin/env node

// 测试使用submission_failed状态的checkbook重试commitment

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');
const fs = require('fs');

async function testCommitmentWithFailedCheckbook() {
    const logger = createLogger('TestCommitment');
    
    try {
        // 从环境变量获取私钥和接收地址
        const testPrivateKey = process.env.TEST_PRIVATE_KEY;
        const recipientAddress = process.env.TEST_RECIPIENT_ADDRESS;
        
        if (!testPrivateKey || testPrivateKey === 'YOUR_TEST_PRIVATE_KEY_HERE') {
            throw new Error('请在.env文件中设置TEST_PRIVATE_KEY环境变量');
        }
        
        if (!recipientAddress) {
            throw new Error('请在.env文件中设置TEST_RECIPIENT_ADDRESS环境变量');
        }

        // 使用参数化配置
        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            }
        };
        
        // 创建客户端
        const client = new ZKPayClient(logger, options);
        await client.initialize();
        
        // 登录
        const loginResult = await client.login(testPrivateKey);
        const userAddress = loginResult.address;
        
        logger.info(`👤 使用私钥对应的地址: ${userAddress}`);
        
        // 获取用户存款记录
        const deposits = await client.getUserDeposits(userAddress);
        logger.info('📊 找到存款记录数:', deposits.length);
        
        // 查找submission_failed状态的checkbook
        const failedCheckbooks = deposits.filter(d => d.status === 'submission_failed');
        logger.info('❌ submission_failed状态记录数:', failedCheckbooks.length);
        
        if (failedCheckbooks.length > 0) {
            const checkbook = failedCheckbooks[0];
            logger.info('🎯 使用submission_failed状态的checkbook重试commitment:');
            logger.info('  Checkbook ID:', checkbook.checkbookId);
            logger.info('  Status:', checkbook.status);
            logger.info('  Token ID:', checkbook.tokenId);
            logger.info('  Amount:', checkbook.grossAmount);
            
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: recipientAddress,
                amount: '10000000000000000000' // 10.0 USDT (18 decimals)
            }];
            
            logger.info('🚀 开始重试commitment...');
            
            // 直接执行commitment（不等待状态变化）
            const result = await client.executeCommitmentSync(
                checkbook.checkbookId,
                allocations,
                false // 不等待with_checkbook状态
            );
            
            logger.info('✅ Commitment重试结果:', result);
            
        } else {
            logger.info('❌ 没有找到submission_failed状态的checkbook');
            logger.info('可用状态:', [...new Set(deposits.map(d => d.status))]);
        }
        
    } catch (error) {
        logger.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    }
}

testCommitmentWithFailedCheckbook();

