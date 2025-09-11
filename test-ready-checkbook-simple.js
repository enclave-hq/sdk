#!/usr/bin/env node

/**
 * 测试使用现有ready CheckBook执行完整的ZKSDK流程
 */

const { ZKPayClient } = require('./core/zkpay-client-library.js');
const yaml = require('js-yaml');
const fs = require('fs');
const { createLogger } = require('./examples/logger');

const logger = createLogger('ReadyCheckBookTest');

async function testReadyCheckBook() {
    try {
        logger.info('🚀 开始测试现有ready CheckBook的完整ZKSDK流程...');
        
        // 使用现有的ready CheckBook
        const testCheckBookId = "e33ef2f5-42b5-4d46-9f0d-62d324552ab7";
        const recipientAddress = '0x742d35Cc6634C0532925a3b8D9C9C4F0e5b1D1F2';
        const transferAmount = '10000000000'; // 10000 USDT (6位小数)
        
        logger.info(`📋 使用CheckBook: ${testCheckBookId}`);
        logger.info(`🎯 接收地址: ${recipientAddress}`);
        logger.info(`💸 转账金额: ${transferAmount} (10000 USDT)`);
        
        // 1. 初始化ZKPayClient
        logger.info('🔧 初始化ZKPayClient...');
        
        // 加载配置
        const configContent = fs.readFileSync('./examples/config.yaml', 'utf8');
        const processedContent = configContent.replace(/\${([^}]+)}/g, (match, envVar) => {
            const [varName, defaultValue] = envVar.split(':-');
            return process.env[varName] || defaultValue || match;
        });
        const config = yaml.load(processedContent);
        
        // 使用Master Operator私钥
        const privateKey = process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY?.startsWith('0x') 
            ? process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY 
            : `0x${process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY}`;
            
        config.test_users.default.private_key = privateKey;
        
        // 修复API URL
        if (config.services.zkpay_backend.url.endsWith('/api/v2')) {
            config.services.zkpay_backend.url = config.services.zkpay_backend.url.replace('/api/v2', '');
        }
        
        const zkpayClient = new ZKPayClient(config, logger);
        await zkpayClient.initialize();
        await zkpayClient.login(privateKey);
        
        logger.info('✅ ZKPayClient初始化完成');
        
        // 2. 执行Commitment
        logger.info('📋 步骤1: 执行Commitment...');
        
        const allocations = [{
            recipient_chain_id: 714,
            recipient_address: recipientAddress,
            amount: transferAmount
        }];
        
        const commitmentResult = await zkpayClient.executeCommitmentSync(
            testCheckBookId,
            allocations,
            true // 等待with_checkbook状态
        );
        
        if (!commitmentResult.success) {
            throw new Error(`Commitment失败: ${commitmentResult.error}`);
        }
        
        logger.info('✅ Commitment执行成功');
        logger.info(`🔗 Commitment哈希: ${commitmentResult.commitmentHash}`);
        
        // 3. 执行Withdraw
        logger.info('🔄 步骤2: 执行Withdraw...');
        
        const recipientInfo = {
            chain_id: 714,
            recipient_address: recipientAddress,
            amount: transferAmount,
            token_symbol: 'test_usdt'
        };
        
        const withdrawResult = await zkpayClient.withdraw(
            testCheckBookId,
            recipientInfo
        );
        
        if (!withdrawResult.success) {
            throw new Error(`Withdraw失败: ${withdrawResult.error}`);
        }
        
        logger.info('✅ Withdraw执行成功');
        logger.info(`🎫 Check ID: ${withdrawResult.checkId}`);
        
        // 4. 执行Payout
        logger.info('💰 步骤3: 执行Payout...');
        
        const payoutResult = await zkpayClient.payout(
            withdrawResult.checkId,
            recipientAddress,
            714
        );
        
        if (!payoutResult.success) {
            throw new Error(`Payout失败: ${payoutResult.error}`);
        }
        
        logger.info('✅ Payout执行成功');
        logger.info(`🔗 交易哈希: ${payoutResult.txHash}`);
        
        // 5. 完成总结
        logger.info('🎉 完整ZKSDK流程执行成功！');
        logger.info('📋 执行步骤总结:');
        logger.info(`   1. ✅ Commitment: ${commitmentResult.commitmentHash}`);
        logger.info(`   2. ✅ Withdraw: ${withdrawResult.checkId}`);
        logger.info(`   3. ✅ Payout: ${payoutResult.txHash}`);
        logger.info(`💸 成功转账 10000 USDT 到 ${recipientAddress}`);
        
        return {
            success: true,
            checkbookId: testCheckBookId,
            commitmentHash: commitmentResult.commitmentHash,
            checkId: withdrawResult.checkId,
            txHash: payoutResult.txHash
        };
        
    } catch (error) {
        logger.error('❌ 测试失败:', error.message);
        logger.error('错误详情:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 运行测试
testReadyCheckBook()
    .then(result => {
        if (result.success) {
            console.log('🎉 测试成功完成！');
            process.exit(0);
        } else {
            console.log('❌ 测试失败');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ 测试异常:', error);
        process.exit(1);
    });

