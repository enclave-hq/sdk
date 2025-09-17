/**
 * KMS签名器接口定义
 * 为ZKSDK提供统一的KMS签名服务接口
 */

const { ethers } = require('ethers');

/**
 * KMS签名器接口
 * 所有KMS签名器实现都必须继承这个接口
 */
class ISignerInterface {
    /**
     * 检查签名器是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        throw new Error('ISignerInterface.isAvailable() must be implemented');
    }

    /**
     * 获取签名器地址
     * @returns {Promise<string>}
     */
    async getAddress() {
        throw new Error('ISignerInterface.getAddress() must be implemented');
    }

    /**
     * 签名消息
     * @param {string} message - 要签名的消息（十六进制格式）
     * @param {string} signatureType - 签名类型：'data', 'transaction', 'eip191'
     * @returns {Promise<string>} 签名结果
     */
    async signMessage(message, signatureType = 'eip191') {
        throw new Error('ISignerInterface.signMessage() must be implemented');
    }

    /**
     * 签名交易
     * @param {Object} transaction - 交易对象
     * @returns {Promise<string>} 签名结果
     */
    async signTransaction(transaction) {
        throw new Error('ISignerInterface.signTransaction() must be implemented');
    }

    /**
     * 获取签名器类型
     * @returns {string} 签名器类型
     */
    getType() {
        throw new Error('ISignerInterface.getType() must be implemented');
    }
}

/**
 * 私钥签名器适配器
 * 使用私钥进行签名的KMS签名器实现
 */
class PrivateKeySignerAdapter extends ISignerInterface {
    constructor(privateKey, logger) {
        super();
        this.privateKey = privateKey;
        this.logger = logger || console;
        this.wallet = new ethers.Wallet(privateKey);
    }

    /**
     * 检查签名器是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            return this.wallet && this.privateKey;
        } catch (error) {
            this.logger.error('私钥签名器不可用:', error.message);
            return false;
        }
    }

    /**
     * 获取签名器地址
     * @returns {Promise<string>}
     */
    async getAddress() {
        return this.wallet.address;
    }

    /**
     * 签名消息
     * @param {string} message - 要签名的消息（十六进制格式）
     * @param {string} signatureType - 签名类型：'data', 'transaction', 'eip191'
     * @returns {Promise<string>} 签名结果
     */
    async signMessage(message, signatureType = 'eip191') {
        try {
            if (signatureType === 'eip191') {
                return await this.wallet.signMessage(message);
            } else if (signatureType === 'data') {
                return await this.wallet.signMessage(ethers.getBytes(message));
            } else {
                throw new Error(`不支持的签名类型: ${signatureType}`);
            }
        } catch (error) {
            this.logger.error('消息签名失败:', error.message);
            throw error;
        }
    }

    /**
     * 签名交易
     * @param {Object} transaction - 交易对象
     * @returns {Promise<string>} 签名结果
     */
    async signTransaction(transaction) {
        try {
            return await this.wallet.signTransaction(transaction);
        } catch (error) {
            this.logger.error('交易签名失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取签名器类型
     * @returns {string} 签名器类型
     */
    getType() {
        return 'private_key';
    }
}

module.exports = {
    ISignerInterface,
    PrivateKeySignerAdapter
};