#!/usr/bin/env node

// 简单测试commitment功能

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');

async function testSimpleCommitment() {
    const logger = createLogger('SimpleCommitment');
    
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

        // 创建参数化配置
        const treasuryContracts = new Map([
            [56, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8']
        ]);
        
        const tokenConfigs = new Map([
            ['56_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']
        ]);

        const options = {
            apiConfig: {
                baseURL: 'https://backend.zkpay.network',
                timeout: 300000
            },
            treasuryContracts,
            tokenConfigs,
            confirmationBlocks: 3,
            maxWaitTime: 300000,
            defaultRecipientAddress: recipientAddress
        };
        
        // 创建客户端
        const client = new ZKPayClient(logger, options);
        await client.initialize();
        
        // 登录 - 使用环境变量中的私钥
        const loginResult = await client.login(testPrivateKey);
        const userAddress = loginResult.address;
        
        logger.info(`👤 使用私钥对应的地址: ${userAddress}`);
        
        // 获取用户存款记录
        const deposits = await client.getUserDeposits(userAddress);
        logger.info('📊 找到存款记录数:', deposits.length);
        
        // 显示所有状态
        const statusCounts = {};
        deposits.forEach(d => {
            statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
        });
        logger.info('📊 状态统计:', statusCounts);
        
        // 查找可用的checkbook（优先选择ready_for_commitment，其次submission_failed）
        let targetCheckbook = deposits.find(d => d.status === 'ready_for_commitment');
        if (!targetCheckbook) {
            targetCheckbook = deposits.find(d => d.status === 'submission_failed');
        }
        if (!targetCheckbook) {
            targetCheckbook = deposits[0]; // 使用第一个
        }
        
        if (targetCheckbook) {
            logger.info('🎯 选择checkbook:');
            logger.info('  Checkbook ID:', targetCheckbook.checkbookId);
            logger.info('  Status:', targetCheckbook.status);
            logger.info('  Token ID:', targetCheckbook.tokenId);
            logger.info('  Amount:', targetCheckbook.grossAmount);
            
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: recipientAddress,
                amount: '10000000000000000000' // 10.0 USDT (18 decimals)
            }];
            
            logger.info('🚀 开始执行commitment...');
            
            // 执行commitment
            const result = await client.executeCommitmentSync(
                targetCheckbook.checkbookId,
                allocations,
                false // 不等待with_checkbook状态
            );
            
            logger.info('✅ Commitment执行结果:', result);
            
        } else {
            logger.info('❌ 没有找到可用的checkbook');
        }
        
    } catch (error) {
        logger.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    }
}

testSimpleCommitment();
