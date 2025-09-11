/**
 * 测试ZKPay Client Library的异步功能
 * 演示如何使用异步方法等待操作完成或超时
 */

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const fs = require('fs');

async function testAsyncFeatures() {
    try {
        console.log('🚀 ZKPay Client Library 异步功能测试\n');

        // 1. 初始化客户端（使用参数化配置）
        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            }
        };
        
        const client = new ZKPayClient(null, options);
        await client.initialize();
        
        const privateKey = process.env.TEST_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('请设置环境变量 TEST_PRIVATE_KEY');
        }
        await client.login(privateKey);
        
        console.log('✅ 客户端初始化完成\n');

        // 2. 获取现有的checkbook用于测试
        const deposits = await client.getUserDeposits();
        const readyDeposit = deposits.find(d => d.status === 'ready_for_commitment');
        
        if (!readyDeposit) {
            console.log('❌ 未找到ready_for_commitment状态的存款记录，请先执行存款操作');
            return;
        }

        console.log(`📋 使用CheckBook: ${readyDeposit.checkbookId}\n`);

        // 3. 测试Commitment异步功能
        console.log('🧪 测试 Commitment 异步功能...');
        
        const allocations = [
            {
                recipient_chain_id: 56,
                recipient_address: client.getCurrentUser().address,
                amount: "1800000", // 1.8 USDT
            }
        ];

        // 异步提交commitment（立即返回）
        const commitmentResult = await client.executeCommitmentAsync(
            readyDeposit.checkbookId,
            allocations
        );

        console.log('✅ Commitment异步提交成功:');
        console.log(`   状态: ${commitmentResult.status}`);
        console.log(`   Commitment哈希: ${commitmentResult.commitmentHash}`);
        console.log('');

        // 方法1: 使用waitForCompletion轮询状态
        console.log('📊 方法1: 使用waitForCompletion轮询状态...');
        try {
            const pollingResult = await commitmentResult.waitForCompletion(['with_checkbook'], 180);
            console.log(`✅ 轮询完成: 状态变为 ${pollingResult.status}`);
        } catch (error) {
            console.log(`❌ 轮询超时: ${error.message}`);
        }
        console.log('');

        // 方法2: 使用waitUntilCompleted等待完成并获取完整结果
        console.log('📊 方法2: 使用waitUntilCompleted等待完成...');
        try {
            const finalResult = await commitmentResult.waitUntilCompleted(['with_checkbook'], 180);
            console.log('✅ 等待完成，获取最终结果:');
            console.log(`   最终状态: ${finalResult.finalStatus}`);
            console.log(`   Commitment哈希: ${finalResult.commitmentHash}`);
            console.log(`   完成时间: ${finalResult.completedAt}`);
        } catch (error) {
            console.log(`❌ 等待超时: ${error.message}`);
        }
        console.log('');

        // 4. 测试提现异步功能
        const withCheckbookDeposit = deposits.find(d => d.status === 'with_checkbook');
        if (withCheckbookDeposit) {
            console.log('🧪 测试 提现 异步功能...');
            console.log(`📋 使用CheckBook: ${withCheckbookDeposit.checkbookId}\n`);

            // 异步提交提现（立即返回）
            const recipientAddress = process.env.TEST_RECIPIENT_ADDRESS || '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce';
            const withdrawResult = await client.generateProofAsync(
                withCheckbookDeposit.checkbookId,
                [{
                    recipient_chain_id: 56,
                    recipient_address: recipientAddress,
                    amount: "1800000"
                }]
            );

            console.log('✅ 提现异步提交成功:');
            console.log(`   Check ID: ${withdrawResult.checkId}`);
            console.log(`   状态: ${withdrawResult.status || '证明生成中'}`);
            console.log('');

            // 方法1: 检查当前状态
            console.log('📊 方法1: 检查当前状态...');
            try {
                const currentStatus = await withdrawResult.checkStatus();
                console.log(`📈 当前状态: ${JSON.stringify(currentStatus, null, 2)}`);
            } catch (error) {
                console.log(`❌ 状态查询失败: ${error.message}`);
            }
            console.log('');

            // 方法2: 等待完成并获取交易哈希
            console.log('📊 方法2: 等待提现完成并获取交易哈希...');
            try {
                const finalWithdrawResult = await withdrawResult.waitUntilCompleted(300);
                console.log('✅ 提现完成，获取最终结果:');
                console.log(`   最终状态: ${finalWithdrawResult.finalStatus}`);
                console.log(`   交易哈希: ${finalWithdrawResult.transactionHash}`);
                console.log(`   完成时间: ${finalWithdrawResult.completedAt}`);
            } catch (error) {
                console.log(`❌ 提现等待超时: ${error.message}`);
            }
        }

        console.log('\n🎉 异步功能测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response && error.response.data) {
            console.error('API错误详情:', error.response.data);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testAsyncFeatures();
}

module.exports = { testAsyncFeatures };
