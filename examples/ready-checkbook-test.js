#!/usr/bin/env node

/**
 * TestUseExistingready CheckBookExecute完整的ZKSDK流程
 */

const { ZKPayClient } = require('./core/zkpay-client-library.js');
const fs = require('fs');
const { createLogger } = require('./examples/logger');

const logger = createLogger('ReadyCheckBookTest');

async function testReadyCheckBook() {
    try {
        logger.info('🚀 StartingTestExistingready CheckBook的完整ZKSDK流程...');
        
        // UseExisting的ready CheckBook
        const testCheckBookId = "e33ef2f5-42b5-4d46-9f0d-62d324552ab7";
        const recipientAddress = '0x742d35Cc6634C0532925a3b8D9C9C4F0e5b1D1F2';
        const transferAmount = '10000000000'; // 10000 USDT (6位小数)
        
        logger.info(`📋 UseCheckBook: ${testCheckBookId}`);
        logger.info(`🎯 ReceiveAddress: ${recipientAddress}`);
        logger.info(`💸 转账Amount: ${transferAmount} (10000 USDT)`);
        
        // 1. 初始化ZKPayClient
        logger.info('🔧 初始化ZKPayClient...');
        
        // CreateConfiguration
        const config = {
            services: {
                zkpay_backend: {
                    url: process.env.ZKPAY_BACKEND_URL || 'https://backend.zkpay.network',
                    timeout: 300000
                }
            },
            blockchain: {
                management_chain: {
                    chain_id: 714,  // SLIP44 BSC
                    rpc_url: 'https://bsc-dataseed1.binance.org',
                    contracts: {
                        treasury_contract: '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8'
                    },
                    tokens: {
                        test_usdt: {
                            address: '0xbFBD79DbF5369D013a3D31812F67784efa6e0309',
                            decimals: 6,
                            symbol: 'TUSDT',
                            token_id: 65535
                        }
                    }
                },
                source_chains: [{
                    chain_id: 714,  // SLIP44 BSC
                    rpc_url: 'https://bsc-dataseed1.binance.org',
                    contracts: {
                        treasury_contract: '0x83DCC14c8d40B87DE01cC641b655bD608cf537e8'
                    },
                    tokens: {
                        test_usdt: {
                            address: '0xbFBD79DbF5369D013a3D31812F67784efa6e0309',
                            decimals: 6,
                            symbol: 'TUSDT',
                            token_id: 65535
                        }
                    }
                }]
            },
            test: {
                users: {
                    default: {
                        private_key: null // 将在下面设置
                    }
                }
            }
        };
        
        // UseMaster OperatorPrivate Key
        const privateKey = process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY?.startsWith('0x') 
            ? process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY 
            : `0x${process.env.MASTER_OPERATOR_BSC_PRIVATE_KEY}`;
            
        config.test.users.default.private_key = privateKey;
        
        // 修复API URL
        if (config.services.zkpay_backend.url.endsWith('/api/v2')) {
            config.services.zkpay_backend.url = config.services.zkpay_backend.url.replace('/api/v2', '');
        }
        
        const zkpayClient = new ZKPayClient(config, logger);
        await zkpayClient.initialize();
        await zkpayClient.login(privateKey);
        
        logger.info('✅ ZKPayClient初始化completed');
        
        // 2. ExecuteCommitment
        logger.info('📋 Step1: ExecuteCommitment...');
        
        const allocations = [{
            recipient_chain_id: 714,
            recipient_address: recipientAddress,
            amount: transferAmount
        }];
        
        const commitmentResult = await zkpayClient.executeCommitmentSync(
            testCheckBookId,
            allocations,
            true // Waitwith_checkbookStatus
        );
        
        if (!commitmentResult.success) {
            throw new Error(`Commitmentfailed: ${commitmentResult.error}`);
        }
        
        logger.info('✅ CommitmentExecutesuccessful');
        logger.info(`🔗 CommitmentHash: ${commitmentResult.commitmentHash}`);
        
        // 3. ExecuteWithdraw
        logger.info('🔄 Step2: ExecuteWithdraw...');
        
        const recipientInfo = {
            chain_id: 714,
            recipient_address: recipientAddress,
            amount: transferAmount,
            token_symbol: 'test_usdt'
        };
        
        const withdrawResult = await zkpayClient.withdraw(
            testCheckBookId,
            recipientInfo
        );
        
        if (!withdrawResult.success) {
            throw new Error(`Withdrawfailed: ${withdrawResult.error}`);
        }
        
        logger.info('✅ WithdrawExecutesuccessful');
        logger.info(`🎫 Check ID: ${withdrawResult.checkId}`);
        
        // 4. ExecutePayout
        logger.info('💰 Step3: ExecutePayout...');
        
        const payoutResult = await zkpayClient.payout(
            withdrawResult.checkId,
            recipientAddress,
            714
        );
        
        if (!payoutResult.success) {
            throw new Error(`Payoutfailed: ${payoutResult.error}`);
        }
        
        logger.info('✅ PayoutExecutesuccessful');
        logger.info(`🔗 交易Hash: ${payoutResult.txHash}`);
        
        // 5. completedSummary
        logger.info('🎉 完整ZKSDK流程Executesuccessful！');
        logger.info('📋 ExecuteStepSummary:');
        logger.info(`   1. ✅ Commitment: ${commitmentResult.commitmentHash}`);
        logger.info(`   2. ✅ Withdraw: ${withdrawResult.checkId}`);
        logger.info(`   3. ✅ Payout: ${payoutResult.txHash}`);
        logger.info(`💸 successful转账 10000 USDT 到 ${recipientAddress}`);
        
        return {
            success: true,
            checkbookId: testCheckBookId,
            commitmentHash: commitmentResult.commitmentHash,
            checkId: withdrawResult.checkId,
            txHash: payoutResult.txHash
        };
        
    } catch (error) {
        logger.error('❌ Testfailed:', error.message);
        logger.error('ErrorDetails:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 运行Test
testReadyCheckBook()
    .then(result => {
        if (result.success) {
            console.log('🎉 Testsuccessfulcompleted！');
            process.exit(0);
        } else {
            console.log('❌ Testfailed');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Test异常:', error);
        process.exit(1);
    });

