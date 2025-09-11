#!/usr/bin/env node

// 测试SLIP44到实际链ID的映射

const { ZKPayWalletManager } = require('../managers/zkpay-wallet-manager');
const { createLogger } = require('../utils/logger');

async function testSlip44Mapping() {
    const logger = createLogger('Slip44Test');
    const walletManager = new ZKPayWalletManager(logger);
    
    console.log('🔍 测试SLIP44到实际链ID的映射...\n');
    
    // 测试SLIP44币种ID映射
    const testCases = [
        { slip44: 60, expected: 1, description: 'Ethereum (SLIP44 60) -> Ethereum Mainnet (Chain ID 1)' },
        { slip44: 714, expected: 56, description: 'BSC (SLIP44 714) -> BSC Mainnet (Chain ID 56)' },
        { slip44: 966, expected: 137, description: 'Polygon (SLIP44 966) -> Polygon Mainnet (Chain ID 137)' },
        { slip44: 42161, expected: 42161, description: 'Arbitrum (SLIP44 42161) -> Arbitrum One (Chain ID 42161)' },
        { slip44: 10, expected: 10, description: 'Optimism (SLIP44 10) -> Optimism Mainnet (Chain ID 10)' },
        { slip44: 195, expected: 195, description: 'Tron (SLIP44 195) -> Tron Mainnet (Chain ID 195)' },
        { slip44: 56, expected: 56, description: 'BSC (Chain ID 56) - 无SLIP44映射' },
        { slip44: 1, expected: 1, description: 'Ethereum Mainnet (Chain ID 1) - 无SLIP44映射' },
    ];
    
    for (const testCase of testCases) {
        const actualChainId = walletManager.getActualChainId(testCase.slip44);
        const isCorrect = actualChainId === testCase.expected;
        
        console.log(`SLIP44 ${testCase.slip44} -> 实际链ID ${actualChainId} ${isCorrect ? '✅' : '❌'}`);
        console.log(`  说明: ${testCase.description}`);
        
        if (isCorrect) {
            try {
                const rpcUrl = walletManager.getRpcUrl(testCase.slip44);
                console.log(`  RPC URL: ${rpcUrl}`);
                
                // 测试连接
                const provider = walletManager.getProvider(testCase.slip44);
                const network = await provider.getNetwork();
                console.log(`  连接测试: ✅ 链ID ${network.chainId}`);
            } catch (error) {
                console.log(`  连接测试: ❌ ${error.message}`);
            }
        }
        console.log('');
    }
    
    console.log('🎯 特殊测试: 使用SLIP44 714 (BSC) 访问BSC RPC');
    try {
        const provider = walletManager.getProvider(714); // SLIP44 BSC ID
        const network = await provider.getNetwork();
        console.log(`✅ 成功! SLIP44 714 映射到链ID ${network.chainId} (BSC)`);
        
        // 测试获取余额
        const balance = await provider.getBalance('0xaAf9CB43102654126aEff96a4AD25F23E7C969A2');
        console.log(`✅ 余额查询成功: ${balance.toString()} Wei`);
        
    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}`);
    }
}

testSlip44Mapping().catch(console.error);
