// ZKPay KMS适配器
// 实现与KMS服务的集成，提供签名功能

const axios = require('axios');
const { createLogger } = require('./logger');
const { ethers } = require('ethers');
const { ISignerInterface } = require('./kms-signer-interface');

/**
 * ZKPay KMS签名器
 * 通过KMS服务进行签名操作
 */
class ZKPayKMSSigner extends ISignerInterface {
    constructor(config, logger = null, rpcProviders = null) {
        super(logger || createLogger('ZKPayKMSSigner'));
        
        this.config = {
            baseURL: config.baseURL || 'http://localhost:18082',
            keyAlias: config.keyAlias,
            encryptedKey: config.encryptedKey,
            slip44Id: config.slip44Id || 714,
            address: config.address,
            defaultSignatureType: config.defaultSignatureType || 'eip191',
            timeout: config.timeout || 30000,
            headers: config.headers || {}
        };
        
        this.rpcProviders = rpcProviders; // RPC提供者映射 {chainId: provider}

        // 创建HTTP客户端
        this.client = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Key': process.env.KMS_SERVICE_KEY || 'zkpay-service-key-zksdk',
                'X-Service-Name': 'zksdk',
                ...this.config.headers
            }
        });

        this.logger.info(`🔐 ZKPay KMS签名器已初始化: ${this.config.keyAlias} (SLIP44: ${this.config.slip44Id})`);
    }

    /**
     * 签署消息
     * @param {string} message - 要签署的消息
     * @param {string} address - 签名者地址（可选）
     * @returns {Promise<string>} - 签名结果
     */
    async signMessage(message, address) {
        const slip44Id = this.config.slip44Id;
        const chainInfo = this.getChainInfo(slip44Id);
        this.logger.info(`🔐 KMS签署消息: ${chainInfo.name} (SLIP44: ${slip44Id})`);
        
        try {
            // 将消息转换为十六进制格式
            const messageHex = '0x' + Buffer.from(message, 'utf8').toString('hex');
            
            this.logger.info(`📝 消息签名请求:`, {
                原始消息: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
                十六进制: messageHex.slice(0, 100) + (messageHex.length > 100 ? '...' : ''),
                消息长度: message.length,
                十六进制长度: messageHex.length
            });
            
            const response = await this.client.post('/api/v1/sign', {
                key_alias: this.config.keyAlias,
                k1: this.config.encryptedKey, // 使用正确的参数名称
                data: messageHex, // 使用正确的数据字段名
                slip44_id: slip44Id, // 使用正确的SLIP44 ID字段
                signature_type: this.config.defaultSignatureType || 'eip191'
            });

            if (!response.data.success) {
                throw new Error(`KMS消息签名失败: ${response.data.error}`);
            }

            const signature = response.data.signature;
            this.logger.info(`✅ KMS消息签名成功: ${signature.slice(0, 20)}...`);
            
            return signature;

        } catch (error) {
            this.logger.error(`❌ KMS消息签名失败: ${error.response?.data?.error || error.message}`);
            throw new Error(`KMS消息签名失败: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * 签署交易
     * @param {Object} transaction - 交易对象 {to, value, data, gasLimit, gasPrice, nonce}
     * @param {number} chainId - 链ID (SLIP44格式)
     * @param {string} address - 签名者地址（可选）
     * @returns {Promise<string>} - 签名后的交易数据（可直接广播）
     */
    async signTransaction(transaction, chainId, address) {
        this.logger.info('🔐 KMS交易签名请求原始数据:');
        this.logger.info(`  to: ${transaction.to}`);
        this.logger.info(`  value: ${transaction.value} (${typeof transaction.value})`);
        this.logger.info(`  gasLimit: ${transaction.gasLimit} (${typeof transaction.gasLimit})`);
        this.logger.info(`  gasPrice: ${transaction.gasPrice} (${typeof transaction.gasPrice})`);
        this.logger.info(`  nonce: ${transaction.nonce} (${typeof transaction.nonce})`);
        this.logger.info(`  chainId: ${chainId}`);

        try {
            // 从RPC节点获取nonce和gasPrice
            await this.fillMissingTransactionFields(transaction, chainId);
            // 为KMS签名器补充缺失的交易字段
            if (transaction.value === null || transaction.value === undefined) {
                transaction.value = '0';
                this.logger.info('⚠️ 补充缺失的value字段: 0');
            }
            
            if (transaction.nonce === null || transaction.nonce === undefined) {
                // 为KMS签名器自动获取nonce
                // 注意：这里需要一个provider来获取nonce，暂时使用0作为默认值
                transaction.nonce = 0;
                this.logger.warn('⚠️ KMS签名器缺少nonce，使用默认值0（生产环境应该从provider获取）');
            }
            
            if (transaction.gasPrice === null || transaction.gasPrice === undefined) {
                // 为KMS签名器设置默认gasPrice（BSC主网通常是5 gwei）
                transaction.gasPrice = '5000000000'; // 5 gwei
                this.logger.warn('⚠️ KMS签名器缺少gasPrice，使用默认值5 gwei');
            }
            
            if (transaction.gasLimit === null || transaction.gasLimit === undefined) {
                throw new Error('交易gasLimit不能为空');
            }

            // 根据KMS文档，需要序列化交易并计算哈希
            // ethers已在文件顶部导入
            
            // 构建标准的ethers交易对象
            const txData = {
                to: transaction.to,
                value: typeof transaction.value === 'bigint' ? transaction.value.toString() : (transaction.value || '0'),
                data: transaction.data || '0x',
                gasLimit: typeof transaction.gasLimit === 'bigint' ? transaction.gasLimit.toString() : transaction.gasLimit.toString(),
                gasPrice: typeof transaction.gasPrice === 'bigint' ? transaction.gasPrice.toString() : transaction.gasPrice.toString(),
                nonce: typeof transaction.nonce === 'bigint' ? Number(transaction.nonce) : Number(transaction.nonce),
                chainId: this.getEvmChainId(this.config.slip44Id) // 转换为EVM链ID
            };

            // 序列化交易并计算哈希 (ethers v6兼容)
            const serializedTx = ethers.Transaction.from(txData).unsignedSerialized;
            const txHash = ethers.keccak256(serializedTx);
            
            this.logger.info('📋 交易序列化信息:');
            this.logger.info(`  序列化交易: ${serializedTx}`);
            this.logger.info(`  交易哈希: ${txHash}`);

            const signRequest = {
                key_alias: this.config.keyAlias,
                k1: this.config.encryptedKey, // 使用正确的参数名称
                data: txHash, // 发送交易哈希而不是交易参数
                slip44_id: this.config.slip44Id,
                signature_type: 'transaction', // 明确指定为交易签名
                tx_hash: txHash // 用于审计日志
            };

            this.logger.info('📡 向KMS发送交易签名请求:');
            this.logger.info(`  key_alias: ${signRequest.key_alias}`);
            this.logger.info(`  slip44_id: ${signRequest.slip44_id}`);
            this.logger.info(`  data (txHash): ${signRequest.data}`);
            this.logger.info(`  signature_type: ${signRequest.signature_type}`);
            
            const response = await this.client.post('/api/v1/sign', signRequest, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Key': 'zkpay-service-key-zksdk',
                    'X-Service-Name': 'zksdk'
                }
            });

            if (!response.data.success) {
                throw new Error(`KMS交易签名失败: ${response.data.error}`);
            }

            const signature = response.data.signature;
            this.logger.info(`✅ KMS交易签名成功: ${signature.slice(0, 20)}...`);

            // 根据KMS文档，签名返回格式为十六进制字符串，需要与原始交易数据组合 (ethers v6兼容)
            const tx = ethers.Transaction.from(txData);
            // 确保签名有0x前缀
            const formattedSignature = signature.startsWith('0x') ? signature : '0x' + signature;
            tx.signature = ethers.Signature.from(formattedSignature);
            const signedTx = tx.serialized;
            this.logger.info(`📦 完整签名交易: ${signedTx.slice(0, 50)}...`);
            
            return signedTx;

        } catch (error) {
            this.logger.error(`❌ KMS交易签名失败: ${error.response?.data?.error || error.message}`);
            throw new Error(`KMS交易签名失败: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * 获取地址
     * @returns {string} - 钱包地址
     */
    getAddress() {
        return this.config.address;
    }

    /**
     * 从RPC节点填充缺失的交易字段
     * @param {Object} transaction - 交易对象
     * @param {number} chainId - 链ID
     */
    async fillMissingTransactionFields(transaction, chainId) {
        // chainId参数是EVM链ID，需要映射到SLIP44 ID来找RPC提供者
        // BSC: EVM链ID 56 <-> SLIP44 ID 714
        let slip44Id = chainId;
        if (chainId === 56) {
            slip44Id = 714; // BSC的SLIP44 ID
        }
        
        if (!this.rpcProviders || !this.rpcProviders[slip44Id]) {
            this.logger.warn(`⚠️ 没有配置SLIP44 ID ${slip44Id} (EVM Chain ${chainId})的RPC提供者，将使用默认值`);
            return;
        }

        const provider = this.rpcProviders[slip44Id];
        this.logger.info(`🔍 使用SLIP44 ID ${slip44Id}的RPC提供者获取交易参数`);
        
        try {
            // 获取nonce
            if (transaction.nonce === null || transaction.nonce === undefined) {
                const nonce = await provider.getTransactionCount(this.config.address, 'pending');
                transaction.nonce = nonce;
                this.logger.info(`🔍 从RPC获取nonce: ${nonce}`);
            }
            
            // 获取gasPrice
            if (transaction.gasPrice === null || transaction.gasPrice === undefined) {
                const feeData = await provider.getFeeData();
                transaction.gasPrice = feeData.gasPrice.toString();
                this.logger.info(`🔍 从RPC获取gasPrice: ${transaction.gasPrice}`);
            }
        } catch (error) {
            this.logger.error(`❌ 从RPC获取交易参数失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 检查签名器是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const response = await this.client.get('/api/v1/health');
            return response.data.status === 'healthy';
        } catch (error) {
            this.logger.warn(`KMS健康检查失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 获取链信息
     * @param {number} slip44Id - SLIP44 ID
     * @returns {Object} - 链信息
     */
    getChainInfo(slip44Id) {
        const chainMap = {
            0: { name: 'Bitcoin', evmChainId: null },
            60: { name: 'Ethereum', evmChainId: 1 },
            714: { name: 'BSC', evmChainId: 56 },
            195: { name: 'X Layer', evmChainId: 728126428 }
        };
        
        return chainMap[slip44Id] || { name: `Chain-${slip44Id}`, evmChainId: slip44Id };
    }

    /**
     * 获取EVM链ID（用于交易签名）
     */
    getEvmChainId(slip44Id) {
        const chainInfo = this.getChainInfo(slip44Id);
        if (chainInfo.evmChainId === null) {
            throw new Error(`链 ${slip44Id} 不支持EVM交易签名`);
        }
        return chainInfo.evmChainId;
    }
}

/**
 * ZKPay KMS签名器工厂
 */
class ZKPayKMSSignerFactory {
    /**
     * 从现有加密密钥创建签名器
     * @param {Object} config - 配置对象
     * @param {Logger} logger - 日志器
     * @param {Object} rpcProviders - RPC提供者映射 {chainId: provider}
     * @returns {ZKPayKMSSigner}
     */
    static createFromExistingKey(config, logger, rpcProviders = null) {
        return new ZKPayKMSSigner(config, logger, rpcProviders);
    }

    /**
     * 创建新密钥并返回签名器
     * @param {Object} config - 配置对象
     * @param {Logger} logger - 日志器
     * @returns {Promise<ZKPayKMSSigner>}
     */
    static async createWithNewKey(config, logger) {
        // 这里需要调用KMS的generate-key或encrypt接口
        // 暂时返回错误，需要具体实现
        throw new Error('createWithNewKey功能需要实现');
    }
}

module.exports = {
    ZKPayKMSSigner,
    ZKPayKMSSignerFactory
};
