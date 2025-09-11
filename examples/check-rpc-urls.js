#!/usr/bin/env node

// 检查RPC URL配置

const { ZKPayWalletManager } = require('../managers/zkpay-wallet-manager');
const { createLogger } = require('../utils/logger');

async function checkRpcUrls() {
    const logger = createLogger('RpcCheck');
    const walletManager = new ZKPayWalletManager(logger);
    
    console.log('🔍 检查RPC URL配置...\n');
    
    // 只测试必要的链：714(BSC), 195(TRON), 60(ETH)
    const testChains = [714, 195, 60];
    
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
