/**
 * 分析commitment数据在zkpay-client-library.js中生成的待签名消息
 */

const { ZKPayCommitmentManager } = require('../managers/zkpay-commitment-manager');
const { createLogger } = require('../utils/logger');
const AddressFormatter = require('../utils/address-formatter');

async function analyzeCommitmentSignatureMessage() {
    const logger = createLogger('AnalyzeCommitmentSignature');
    
    // 你提供的commitment数据
    const commitmentData = {
        "allocations": [{
            "recipient_chain_id": 714,
            "recipient_address": "0x0000000000000000000000000848d929b9d35bfb7aa50641d392a4ad83e145ce",
            "amount": "15000000000000000000",
            "token_id": 65535
        }],
        "deposit_id": "000000000000000000000000000000000000000000000000000000000117987c",
        "signature": {
            "chain_id": 714,
            "signature_data": "65e0bef7ef3dc20746690d2e50050c345d6e1ee411ca535d187abf4de1bebda05d657065232de9b7e1d76f02c40cd0cd54bbd9ce0162cc1089b756dadb443ee31c"
        },
        "owner_address": {
            "chain_id": 714,
            "address": "0x000000000000000000000000aaf9cb43102654126aeff96a4ad25f23e7c969a2"
        }
    };
    
    console.log('🔍 分析Commitment数据的签名消息生成');
    console.log('==========================================\n');
    
    console.log('📋 输入数据:');
    console.log(JSON.stringify(commitmentData, null, 2));
    console.log('');
    
    // 创建模拟的CommitmentManager
    const mockWalletManager = {
        getUserAddress: () => '0xaAf9CB43102654126aEff96a4AD25F23E7C969A2'
    };
    
    const commitmentManager = new ZKPayCommitmentManager(mockWalletManager, logger);
    
    // 模拟存款记录（根据commitment数据构造）
    const mockDepositRecord = {
        local_deposit_id: parseInt(commitmentData.deposit_id, 16), // 将hex转为数字
        token_id: commitmentData.allocations[0].token_id,
        owner: {
            data: commitmentData.owner_address.address
        }
    };
    
    console.log('🔍 模拟的存款记录:');
    console.log(JSON.stringify(mockDepositRecord, null, 2));
    console.log('');
    
    // 生成签名消息
    try {
        const signatureMessage = commitmentManager.generateCommitmentSignatureMessage(
            mockDepositRecord,
            commitmentData.allocations[0].recipient_address,
            commitmentData.allocations[0].amount,
            commitmentData.allocations[0].recipient_chain_id
        );
        
        console.log('📝 生成的签名消息:');
        console.log('=====================================');
        console.log(signatureMessage);
        console.log('=====================================');
        console.log(`消息长度: ${signatureMessage.length} 字符`);
        console.log('');
        
        // 分析消息组成部分
        console.log('🔍 消息组成分析:');
        console.log('---------------------------------------');
        
        // 1. 分析存款ID
        const depositIdBigInt = BigInt('0x' + commitmentData.deposit_id);
        console.log(`📋 存款ID (hex): ${commitmentData.deposit_id}`);
        console.log(`📋 存款ID (decimal): ${depositIdBigInt.toString()}`);
        
        // 2. 分析金额
        const amountBigInt = BigInt(commitmentData.allocations[0].amount);
        const amountFormatted = (amountBigInt / BigInt(10 ** 18)).toString() + '.00';
        console.log(`💰 金额 (wei): ${commitmentData.allocations[0].amount}`);
        console.log(`💰 金额 (formatted): ${amountFormatted} TUSDT`);
        
        // 3. 分析接收地址
        const recipientAddress = commitmentData.allocations[0].recipient_address;
        console.log(`📍 接收地址 (原始): ${recipientAddress}`);
        
        // 检查是否是Universal Address格式
        const cleanAddress = recipientAddress.replace(/^0x/, '');
        if (cleanAddress.length === 64 && cleanAddress.startsWith('000000000000000000000000')) {
            const chainSpecificAddress = AddressFormatter.fromUniversalAddress(recipientAddress);
            console.log(`📍 接收地址 (链特定): ${chainSpecificAddress}`);
            console.log(`📍 地址格式化: Binance Smart Chain链上${chainSpecificAddress}地址`);
        } else {
            console.log(`📍 地址格式化: Binance Smart Chain链上${recipientAddress}地址`);
        }
        
        // 4. 分析所有者地址
        const ownerAddress = commitmentData.owner_address.address;
        console.log(`🔒 所有者地址 (原始): ${ownerAddress}`);
        
        const cleanOwnerAddress = ownerAddress.replace(/^0x/, '');
        if (cleanOwnerAddress.length === 64 && cleanOwnerAddress.startsWith('000000000000000000000000')) {
            const ownerChainSpecificAddress = AddressFormatter.fromUniversalAddress(ownerAddress);
            console.log(`🔒 所有者地址 (链特定): ${ownerChainSpecificAddress}`);
            console.log(`🔒 所有者格式化: Binance Smart Chain链上${ownerChainSpecificAddress}地址`);
        } else {
            console.log(`🔒 所有者格式化: Binance Smart Chain链上${ownerAddress}地址`);
        }
        
        console.log('');
        
        // 计算消息哈希用于对比
        const crypto = require('crypto');
        const messageBuffer = Buffer.from(signatureMessage, 'utf8');
        const messageHash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
        console.log(`📋 消息SHA256哈希: ${messageHash}`);
        
        // 显示提供的签名
        console.log(`🔐 提供的签名: ${commitmentData.signature.signature_data}`);
        
        console.log('');
        console.log('✅ 签名消息分析完成');
        
        return {
            signatureMessage,
            messageHash,
            providedSignature: commitmentData.signature.signature_data,
            messageLength: signatureMessage.length
        };
        
    } catch (error) {
        console.error('❌ 生成签名消息失败:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// 运行分析
if (require.main === module) {
    analyzeCommitmentSignatureMessage()
        .then(result => {
            console.log('\n📊 分析结果摘要:');
            console.log(`  消息长度: ${result.messageLength} 字符`);
            console.log(`  消息哈希: ${result.messageHash}`);
            console.log(`  提供签名: ${result.providedSignature}`);
        })
        .catch(error => {
            console.error('❌ 分析失败:', error);
            process.exit(1);
        });
}

module.exports = { analyzeCommitmentSignatureMessage };
