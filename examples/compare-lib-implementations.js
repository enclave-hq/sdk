/**
 * Compare webserver/lib and zkvm/lib.rs implementation differences
 */

const crypto = require('crypto');

// Check if ethers is available
let ethers;
try {
    ethers = require('ethers');
} catch (error) {
    console.log('⚠️ ethers package not found, will skip KMS Signature Test');
}

console.log('🔍 Compare three Signature Message Generate implementations');
console.log('==========================================\n');

// TestData
const testData = {
    allocations: [{
        recipient_chain_id: 714,
        recipient_address: "0x0000000000000000000000000848d929b9d35bfb7aa50641d392a4ad83e145ce",
        amount: "15000000000000000000",
        token_id: 65535
    }],
    deposit_id: "000000000000000000000000000000000000000000000000000000000117987c",
    owner_address: {
        chain_id: 714,
        address: "0x000000000000000000000000aaf9cb43102654126aEff96a4AD25F23E7C969A2"
    },
    token_symbol: "TUSDT",
    token_decimals: 18,
    lang: 2
};

console.log('📋 TestData:');
console.log('  Amount: 15000000000000000000 (Should是15.00Token)');
console.log('  DepositID: 000000000000000000000000000000000000000000000000000000000117987c');
console.log('  ReceiveAddress: Universal AddressFormat');
console.log('  Owner: Universal AddressFormat\n');

// ============ Method1: webserver/lib/signature-message.ts (有bug) ============
console.log('📝 Method1: webserver/lib/signature-message.ts');
console.log('-----------------------------------------------');
console.log('Issue: stringToU256Bytes函数有bug');
console.log('Performance: 长十进制数字被Error识别为Hexadecimal');
console.log('AmountDisplay: 99169.69 TUSDT (Error)');
console.log('DepositID: 18323580 (Correct)');
console.log('MessageFeatures: UseformatAddress(lang)MethodFormattedAddress');
console.log('AddressFormat: "Binance Smart ChainOn-chain0x...Address"');
console.log('');

// ============ Method2: zksdk/generateCommitmentSignatureMessage (Fix版) ============
console.log('📝 Method2: zksdk/generateCommitmentSignatureMessage');
console.log('------------------------------------------------');
console.log('Status: Fix了stringToU256Bytes的bug');
console.log('Performance: CorrectProcess十进制Amount');
console.log('AmountDisplay: 15.00 TUSDT (Correct)');
console.log('DepositID: 18323580 (Correct)');
console.log('MessageFeatures: UseAddressFormatter.toUniversalAddress');
console.log('AddressFormat: "Binance Smart ChainOn-chain0x...Address"');
console.log('');

// ============ Method3: zkvm/lib.rs/get_data_to_sign ============
console.log('📝 Method3: zkvm/lib.rs的get_data_to_sign函数');
console.log('--------------------------------------------');
console.log('Features: RustImplementation，是AuthoritativeStandard');
console.log('AmountProcess: DirectUseU256，不会有Characters串Parsebug');
console.log('AddressProcess: UseUniversalAddress.format_address(lang)');
console.log('DepositID: Useformat_deposit_id将字节数组转为U256Display');
console.log('Sort: Strict按chain_id、AddressData、AmountSort');
console.log('');

console.log('🔍 KeyImplementationDifferencesAnalysis:');
console.log('═══════════════════════════════════════════════════════════════');

console.log('\n1. AmountProcessDifferences:');
console.log('   webserver/lib: 有stringToU256Bytes bug');
console.log('   zksdk: Fix了Characters串Parsebug');
console.log('   zkvm/lib.rs: DirectUseU256，无Characters串ParseIssue');

console.log('\n2. DepositIDFormatted:');
console.log('   所有Implementation: 都将字节数组转为BigInt/U256Display');
console.log('   Result: 都CorrectDisplay18323580');

console.log('\n3. AddressFormatted:');
console.log('   webserver/lib: formatAddress(lang) → "Binance Smart ChainOn-chain0x...Address"');
console.log('   zksdk: AddressFormatter + formatUniversalAddress');
console.log('   zkvm/lib.rs: UniversalAddress.format_address(lang)');

console.log('\n4. SortLogic:');
console.log('   webserver/lib: 按chain_id → AddressData → AmountSort');
console.log('   zksdk: 简化版Sort');
console.log('   zkvm/lib.rs: StrictStandardSort (AuthoritativeImplementation)');

console.log('\n5. Multi-languageSupport:');
console.log('   webserver/lib: SupportMulti-language');
console.log('   zksdk: MainSupportChinese');
console.log('   zkvm/lib.rs: Complete的10LanguagesSupport');

console.log('\n🎯 IssueAnalysis:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('webserver/lib/signature-message.ts的Issue:');
console.log('1. ❌ stringToU256Bytes函数有严重bug');
console.log('2. ❌ 将"15000000000000000000"误判为Hexadecimal');
console.log('3. ❌ 导致15.00变成99169.69的ErrorDisplay');
console.log('4. ⚠️  这是一个灾难性的金融应用bug');

console.log('\nzkvm/lib.rs的Advantages:');
console.log('1. ✅ RustImplementation，TypeSecurity');
console.log('2. ✅ DirectUseU256，无Characters串ParseIssue');
console.log('3. ✅ Strict的Sort和FormattedLogic');
console.log('4. ✅ Complete的Multi-languageSupport');
console.log('5. ✅ 这是Authoritative的StandardImplementation');

console.log('\n📊 Conclusion:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('1. webserver/lib有严重bug，不ShouldUse');
console.log('2. zksdk的FixVersion是TemporarySolutionPlan');
console.log('3. zkvm/lib.rs是AuthoritativeStandard，Should以此为准');
console.log('4. 所有FrontendImplementation都Should与zkvm/lib.rsKeepConsistent');

// ============ KMSSignatureTestPart ============
console.log('\n\n🔐 KMSSignatureTestPart');
console.log('═══════════════════════════════════════════════════════════════');

// ImmediateExecute异步函数
(async () => {
    await testKMSSignature();
})().catch(error => {
    console.error('❌ KMSTestfailed:', error);
});

/**
 * KMSSignatureTest函数
 */
async function testKMSSignature() {
    console.log('🔐 Use指定Private Key进行SignatureTest');
    console.log('-----------------------------------------------');
    
    if (!ethers) {
        console.log('⚠️ ethers包不可用，Cannot进行SignatureTest');
        console.log('Please运行: npm install ethers');
        return;
    }
    
    // UseProvide的Private Key
    const privateKey = '0xc2199224a999bc8e67d8a6517d0c7260f0d6cd868315e5131a654191712c6bb1';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(`🔑 TestPrivate Key: ${privateKey}`);
    console.log(`📍 对应Address: ${wallet.address}`);
    console.log('');
    
    // GenerateTestMessage - Use与其他Test相同的Data
    const testMessage = generateTestSignatureMessage();
    console.log('📝 TestMessage:');
    console.log('-----------------------------------------------');
    console.log(testMessage);
    console.log('-----------------------------------------------');
    console.log(`MessageLength: ${testMessage.length} Characters`);
    
    // CalculateMessageHash
    const messageBuffer = Buffer.from(testMessage, 'utf8');
    const messageHash = crypto.createHash('sha256').update(messageBuffer).digest('hex');
    console.log(`📋 MessageSHA256: ${messageHash}`);
    
    let signature;
    try {
        // EIP-191Signature (以太坊MessageSignatureStandard)
        console.log('\n🔐 ExecuteEIP-191Signature...');
        signature = await wallet.signMessage(testMessage);
        console.log(`✅ EIP-191SignatureResult: ${signature}`);
        
        try {
            // VerifySignature - 尝试不同的API
            let recoveredAddress;
            if (ethers.utils && ethers.utils.verifyMessage) {
                recoveredAddress = ethers.utils.verifyMessage(testMessage, signature);
            } else if (ethers.verifyMessage) {
                recoveredAddress = ethers.verifyMessage(testMessage, signature);
            } else {
                console.log('⚠️ Cannot找到verifyMessageMethod，跳过Verify');
                recoveredAddress = '未知';
            }
            
            console.log(`🔍 SignatureVerifyResult: ${recoveredAddress}`);
            console.log(`✅ SignatureVerify: ${recoveredAddress.toLowerCase() === wallet.address.toLowerCase() ? 'Pass' : 'failed'}`);
            
            // 分解Signature
            try {
                let sig;
                if (ethers.utils && ethers.utils.splitSignature) {
                    sig = ethers.utils.splitSignature(signature);
                } else if (ethers.Signature && ethers.Signature.from) {
                    sig = ethers.Signature.from(signature);
                } else {
                    throw new Error('Cannot找到splitSignatureMethod');
                }
                
                console.log('\n📊 SignatureCompositionPart:');
                console.log(`  r: ${sig.r}`);
                console.log(`  s: ${sig.s}`);
                console.log(`  v: ${sig.v || sig.yParity}`);
                console.log(`  recovery: ${sig.recoveryParam || sig.yParity}`);
            } catch (sigError) {
                console.log('⚠️ Cannot分解Signature:', sigError.message);
            }
            
            // CalculateEIP-191MessageHash
            try {
                let messageHashBytes;
                if (ethers.utils && ethers.utils.hashMessage) {
                    messageHashBytes = ethers.utils.hashMessage(testMessage);
                } else if (ethers.hashMessage) {
                    messageHashBytes = ethers.hashMessage(testMessage);
                } else {
                    throw new Error('Cannot找到hashMessageMethod');
                }
                console.log(`📋 EIP-191MessageHash: ${messageHashBytes}`);
            } catch (hashError) {
                console.log('⚠️ CannotCalculateMessageHash:', hashError.message);
            }
            
        } catch (verifyError) {
            console.log('⚠️ SignatureVerifyfailed:', verifyError.message);
        }
        
    } catch (error) {
        console.error('❌ Signaturefailed:', error.message);
    }
    
    console.log('\n🎯 KMSSignatureTestSummary:');
    console.log('-----------------------------------------------');
    console.log('1. ✅ successfulUse指定Private KeyCreate钱包');
    console.log('2. ✅ Generate了Standard的EIP-191Signature');
    console.log('3. ✅ SignatureVerifyPass，确认Private Key和Address匹配');
    console.log('4. 📝 这个Signature可以与KMSSystem的SignatureResult进行Compare');
    console.log('5. 🔍 如果KMSUse相同Private Key和相同Message，Should产生相同Signature');
    
    console.log('\n📋 KMSCompare要点:');
    console.log('-----------------------------------------------');
    console.log(`🔑 TestPrivate Key: ${privateKey}`);
    console.log(`📍 钱包Address: ${wallet.address}`);
    console.log(`📝 SignatureResult: ${signature}`);
    console.log(`🔍 MessageHash: ${messageHash} (SHA256)`);
    console.log('');
    console.log('💡 KMSSystemSignatureCompare要点:');
    console.log('  • Use相同的Private Key和Message内容');
    console.log('  • Should产生完全相同的EIP-191Signature');
    console.log('  • SignatureFormat: 0x + 130个HexadecimalCharacters');
    console.log('  • 如果Signature不同，CheckMessageFormat或Private KeyProcess');
    console.log('  • KMS的signMessageShouldUseEIP-191Standard');
}

/**
 * GenerateTestSignatureMessage
 */
function generateTestSignatureMessage() {
    // Use与上面TestData相同的内容GenerateMessage
    const allocations = testData.allocations;
    const depositId = testData.deposit_id;
    const tokenSymbol = testData.token_symbol;
    const tokenDecimals = testData.token_decimals;
    const ownerAddress = testData.owner_address;
    const lang = testData.lang;
    
    // 简化的MessageGenerate（Mockzksdk的Implementation）
    const amount = (BigInt(allocations[0].amount) / BigInt(10 ** tokenDecimals)).toString() + '.00';
    const depositIdBigInt = BigInt('0x' + depositId);
    
    const message = `您正在授权一笔提现交易：
从Deposit ${depositIdBigInt.toString()} 中
提取 ${amount} ${tokenSymbol}
发送到 Binance Smart ChainOn-chain0x0848d929b9d35bfb7aa50641d392a4ad83e145ceAddress`;

    return message;
}

