#!/usr/bin/env node

// ZKPay 客户端库测试脚本
// 用于验证客户端库的基本功能

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');
const yaml = require('js-yaml');
const fs = require('fs');

/**
 * ZKPay 客户端库测试
 */
class ZKPayClientTest {
    constructor(configFile) {
        this.configFile = configFile;
        this.config = null;
        this.logger = createLogger('ZKPayClientTest');
        this.client = null;
        this.testResults = [];
    }

    /**
     * 初始化测试
     */
    async initialize() {
        // 创建客户端（不需要config）
        this.client = new ZKPayClient(null, this.logger);
        
        // 初始化客户端
        await this.client.initialize();
        
        this.logger.info('✅ ZKPay客户端测试初始化完成');
    }

    /**
     * 加载配置文件
     */
    loadConfig() {
        try {
            const configPath = require('path').resolve(this.configFile);
            const configContent = fs.readFileSync(configPath, 'utf8');
            
            // 处理环境变量替换
            const processedContent = configContent.replace(/\${([^}]+)}/g, (match, envVar) => {
                const [varName, defaultValue] = envVar.split(':-');
                return process.env[varName] || defaultValue || match;
            });
            
            this.config = yaml.load(processedContent);
            this.logger.info('✅ 配置文件加载成功');
        } catch (error) {
            this.logger.error('❌ 配置文件加载失败:', error.message);
            throw error;
        }
    }

    /**
     * 运行测试用例
     */
    async runTest(testName, testFunction) {
        this.logger.info(`🧪 运行测试: ${testName}`);
        
        const startTime = Date.now();
        let success = false;
        let error = null;
        let result = null;
        
        try {
            result = await testFunction();
            success = true;
            this.logger.info(`✅ 测试通过: ${testName}`);
        } catch (err) {
            error = err;
            success = false;
            this.logger.error(`❌ 测试失败: ${testName} - ${err.message}`);
        }
        
        const duration = Date.now() - startTime;
        
        this.testResults.push({
            name: testName,
            success,
            error: error?.message,
            result,
            duration
        });
        
        return { success, result, error };
    }

    /**
     * 测试1: 客户端初始化
     */
    async test1_ClientInitialization() {
        return await this.runTest('客户端初始化', async () => {
            // 检查客户端是否正确初始化
            if (!this.client.isInitialized) {
                throw new Error('客户端未正确初始化');
            }
            
            // 检查API连接
            await this.client.testApiConnection();
            
            return { initialized: true, apiConnected: true };
        });
    }

    /**
     * 测试2: 用户登录
     */
    async test2_UserLogin() {
        return await this.runTest('用户登录', async () => {
            const privateKey = process.env.TEST_PRIVATE_KEY;
            if (!privateKey || privateKey === 'YOUR_TEST_PRIVATE_KEY_HERE') {
                throw new Error('请在.env文件中设置TEST_PRIVATE_KEY环境变量');
            }
            
            // 执行登录
            const loginResult = await this.client.login(privateKey, 'test_user');
            
            // 验证登录状态
            if (!this.client.isLoggedIn()) {
                throw new Error('登录状态验证失败');
            }
            
            const currentUser = this.client.getCurrentUser();
            if (!currentUser || !currentUser.address) {
                throw new Error('用户信息获取失败');
            }
            
            return {
                loginResult,
                currentUser: {
                    address: currentUser.address,
                    userName: currentUser.userName
                }
            };
        });
    }

    /**
     * 测试3: Token余额查询
     */
    async test3_TokenBalance() {
        return await this.runTest('Token余额查询', async () => {
            if (!this.client.isLoggedIn()) {
                throw new Error('用户未登录');
            }
            
            // 查询BSC上的测试USDT余额
            const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
            const balance = await this.client.checkTokenBalance(56, tokenAddress);
            
            if (!balance.balance || !balance.formatted) {
                throw new Error('余额查询结果格式错误');
            }
            
            return {
                balance: balance.formatted,
                symbol: balance.symbol,
                decimals: balance.decimals
            };
        });
    }

    /**
     * 测试4: Token授权额度查询
     */
    async test4_TokenAllowance() {
        return await this.runTest('Token授权额度查询', async () => {
            if (!this.client.isLoggedIn()) {
                throw new Error('用户未登录');
            }
            
            // 查询授权额度
            const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309';
            const treasuryAddress = '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8';
            const allowance = await this.client.checkTokenAllowance(56, tokenAddress, treasuryAddress);
            
            if (!allowance.hasOwnProperty('allowance') || !allowance.formatted) {
                throw new Error('授权额度查询结果格式错误');
            }
            
            return {
                allowance: allowance.formatted,
                decimals: allowance.decimals
            };
        });
    }

    /**
     * 测试5: 用户存款记录查询
     */
    async test5_UserDeposits() {
        return await this.runTest('用户存款记录查询', async () => {
            if (!this.client.isLoggedIn()) {
                throw new Error('用户未登录');
            }
            
            // 查询用户存款记录
            const deposits = await this.client.getUserDeposits();
            
            if (!Array.isArray(deposits)) {
                throw new Error('存款记录查询结果应为数组');
            }
            
            return {
                count: deposits.length,
                deposits: deposits.map(d => ({
                    checkbookId: d.checkbookId,
                    status: d.status,
                    tokenSymbol: d.tokenSymbol,
                    allocatableAmount: d.allocatableAmount
                }))
            };
        });
    }

    /**
     * 测试6: 分配方案创建和签名
     */
    async test6_AllocationAndSigning() {
        return await this.runTest('分配方案创建和签名', async () => {
            if (!this.client.isLoggedIn()) {
                throw new Error('用户未登录');
            }
            
            // 获取用户存款记录
            const deposits = await this.client.getUserDeposits();
            if (deposits.length === 0) {
                throw new Error('没有可用的存款记录用于测试');
            }
            
            const deposit = deposits[0];
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
                amount: "1000000000000000000" // 1.0 USDT
            }];
            
            // 创建分配和签名
            const result = await this.client.createAllocationAndSign(
                deposit.checkbookId,
                allocations
            );
            
            if (!result.signature || !result.signatureMessage) {
                throw new Error('签名生成失败');
            }
            
            return {
                checkbookId: result.checkbookId,
                allocationsCount: result.allocations.length,
                signatureLength: result.signature.length,
                hasSignatureMessage: !!result.signatureMessage
            };
        });
    }

    /**
     * 测试7: 支持的链和Token查询
     */
    async test7_SupportedChainsAndTokens() {
        return await this.runTest('支持的链和Token查询', async () => {
            // 获取支持的链
            const chains = this.client.getSupportedChains();
            if (!Array.isArray(chains) || chains.length === 0) {
                throw new Error('支持的链列表为空');
            }
            
            // 获取BSC支持的Token
            const tokens = this.client.getSupportedTokens(56);
            if (!tokens || Object.keys(tokens).length === 0) {
                throw new Error('BSC支持的Token列表为空');
            }
            
            return {
                chainsCount: chains.length,
                chains: chains.map(c => ({ chain_id: c.chain_id, name: c.name })),
                bscTokens: Object.keys(tokens)
            };
        });
    }

    /**
     * 测试8: 错误处理
     */
    async test8_ErrorHandling() {
        return await this.runTest('错误处理', async () => {
            // 测试未登录状态下的操作
            this.client.logout();
            
            let errorCaught = false;
            try {
                await this.client.getUserDeposits();
            } catch (error) {
                if (error.message.includes('未登录')) {
                    errorCaught = true;
                }
            }
            
            if (!errorCaught) {
                throw new Error('未正确处理未登录错误');
            }
            
            // 重新登录
            const privateKey = Object.values(this.config.test_users)[0].private_key;
            await this.client.login(privateKey, 'test_user');
            
            return { errorHandlingWorking: true };
        });
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        this.logger.info('🚀 开始运行ZKPay客户端库测试...');
        
        const tests = [
            () => this.test1_ClientInitialization(),
            () => this.test2_UserLogin(),
            () => this.test3_TokenBalance(),
            () => this.test4_TokenAllowance(),
            () => this.test5_UserDeposits(),
            () => this.test6_AllocationAndSigning(),
            () => this.test7_SupportedChainsAndTokens(),
            () => this.test8_ErrorHandling()
        ];
        
        let passedTests = 0;
        let failedTests = 0;
        
        for (const test of tests) {
            const result = await test();
            if (result.success) {
                passedTests++;
            } else {
                failedTests++;
            }
        }
        
        // 显示测试总结
        this.displayTestSummary(passedTests, failedTests);
        
        return {
            total: tests.length,
            passed: passedTests,
            failed: failedTests,
            results: this.testResults
        };
    }

    /**
     * 显示测试总结
     */
    displayTestSummary(passed, failed) {
        console.log('\n📊 ====== 测试总结 ======');
        console.log(`✅ 通过测试: ${passed}`);
        console.log(`❌ 失败测试: ${failed}`);
        console.log(`📈 成功率: ${(passed / (passed + failed) * 100).toFixed(2)}%`);
        
        console.log('\n📋 详细结果:');
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            const duration = `${result.duration}ms`;
            console.log(`  ${status} ${index + 1}. ${result.name} (${duration})`);
            
            if (!result.success && result.error) {
                console.log(`     错误: ${result.error}`);
            }
        });
        
        console.log('========================\n');
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理测试资源...');
        
        if (this.client) {
            await this.client.cleanup();
        }
        
        this.logger.info('✅ 测试清理完成');
    }
}

// 命令行接口
if (require.main === module) {
    const { Command } = require('commander');
    const program = new Command();

    program
        .name('test-zkpay-client')
        .description('ZKPay 客户端库测试工具')
        .version('1.0.0');

    program
        .option('-c, --config <file>', '配置文件路径', 'config.yaml')
        .option('--json', '以JSON格式输出结果');

    program.action(async (options) => {
        const test = new ZKPayClientTest(options.config);
        
        try {
            await test.initialize();
            const results = await test.runAllTests();
            
            if (options.json) {
                console.log(JSON.stringify(results, null, 2));
            }
            
            // 如果有失败的测试，退出码为1
            if (results.failed > 0) {
                process.exit(1);
            }
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error.message);
            process.exit(1);
        } finally {
            await test.cleanup();
        }
    });

    program.parse();
}

module.exports = { ZKPayClientTest };
