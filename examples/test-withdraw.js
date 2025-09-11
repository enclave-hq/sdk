#!/usr/bin/env node

// 测试withdraw功能

// 加载环境变量
require('dotenv').config();

const { ZKPayClient } = require('../core/zkpay-client-library');
const { createLogger } = require('../utils/logger');

async function testWithdraw() {
    const logger = createLogger('TestWithdraw');
    
    try {
        // 从环境变量获取私钥和接收地址
        const testPrivateKey = process.env.TEST_PRIVATE_KEY;
        const recipientAddress = process.env.TEST_RECIPIENT_ADDRESS;
        
        if (!testPrivateKey || testPrivateKey === 'YOUR_TEST_PRIVATE_KEY_HERE') {
            throw new Error('请在.env文件中设置TEST_PRIVATE_KEY环境变量');
        }
        
        if (!recipientAddress) {
            throw new Error('请在.env文件中设置TEST_RECIPIENT_ADDRESS环境变量');
        }

        // 配置
        const config = {
            services: {
                zkpay_backend: {
                    url: 'https://backend.zkpay.network',
                    timeout: 300000
                }
            },
            test_users: {
                default: {
                    private_key: testPrivateKey
                }
            },
            blockchain: {
                management_chain: {
                    chain_id: 56,
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
                    chain_id: 56,
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
            test_config: {
                withdraw: {
                    default_recipient_address: recipientAddress
                }
            }
        };
        
        // 创建客户端
        const client = new ZKPayClient(config, logger);
        await client.initialize();
        
        // 登录 - 使用环境变量中的私钥
        const loginResult = await client.login(testPrivateKey);
        const userAddress = loginResult.address;
        
        logger.info(`👤 使用私钥对应的地址: ${userAddress}`);
        
        // 获取用户存款记录
        const deposits = await client.getUserDeposits(userAddress);
        logger.info('📊 找到存款记录数:', deposits.length);
        
        // 显示所有状态
        const statusCounts = {};
        deposits.forEach(d => {
            statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
        });
        logger.info('📊 状态统计:', statusCounts);
        
        // 查找可用的checkbook（优先选择with_checkbook状态，表示commitment已完成）
        let targetCheckbook = deposits.find(d => d.status === 'with_checkbook');
        if (!targetCheckbook) {
            targetCheckbook = deposits.find(d => d.status === 'ready_for_commitment');
        }
        if (!targetCheckbook) {
            targetCheckbook = deposits[0]; // 使用第一个
        }
        
        if (targetCheckbook) {
            logger.info('🎯 选择checkbook进行withdraw测试:');
            logger.info('  Checkbook ID:', targetCheckbook.checkbookId);
            logger.info('  Status:', targetCheckbook.status);
            logger.info('  Token ID:', targetCheckbook.tokenId);
            logger.info('  Amount:', targetCheckbook.grossAmount);
            
            // 如果状态不是with_checkbook，先执行commitment
            if (targetCheckbook.status !== 'with_checkbook') {
                logger.info('🔄 状态不是with_checkbook，先执行commitment...');
                
                const allocations = [{
                    recipient_chain_id: 714,
                    recipient_address: recipientAddress,
                    amount: '10000000000000000000' // 10.0 USDT (18 decimals)
                }];
                
                const commitmentResult = await client.executeCommitmentSync(
                    targetCheckbook.checkbookId,
                    allocations,
                    true // 等待with_checkbook状态
                );
                
                logger.info('✅ Commitment执行结果:', commitmentResult);
            }
            
            // 现在执行withdraw
            logger.info('🚀 开始执行withdraw...');
            
            const recipientInfo = {
                chain_id: 714,
                address: recipientAddress,
                amount: "10000000000000000000", // 10.0 USDT (18 decimals)
                token_symbol: 'test_usdt'
            };
            
            // 执行完整提现流程
            const withdrawResult = await client.performFullCommitmentToWithdraw(
                targetCheckbook.checkbookId,
                recipientInfo,
                {
                    waitForProof: true,
                    maxWaitTime: 300
                }
            );
            
            logger.info('✅ Withdraw执行结果:', withdrawResult);
            
        } else {
            logger.info('❌ 没有找到可用的checkbook');
        }
        
    } catch (error) {
        logger.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    }
}

testWithdraw();
