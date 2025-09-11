#!/usr/bin/env node

// 简化的ZKPay SDK测试

require('dotenv').config();
const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');

async function simpleTest() {
    const logger = createLogger('SimpleTest');
    
    console.log('🚀 开始简化测试...\n');
    
    try {
        // 参数化配置
        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            }
        };

        // 创建客户端
        const client = new ZKPayClient(logger, options);
        await client.initialize();
        console.log('✅ 客户端初始化成功');

        // 登录
        const privateKey = process.env.TEST_USER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('请设置环境变量 TEST_USER_PRIVATE_KEY');
        }
        
        await client.login(privateKey);
        console.log('✅ 用户登录成功');

        // 测试检查Token余额（包含Token信息）
        const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'; // BSC Testnet USDT
        const balance = await client.checkTokenBalance(56, tokenAddress);
        console.log(`✅ Token信息: ${balance.symbol} (${balance.name}) - ${balance.decimals} decimals`);
        console.log(`✅ Token余额: ${balance.formatted} ${balance.symbol}`);

        console.log('\n🎉 所有测试通过！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

simpleTest();
