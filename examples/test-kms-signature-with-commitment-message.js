/**
 * 使用KMS私钥对commitment待签名消息进行签名测试
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const { analyzeCommitmentSignatureMessage } = require('./analyze-commitment-signature-message');

async function testKMSSignatureWithCommitmentMessage() {
    console.log('🔐 使用KMS私钥对commitment消息进行签名测试');
    console.log('==========================================\n');
    
    // KMS私钥
    const privateKey = '0xc2199224a999bc8e67d8a6517d0c7260f0d6cd868315e5131a654191712c6bb1';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(`🔑 KMS私钥: ${privateKey}`);
    console.log(`📍 对应地址: ${wallet.address}`);
    console.log('');
    
    try {
        // 1. 首先获取commitment消息
        console.log('📋 步骤1: 生成commitment待签名消息...');
        const analysisResult = await analyzeCommitmentSignatureMessage();
        const messageToSign = analysisResult.signatureMessage;
        
        console.log('📝 待签名消息:');
        console.log('=====================================');
        console.log(messageToSign);
        console.log('=====================================');
        console.log(`消息长度: ${messageToSign.length} 字符`);
        console.log('');
        
        // 2. 使用KMS私钥进行EIP-191签名
        console.log('📋 步骤2: 执行EIP-191签名...');
        const signature = await wallet.signMessage(messageToSign);
        console.log(`✅ 签名结果: ${signature}`);
        console.log('');
        
        // 3. 验证签名
        console.log('📋 步骤3: 验证签名...');
        let recoveredAddress;
        try {
            if (ethers.utils && ethers.utils.verifyMessage) {
                recoveredAddress = ethers.utils.verifyMessage(messageToSign, signature);
            } else if (ethers.verifyMessage) {
                recoveredAddress = ethers.verifyMessage(messageToSign, signature);
            } else {
                console.log('⚠️ 无法找到verifyMessage方法，跳过验证');
                recoveredAddress = '未知';
            }
            console.log(`🔍 恢复的地址: ${recoveredAddress}`);
            console.log(`✅ 签名验证: ${recoveredAddress.toLowerCase() === wallet.address.toLowerCase() ? '通过' : '失败'}`);
        } catch (error) {
            console.log(`⚠️ 签名验证出错: ${error.message}`);
            recoveredAddress = '验证失败';
        }
        console.log('');
        
        // 4. 分解签名
        console.log('📋 步骤4: 分解签名组成部分...');
        let sig;
        try {
            if (ethers.utils && ethers.utils.splitSignature) {
                sig = ethers.utils.splitSignature(signature);
            } else if (ethers.Signature && ethers.Signature.from) {
                sig = ethers.Signature.from(signature);
            } else {
                throw new Error('无法找到splitSignature方法');
            }
            console.log(`  r: ${sig.r}`);
            console.log(`  s: ${sig.s}`);
            console.log(`  v: ${sig.v || sig.yParity}`);
            console.log(`  recovery: ${sig.recoveryParam || sig.yParity}`);
        } catch (error) {
            console.log(`⚠️ 无法分解签名: ${error.message}`);
            sig = null;
        }
        console.log('');
        
        // 5. 计算各种哈希用于对比
        console.log('📋 步骤5: 计算消息哈希...');
        const messageBuffer = Buffer.from(messageToSign, 'utf8');
        const sha256Hash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
        let eip191Hash;
        try {
            if (ethers.utils && ethers.utils.hashMessage) {
                eip191Hash = ethers.utils.hashMessage(messageToSign);
            } else if (ethers.hashMessage) {
                eip191Hash = ethers.hashMessage(messageToSign);
            } else {
                eip191Hash = '无法计算';
            }
        } catch (error) {
            eip191Hash = '计算失败';
        }
        
        console.log(`📋 消息SHA256哈希: ${sha256Hash}`);
        console.log(`📋 EIP-191消息哈希: ${eip191Hash}`);
        console.log('');
        
        // 6. 与原始commitment数据中的签名进行对比
        const originalSignature = "65e0bef7ef3dc20746690d2e50050c345d6e1ee411ca535d187abf4de1bebda05d657065232de9b7e1d76f02c40cd0cd54bbd9ce0162cc1089b756dadb443ee31c";
        console.log('📋 步骤6: 与原始签名对比...');
        console.log(`🔐 原始签名: ${originalSignature}`);
        console.log(`🔐 KMS签名:  ${signature.replace(/^0x/, '')}`);
        console.log(`🔍 签名匹配: ${signature.replace(/^0x/, '') === originalSignature ? '✅ 完全匹配' : '❌ 不匹配'}`);
        console.log('');
        
        // 7. 如果签名不匹配，尝试验证原始签名
        if (signature.replace(/^0x/, '') !== originalSignature) {
            console.log('📋 步骤7: 验证原始签名...');
            try {
                const originalSignatureWithPrefix = '0x' + originalSignature;
                const recoveredFromOriginal = ethers.utils.verifyMessage(messageToSign, originalSignatureWithPrefix);
                console.log(`🔍 原始签名恢复地址: ${recoveredFromOriginal}`);
                console.log(`🔍 原始签名验证: ${recoveredFromOriginal.toLowerCase() === wallet.address.toLowerCase() ? '通过' : '失败'}`);
            } catch (error) {
                console.log(`❌ 原始签名验证失败: ${error.message}`);
            }
        }
        
        console.log('\n🎯 测试结果总结:');
        console.log('==========================================');
        console.log(`🔑 KMS私钥: ${privateKey}`);
        console.log(`📍 KMS地址: ${wallet.address}`);
        console.log(`📝 消息长度: ${messageToSign.length} 字符`);
        console.log(`🔐 KMS签名: ${signature}`);
        console.log(`📋 消息哈希: ${sha256Hash}`);
        console.log(`🔍 签名验证: ${recoveredAddress.toLowerCase() === wallet.address.toLowerCase() ? '✅ 通过' : '❌ 失败'}`);
        
        return {
            privateKey,
            walletAddress: wallet.address,
            message: messageToSign,
            signature,
            messageHash: sha256Hash,
            eip191Hash,
            signatureComponents: sig,
            originalSignature,
            signaturesMatch: signature.replace(/^0x/, '') === originalSignature
        };
        
    } catch (error) {
        console.error('❌ 签名测试失败:', error.message);
        throw error;
    }
}

// 运行测试
if (require.main === module) {
    testKMSSignatureWithCommitmentMessage()
        .then(result => {
            console.log('\n✅ KMS签名测试完成');
        })
        .catch(error => {
            console.error('❌ 测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testKMSSignatureWithCommitmentMessage };
