#!/usr/bin/env node

// 检查RPC URL配置

const { ZKPayWalletManager } = require('../managers/zkpay-wallet-manager');
const { createLogger } = require('../utils/logger');

async function checkRpcUrls() {
    const logger = createLogger('RpcCheck');
    const walletManager = new ZKPayWalletManager(logger);
    
    console.log('🔍 检查RPC URL配置...\n');
    
    // 测试几个主要链的RPC URL
    const testChains = [1, 56, 97, 137, 42161, 10];
    
    for (const chainId of testChains) {
        try {
            const rpcUrl = walletManager.getRpcUrl(chainId);
            console.log(`链 ${chainId}: ${rpcUrl}`);
            
            // 测试连接
            const provider = walletManager.getProvider(chainId);
            const network = await provider.getNetwork();
            console.log(`  ✅ 连接成功 - 实际链ID: ${network.chainId}`);
            
        } catch (error) {
            console.log(`  ❌ 连接失败: ${error.message}`);
        }
        console.log('');
    }
}

checkRpcUrls().catch(console.error);
