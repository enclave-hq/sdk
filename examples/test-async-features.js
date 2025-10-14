/**
 * TestZKPay Client Library的异步Function
 * Demo如何Use异步MethodWaitOperationcompleted或超时
 */

// 加载Environment变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const fs = require('fs');

async function testAsyncFeatures() {
    try {
        console.log('🚀 ZKPay Client Library 异步FunctionTest\n');

        // 1. 初始化客户端（Use参数化Configuration）
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
            throw new Error('Please设置Environment变量 TEST_PRIVATE_KEY');
        }
        await client.login(privateKey);
        
        console.log('✅ 客户端初始化completed\n');

        // 2. GetExisting的checkbook用于Test
        const deposits = await client.getUserDeposits();
        const readyDeposit = deposits.find(d => d.status === 'ready_for_commitment');
        
        if (!readyDeposit) {
            console.log('❌ 未找到ready_for_commitmentStatus的Deposit记录，Please先ExecuteDepositOperation');
            return;
        }

        console.log(`📋 UseCheckBook: ${readyDeposit.checkbookId}\n`);

        // 3. TestCommitment异步Function
        console.log('🧪 Test Commitment 异步Function...');
        
        const allocations = [
            {
                recipient_chain_id: 714,  // SLIP44 BSC
                recipient_address: client.getCurrentUser().address,
                amount: "1800000", // 1.8 USDT
            }
        ];

        // 异步提交commitment（Immediate返回）
        const commitmentResult = await client.executeCommitmentAsync(
            readyDeposit.checkbookId,
            allocations
        );

        console.log('✅ Commitment异步提交successful:');
        console.log(`   Status: ${commitmentResult.status}`);
        console.log(`   CommitmentHash: ${commitmentResult.commitmentHash}`);
        console.log('');

        // Method1: UsewaitForCompletion轮询Status
        console.log('📊 Method1: UsewaitForCompletion轮询Status...');
        try {
            const pollingResult = await commitmentResult.waitForCompletion(['with_checkbook'], 180);
            console.log(`✅ 轮询completed: Status变为 ${pollingResult.status}`);
        } catch (error) {
            console.log(`❌ 轮询超时: ${error.message}`);
        }
        console.log('');

        // Method2: UsewaitUntilCompletedWaitcompleted并Get完整Result
        console.log('📊 Method2: UsewaitUntilCompletedWaitcompleted...');
        try {
            const finalResult = await commitmentResult.waitUntilCompleted(['with_checkbook'], 180);
            console.log('✅ Waitcompleted，GetFinalResult:');
            console.log(`   FinalStatus: ${finalResult.finalStatus}`);
            console.log(`   CommitmentHash: ${finalResult.commitmentHash}`);
            console.log(`   completed时间: ${finalResult.completedAt}`);
        } catch (error) {
            console.log(`❌ Wait超时: ${error.message}`);
        }
        console.log('');

        // 4. Test提现异步Function
        const withCheckbookDeposit = deposits.find(d => d.status === 'with_checkbook');
        if (withCheckbookDeposit) {
            console.log('🧪 Test 提现 异步Function...');
            console.log(`📋 UseCheckBook: ${withCheckbookDeposit.checkbookId}\n`);

            // 异步提交提现（Immediate返回）
            const recipientAddress = process.env.TEST_RECIPIENT_ADDRESS || '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce';
            const withdrawResult = await client.generateProofAsync(
                withCheckbookDeposit.checkbookId,
                [{
                    recipient_chain_id: 714,  // SLIP44 BSC
                    recipient_address: recipientAddress,
                    amount: "1800000"
                }]
            );

            console.log('✅ 提现异步提交successful:');
            console.log(`   Check ID: ${withdrawResult.checkId}`);
            console.log(`   Status: ${withdrawResult.status || '证明Generate中'}`);
            console.log('');

            // Method1: Check当前Status
            console.log('📊 Method1: Check当前Status...');
            try {
                const currentStatus = await withdrawResult.checkStatus();
                console.log(`📈 当前Status: ${JSON.stringify(currentStatus, null, 2)}`);
            } catch (error) {
                console.log(`❌ StatusQueryfailed: ${error.message}`);
            }
            console.log('');

            // Method2: Waitcompleted并Get交易Hash
            console.log('📊 Method2: Wait提现completed并Get交易Hash...');
            try {
                const finalWithdrawResult = await withdrawResult.waitUntilCompleted(300);
                console.log('✅ 提现completed，GetFinalResult:');
                console.log(`   FinalStatus: ${finalWithdrawResult.finalStatus}`);
                console.log(`   交易Hash: ${finalWithdrawResult.transactionHash}`);
                console.log(`   completed时间: ${finalWithdrawResult.completedAt}`);
            } catch (error) {
                console.log(`❌ 提现Wait超时: ${error.message}`);
            }
        }

        console.log('\n🎉 异步FunctionTestcompleted！');

    } catch (error) {
        console.error('❌ Testfailed:', error.message);
        if (error.response && error.response.data) {
            console.error('APIErrorDetails:', error.response.data);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testAsyncFeatures();
}

module.exports = { testAsyncFeatures };
