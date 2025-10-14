/**
 * UseKMSPrivate Key对commitment待SignatureMessage进行SignatureTest
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const { analyzeCommitmentSignatureMessage } = require('./analyze-commitment-signature-message');

async function testKMSSignatureWithCommitmentMessage() {
    console.log('🔐 UseKMSPrivate Key对commitmentMessage进行SignatureTest');
    console.log('==========================================\n');
    
    // KMSPrivate Key
    const privateKey = '0xc2199224a999bc8e67d8a6517d0c7260f0d6cd868315e5131a654191712c6bb1';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(`🔑 KMSPrivate Key: ${privateKey}`);
    console.log(`📍 对应Address: ${wallet.address}`);
    console.log('');
    
    try {
        // 1. 首先GetcommitmentMessage
        console.log('📋 Step1: Generatecommitment待SignatureMessage...');
        const analysisResult = await analyzeCommitmentSignatureMessage();
        const messageToSign = analysisResult.signatureMessage;
        
        console.log('📝 待SignatureMessage:');
        console.log('=====================================');
        console.log(messageToSign);
        console.log('=====================================');
        console.log(`MessageLength: ${messageToSign.length} Characters`);
        console.log('');
        
        // 2. UseKMSPrivate Key进行EIP-191Signature
        console.log('📋 Step2: ExecuteEIP-191Signature...');
        const signature = await wallet.signMessage(messageToSign);
        console.log(`✅ SignatureResult: ${signature}`);
        console.log('');
        
        // 3. VerifySignature
        console.log('📋 Step3: VerifySignature...');
        let recoveredAddress;
        try {
            if (ethers.utils && ethers.utils.verifyMessage) {
                recoveredAddress = ethers.utils.verifyMessage(messageToSign, signature);
            } else if (ethers.verifyMessage) {
                recoveredAddress = ethers.verifyMessage(messageToSign, signature);
            } else {
                console.log('⚠️ Cannot找ToverifyMessageMethod，跳过Verify');
                recoveredAddress = '未知';
            }
            console.log(`🔍 恢复的Address: ${recoveredAddress}`);
            console.log(`✅ SignatureVerify: ${recoveredAddress.toLowerCase() === wallet.address.toLowerCase() ? 'Pass' : 'failed'}`);
        } catch (error) {
            console.log(`⚠️ SignatureVerify出错: ${error.message}`);
            recoveredAddress = 'Verifyfailed';
        }
        console.log('');
        
        // 4. 分解Signature
        console.log('📋 Step4: 分解SignatureCompositionPart...');
        let sig;
        try {
            if (ethers.utils && ethers.utils.splitSignature) {
                sig = ethers.utils.splitSignature(signature);
            } else if (ethers.Signature && ethers.Signature.from) {
                sig = ethers.Signature.from(signature);
            } else {
                throw new Error('Cannot找TosplitSignatureMethod');
            }
            console.log(`  r: ${sig.r}`);
            console.log(`  s: ${sig.s}`);
            console.log(`  v: ${sig.v || sig.yParity}`);
            console.log(`  recovery: ${sig.recoveryParam || sig.yParity}`);
        } catch (error) {
            console.log(`⚠️ Cannot分解Signature: ${error.message}`);
            sig = null;
        }
        console.log('');
        
        // 5. Calculate各种Hash用于Compare
        console.log('📋 Step5: CalculateMessageHash...');
        const messageBuffer = Buffer.from(messageToSign, 'utf8');
        const sha256Hash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
        let eip191Hash;
        try {
            if (ethers.utils && ethers.utils.hashMessage) {
                eip191Hash = ethers.utils.hashMessage(messageToSign);
            } else if (ethers.hashMessage) {
                eip191Hash = ethers.hashMessage(messageToSign);
            } else {
                eip191Hash = 'CannotCalculate';
            }
        } catch (error) {
            eip191Hash = 'Calculatefailed';
        }
        
        console.log(`📋 MessageSHA256Hash: ${sha256Hash}`);
        console.log(`📋 EIP-191MessageHash: ${eip191Hash}`);
        console.log('');
        
        // 6. 与OriginalcommitmentData中的Signature进行Compare
        const originalSignature = "65e0bef7ef3dc20746690d2e50050c345d6e1ee411ca535d187abf4de1bebda05d657065232de9b7e1d76f02c40cd0cd54bbd9ce0162cc1089b756dadb443ee31c";
        console.log('📋 Step6: 与OriginalSignatureCompare...');
        console.log(`🔐 OriginalSignature: ${originalSignature}`);
        console.log(`🔐 KMSSignature:  ${signature.replace(/^0x/, '')}`);
        console.log(`🔍 Signature匹配: ${signature.replace(/^0x/, '') === originalSignature ? '✅ 完全匹配' : '❌ 不匹配'}`);
        console.log('');
        
        // 7. IfSignature不匹配，尝试VerifyOriginalSignature
        if (signature.replace(/^0x/, '') !== originalSignature) {
            console.log('📋 Step7: VerifyOriginalSignature...');
            try {
                const originalSignatureWithPrefix = '0x' + originalSignature;
                const recoveredFromOriginal = ethers.utils.verifyMessage(messageToSign, originalSignatureWithPrefix);
                console.log(`🔍 OriginalSignature恢复Address: ${recoveredFromOriginal}`);
                console.log(`🔍 OriginalSignatureVerify: ${recoveredFromOriginal.toLowerCase() === wallet.address.toLowerCase() ? 'Pass' : 'failed'}`);
            } catch (error) {
                console.log(`❌ OriginalSignatureVerifyfailed: ${error.message}`);
            }
        }
        
        console.log('\n🎯 TestResultSummary:');
        console.log('==========================================');
        console.log(`🔑 KMSPrivate Key: ${privateKey}`);
        console.log(`📍 KMSAddress: ${wallet.address}`);
        console.log(`📝 MessageLength: ${messageToSign.length} Characters`);
        console.log(`🔐 KMSSignature: ${signature}`);
        console.log(`📋 MessageHash: ${sha256Hash}`);
        console.log(`🔍 SignatureVerify: ${recoveredAddress.toLowerCase() === wallet.address.toLowerCase() ? '✅ Pass' : '❌ failed'}`);
        
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
        console.error('❌ SignatureTestfailed:', error.message);
        throw error;
    }
}

// RunTest
if (require.main === module) {
    testKMSSignatureWithCommitmentMessage()
        .then(result => {
            console.log('\n✅ KMSSignatureTestcompleted');
        })
        .catch(error => {
            console.error('❌ Testfailed:', error);
            process.exit(1);
        });
}

module.exports = { testKMSSignatureWithCommitmentMessage };
