#!/usr/bin/env node

// ZKPay Client Library 新API测试
// 测试不使用config.yaml的新API设计

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');
const chalk = require('chalk');

/**
 * 新API测试
 */
class NewAPITest {
    constructor() {
        this.logger = createLogger('NewAPITest');
        this.client = null;
        this.testResults = [];
    }

    /**
     * 初始化
     */
    async initialize() {
        console.log(chalk.blue('🔧 初始化新API测试...'));
        
        // 参数化配置（包含Treasury合约配置）
        const treasuryContracts = new Map([
            [56, '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8']
        ]);
        
        const tokenConfigs = new Map([
            ['56_test_usdt', '0xbFBD79DbF5369D013a3D31812F67784efa6e0309']
        ]);

        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            },
            treasuryContracts,
            tokenConfigs,
            confirmationBlocks: 3,
            maxWaitTime: 300000
        };

        // 创建客户端
        this.client = new ZKPayClient(this.logger, options);
        await this.client.initialize();
        
        console.log(chalk.green('✅ 新API测试初始化完成'));
    }

    /**
     * 运行测试
     */
    async runTests() {
        console.log(chalk.blue('🚀 开始运行新API测试...'));
        
        try {
            // 测试1: 用户登录
            await this.runTest('用户登录', async () => {
                const privateKey = process.env.TEST_USER_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error('请设置环境变量 TEST_USER_PRIVATE_KEY');
                }
                return await this.client.login(privateKey);
            });

            // 测试2: 获取Token信息（通过余额检查）
            await this.runTest('获取Token信息', async () => {
                const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'; // BSC Testnet USDT
                const balance = await this.client.checkTokenBalance(56, tokenAddress);
                console.log(`Token: ${balance.symbol} (${balance.name}) - ${balance.decimals} decimals`);
                return balance;
            });

            // 测试3: 检查Token余额
            await this.runTest('检查Token余额', async () => {
                const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
                const balance = await this.client.checkTokenBalance(56, tokenAddress);
                console.log(`余额: ${balance.formatted} ${balance.symbol}`);
                return balance;
            });

            // 测试4: 检查Token授权
            await this.runTest('检查Token授权', async () => {
                const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
                const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
                const allowance = await this.client.checkTokenAllowance(56, tokenAddress, treasuryAddress);
                console.log(`授权额度: ${allowance.formatted} ${allowance.symbol}`);
                return allowance;
            });

            // 测试5: 获取用户存款记录
            await this.runTest('获取用户存款记录', async () => {
                const deposits = await this.client.getUserDeposits();
                console.log(`找到 ${deposits.length} 条存款记录`);
                return deposits;
            });

            // 测试6: 获取支持的链
            await this.runTest('获取支持的链', async () => {
                const chains = this.client.getSupportedChains();
                console.log(`支持的链: ${chains.map(c => c.chain_id).join(', ')}`);
                return chains;
            });

            // 打印测试结果
            this.printTestResults();

        } catch (error) {
            console.error(chalk.red('❌ 测试运行失败:'), error.message);
            throw error;
        }
    }

    /**
     * 运行单个测试
     */
    async runTest(testName, testFunction) {
        console.log(chalk.yellow(`\n🧪 测试: ${testName}`));
        
        try {
            const startTime = Date.now();
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'success',
                duration: duration,
                result: result
            });
            
            console.log(chalk.green(`✅ ${testName} 成功 (${duration}ms)`));
            return result;
            
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'failed',
                error: error.message
            });
            
            console.log(chalk.red(`❌ ${testName} 失败: ${error.message}`));
            throw error;
        }
    }

    /**
     * 打印测试结果
     */
    printTestResults() {
        console.log(chalk.blue('\n📊 测试结果汇总:'));
        console.log('='.repeat(50));
        
        const successCount = this.testResults.filter(r => r.status === 'success').length;
        const failedCount = this.testResults.filter(r => r.status === 'failed').length;
        const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);
        
        console.log(chalk.green(`✅ 成功: ${successCount}`));
        console.log(chalk.red(`❌ 失败: ${failedCount}`));
        console.log(chalk.blue(`⏱️  总耗时: ${totalDuration}ms`));
        
        if (failedCount > 0) {
            console.log(chalk.red('\n失败的测试:'));
            this.testResults
                .filter(r => r.status === 'failed')
                .forEach(r => console.log(chalk.red(`  - ${r.name}: ${r.error}`)));
        }
        
        console.log('='.repeat(50));
    }
}

// 主函数
async function main() {
    const test = new NewAPITest();
    
    try {
        await test.initialize();
        await test.runTests();
        console.log(chalk.green('\n🎉 所有测试完成!'));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red('\n💥 测试失败:'), error.message);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = NewAPITest;
