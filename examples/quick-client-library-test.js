#!/usr/bin/env node

// ZKPay Client Library 快速VerifyTest
// 用于快速Verifyclient-library的基本Function是否Normal

// 加载Environment变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * 快速VerifyTest
 */
class QuickClientLibraryTest {
    constructor() {
        this.config = null;
        this.logger = createLogger('QuickTest');
        this.client = null;
        this.testResults = [];
    }

    /**
     * 初始化
     */
    async initialize() {
        console.log(chalk.blue('🔧 初始化快速Test...'));
        
        // CleanupLog
        this.clearLogs();
        
        // Use参数化Configuration
        const options = {
            apiConfig: {
                baseURL: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                timeout: 300000
            }
        };
        
        // Create客户端
        this.client = new ZKPayClient(this.logger, options);
        await this.client.initialize();
        
        console.log(chalk.green('✅ 快速Test初始化completed'));
    }

    /**
     * CleanupLog
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
     * ExecuteTest
     */
    async runTest(name, testFn) {
        console.log(chalk.cyan(`🧪 Test: ${name}`));
        const startTime = Date.now();
        
        try {
            const result = await testFn();
            const duration = Date.now() - startTime;
            
            console.log(chalk.green(`✅ ${name} - Pass (${duration}ms)`));
            this.testResults.push({ name, success: true, duration, result });
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log(chalk.red(`❌ ${name} - failed: ${error.message}`));
            this.testResults.push({ name, success: false, duration, error: error.message });
            throw error;
        }
    }

    /**
     * 快速Verify流程
     */
    async runQuickValidation() {
        console.log(chalk.blue('\n🚀 StartingZKPay Client Library快速Verify...\n'));
        
        try {
            // 1. Test初始化
            await this.runTest('客户端初始化', async () => {
                return {
                    initialized: this.client.isInitialized,
                    apiConnected: (await this.client.testApiConnection()).success
                };
            });

            // 2. Test登录
            const loginResult = await this.runTest('User登录', async () => {
                const privateKey = process.env.TEST_USER_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error('Please设置Environment变量 TEST_USER_PRIVATE_KEY');
                }
                return await this.client.login(privateKey);
            });

            // 3. TestTokenOperation
            await this.runTest('TokenOperation', async () => {
                const chainId = 714;  // SLIP44 BSC
                const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'; // BSC Testnet USDT
                
                const balance = await this.client.checkTokenBalance(chainId, tokenAddress);
                // 跳过授权Check，因为需要TreasuryAddressConfiguration
                // const allowance = await this.client.checkTokenAllowance(chainId, tokenAddress);
                
                return { balance, message: 'Token余额Checksuccessful' };
            });

            // 4. TestCheckBookQuery
            const deposits = await this.runTest('CheckBookQuery', async () => {
                return await this.client.getUserDeposits();
            });

            // 5. 如果有Deposit记录，TestCheckBookDetails
            if (deposits && deposits.length > 0) {
                await this.runTest('CheckBookDetails', async () => {
                    const checkbookId = deposits[0].checkbookId || deposits[0].checkbook_id;
                    if (!checkbookId) {
                        throw new Error(`Deposit记录中checkbook_id为空: ${JSON.stringify(deposits[0])}`);
                    }
                    return await this.client.getCheckbookDetails(checkbookId);
                });
            }

            // DisplayResult
            this.displayQuickResults();
            
            return true;

        } catch (error) {
            console.log(chalk.red(`\n❌ 快速Verifyfailed: ${error.message}\n`));
            this.displayQuickResults();
            return false;
        }
    }

    /**
     * Execute完整的FunctionTest（包含实际交易）
     */
    async runFullFunctionalTest() {
        console.log(chalk.blue('\n🚀 Starting完整FunctionTest（包含实际交易）...\n'));
        
        try {
            // 先Execute快速Verify
            const quickResult = await this.runQuickValidation();
            if (!quickResult) {
                throw new Error('快速Verifyfailed，跳过完整Test');
            }

            console.log(chalk.blue('\n🔄 继续完整FunctionTest...\n'));

            // 6. TestDeposit
            const depositResult = await this.runTest('DepositOperation', async () => {
                const chainId = 714;  // SLIP44 BSC
                const tokenAddress = '0xbFBD79DbF5369D013a3D31812F67784efa6e0309'; // BSC Testnet USDT
                const amount = '2.0'; // 最低Amount要求
                
                return await this.client.deposit(chainId, tokenAddress, amount);
            });

            // 7. WaitDeposit检测
            const depositRecord = await this.runTest('Deposit检测', async () => {
                return await this.client.waitForDepositDetection(
                    depositResult.deposit.txHash,
                    56,
                    60
                );
            });

                    // 8. WaitcheckbookStatus变为ready_for_commitment
        await this.runTest('Waitcheckbook准备', async () => {
            return await this.client.waitForCheckbookReady(depositRecord.checkbook_id); // UseDefault60秒超时
        });

            // 9. Test分配和Signature
            await this.runTest('分配和Signature', async () => {
                const allocations = [
                    {
                        recipient_chain_id: 714,  // SLIP44 BSC
                        recipient_address: this.client.getCurrentUser().address,
                        amount: "1800000", // 1.8 USDT (6位精度，扣除手续费后的可用Amount)
                    }
                ];
                
                return await this.client.executeCommitmentSync(
                    depositRecord.checkbook_id,
                    allocations,
                    true // Wait到with_checkbookStatus
                );
            });

            // 10. TestCommitmentStatusVerify（跳过重复Execute）
            await this.runTest('CommitmentStatusVerify', async () => {
                const details = await this.client.getCheckbookDetails(depositRecord.checkbook_id);
                if (details.status !== 'with_checkbook') {
                    throw new Error(`期望Status为with_checkbook，实际为${details.status}`);
                }
                return { status: details.status, message: 'CommitmentStatusVerifysuccessful' };
            });

            // 11. Test提现证明Generate
            await this.runTest('提现证明Generate', async () => {
                const recipientInfo = {
                    chain_id: 714,  // SLIP44 BSC
                    address: this.client.getCurrentUser().address,
                    amount: "1800000", // 1.8 USDT (6位精度)
                    token_symbol: "TUSDT"
                };
                
                return await this.client.generateProofSync(
                    depositRecord.checkbook_id,
                    recipientInfo,
                    true
                );
            });

            console.log(chalk.green('\n🎉 完整FunctionTest全部Pass！'));
            this.displayQuickResults();
            
            return true;

        } catch (error) {
            console.log(chalk.red(`\n❌ 完整FunctionTestfailed: ${error.message}\n`));
            this.displayQuickResults();
            return false;
        }
    }

    /**
     * Display快速TestResult
     */
    displayQuickResults() {
        console.log('\n' + chalk.blue('📊 ====== 快速TestResult ======'));
        
        const successCount = this.testResults.filter(t => t.success).length;
        const totalCount = this.testResults.length;
        const successRate = ((successCount / totalCount) * 100).toFixed(1);
        
        console.log(`总Test: ${totalCount}, Pass: ${chalk.green(successCount)}, failed: ${chalk.red(totalCount - successCount)}`);
        console.log(`successful率: ${successRate}%`);
        
        this.testResults.forEach(test => {
            const icon = test.success ? '✅' : '❌';
            const color = test.success ? chalk.green : chalk.red;
            console.log(`${icon} ${color(test.name)} (${test.duration}ms)`);
            
            if (!test.success) {
                console.log(`   ${chalk.red('Error:')} ${test.error}`);
            }
        });
        
        console.log('================================\n');
    }

    /**
     * Cleanup
     */
    async cleanup() {
        if (this.client) {
            await this.client.cleanup();
        }
    }
}

// CLIProcess
async function main() {
    const args = process.argv.slice(2);
    const testType = (args.includes('--full') || args.includes('functional')) ? 'full' : 'quick';
    
    console.log(chalk.blue('🔧 ZKPay Client Library VerifyTest\n'));
    
    try {
        const test = new QuickClientLibraryTest();
        await test.initialize();
        
        let success;
        if (testType === 'full') {
            success = await test.runFullFunctionalTest();
        } else {
            success = await test.runQuickValidation();
        }
        
        await test.cleanup();
        
        if (success) {
            console.log(chalk.green('🎉 ZKPay Client Library VerifyPass！'));
        } else {
            console.log(chalk.red('❌ ZKPay Client Library Verifyfailed！'));
        }
        
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error(chalk.red('❌ TestExecutefailed:'), error.message);
        process.exit(1);
    }
}

// 导出
module.exports = { QuickClientLibraryTest };

// 直接运行
if (require.main === module) {
    main();
}
