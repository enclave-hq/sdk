// KMS签名接口定义
// 定义标准的签名函数接口，支持与KMS系统对接

const { createLogger } = require('./logger');

/**
 * 签名函数接口定义
 * 
 * KMS签名函数需要实现以下接口：
 * 1. signMessage(message, address) - 签署消息
 * 2. signTransaction(transaction, chainId, address) - 签署交易
 */

/**
 * 标准签名接口类
 * 其他签名实现（KMS、HSM等）需要继承此接口
 */
class ISignerInterface {
    constructor(logger) {
        this.logger = logger || createLogger('SignerInterface');
    }

    /**
     * 签署消息（用于业务逻辑验证，如Commitment授权）
     * @param {string} message - 要签署的消息（UTF-8字符串，包含分配方案等业务数据）
     * @param {string} address - 签名者地址
     * @returns {Promise<string>} - 签名结果（0x开头的十六进制字符串）
     */
    async signMessage(message, address) {
        throw new Error('signMessage方法必须被实现');
    }

    /**
     * 签署交易（用于区块链交易，如ERC20 approve/deposit）
     * @param {Object} transaction - 交易对象 {to, value, data, gasLimit, gasPrice, nonce}
     * @param {number} chainId - 链ID
     * @param {string} address - 签名者地址
     * @returns {Promise<string>} - 签名后的交易数据（可直接广播）
     */
    async signTransaction(transaction, chainId, address) {
        throw new Error('signTransaction方法必须被实现');
    }

    /**
     * 获取地址
     * @returns {string} - 钱包地址
     */
    getAddress() {
        throw new Error('getAddress方法必须被实现');
    }

    /**
     * 验证签名函数是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        throw new Error('isAvailable方法必须被实现');
    }
}

/**
 * KMS签名器实现示例
 * 用户需要根据具体的KMS系统实现此接口
 */
class KMSSignerExample extends ISignerInterface {
    constructor(kmsConfig, logger) {
        super(logger);
        this.kmsConfig = kmsConfig;
        this.address = kmsConfig.address;
    }

    async signMessage(message, address) {
        this.logger.info(`📝 KMS签署消息: ${message.slice(0, 50)}...`);
        
        // 这里需要调用您的KMS系统API
        // 示例：
        // const signature = await this.kmsClient.signMessage({
        //     keyId: this.kmsConfig.keyId,
        //     message: message,
        //     address: address
        // });
        
        // 临时返回模拟签名，实际使用时需要替换
        throw new Error('请实现KMS签名逻辑');
    }

    async signTransaction(transaction, chainId, address) {
        this.logger.info(`🔐 KMS签署交易: Chain ${chainId}, To: ${transaction.to}`);
        
        // 这里需要调用您的KMS系统API
        // 示例：
        // const signedTx = await this.kmsClient.signTransaction({
        //     keyId: this.kmsConfig.keyId,
        //     transaction: transaction,
        //     chainId: chainId,
        //     address: address
        // });
        
        // 临时返回模拟签名，实际使用时需要替换
        throw new Error('请实现KMS交易签名逻辑');
    }

    getAddress() {
        return this.address;
    }

    async isAvailable() {
        // 检查KMS连接状态
        try {
            // 实际实现中应该ping KMS服务
            return true;
        } catch (error) {
            this.logger.error('❌ KMS不可用:', error.message);
            return false;
        }
    }
}

/**
 * 私钥签名器（原有实现的包装）
 * 用于向后兼容
 */
class PrivateKeySignerAdapter extends ISignerInterface {
    constructor(privateKey, logger) {
        super(logger);
        const { ethers } = require('ethers');
        this.wallet = new ethers.Wallet(privateKey);
    }

    async signMessage(message, address) {
        this.logger.debug(`📝 私钥签署消息: ${message.slice(0, 50)}...`);
        return await this.wallet.signMessage(message);
    }

    async signTransaction(transaction, chainId, address) {
        this.logger.debug(`🔐 私钥签署交易: Chain ${chainId}, To: ${transaction.to}`);
        
        // 连接到provider进行交易签名
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(); // 需要配置RPC
        const connectedWallet = this.wallet.connect(provider);
        
        return await connectedWallet.signTransaction(transaction);
    }

    getAddress() {
        return this.wallet.address;
    }

    async isAvailable() {
        return true;
    }
}

/**
 * 签名器工厂类
 * 用于创建不同类型的签名器
 */
class SignerFactory {
    static createKMSSigner(kmsConfig, logger) {
        return new KMSSignerExample(kmsConfig, logger);
    }

    static createPrivateKeySigner(privateKey, logger) {
        return new PrivateKeySignerAdapter(privateKey, logger);
    }

    /**
     * 创建自定义签名器
     * @param {ISignerInterface} customSigner - 自定义签名器实例
     */
    static createCustomSigner(customSigner) {
        if (!(customSigner instanceof ISignerInterface)) {
            throw new Error('自定义签名器必须继承ISignerInterface接口');
        }
        return customSigner;
    }
}

module.exports = {
    ISignerInterface,
    KMSSignerExample,
    PrivateKeySignerAdapter,
    SignerFactory
};
