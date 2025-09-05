#!/usr/bin/env node

// ZKPay 客户端库使用示例
// 展示如何使用ZKPay客户端库进行完整的操作流程

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('./logger');

/**
 * ZKPay 客户端使用示例
 */
class ZKPayClientExample {
    constructor(configFile) {
        this.configFile = configFile;
        this.config = null;
        this.logger = createLogger('ZKPayExample');
        this.client = null;
    }

    /**
     * 初始化示例
     */
    async initialize() {
        // 加载配置
        this.loadConfig();
        
        // 创建客户端
        this.client = new ZKPayClient(this.config, this.logger);
        
        // 初始化客户端
        await this.client.initialize();
        
        this.logger.info('✅ ZKPay客户端示例初始化完成');
    }

    /**
     * 加载配置文件
     */
    loadConfig() {
        try {
            const configPath = path.resolve(this.configFile);
            const configContent = fs.readFileSync(configPath, 'utf8');
            
            // 处理环境变量替换
            const processedContent = this.processEnvironmentVariables(configContent);
            this.config = yaml.load(processedContent);
            
            this.logger.info('✅ 配置文件加载成功');
        } catch (error) {
            this.logger.error('❌ 配置文件加载失败:', error.message);
            throw error;
        }
    }

    /**
     * 处理配置文件中的环境变量
     */
    processEnvironmentVariables(content) {
        return content.replace(/\${([^}]+)}/g, (match, envVar) => {
            const [varName, defaultValue] = envVar.split(':-');
            return process.env[varName] || defaultValue || match;
        });
    }

    // ==================== 基础操作示例 ====================

    /**
     * 示例1: 登录和基础信息查询
     */
    async example1_LoginAndBasicInfo() {
        this.logger.info('🔰 示例1: 登录和基础信息查询');
        
        try {
            // 使用配置中的私钥登录
            const privateKey = Object.values(this.config.test_users)[0].private_key;
            const loginResult = await this.client.login(privateKey, 'example_user');
            
            this.logger.info('✅ 登录成功:', {
                address: loginResult.address,
                userName: loginResult.userName
            });
            
            // 检查Token余额
            const balance = await this.client.checkTokenBalance(56, 'test_usdt');
            this.logger.info('💰 Token余额:', balance);
            
            // 检查授权额度
            const allowance = await this.client.checkTokenAllowance(56, 'test_usdt');
            this.logger.info('🔍 授权额度:', allowance);
            
            // 获取用户存款记录
            const deposits = await this.client.getUserDeposits();
            this.logger.info(`📋 用户存款记录: ${deposits.length} 条`);
            
            return { loginResult, balance, allowance, deposits };
            
        } catch (error) {
            this.logger.error('❌ 示例1执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例2: 执行存款操作
     */
    async example2_PerformDeposit() {
        this.logger.info('🔰 示例2: 执行存款操作');
        
        try {
            const chainId = 56;
            const tokenSymbol = 'test_usdt';
            const amount = '10.0';
            
            // 先检查余额
            const balance = await this.client.checkTokenBalance(chainId, tokenSymbol);
            if (parseFloat(balance.formatted) < parseFloat(amount)) {
                throw new Error(`余额不足: 需要 ${amount}, 但只有 ${balance.formatted}`);
            }
            
            // 执行存款（包含授权）
            const depositResult = await this.client.deposit(chainId, tokenSymbol, amount);
            
            this.logger.info('✅ 存款成功:', {
                txHash: depositResult.deposit.txHash,
                depositId: depositResult.deposit.depositEvent?.depositId
            });
            
            // 等待后端检测存款
            const depositRecord = await this.client.waitForDepositDetection(
                depositResult.deposit.txHash,
                chainId,
                60
            );
            
            this.logger.info('✅ 存款检测完成:', {
                checkbookId: depositRecord.checkbook_id,
                status: depositRecord.status
            });
            
            return { depositResult, depositRecord };
            
        } catch (error) {
            this.logger.error('❌ 示例2执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例3: 创建分配并执行Commitment（同步方式）
     */
    async example3_CommitmentSync(checkbookId) {
        this.logger.info('🔰 示例3: 创建分配并执行Commitment（同步方式）');
        
        try {
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
                amount: "10000000000000000000" // 10.0 USDT (18 decimals)
            }];
            
            // 执行Commitment（同步，等待完成）
            const commitmentResult = await this.client.executeCommitmentSync(
                checkbookId,
                allocations,
                true // 等待到with_checkbook状态
            );
            
            this.logger.info('✅ Commitment执行成功（同步）:', {
                checkbookId,
                status: commitmentResult.status,
                finalStatus: commitmentResult.finalStatus
            });
            
            return commitmentResult;
            
        } catch (error) {
            this.logger.error('❌ 示例3执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例4: 创建分配并执行Commitment（异步方式）
     */
    async example4_CommitmentAsync(checkbookId) {
        this.logger.info('🔰 示例4: 创建分配并执行Commitment（异步方式）');
        
        try {
            // 创建分配方案
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
                amount: "10000000000000000000" // 10.0 USDT (18 decimals)
            }];
            
            // 执行Commitment（异步，立即返回）
            const commitmentResult = await this.client.executeCommitmentAsync(
                checkbookId,
                allocations
            );
            
            this.logger.info('✅ Commitment提交成功（异步）:', {
                checkbookId,
                status: commitmentResult.status
            });
            
            // 可以选择等待完成
            this.logger.info('⏳ 等待Commitment完成...');
            const finalResult = await commitmentResult.waitForCompletion();
            
            this.logger.info('✅ Commitment完成:', {
                finalStatus: finalResult.status
            });
            
            return { commitmentResult, finalResult };
            
        } catch (error) {
            this.logger.error('❌ 示例4执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例5: 生成提现证明（同步方式）
     */
    async example5_GenerateProofSync(checkbookId) {
        this.logger.info('🔰 示例5: 生成提现证明（同步方式）');
        
        try {
            const recipientInfo = {
                chain_id: 714,
                address: this.client.getCurrentUser().address,
                amount: "10000000000000000000",
                token_symbol: 'test_usdt'
            };
            
            // 生成证明（同步，等待完成）
            const proofResult = await this.client.generateProofSync(
                checkbookId,
                recipientInfo,
                true // 等待到completed状态
            );
            
            this.logger.info('✅ 证明生成成功（同步）:', {
                checkId: proofResult.checkId,
                finalStatus: proofResult.finalStatus
            });
            
            if (proofResult.completionResult?.transaction_hash) {
                this.logger.info('💰 提现交易哈希:', proofResult.completionResult.transaction_hash);
            }
            
            return proofResult;
            
        } catch (error) {
            this.logger.error('❌ 示例5执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例6: 生成提现证明（异步方式）
     */
    async example6_GenerateProofAsync(checkbookId) {
        this.logger.info('🔰 示例6: 生成提现证明（异步方式）');
        
        try {
            const recipientInfo = {
                chain_id: 714,
                address: this.client.getCurrentUser().address,
                amount: "10000000000000000000",
                token_symbol: 'test_usdt'
            };
            
            // 生成证明（异步，立即返回）
            const proofResult = await this.client.generateProofAsync(
                checkbookId,
                recipientInfo
            );
            
            this.logger.info('✅ 证明生成请求提交成功（异步）:', {
                checkId: proofResult.checkId
            });
            
            // 可以选择等待完成
            this.logger.info('⏳ 等待证明生成完成...');
            const completionResult = await proofResult.waitForCompletion();
            
            this.logger.info('✅ 证明生成完成:', {
                status: completionResult.status
            });
            
            if (completionResult.transaction_hash) {
                this.logger.info('💰 提现交易哈希:', completionResult.transaction_hash);
            }
            
            return { proofResult, completionResult };
            
        } catch (error) {
            this.logger.error('❌ 示例6执行失败:', error.message);
            throw error;
        }
    }

    // ==================== 高级操作示例 ====================

    /**
     * 示例7: 完整的存款到Commitment流程
     */
    async example7_FullDepositToCommitment() {
        this.logger.info('🔰 示例7: 完整的存款到Commitment流程');
        
        try {
            const chainId = 56;
            const tokenSymbol = 'test_usdt';
            const amount = '15.0';
            
            const allocations = [{
                recipient_chain_id: 714,
                recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
                amount: "15000000000000000000" // 15.0 USDT
            }];
            
            // 执行完整流程
            const result = await this.client.performFullDepositToCommitment(
                chainId,
                tokenSymbol,
                amount,
                allocations,
                {
                    waitForCommitment: true,
                    maxWaitTime: 300
                }
            );
            
            this.logger.info('✅ 完整流程执行成功:', {
                depositTxHash: result.deposit.deposit.txHash,
                checkbookId: result.depositRecord.checkbook_id,
                commitmentStatus: result.commitment.status
            });
            
            return result;
            
        } catch (error) {
            this.logger.error('❌ 示例7执行失败:', error.message);
            throw error;
        }
    }

    /**
     * 示例8: 完整的Commitment到提现流程
     */
    async example8_FullCommitmentToWithdraw(checkbookId) {
        this.logger.info('🔰 示例8: 完整的Commitment到提现流程');
        
        try {
            const recipientInfo = {
                chain_id: 714,
                address: this.client.getCurrentUser().address,
                amount: "15000000000000000000",
                token_symbol: 'test_usdt'
            };
            
            // 执行完整提现流程
            const result = await this.client.performFullCommitmentToWithdraw(
                checkbookId,
                recipientInfo,
                {
                    waitForProof: true,
                    maxWaitTime: 300
                }
            );
            
            this.logger.info('✅ 完整提现流程执行成功:', {
                checkbookId,
                checkId: result.proof.checkId,
                finalStatus: result.proof.finalStatus
            });
            
            if (result.proof.completionResult?.transaction_hash) {
                this.logger.info('💰 提现交易哈希:', result.proof.completionResult.transaction_hash);
            }
            
            return result;
            
        } catch (error) {
            this.logger.error('❌ 示例8执行失败:', error.message);
            throw error;
        }
    }

    // ==================== 运行示例 ====================

    /**
     * 运行所有示例
     */
    async runAllExamples() {
        this.logger.info('🚀 开始运行所有ZKPay客户端示例...');
        
        const results = {};
        
        try {
            // 示例1: 登录和基础信息
            results.example1 = await this.example1_LoginAndBasicInfo();
            
            // 示例2: 执行存款
            results.example2 = await this.example2_PerformDeposit();
            const checkbookId = results.example2.depositRecord.checkbook_id;
            
            // 示例3: Commitment（同步）
            results.example3 = await this.example3_CommitmentSync(checkbookId);
            
            // 示例5: 生成证明（同步）
            results.example5 = await this.example5_GenerateProofSync(checkbookId);
            
            this.logger.info('🎉 所有示例运行成功！');
            
            // 显示总结
            this.displaySummary(results);
            
            return results;
            
        } catch (error) {
            this.logger.error('❌ 示例运行失败:', error.message);
            throw error;
        }
    }

    /**
     * 运行单个示例
     */
    async runSingleExample(exampleName, ...args) {
        this.logger.info(`🚀 运行单个示例: ${exampleName}`);
        
        try {
            // 确保已登录
            if (!this.client.isLoggedIn()) {
                const privateKey = Object.values(this.config.test_users)[0].private_key;
                await this.client.login(privateKey, 'example_user');
            }
            
            const methodName = `example${exampleName.replace('example', '')}`;
            if (typeof this[methodName] !== 'function') {
                throw new Error(`示例方法不存在: ${methodName}`);
            }
            
            const result = await this[methodName](...args);
            this.logger.info(`✅ 示例 ${exampleName} 运行成功`);
            
            return result;
            
        } catch (error) {
            this.logger.error(`❌ 示例 ${exampleName} 运行失败:`, error.message);
            throw error;
        }
    }

    /**
     * 显示运行总结
     */
    displaySummary(results) {
        console.log('\n📊 ====== 运行总结 ======');
        
        if (results.example1) {
            console.log(`✅ 登录成功: ${results.example1.loginResult.address}`);
        }
        
        if (results.example2) {
            console.log(`✅ 存款成功: ${results.example2.depositResult.deposit.txHash}`);
            console.log(`📋 CheckBook ID: ${results.example2.depositRecord.checkbook_id}`);
        }
        
        if (results.example3) {
            console.log(`✅ Commitment成功: ${results.example3.status}`);
        }
        
        if (results.example5) {
            console.log(`✅ 提现成功: ${results.example5.checkId}`);
            if (results.example5.completionResult?.transaction_hash) {
                console.log(`💰 提现交易: ${results.example5.completionResult.transaction_hash}`);
            }
        }
        
        console.log('========================\n');
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理示例资源...');
        
        if (this.client) {
            await this.client.cleanup();
        }
        
        this.logger.info('✅ 示例清理完成');
    }
}

// 命令行接口
if (require.main === module) {
    const { Command } = require('commander');
    const program = new Command();

    program
        .name('zkpay-client-example')
        .description('ZKPay 客户端库使用示例')
        .version('1.0.0');

    program
        .option('-c, --config <file>', '配置文件路径', 'config.yaml')
        .option('-e, --example <name>', '运行指定示例 (例如: example1, example2)')
        .option('--checkbook-id <id>', 'CheckBook ID (用于某些示例)')
        .option('--all', '运行所有示例');

    program.action(async (options) => {
        const example = new ZKPayClientExample(options.config);
        
        try {
            await example.initialize();
            
            if (options.all) {
                await example.runAllExamples();
            } else if (options.example) {
                const args = options.checkbookId ? [options.checkbookId] : [];
                await example.runSingleExample(options.example, ...args);
            } else {
                console.log('请指定 --all 运行所有示例，或 --example <name> 运行指定示例');
                program.help();
            }
            
        } catch (error) {
            console.error('❌ 示例执行失败:', error.message);
            process.exit(1);
        } finally {
            await example.cleanup();
        }
    });

    program.parse();
}

module.exports = { ZKPayClientExample };
