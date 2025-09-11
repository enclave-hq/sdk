#!/usr/bin/env node

// 简化的ZKPay SDK测试

require('dotenv').config();
const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');

async function simpleTest() {
    const logger = createLogger('SimpleTest');
    
    console.log('🚀 开始简化测试...\n');
    
    try {
        // 基本配置
        const config = {
            services: {
                zkpay_backend: {
                    url: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                    timeout: 300000
                }
            }
        };

        // 创建客户端
        const client = new ZKPayClient(config, logger);
        await client.initialize();
        console.log('✅ 客户端初始化成功');

        // 登录
        const privateKey = process.env.TEST_USER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('请设置环境变量 TEST_USER_PRIVATE_KEY');
        }
        
        await client.login(privateKey);
        console.log('✅ 用户登录成功');

        // 测试获取Token信息
        const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'; // BSC Testnet USDT
        const tokenInfo = await client.getTokenInfo(56, tokenAddress);
        console.log(`✅ Token信息: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);

        // 测试检查余额
        const balance = await client.checkTokenBalance(56, tokenAddress);
        console.log(`✅ Token余额: ${balance.formatted} ${balance.symbol}`);

        console.log('\n🎉 所有测试通过！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

simpleTest();
