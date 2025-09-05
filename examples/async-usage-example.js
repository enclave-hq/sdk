/**
 * ZKPay Client异步方法使用示例
 * 展示如何使用await调用异步方法
 */

async function useAsyncMethods(client) {
    try {
        // 1. Commitment异步调用
        console.log('🔗 开始Commitment...');
        const commitmentResult = await client.executeCommitmentAsync(checkbookId, allocations);
        
        console.log('✅ Commitment完成:');
        console.log('   哈希:', commitmentResult.commitmentHash);
        console.log('   状态:', commitmentResult.status);
        
        // 可选：等待到最终状态
        if (commitmentResult.status !== 'with_checkbook') {
            console.log('⏳ 等待到最终状态...');
            const finalCommitment = await commitmentResult.waitUntilCompleted();
            console.log('   最终状态:', finalCommitment.finalStatus);
        }

        // 2. Withdraw异步调用
        console.log('💸 开始提现...');
        const withdrawResult = await client.generateProofAsync(checkbookId, recipientInfo);
        
        console.log('✅ 证明生成完成:');
        console.log('   Check ID:', withdrawResult.checkId);
        console.log('   状态:', withdrawResult.status);
        
        // 等待提现完成
        console.log('⏳ 等待提现完成...');
        const finalWithdraw = await withdrawResult.waitUntilCompleted();
        
        console.log('✅ 提现完成:');
        console.log('   最终状态:', finalWithdraw.finalStatus);
        console.log('   交易哈希:', finalWithdraw.transactionHash);
        
        return {
            commitmentHash: commitmentResult.commitmentHash,
            transactionHash: finalWithdraw.transactionHash
        };
        
    } catch (error) {
        console.error('❌ 异步操作失败:', error.message);
        throw error;
    }
}

// 使用示例
async function main() {
    const client = new ZKPayClient(config);
    await client.initialize();
    await client.login(privateKey);
    
    const result = await useAsyncMethods(client);
    console.log('🎉 所有操作完成:', result);
}
