// ZKPay Commitment 管理器 - 处理 Commitment 生成和提交流程

const axios = require('axios');
const { createLogger } = require('../utils/logger');
const AddressFormatter = require('../utils/address-formatter');

class ZKPayCommitmentManager {
    constructor(walletManager, logger, options = {}) {
        this.walletManager = walletManager;
        this.logger = logger || createLogger('CommitmentManager');
        this.apiClient = null;
        this.wsConnection = null;
        
        // 参数化配置
        this.defaultRecipientAddress = options.defaultRecipientAddress || "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce";
        this.maxWaitTime = options.maxWaitTime || 300000;
        this.apiConfig = options.apiConfig || {
            baseURL: process.env.ZKPAY_API_URL || 'https://backend.zkpay.network',
            timeout: parseInt(process.env.ZKPAY_API_TIMEOUT) || 300000
        };
    }

    /**
     * 初始化Commitment管理器
     */
    async initialize() {
        this.logger.info('🔗 初始化Commitment管理器...');
        
        // 初始化API客户端
        this.apiClient = axios.create({
            baseURL: this.apiConfig.baseURL,
            timeout: this.apiConfig.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // 设置请求拦截器
        this.apiClient.interceptors.request.use(
            (config) => {
                this.logger.debug(`📤 API请求: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                this.logger.error(`❌ API请求错误:`, error.message);
                return Promise.reject(error);
            }
        );

        // 设置响应拦截器
        this.apiClient.interceptors.response.use(
            (response) => {
                this.logger.debug(`📥 API响应: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'NO_RESPONSE';
                const url = error.config?.url || 'UNKNOWN_URL';
                this.logger.error(`❌ API响应错误: ${status} ${url} - ${error.message}`);
                return Promise.reject(error);
            }
        );

        // 测试API连接
        await this.testApiConnection();
        
        this.logger.info('✅ Commitment管理器初始化完成');
    }

    /**
     * 测试API连接
     */
    async testApiConnection() {
        try {
            const response = await this.apiClient.get('/health');
            this.logger.info(`🔗 API连接测试成功: ${response.data?.message || 'OK'}`);
            return { success: true, message: response.data?.message || 'OK' };
        } catch (error) {
            this.logger.error(`❌ API连接测试失败:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 创建存款记录
     */
    async createDeposit(depositData) {
        this.logger.info(`📝 创建存款记录...`);
        this.logger.info(`   存款金额: ${depositData.amount}`);
        this.logger.info(`   Token: ${depositData.token_symbol}`);
        this.logger.info(`   链ID: ${depositData.chain_id}`);

        try {
            const requestData = {
                chain_id: depositData.chain_id,
                user_address: depositData.user_address,
                token_address: depositData.token_address,
                token_symbol: depositData.token_symbol,
                amount: depositData.amount,
                transaction_hash: depositData.transaction_hash,
                deposit_id: depositData.deposit_id,
                token_id: depositData.token_id,
                user_data: depositData.user_data || depositData.user_address
            };

            const response = await this.apiClient.post('/api/v2/deposits', requestData);
            const result = response.data;

            this.logger.info(`✅ 存款记录创建成功:`);
            this.logger.info(`   数据库ID: ${result.id}`);
            this.logger.info(`   状态: ${result.status}`);
            this.logger.info(`   链上存款ID: ${result.local_deposit_id}`);

            return result;

        } catch (error) {
            this.logger.error(`❌ 创建存款记录失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 获取存款信息 - 使用链ID和本地存款ID查询
     */
    async getDeposit(chainId, localDepositId) {
        try {
            const response = await this.apiClient.get(`/api/v2/deposits/${chainId}/${localDepositId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取存款信息失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 等待后端检测存款事件并创建记录
     */
    async waitForDepositDetection(txHash, chainId, userAddress, maxWaitTime = 60) {
        this.logger.info(`👁️ 等待后端检测存款事件...`);
        this.logger.info(`   交易哈希: ${txHash}`);
        this.logger.info(`   链ID: ${chainId}`);
        this.logger.info(`   用户地址: ${userAddress}`);
        this.logger.info(`   最大等待时间: ${maxWaitTime}秒`);

        const startTime = Date.now();
        const pollInterval = 2000; // 2秒轮询一次

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                this.logger.info(`🔄 轮询存款记录 (第${Math.floor((Date.now() - startTime) / pollInterval) + 1}次)...`);
                
                // 查询用户的存款记录
                const deposits = await this.getUserDeposits(userAddress, 714); // 使用SLIP-44链ID
                
                this.logger.info(`📋 查询到 ${deposits.length} 条存款记录`);
                if (deposits.length > 0) {
                    this.logger.info(`🔍 最新存款交易哈希: ${deposits[0].deposit_tx_hash}`);
                    this.logger.info(`🎯 目标交易哈希: ${txHash}`);
                }
                
                // 查找匹配交易哈希的存款记录
                const matchingDeposit = deposits.find(deposit => 
                    deposit.deposit_tx_hash && 
                    typeof deposit.deposit_tx_hash === 'string' &&
                    deposit.deposit_tx_hash.toLowerCase() === txHash.toLowerCase()
                );

                if (matchingDeposit) {
                    this.logger.info(`✅ 后端已检测到存款记录!`);
                    this.logger.info(`   数据库ID: ${matchingDeposit.checkbook_id}`);
                    this.logger.info(`   状态: ${matchingDeposit.status}`);
                    this.logger.info(`   链上存款ID: ${matchingDeposit.local_deposit_id}`);
                    return matchingDeposit;
                }

                this.logger.info(`⏳ 未找到匹配记录，等待${pollInterval/1000}秒后重试...`);
                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
            } catch (error) {
                this.logger.warn(`⚠️ 轮询存款记录时出错: ${error.message}`);
                this.logger.warn(`⚠️ 错误详情: ${error.response?.data || error.stack}`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`等待后端检测存款超时 (${maxWaitTime}秒)`);
    }

    /**
     * 获取用户的存款列表 - 使用正确的 by-owner API
     */
    async getUserDeposits(userAddress, chainId = null) {
        this.logger.debug(`🔍 查询用户存款记录...`);
        this.logger.debug(`   用户地址: ${userAddress}`);
        this.logger.debug(`   链ID: ${chainId || '所有链'}`);

        try {
            // 将用户地址转换为Universal Address格式
            const backendChainId = chainId || 714; // 默认使用BSC
            
            // 将EVM地址转换为32字节Universal Address格式 (右对齐，前12字节为0)
            const cleanAddress = userAddress.replace(/^0x/, '').toLowerCase().padStart(40, '0');
            const ownerData = '0x' + '0'.repeat(24) + cleanAddress;
            
            this.logger.info(`🔍 API查询参数: chain_id=${backendChainId}, owner_data=${ownerData}`);
            
            const apiUrl = '/api/v2/deposits/by-owner';
            const params = {
                chain_id: backendChainId,
                owner_data: ownerData,
                page: 1,
                size: 20, // 增加查询数量，确保包含最新记录
                deleted: false,
                sort: 'created_at',
                order: 'desc' // 按创建时间倒序，最新的在前面
            };
            
            this.logger.info(`🌐 完整API调用: ${this.apiConfig.baseURL}${apiUrl}?${new URLSearchParams(params).toString()}`);
            
            const response = await this.apiClient.get(apiUrl, { params });
            
            const result = response.data;
            this.logger.info(`✅ API响应状态: ${response.status}`);
            this.logger.info(`📊 查询结果: 找到 ${result.data ? result.data.length : 0} 条存款记录`);
            
            if (result.error) {
                this.logger.error(`❌ API返回错误: ${result.error}`);
                throw new Error(`API错误: ${result.error}`);
            }
            
            // 打印每个存款记录的 checkbook_id（仅在debug模式）
            if (result.data && result.data.length > 0) {
                result.data.forEach((deposit, index) => {
                    this.logger.info(`📋 存款 ${index + 1}: tx=${deposit.deposit_tx_hash}, status=${deposit.status}, created=${deposit.created_at}`);
                });
            } else {
                this.logger.warn(`⚠️ 未找到任何存款记录`);
                this.logger.info(`🔍 响应结构: ${JSON.stringify(result, null, 2)}`);
            }
            
            return result.data || [];

        } catch (error) {
            this.logger.error(`❌ 查询用户存款失败:`, error.response?.data || error.message);
            this.logger.error(`❌ 错误详情: ${JSON.stringify(error.response?.data || error.message, null, 2)}`);
            throw error;
        }
    }

    /**
     * 从存款记录执行状态驱动的 Commitment 流程 - 参考 webserver 实现
     */
    async performCommitmentFlowFromRecord(depositRecord, userAddress, wsToken = null) {
        this.logger.info(`🚀 从存款记录开始状态驱动的Commitment流程...`);
        this.logger.info(`   存款记录ID: ${depositRecord.id}`);
        this.logger.info(`   Chain ID: ${depositRecord.chain_id}`);
        this.logger.info(`   Local Deposit ID: ${depositRecord.local_deposit_id}`);
        this.logger.info(`   当前状态: ${depositRecord.status}`);

        try {
            const chainId = parseInt(depositRecord.chain_id);
            const localDepositId = depositRecord.local_deposit_id;
            
            // 缓存存款记录，供其他方法使用
            this.lastDepositRecord = depositRecord;
            
            // 根据当前状态决定操作
            switch (depositRecord.status) {
                case 'unsigned':
                    this.logger.info(`✅ 存款已确认，等待状态变为ready_for_commitment...`);
                    // 等待WebSocket推送状态变化到ready_for_commitment
                    const updatedDeposit = await this.waitForDepositStatus(chainId, localDepositId, ['ready_for_commitment'], 180);
                    
                    // 状态变化后，直接提交 commitment
                    return await this.submitCommitmentV2WithDepositInfo(updatedDeposit, userAddress, 'kms-demo-user');
                    
                case 'ready_for_commitment':
                    this.logger.info(`✅ 存款已准备好，直接提交Commitment...`);
                    return await this.submitCommitmentV2WithDepositInfo(depositRecord, userAddress, 'kms-demo-user');
                    
                case 'with_checkbook':
                case 'issued':
                    this.logger.info(`✅ Commitment已存在，状态: ${depositRecord.status}`);
                    return {
                        checkbookId: depositRecord.id,
                        commitment: depositRecord.commitment,
                        status: depositRecord.status
                    };
                    
                default:
                    throw new Error(`不支持的存款状态: ${depositRecord.status}`);
            }

        } catch (error) {
            this.logger.error(`❌ 状态驱动Commitment流程失败:`, error.message);
            throw error;
        }
    }

    /**
     * 等待存款状态变化 - 通过by-owner API轮询
     */
    async waitForDepositStatus(chainId, localDepositId, targetStatuses, maxWaitTime = 180) {
        this.logger.info(`⏳ 等待存款状态变化...`);
        this.logger.info(`   Chain ID: ${chainId}`);
        this.logger.info(`   Local Deposit ID: ${localDepositId}`);
        this.logger.info(`   目标状态: ${targetStatuses.join(', ')}`);
        this.logger.info(`   最大等待时间: ${maxWaitTime}秒`);

        const startTime = Date.now();
        const pollInterval = 3000; // 3秒轮询一次
        const userAddress = this.walletManager.getUserAddress('default');

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                // 使用by-owner API查询最新的存款记录
                const latestDeposit = await this.getDepositByOwner(chainId, userAddress);
                
                // 查找匹配的local_deposit_id
                if (latestDeposit.local_deposit_id === localDepositId) {
                    this.logger.debug(`📊 当前状态: ${latestDeposit.status}`);

                    if (targetStatuses.includes(latestDeposit.status)) {
                        this.logger.info(`✅ 存款状态已变为: ${latestDeposit.status}`);
                        return latestDeposit;
                    }
                }

                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
            } catch (error) {
                this.logger.warn(`⚠️ 轮询存款状态时出错: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`等待存款状态变化超时 (${maxWaitTime}秒)`);
    }

    /**
     * 使用存款信息提交 Commitment V2 - 完整的签名和分配信息
     */
    async submitCommitmentV2WithDepositInfo(depositRecord, userAddress, userName = 'default') {
        this.logger.info(`📤 提交 Commitment V2 (使用存款信息)...`);
        this.logger.info(`   存款ID: ${depositRecord.id}`);
        this.logger.info(`   Chain ID: ${depositRecord.chain_id}`);
        this.logger.info(`   Local Deposit ID: ${depositRecord.local_deposit_id}`);

        try {
            // 1. 设置参数
            const chainId = parseInt(depositRecord.chain_id);
            const targetChainId = 714; // BSC的SLIP-44 ID
            const finalRecipientAddress = this.defaultRecipientAddress; // 使用参数化配置的接收地址
            const finalAmount = depositRecord.allocatable_amount || depositRecord.gross_amount;  // 如果 allocatable_amount 为空，使用 gross_amount

            this.logger.info(`🎯 Commitment参数:`, {
                接收地址: finalRecipientAddress,
                金额: finalAmount,
                目标链: targetChainId,
                代币ID: depositRecord.token_id
            });

            // 2. 生成签名数据
            const signatureMessage = this.generateCommitmentSignatureMessage(
                depositRecord, 
                finalRecipientAddress, 
                finalAmount,
                targetChainId
            );

            const signature = await this.walletManager.signMessage(signatureMessage, userName);
            this.logger.info(`✅ 签名生成成功: ${signature.slice(0, 20)}...`);

            // 3. 构建完整的V2请求 - 使用你提供的payload格式
            
            const requestData = {
                checkbook_id: depositRecord.checkbook_id,  // 使用正确的 checkbook_id 字段
                chain_id: targetChainId,
                local_deposit_id: parseInt(depositRecord.local_deposit_id),  // 🔧 修复：使用正确的字段名和数值类型
                allocations: [{
                    recipient_chain_id: targetChainId,
                    recipient_address: AddressFormatter.toUniversalAddress(targetChainId, finalRecipientAddress), // 使用统一的地址格式化工具
                    amount: finalAmount || depositRecord.gross_amount,  // 如果 allocatable_amount 为空，使用 gross_amount
                    token_id: depositRecord.token_id  // 🔧 修复：直接使用存款记录中的正确token_id
                }],
                signature: {
                    chain_id: targetChainId,
                    signature_data: signature.startsWith('0x') ? signature : `0x${signature}`,  // 🔧 修复：确保签名数据包含0x前缀
                    public_key: null
                },
                owner_address: {
                    chain_id: targetChainId,
                    address: AddressFormatter.toUniversalAddress(targetChainId, userAddress) // 使用统一的地址格式化工具
                },
                token_symbol: this.getTokenSymbolById(depositRecord.token_id),
                token_decimals: 18,
                lang: 2
            };

            this.logger.info(`📤 发送Commitment请求...`);
            this.logger.info(`📋 请求数据摘要:`, {
                checkbook_id: requestData.checkbook_id,
                chain_id: requestData.chain_id,
                local_deposit_id: requestData.local_deposit_id,
                allocations_count: requestData.allocations.length,
                has_signature: !!requestData.signature.signature_data,
                token_symbol: requestData.token_symbol
            });
            
            // 详细日志完整的请求数据（用于调试）
            console.log(`🔍 完整请求数据:`);
            console.log(JSON.stringify(requestData, null, 2));

            // 发送请求，等待足够长的时间让ZKVM生成证明
            this.logger.info(`⏰ 发送请求并等待ZKVM证明生成（可能需要60-120秒）...`);
            
            // 为 commitment 请求设置更长的超时时间（5分钟）
            const response = await this.apiClient.post('/api/v2/commitments', requestData, {
                timeout: 300000  // 5分钟超时
            });
            const result = response.data;

            this.logger.info(`✅ Commitment V2 提交成功:`);
            this.logger.info(`   Commitment: ${result.commitment}`);
            this.logger.info(`   状态: ${result.status}`);
            this.logger.info(`   Checkbook状态: ${result.checkbook_status}`);

            return {
                checkbookId: result.checkbook_id,
                commitment: result.commitment,
                status: result.status,
                checkbook_status: result.checkbook_status
            };

        } catch (error) {
            this.logger.error(`❌ 提交 Commitment V2 失败:`);
            if (error.response) {
                this.logger.error(`   HTTP状态: ${error.response.status}`);
                this.logger.error(`   错误数据:`, JSON.stringify(error.response.data, null, 2));
                this.logger.error(`   错误头:`, JSON.stringify(error.response.headers, null, 2));
            } else {
                this.logger.error(`   错误信息:`, error.message);
            }
            
            // 如果是超时错误，提供更多信息
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                this.logger.error(`⏰ 这是超时错误 - ZKVM证明生成可能需要60-120秒`);
                this.logger.error(`💡 建议：检查后端ZKVM服务状态，或增加超时时间`);
            }
            
            throw error;
        }
    }

    /**
     * 生成 Commitment 签名消息 - 使用与webserver完全一致的实现
     */
    generateCommitmentSignatureMessage(depositRecord, recipientAddress, amount, targetChainId) {
        this.logger.info(`🔏 生成Commitment签名消息...`);
        
        // 使用与webserver相同的签名消息生成逻辑
        const allocations = [{
            recipient_chain_id: targetChainId,
            recipient_address: recipientAddress.replace(/^0x/, ''),
            amount: amount,
            token_id: 65535  // TEST_USDT的正确Token ID
        }];
        
        // 将local_deposit_id转换为32字节十六进制格式用于签名消息
        const depositId = depositRecord.local_deposit_id ? 
            depositRecord.local_deposit_id.toString(16).padStart(64, '0') : 
            depositRecord.id;
        const tokenSymbol = this.getTokenSymbolById(depositRecord.token_id);
        const tokenDecimals = 18;
        const ownerAddress = {
            chain_id: targetChainId,
            address: (depositRecord.owner?.data || this.walletManager.getUserAddress('default')).replace(/^0x/, '')
        };
        const lang = 2; // 中文

        // 生成完整的签名消息
        const message = this.generateFullSignMessage(
            allocations,
            depositId,
            tokenSymbol,
            tokenDecimals,
            ownerAddress,
            lang
        );
        
        // 调试：显示生成的签名消息
        console.log('🔍 生成的签名消息内容:');
        console.log('=====================================');
        console.log(message);
        console.log('=====================================');
        console.log('消息长度:', message.length, '字符');
        
        this.logger.debug(`📝 签名消息生成完成 (${message.length}字符)`);
        return message;
    }

    /**
     * 完整签名消息生成 - 与webserver的generateSignMessage完全一致
     */
    generateFullSignMessage(allocations, depositId, tokenSymbol, tokenDecimals, ownerAddress, lang = 2) {
        // 1. 将depositId转换为32字节数组然后转回大整数（与webserver的formatDepositId完全一致）
        const formatDepositId = (depositIdHex) => {
            // 移除0x前缀并左填充到64位十六进制（32字节）
            const cleanHex = depositIdHex.replace(/^0x/, '').padStart(64, '0');
            
            // 转换为BigInt并返回十进制字符串
            let result = BigInt(0);
            for (let i = 0; i < 32; i++) {
                const byteValue = parseInt(cleanHex.substr(i * 2, 2), 16);
                result = result << BigInt(8);
                result = result | BigInt(byteValue);
            }
            return result.toString();
        };
        
        // 2. 格式化金额（模拟webserver的formatAmount，假设18位小数）
        const formatAmount = (amountWei) => {
            const amount = BigInt(amountWei);
            const divisor = BigInt(10 ** 18);
            const wholePart = amount / divisor;
            const decimalPart = amount % divisor;
            
            // 格式化小数部分，显示2位小数
            const decimalStr = decimalPart.toString().padStart(18, '0');
            const displayDecimal = decimalStr.substring(0, 2);
            return `${wholePart}.${displayDecimal}`;
        };
        
        // 3. 格式化Universal Address（与ZKVM完全一致，参考universal_address.rs第193行）
        const formatUniversalAddress = (address, chainId) => {
            const chainName = this.getChainName(chainId);
            
            // 获取链特定地址格式（参考universal_address.rs的get_chain_specific_address）
            let chainAddress;
            console.log(`[DEBUG] formatUniversalAddress - address: ${JSON.stringify(address)}, type: ${typeof address}, chainId: ${chainId}`);
            if (!address || typeof address !== 'string') {
                throw new Error(`无效地址参数: ${address}, 类型: ${typeof address}`);
            }
            
            // 检查是否是Universal Address格式 (64字符长度，前24个字符为0)
            const cleanAddress = address.replace(/^0x/, '');
            if (cleanAddress.length === 64 && cleanAddress.startsWith('000000000000000000000000')) {
                // 这是Universal Address，需要转换为链特定格式
                chainAddress = AddressFormatter.fromUniversalAddress(address);
                console.log(`[DEBUG] 转换Universal Address: ${address} -> ${chainAddress}`);
            } else {
                // 这是普通地址，直接格式化
                if (chainId === 714 || chainId === 60 || chainId === 966) {
                    // Ethereum系链：确保0x前缀
                    chainAddress = address.startsWith('0x') ? address : `0x${address}`;
                } else if (chainId === 195) {
                    // TRON：Base58格式
                    chainAddress = address;
                } else {
                    // 默认使用以太坊格式
                    chainAddress = address.startsWith('0x') ? address : `0x${address}`;
                }
            }
            
            // 与universal_address.rs第193行完全一致的格式
            return `${chainName}链上${chainAddress}地址`;
        };
        
        // 4. 计算总金额
        let totalAmount = BigInt(0);
        for (const allocation of allocations) {
            totalAmount += BigInt(allocation.amount);
        }
        
        // 5. 生成中文签名消息（与webserver完全一致）
        let message = "🎯 ZKPay 隐私转账确认\n\n";
        message += `💰 您即将向 ${allocations.length} 位接收者分配 ${formatAmount(totalAmount)} ${tokenSymbol}：\n`;
        
        for (const allocation of allocations) {
            message += `  • ${formatUniversalAddress(allocation.recipient_address, allocation.recipient_chain_id)} → ${formatAmount(allocation.amount)} ${tokenSymbol}\n`;
        }
        
        message += `\n📝 存款ID: ${formatDepositId(depositId)}\n`;
        message += `🔗 网络: ${this.getChainName(ownerAddress.chain_id)} (${ownerAddress.chain_id})\n`;
        message += `💎 代币: ${tokenSymbol} (ID: ${allocations[0].token_id})\n`;
        // 处理 owner 地址：根据链ID转换Universal Address为链特定格式
        const ownerChainAddress = this.convertUniversalAddressToChainSpecific(ownerAddress.address, ownerAddress.chain_id);
        
        message += `🔒 所有者: ${formatUniversalAddress(ownerChainAddress, ownerAddress.chain_id)}\n\n`;
        message += "⚠️ 请在签名前仔细核对所有信息\n";
        message += "✅ 签名确认此隐私分配方案";
        
        return message;
    }

    /**
     * 格式化金额显示
     */
    formatAmountForDisplay(amountWei) {
        const amount = BigInt(amountWei);
        const divisor = BigInt(10 ** 18); // 统一使用18位decimal
        const wholePart = amount / divisor;
        const decimalPart = amount % divisor;
        
        // 格式化小数部分，显示2位小数
        const decimalStr = decimalPart.toString().padStart(18, '0');
        const displayDecimal = decimalStr.substring(0, 2);
        return `${wholePart}.${displayDecimal}`;
    }

    /**
     * 格式化地址显示
     */
    formatAddressForDisplay(address, chainId, lang) {
        const chainName = this.getChainName(chainId);
        const shortAddress = address.length > 10 ? 
            `${address.slice(0, 6)}...${address.slice(-4)}` : 
            address;
        
        if (lang === 2) {
            return `${chainName}链上${shortAddress}地址`;
        } else {
            return `${shortAddress} on ${chainName}`;
        }
    }

    /**
     * 获取链名称
     */
    getChainName(chainId) {
        const chainMap = {
            60: "Ethereum Mainnet",
            714: "Binance Smart Chain",
            966: "Polygon",
            195: "TRON",
            31337: "Anvil Local",
            11155111: "Sepolia Testnet"
        };
        return chainMap[chainId] || `Chain ${chainId}`;
    }

    /**
     * 根据 Token ID 获取符号
     */
    getTokenSymbolById(tokenId) {
        const tokenMap = {
            1: "USDT",
            65535: "TUSDT"  // 特殊测试Token
        };
        return tokenMap[tokenId] || "TOKEN";
    }

    /**
     * 根据 Token ID 获取小数位数
     */
    getTokenDecimalsById(tokenId) {
        const decimalsMap = {
            1: 6,      // USDT is 6 decimals
            65535: 6   // TUSDT is also 6 decimals  
        };
        return decimalsMap[tokenId] || 18;
    }

    /**
     * 将Universal Address转换为链特定地址格式
     * 参考 universal_address.rs 的 get_chain_specific_address 方法
     */
    convertUniversalAddressToChainSpecific(universalAddress, chainId) {
        // 移除0x前缀并确保是64字符的Universal Address
        const cleanAddress = universalAddress.replace(/^0x/, '');
        
        if (cleanAddress.length !== 64) {
            // 如果不是64字符，可能已经是链特定格式
            console.log(`[DEBUG] convertUniversalAddressToChainSpecific - universalAddress: ${JSON.stringify(universalAddress)}, type: ${typeof universalAddress}`);
            if (!universalAddress || typeof universalAddress !== 'string') {
                throw new Error(`无效Universal Address: ${universalAddress}, 类型: ${typeof universalAddress}`);
            }
            return universalAddress.startsWith('0x') ? universalAddress : `0x${universalAddress}`;
        }
        
        // 提取后20字节作为以太坊地址（参考 to_ethereum_address 方法）
        const ethAddressHex = cleanAddress.slice(-40); // 后40个字符 = 20字节
        
        switch (chainId) {
            case 60:  // Ethereum
            case 714: // Binance Smart Chain  
            case 966: // Polygon
            case 250: // Fantom
            case 43114: // Avalanche
            case 9001: // Arbitrum
            case 10001: // Optimism
            case 8453: // Base
            case 324: // zkSync Era
                return `0x${ethAddressHex}`;
            
            case 195: // TRON
                // TODO: 实现TRON Base58Check转换
                return `T${ethAddressHex.slice(0, 32)}...`;
            
            default:
                // 默认使用以太坊格式
                return `0x${ethAddressHex}`;
        }
    }

    /**
     * 生成Commitment证明
     */
    async generateCommitmentProof(checkbookId, recipientAddress) {
        this.logger.info(`🧮 开始生成Commitment证明...`);
        this.logger.info(`   Checkbook ID: ${checkbookId}`);
        this.logger.info(`   接收地址: ${recipientAddress}`);

        try {
            const requestData = {
                checkbook_id: checkbookId,
                recipient_address: recipientAddress
            };

            // 调用证明生成API
            const response = await this.apiClient.post('/api/v2/commitments/generate', requestData);
            const result = response.data;

            this.logger.info(`✅ Commitment证明生成成功:`);
            this.logger.info(`   Commitment: ${result.commitment}`);
            this.logger.info(`   证明数据长度: ${result.proof?.length || 0} 字符`);

            return result;

        } catch (error) {
            this.logger.error(`❌ 生成Commitment证明失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 提交Commitment到区块链
     */
    async submitCommitment(checkbookId) {
        this.logger.info(`📤 开始提交Commitment到区块链...`);
        this.logger.info(`   Checkbook ID: ${checkbookId}`);

        try {
            const requestData = {
                checkbook_id: checkbookId
            };

            // 调用自动执行Commitment提交API
            const response = await this.apiClient.post('/api/v2/commitments/auto-execute', requestData);
            const result = response.data;

            this.logger.info(`✅ Commitment提交成功:`);
            this.logger.info(`   交易哈希: ${result.transaction_hash}`);
            this.logger.info(`   状态: ${result.status}`);

            return result;

        } catch (error) {
            this.logger.error(`❌ 提交Commitment失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 等待Commitment确认
     */
    async waitForCommitmentConfirmation(checkbookId, maxWaitTime = 300) {
        this.logger.info(`⏳ 等待Commitment确认 (最大等待时间: ${maxWaitTime}秒)...`);

        const startTime = Date.now();
        const pollInterval = 5000; // 5秒轮询一次

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                const response = await this.apiClient.get(`/api/v2/checkbooks/${checkbookId}`);
                const checkbook = response.data;

                this.logger.debug(`📊 当前状态: ${checkbook.status}`);

                // 检查是否已确认
                if (checkbook.status === 'issued' || checkbook.status === 'r_proving') {
                    this.logger.info(`✅ Commitment已确认! 状态: ${checkbook.status}`);
                    return checkbook;
                }

                // 检查是否失败
                if (checkbook.status.includes('failed')) {
                    this.logger.error(`❌ Commitment确认失败! 状态: ${checkbook.status}`);
                    throw new Error(`Commitment确认失败: ${checkbook.status}`);
                }

                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (error) {
                if (error.response?.status === 404) {
                    this.logger.debug(`📋 Checkbook ${checkbookId} 暂未创建，继续等待...`);
                } else {
                    this.logger.error(`❌ 检查Commitment状态失败:`, error.message);
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`Commitment确认超时 (${maxWaitTime}秒)`);
    }

    /**
     * 完整的Commitment流程
     */
    async performFullCommitmentFlow(depositData, recipientAddress) {
        this.logger.info(`🚀 开始完整Commitment流程...`);

        const results = {
            createDeposit: null,
            generateProof: null,
            submitCommitment: null,
            waitConfirmation: null,
            depositData,
            recipientAddress
        };

        try {
            // 步骤1: 创建存款记录
            this.logger.info(`📋 步骤1: 创建存款记录`);
            results.createDeposit = await this.createDeposit(depositData);
            const checkbookId = results.createDeposit.id;

            // 步骤2: 生成Commitment证明
            this.logger.info(`📋 步骤2: 生成Commitment证明`);
            results.generateProof = await this.generateCommitmentProof(checkbookId, recipientAddress);

            // 等待一小段时间确保证明生成完成
            this.logger.info(`⏸️ 等待证明生成完成...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 步骤3: 提交Commitment到区块链
            this.logger.info(`📋 步骤3: 提交Commitment到区块链`);
            results.submitCommitment = await this.submitCommitment(checkbookId);

            // 步骤4: 等待Commitment确认
            this.logger.info(`📋 步骤4: 等待Commitment确认`);
            results.waitConfirmation = await this.waitForCommitmentConfirmation(
                checkbookId, 
                this.maxWaitTime
            );

            this.logger.info(`🎉 完整Commitment流程成功完成!`);
            this.logger.info(`   Checkbook ID: ${checkbookId}`);
            this.logger.info(`   最终状态: ${results.waitConfirmation.status}`);

            return {
                ...results,
                checkbookId,
                success: true
            };

        } catch (error) {
            this.logger.error(`❌ 完整Commitment流程失败:`, error.message);
            results.error = error;
            results.success = false;
            throw error;
        }
    }

    /**
     * 创建Check (提现凭证)
     */
    async createCheck(checkbookId, recipientInfo) {
        this.logger.info(`📋 创建Check (提现凭证)...`);
        this.logger.info(`   Checkbook ID: ${checkbookId}`);
        this.logger.info(`   接收链: ${recipientInfo.chain_id}`);
        this.logger.info(`   接收地址: ${recipientInfo.address}`);
        this.logger.info(`   提现金额: ${recipientInfo.amount}`);

        try {
            // 获取Checkbook信息以获得正确的token_id
            let tokenId = recipientInfo.token_id;
            if (!tokenId) {
                const checkbookResponse = await this.apiClient.get(`/api/v2/checkbooks/${checkbookId}`);
                const checkbook = checkbookResponse.data;
                tokenId = checkbook.token_id || 65535; // 测试环境默认TUSDT
                this.logger.info(`   从Checkbook获取Token ID: ${tokenId}`);
            }

            const requestData = {
                checkbook_id: checkbookId,
                recipient: {
                    chain_id: recipientInfo.chain_id,
                    address: recipientInfo.address,
                    amount: recipientInfo.amount,
                    token_id: tokenId
                }
            };

            const response = await this.apiClient.post('/api/v2/checks', requestData);
            const result = response.data;

            this.logger.info(`✅ Check创建成功:`);
            this.logger.info(`   Check ID: ${result.id}`);
            this.logger.info(`   状态: ${result.status}`);

            return result;

        } catch (error) {
            this.logger.error(`❌ 创建Check失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 获取存款状态 - 使用by-owner API查询特定存款
     */
    async getDepositByOwner(chainId, ownerAddress) {
        this.logger.debug(`🔍 通过owner查询存款: chain_id=${chainId}, owner=${ownerAddress}`);
        
        try {
            // 转换地址为universal格式
            const universalAddress = AddressFormatter.toUniversalAddress(chainId, ownerAddress);
            
            const params = new URLSearchParams({
                chain_id: chainId.toString(),
                owner_data: universalAddress,
                page: '1',
                size: '10',
                deleted: 'false'
            });
            
            const response = await this.apiClient.get(`/api/v2/deposits/by-owner?${params.toString()}`);
            const result = response.data;
            
            this.logger.info(`📊 查询到 ${result.data.length} 条存款记录`);
            
            if (result.data.length === 0) {
                throw new Error('未找到该用户的存款记录');
            }
            
            // 返回最新的存款记录（通常是第一个）
            const latestDeposit = result.data[0];
            this.logger.info(`✅ 获取到最新存款:`, {
                ID: latestDeposit.id || `${latestDeposit.chain_id}-${latestDeposit.local_deposit_id}`,
                状态: latestDeposit.status,
                金额: latestDeposit.allocatable_amount,
                本地ID: latestDeposit.local_deposit_id
            });
            
            // 详细输出存款记录的所有字段（调试用）
            console.log('🔍 完整存款记录数据:');
            console.log(JSON.stringify(latestDeposit, null, 2));
            
            return latestDeposit;
            
        } catch (error) {
            this.logger.error(`❌ 查询存款失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    // 已移除 convertToUniversalAddress 函数，统一使用 AddressFormatter.toUniversalAddress

    /**
     * 通过链ID和本地存款ID获取存款状态
     */
    async getDepositStatus(chainId, localDepositId) {
        this.logger.debug(`🔍 获取存款状态: chain_id=${chainId}, local_deposit_id=${localDepositId}`);
        
        try {
            const response = await this.apiClient.get(`/api/v2/deposits/${chainId}/${localDepositId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取存款状态失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 获取用户的Checkbook列表
     */
    async getUserCheckbooks(userAddress, chainId = null) {
        try {
            const params = { user_address: userAddress };
            if (chainId) {
                params.chain_id = chainId;
            }

            const response = await this.apiClient.get('/api/v2/checkbooks', { params });
            return response.data;
        } catch (error) {
            this.logger.error(`❌ 获取用户Checkbook列表失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 重试失败的操作
     */
    async retryOperation(entityId, entityType, operation) {
        this.logger.info(`🔄 重试操作: ${operation} for ${entityType} ${entityId}`);

        try {
            let endpoint;
            let requestData = {};

            if (entityType === 'checkbook') {
                if (operation === 'generate_proof') {
                    endpoint = '/api/v2/commitments/auto-execute';
                    requestData = { checkbook_id: entityId };
                } else if (operation === 'submit_commitment') {
                    endpoint = '/api/v2/commitments/auto-execute';
                    requestData = { checkbook_id: entityId };
                }
            } else if (entityType === 'check') {
                if (operation === 'generate_proof') {
                    endpoint = `/api/v2/checks/${entityId}/generate-proof`;
                } else if (operation === 'execute') {
                    endpoint = `/api/v2/checks/${entityId}/execute`;
                }
            }

            if (!endpoint) {
                throw new Error(`不支持的重试操作: ${operation} for ${entityType}`);
            }

            const response = await this.apiClient.post(endpoint, requestData);
            const result = response.data;

            this.logger.info(`✅ 重试操作成功:`);
            this.logger.info(`   结果: ${JSON.stringify(result, null, 2)}`);

            return result;

        } catch (error) {
            this.logger.error(`❌ 重试操作失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 监控状态变化
     */
    async monitorStatusChanges(entityId, entityType, targetStatuses, maxWaitTime = 300) {
        this.logger.info(`👁️ 开始监控状态变化...`);
        this.logger.info(`   实体: ${entityType} ${entityId}`);
        this.logger.info(`   目标状态: ${targetStatuses.join(', ')}`);

        const startTime = Date.now();
        const pollInterval = 5000; // 5秒轮询一次

        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                let entity;
                if (entityType === 'checkbook') {
                    entity = await this.getCheckbookStatus(entityId);
                } else if (entityType === 'check') {
                    const response = await this.apiClient.get(`/api/v2/checks/${entityId}`);
                    entity = response.data;
                } else {
                    throw new Error(`不支持的实体类型: ${entityType}`);
                }

                this.logger.debug(`📊 当前状态: ${entity.status}`);

                // 检查是否达到目标状态
                if (targetStatuses.includes(entity.status)) {
                    this.logger.info(`✅ 达到目标状态: ${entity.status}`);
                    return entity;
                }

                // 检查是否失败
                if (entity.status.includes('failed')) {
                    this.logger.error(`❌ 状态变为失败: ${entity.status}`);
                    throw new Error(`状态监控失败: ${entity.status}`);
                }

                // 等待下次轮询
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (error) {
                if (error.response?.status === 404) {
                    this.logger.debug(`📋 实体 ${entityId} 暂未找到，继续等待...`);
                } else {
                    this.logger.error(`❌ 监控状态失败:`, error.message);
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`状态监控超时 (${maxWaitTime}秒)`);
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.logger.info('🧹 清理Commitment管理器资源...');
        
        if (this.wsConnection) {
            try {
                this.wsConnection.close();
            } catch (error) {
                this.logger.warn(`⚠️ 关闭WebSocket连接时出错:`, error.message);
            }
        }

        this.logger.info('✅ Commitment管理器清理完成');
    }
}

module.exports = { ZKPayCommitmentManager };
