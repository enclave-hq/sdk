/**
 * SAAS KMS签名器实现
 * 为ZKSDK提供KMS签名服务，替代直接私钥登录
 */
const axios = require('axios');
const { ISignerInterface } = require('./kms-signer-interface');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SaasKMSSigner');

/**
 * SAAS KMS签名器
 * 通过SAAS系统的KMS服务进行签名操作
 */
class SaasKMSSigner extends ISignerInterface {
    constructor(config) {
        super();
        
        // 配置验证
        this.validateConfig(config);
        
        this.kmsUrl = config.kmsUrl;
        this.enterpriseId = config.enterpriseId;
        this.chainId = config.chainId;
        this.userAddress = config.userAddress;
        this.keyAlias = config.keyAlias;
        this.k1Key = config.k1Key;
        
        // 创建HTTP客户端
        this.client = axios.create({
            baseURL: this.kmsUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'zksdk-kms-signer/1.0',
            },
        });
        
        logger.info('🔐 SAAS KMS签名器初始化完成', {
            enterpriseId: this.enterpriseId,
            chainId: this.chainId,
            userAddress: this.userAddress,
        });
    }

    /**
     * 验证配置参数
     */
    validateConfig(config) {
        const required = ['kmsUrl', 'enterpriseId', 'chainId', 'userAddress', 'keyAlias', 'k1Key'];
        
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`KMS签名器配置缺少必需字段: ${field}`);
            }
        }
    }

    /**
     * 检查签名器是否可用
     */
    async isAvailable() {
        try {
            const response = await this.client.get('/api/v1/health');
            return response.data.status === 'healthy';
        } catch (error) {
            logger.error('KMS服务健康检查失败:', error.message);
            return false;
        }
    }

    /**
     * 获取签名器地址
     */
    async getAddress() {
        return this.userAddress;
    }

    /**
     * 签名消息
     * @param {string} message - 要签名的消息
     * @param {string} signatureType - 签名类型：'data', 'transaction', 'eip191'
     */
    async signMessage(message, signatureType = 'eip191') {
        try {
            logger.info('🔐 开始KMS消息签名', {
                messageLength: message.length,
                signatureType,
                keyAlias: this.keyAlias,
            });

            // 确保消息是十六进制格式
            let hexMessage = message;
            if (!message.startsWith('0x')) {
                // 如果不是十六进制，转换为十六进制
                hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');
            }

            const requestData = {
                key_alias: this.keyAlias,
                k1: this.k1Key,
                data: hexMessage,
                slip44_id: this.getSlip44Id(),
                signature_type: signatureType,
            };

            const response = await this.client.post('/api/v1/sign', requestData);

            if (!response.data.success) {
                throw new Error(response.data.error || 'KMS签名失败');
            }

            logger.info('✅ KMS消息签名成功', {
                address: response.data.address,
                signatureLength: response.data.signature.length,
            });

            return response.data.signature;

        } catch (error) {
            logger.error('❌ KMS消息签名失败:', error.message);
            throw error;
        }
    }

    /**
     * 签名交易
     * @param {Object} transaction - 交易对象
     */
    async signTransaction(transaction) {
        try {
            logger.info('🔐 开始KMS交易签名', {
                to: transaction.to,
                value: transaction.value,
                keyAlias: this.keyAlias,
            });

            // 计算交易哈希
            const ethers = require('ethers');
            const serializedTx = ethers.utils.serializeTransaction(transaction);
            const txHash = ethers.utils.keccak256(serializedTx);

            const requestData = {
                key_alias: this.keyAlias,
                k1: this.k1Key,
                data: txHash,
                slip44_id: this.getSlip44Id(),
                signature_type: 'transaction',
                tx_hash: txHash,
            };

            const response = await this.client.post('/api/v1/sign', requestData);

            if (!response.data.success) {
                throw new Error(response.data.error || 'KMS交易签名失败');
            }

            logger.info('✅ KMS交易签名成功', {
                address: response.data.address,
                txHash: txHash.substring(0, 10) + '...',
            });

            return response.data.signature;

        } catch (error) {
            logger.error('❌ KMS交易签名失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取签名器类型
     */
    getType() {
        return 'saas-kms';
    }

    /**
     * 根据链ID获取SLIP44 ID
     */
    getSlip44Id() {
        const slip44Map = {
            '1': 60,    // Ethereum Mainnet
            '56': 714,  // BSC Mainnet
            '97': 714,  // BSC Testnet
            '137': 966, // Polygon
            '42161': 9001, // Arbitrum One
            '10': 614,  // Optimism
            '195': 195, // TRON (TRX)
        };

        const slip44Id = slip44Map[this.chainId];
        if (!slip44Id) {
            throw new Error(`不支持的链ID: ${this.chainId}`);
        }

        return slip44Id;
    }

    /**
     * 创建企业用户KMS签名器
     * @param {Object} config - 配置参数
     * @param {string} config.kmsUrl - KMS服务URL
     * @param {string} config.enterpriseId - 企业ID
     * @param {string} config.chainId - 链ID
     * @param {string} config.userAddress - 用户地址
     * @param {string} config.k1Key - K1传输密钥
     */
    static createEnterpriseUserSigner(config) {
        const keyAlias = `enterprise_${config.enterpriseId}_user_${config.userAddress}_${config.chainId}`;
        
        return new SaasKMSSigner({
            ...config,
            keyAlias,
        });
    }

    /**
     * 创建企业操作员KMS签名器
     * @param {Object} config - 配置参数
     */
    static createEnterpriseOperatorSigner(config) {
        const keyAlias = `enterprise_${config.enterpriseId}_operator_${config.chainId}`;
        
        return new SaasKMSSigner({
            ...config,
            keyAlias,
        });
    }

    /**
     * 创建Master Operator KMS签名器
     * @param {Object} config - 配置参数
     */
    static createMasterOperatorSigner(config) {
        const keyAlias = `master_operator_${config.chainId}`;
        
        return new SaasKMSSigner({
            ...config,
            keyAlias,
        });
    }
}

/**
 * KMS签名器工厂
 */
class KMSSignerFactory {
    /**
     * 创建适合ZKSDK使用的KMS签名器
     * @param {Object} options - 选项
     * @param {string} options.signerType - 签名器类型：'enterprise-user', 'enterprise-operator', 'master-operator'
     * @param {string} options.kmsUrl - KMS服务URL
     * @param {string} options.enterpriseId - 企业ID
     * @param {string} options.chainId - 链ID
     * @param {string} options.userAddress - 用户地址
     * @param {string} options.k1Key - K1传输密钥
     */
    static createSigner(options) {
        switch (options.signerType) {
            case 'enterprise-user':
                return SaasKMSSigner.createEnterpriseUserSigner(options);
            
            case 'enterprise-operator':
                return SaasKMSSigner.createEnterpriseOperatorSigner(options);
            
            case 'master-operator':
                return SaasKMSSigner.createMasterOperatorSigner(options);
            
            default:
                throw new Error(`不支持的签名器类型: ${options.signerType}`);
        }
    }

    /**
     * 从SAAS系统获取企业用户的KMS配置
     * @param {Object} params - 参数
     * @param {string} params.saasApiUrl - SAAS API URL
     * @param {string} params.enterpriseApiKey - 企业API密钥
     * @param {string} params.enterpriseId - 企业ID
     * @param {string} params.userAddress - 用户地址
     * @param {string} params.chainId - 链ID
     */
    static async createSignerFromSaasApi(params) {
        try {
            logger.info('🔍 从SAAS系统获取KMS配置...', {
                enterpriseId: params.enterpriseId,
                userAddress: params.userAddress,
                chainId: params.chainId,
            });

            // 调用SAAS API获取KMS配置
            const response = await axios.post(`${params.saasApiUrl}/api/kms/user-signer-config`, {
                enterprise_id: params.enterpriseId,
                user_address: params.userAddress,
                chain_id: params.chainId,
            }, {
                headers: {
                    'Authorization': `Bearer ${params.enterpriseApiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.data.success) {
                throw new Error(response.data.message || '获取KMS配置失败');
            }

            const kmsConfig = response.data.data;

            // 创建KMS签名器
            return new SaasKMSSigner({
                kmsUrl: kmsConfig.kms_url,
                enterpriseId: params.enterpriseId,
                chainId: params.chainId,
                userAddress: params.userAddress,
                keyAlias: kmsConfig.key_alias,
                k1Key: kmsConfig.k1_key,
            });

        } catch (error) {
            logger.error('❌ 从SAAS系统创建KMS签名器失败:', error.message);
            throw error;
        }
    }
}

module.exports = {
    SaasKMSSigner,
    KMSSignerFactory,
    ISignerInterface,
};
