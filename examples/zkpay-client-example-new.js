#!/usr/bin/env node

// ZKPay 客户端库使用示例 - 新版本（参数化配置）
// 展示如何使用ZKPay客户端库进行完整的操作流程

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');

/**
 * ZKPay 客户端使用示例 - 新版本
 */
class ZKPayClientExample {
    constructor() {
        this.logger = createLogger('ZKPayExample');
        this.client = null;
    }

    /**
     * 初始化示例
     */
    async initialize() {
        // 创建参数化配置
        const options = this.createOptionsFromEnv();
        
        // 创建客户端 - 使用新的参数化方式
        this.client = new ZKPayClient(this.logger, options);
        
        // 初始化客户端
        await this.client.initialize();
        
        this.logger.info('✅ ZKPay客户端示例初始化完成');
    }

    /**
     * 从环境变量创建参数化配置
     */
    createOptionsFromEnv() {
        const testPrivateKey = process.env.TEST_PRIVATE_KEY;
        if (!testPrivateKey || testPrivateKey === 'YOUR_TEST_PRIVATE_KEY_HERE') {
            throw new Error('请在.env文件中设置TEST_PRIVATE_KEY环境变量');
        }

        // 创建参数化配置
        const treasuryContracts = new Map([
            [56, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8']
        ]);
        
        const tokenConfigs = new Map([
            ['56_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']
        ]);

        return {
            apiConfig: {
                baseURL: process.env.ZKPAY_API_URL || 'https://backend.zkpay.network',
                timeout: parseInt(process.env.ZKPAY_API_TIMEOUT) || 300000
            },
            treasuryContracts,
            tokenConfigs,
            confirmationBlocks: 3,
            maxWaitTime: 300000,
            defaultRecipientAddress: process.env.TEST_RECIPIENT_ADDRESS || '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce'
        };
    }

    /**
     * 示例1: 基础功能测试
     */
    async example1_BasicFlow() {
        this.logger.info('🚀 示例1: 基础功能测试');
        
        try {
            // 登录
            const privateKey = process.env.TEST_PRIVATE_KEY;
            await this.client.login(privateKey);
            
            // 获取用户信息
            const user = this.client.getCurrentUser();
            this.logger.info(`当前用户: ${user.address}`);
            
            // 获取支持的链
            const chains = this.client.getSupportedChains();
            this.logger.info(`支持的链: ${chains.join(', ')}`);
            
            return { success: true, user, chains };
            
        } catch (error) {
            this.logger.error('❌ 示例1失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 示例2: 完整存款到提现流程
     */
    async example2_FullFlow() {
        this.logger.info('🚀 示例2: 完整存款到提现流程');
        
        try {
            const privateKey = process.env.TEST_PRIVATE_KEY;
            await this.client.login(privateKey);
            
            // 定义参数
            const chainId = 714;  // SLIP44 BSC
            const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
            const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
            const amount = '10.0';
            
            // 获取Token信息
            const tokenInfo = await this.client.getTokenInfo(chainId, tokenAddress);
            this.logger.info(`Token: ${tokenInfo.symbol} (${tokenInfo.name}) - ${tokenInfo.decimals} decimals`);
            
            // 检查余额
            const balance = await this.client.checkTokenBalance(chainId, tokenAddress);
            this.logger.info(`当前余额: ${balance.formatted} ${tokenInfo.symbol}`);
            
            // 检查授权
            const allowance = await this.client.checkTokenAllowance(chainId, tokenAddress, treasuryAddress);
            this.logger.info(`当前授权: ${allowance.formatted} ${tokenInfo.symbol}`);
            
            // 授权（如果需要）
            if (allowance.balance < BigInt(ethers.parseUnits(amount, tokenInfo.decimals))) {
                await this.client.approveToken(chainId, tokenAddress, amount, treasuryAddress);
            }
            
            // 存款
            const depositResult = await this.client.deposit(chainId, tokenAddress, amount, treasuryAddress);
            this.logger.info(`存款交易: ${depositResult.txHash}`);
            
            // 等待检测
            const depositRecord = await this.client.waitForDepositDetection(
                depositResult.txHash, chainId, 60
            );
            this.logger.info(`存款记录: ${depositRecord.checkbook_id}`);
            
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce',
                amount: '10000000000000000000' // 10.0 USDT
            }];
            
            // 执行承诺
            const commitmentResult = await this.client.executeCommitmentSync(
                depositRecord.checkbook_id, allocations, true
            );
            this.logger.info(`承诺结果: ${commitmentResult.status}`);
            
            // 准备提现信息
            const recipientInfo = {
                chain_id: 714,
                address: '0x0848d929b9d35bfb7aa50641d392a4ad83e145ce',
                amount: '10000000000000000000',
                token_symbol: 'test_usdt'
            };
            
            // 生成提现证明
            const withdrawResult = await this.client.generateProofSync(
                depositRecord.checkbook_id, recipientInfo, true
            );
            this.logger.info(`提现结果: ${withdrawResult.status}`);
            
            return {
                success: true,
                depositRecord,
                commitmentResult,
                withdrawResult
            };
            
        } catch (error) {
            this.logger.error('❌ 示例2失败:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 运行所有示例
     */
    async runAllExamples() {
        this.logger.info('🎯 开始运行所有示例...');
        
        const results = {};
        
        // 示例1
        results.example1 = await this.example1_BasicFlow();
        
        // 示例2
        results.example2 = await this.example2_FullFlow();
        
        // 输出结果
        this.logger.info('📊 示例运行结果:');
        console.log(JSON.stringify(results, null, 2));
        
        return results;
    }

    /**
     * 清理资源
     */
    async cleanup() {
        if (this.client) {
            await this.client.cleanup();
        }
    }
}

// 主函数
async function main() {
    const example = new ZKPayClientExample();
    
    try {
        await example.initialize();
        
        // 根据命令行参数运行不同示例
        const args = process.argv.slice(2);
        
        if (args.includes('--all')) {
            await example.runAllExamples();
        } else if (args.includes('--example1')) {
            await example.example1_BasicFlow();
        } else if (args.includes('--example2')) {
            await example.example2_FullFlow();
        } else {
            console.log('使用方法:');
            console.log('  node zkpay-client-example-new.js --all        # 运行所有示例');
            console.log('  node zkpay-client-example-new.js --example1   # 运行示例1');
            console.log('  node zkpay-client-example-new.js --example2   # 运行示例2');
        }
        
    } catch (error) {
        console.error('❌ 示例运行失败:', error.message);
        process.exit(1);
    } finally {
        await example.cleanup();
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ZKPayClientExample };
