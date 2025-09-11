#!/usr/bin/env node

// ZKPay Client Library 快速验证测试
// 用于快速验证client-library的基本功能是否正常

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * 快速验证测试
 */
class QuickClientLibraryTest {
    constructor(configFile = './config.yaml') {
        this.configFile = configFile;
        this.config = null;
        this.logger = createLogger('QuickTest');
        this.client = null;
        this.testResults = [];
    }

    /**
     * 初始化
     */
    async initialize() {
        console.log(chalk.blue('🔧 初始化快速测试...'));
        
        // 清理日志
        this.clearLogs();
        
        // 加载配置
        this.loadConfig();
        
        // 创建客户端
        this.client = new ZKPayClient(this.config, this.logger);
        await this.client.initialize();
        
        console.log(chalk.green('✅ 快速测试初始化完成'));
    }

    /**
     * 清理日志
     */
    clearLogs() {
        const logFiles = [
            './zkpay-client-library/e2e-test.log',
            './zkpay-client-library/exceptions.log',
            './zkpay-client-library/rejections.log'
        ];
        
        logFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }

    /**
     * 加载配置
     */
    loadConfig() {
        const configPath = path.resolve(this.configFile);
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // 处理环境变量
        const processedContent = configContent.replace(/\${([^}]+)}/g, (match, envVar) => {
            const [varName, defaultValue] = envVar.split(':-');
            return process.env[varName] || defaultValue || match;
        });
        
        this.config = yaml.load(processedContent);
    }

    /**
     * 执行测试
     */
    async runTest(name, testFn) {
        console.log(chalk.cyan(`🧪 测试: ${name}`));
        const startTime = Date.now();
        
        try {
            const result = await testFn();
            const duration = Date.now() - startTime;
            
            console.log(chalk.green(`✅ ${name} - 通过 (${duration}ms)`));
            this.testResults.push({ name, success: true, duration, result });
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log(chalk.red(`❌ ${name} - 失败: ${error.message}`));
            this.testResults.push({ name, success: false, duration, error: error.message });
            throw error;
        }
    }

    /**
     * 快速验证流程
     */
    async runQuickValidation() {
        console.log(chalk.blue('\n🚀 开始ZKPay Client Library快速验证...\n'));
        
        try {
            // 1. 测试初始化
            await this.runTest('客户端初始化', async () => {
                return {
                    initialized: this.client.isInitialized,
                    apiConnected: (await this.client.testApiConnection()).success
                };
            });

            // 2. 测试登录
            const loginResult = await this.runTest('用户登录', async () => {
                const privateKey = Object.values(this.config.test_users)[0].private_key;
                return await this.client.login(privateKey);
            });

            // 3. 测试Token操作
            await this.runTest('Token操作', async () => {
                const chainId = 56;
                const tokenSymbol = 'test_usdt';
                
                const balance = await this.client.checkTokenBalance(chainId, tokenSymbol);
                const allowance = await this.client.checkTokenAllowance(chainId, tokenSymbol);
                
                return { balance, allowance };
            });

            // 4. 测试CheckBook查询
            const deposits = await this.runTest('CheckBook查询', async () => {
                return await this.client.getUserDeposits();
            });

            // 5. 如果有存款记录，测试CheckBook详情
            if (deposits && deposits.length > 0) {
                await this.runTest('CheckBook详情', async () => {
                    const checkbookId = deposits[0].checkbookId || deposits[0].checkbook_id;
                    if (!checkbookId) {
                        throw new Error(`存款记录中checkbook_id为空: ${JSON.stringify(deposits[0])}`);
                    }
                    return await this.client.getCheckbookDetails(checkbookId);
                });
            }

            // 显示结果
            this.displayQuickResults();
            
            return true;

        } catch (error) {
            console.log(chalk.red(`\n❌ 快速验证失败: ${error.message}\n`));
            this.displayQuickResults();
            return false;
        }
    }

    /**
     * 执行完整的功能测试（包含实际交易）
     */
    async runFullFunctionalTest() {
        console.log(chalk.blue('\n🚀 开始完整功能测试（包含实际交易）...\n'));
        
        try {
            // 先执行快速验证
            const quickResult = await this.runQuickValidation();
            if (!quickResult) {
                throw new Error('快速验证失败，跳过完整测试');
            }

            console.log(chalk.blue('\n🔄 继续完整功能测试...\n'));

            // 6. 测试存款
            const depositResult = await this.runTest('存款操作', async () => {
                const chainId = 56;
                const tokenSymbol = 'test_usdt';
                const amount = '2.0'; // 最低金额要求
                
                return await this.client.deposit(chainId, tokenSymbol, amount);
            });

            // 7. 等待存款检测
            const depositRecord = await this.runTest('存款检测', async () => {
                return await this.client.waitForDepositDetection(
                    depositResult.deposit.txHash,
                    56,
                    60
                );
            });

                    // 8. 等待checkbook状态变为ready_for_commitment
        await this.runTest('等待checkbook准备', async () => {
            return await this.client.waitForCheckbookReady(depositRecord.checkbook_id); // 使用默认60秒超时
        });

            // 9. 测试分配和签名
            await this.runTest('分配和签名', async () => {
                const allocations = [
                    {
                        recipient_chain_id: 56,
                        recipient_address: this.client.getCurrentUser().address,
                        amount: "1800000", // 1.8 USDT (6位精度，扣除手续费后的可用金额)
                    }
                ];
                
                return await this.client.executeCommitmentSync(
                    depositRecord.checkbook_id,
                    allocations,
                    true // 等待到with_checkbook状态
                );
            });

            // 10. 测试Commitment状态验证（跳过重复执行）
            await this.runTest('Commitment状态验证', async () => {
                const details = await this.client.getCheckbookDetails(depositRecord.checkbook_id);
                if (details.status !== 'with_checkbook') {
                    throw new Error(`期望状态为with_checkbook，实际为${details.status}`);
                }
                return { status: details.status, message: 'Commitment状态验证成功' };
            });

            // 11. 测试提现证明生成
            await this.runTest('提现证明生成', async () => {
                const recipientInfo = {
                    chain_id: 56,
                    address: this.client.getCurrentUser().address,
                    amount: "1800000", // 1.8 USDT (6位精度)
                    token_symbol: "test_usdt"
                };
                
                return await this.client.generateProofSync(
                    depositRecord.checkbook_id,
                    recipientInfo,
                    true
                );
            });

            console.log(chalk.green('\n🎉 完整功能测试全部通过！'));
            this.displayQuickResults();
            
            return true;

        } catch (error) {
            console.log(chalk.red(`\n❌ 完整功能测试失败: ${error.message}\n`));
            this.displayQuickResults();
            return false;
        }
    }

    /**
     * 显示快速测试结果
     */
    displayQuickResults() {
        console.log('\n' + chalk.blue('📊 ====== 快速测试结果 ======'));
        
        const successCount = this.testResults.filter(t => t.success).length;
        const totalCount = this.testResults.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);
        
        console.log(`总测试: ${totalCount}, 通过: ${chalk.green(successCount)}, 失败: ${chalk.red(totalCount - successCount)}`);
        console.log(`成功率: ${successRate}%`);
        
        this.testResults.forEach(test => {
            const icon = test.success ? '✅' : '❌';
            const color = test.success ? chalk.green : chalk.red;
            console.log(`${icon} ${color(test.name)} (${test.duration}ms)`);
            
            if (!test.success) {
                console.log(`   ${chalk.red('错误:')} ${test.error}`);
            }
        });
        
        console.log('================================\n');
    }

    /**
     * 清理
     */
    async cleanup() {
        if (this.client) {
            await this.client.cleanup();
        }
    }
}

// CLI处理
async function main() {
    const args = process.argv.slice(2);
    const configFile = args.find(arg => arg.startsWith('--config='))?.split('=')[1] || 
                      (args.includes('--config') ? args[args.indexOf('--config') + 1] : './config.yaml');
    
    const testType = (args.includes('--full') || args.includes('functional')) ? 'full' : 'quick';
    
    console.log(chalk.blue('🔧 ZKPay Client Library 验证测试\n'));
    
    try {
        const test = new QuickClientLibraryTest(configFile);
        await test.initialize();
        
        let success;
        if (testType === 'full') {
            success = await test.runFullFunctionalTest();
        } else {
            success = await test.runQuickValidation();
        }
        
        await test.cleanup();
        
        if (success) {
            console.log(chalk.green('🎉 ZKPay Client Library 验证通过！'));
        } else {
            console.log(chalk.red('❌ ZKPay Client Library 验证失败！'));
        }
        
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error(chalk.red('❌ 测试执行失败:'), error.message);
        process.exit(1);
    }
}

// 导出
module.exports = { QuickClientLibraryTest };

// 直接运行
if (require.main === module) {
    main();
}
