/**
 * 统一的地址格式化工具类
 * 处理不同链之间的地址转换和格式化
 */

class AddressFormatter {
    /**
     * 将任意格式的地址转换为Universal Address格式 (32字节，0x前缀)
     * @param {number} chainId - SLIP-44链ID
     * @param {string} address - 原始地址
     * @returns {string} Universal Address格式的地址
     */
    static toUniversalAddress(chainId, address) {
        if (!address) {
            throw new Error('地址不能为空');
        }

        // 清理地址，移除0x前缀并转为小写
        const cleanAddress = address.replace(/^0x/, '').toLowerCase();
        
        // 验证地址长度（以太坊地址应该是40个字符）
        if (cleanAddress.length !== 40) {
            throw new Error(`无效的地址长度: ${cleanAddress.length}, 期望40个字符`);
        }

        // 验证地址只包含有效的十六进制字符
        if (!/^[0-9a-f]{40}$/.test(cleanAddress)) {
            throw new Error(`无效的地址格式: ${address}`);
        }

        // 转换为32字节格式：前12字节为0，后20字节为地址
        return '0x000000000000000000000000' + cleanAddress;
    }

    /**
     * 将Universal Address转换为标准的以太坊地址格式
     * @param {string} universalAddress - Universal Address格式的地址
     * @returns {string} 标准以太坊地址格式 (0x + 20字节)
     */
    static fromUniversalAddress(universalAddress) {
        if (!universalAddress) {
            throw new Error('Universal Address不能为空');
        }

        // 清理地址
        const cleanAddress = universalAddress.replace(/^0x/, '').toLowerCase();
        
        // 验证Universal Address长度（应该是64个字符）
        if (cleanAddress.length !== 64) {
            throw new Error(`无效的Universal Address长度: ${cleanAddress.length}, 期望64个字符`);
        }

        // 验证前24个字符是否都是0
        const padding = cleanAddress.slice(0, 24);
        if (padding !== '000000000000000000000000') {
            throw new Error('无效的Universal Address格式，前12字节应该为0');
        }

        // 提取后20字节作为以太坊地址
        const ethAddress = cleanAddress.slice(24);
        return '0x' + ethAddress;
    }

    /**
     * 根据链ID格式化地址用于显示
     * @param {number} chainId - SLIP-44链ID  
     * @param {string} address - 地址
     * @returns {string} 格式化后的地址显示
     */
    static formatForDisplay(chainId, address) {
        const chainName = this.getChainName(chainId);
        let chainAddress;

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
        
        return `${chainName}链上${chainAddress}地址`;
    }

    /**
     * 确保地址有0x前缀（用于以太坊系链）
     * @param {string} address - 地址
     * @returns {string} 带0x前缀的地址
     */
    static ensureHexPrefix(address) {
        if (!address) {
            throw new Error('地址不能为空');
        }
        return address.startsWith('0x') ? address : `0x${address}`;
    }

    /**
     * 移除地址的0x前缀
     * @param {string} address - 地址
     * @returns {string} 不带0x前缀的地址
     */
    static removeHexPrefix(address) {
        if (!address) {
            throw new Error('地址不能为空');
        }
        return address.replace(/^0x/, '');
    }

    /**
     * 验证地址格式是否有效
     * @param {string} address - 地址
     * @param {number} chainId - 链ID（可选）
     * @returns {boolean} 是否有效
     */
    static isValidAddress(address, chainId = null) {
        try {
            if (!address) return false;
            
            if (chainId === 195) {
                // TRON地址验证（Base58格式）
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
            } else {
                // 以太坊系地址验证
                const cleanAddress = this.removeHexPrefix(address);
                return /^[0-9a-fA-F]{40}$/.test(cleanAddress);
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取链名称
     * @param {number} chainId - SLIP-44链ID
     * @returns {string} 链名称
     */
    static getChainName(chainId) {
        const chainNames = {
            60: 'Ethereum',
            714: 'BSC',
            966: 'Polygon',
            195: 'TRON'
        };
        return chainNames[chainId] || `Chain-${chainId}`;
    }

    /**
     * 批量转换地址为Universal Address格式
     * @param {number} chainId - 链ID
     * @param {string[]} addresses - 地址数组
     * @returns {string[]} Universal Address格式的地址数组
     */
    static batchToUniversalAddress(chainId, addresses) {
        return addresses.map(address => this.toUniversalAddress(chainId, address));
    }

    /**
     * 批量从Universal Address转换为标准地址
     * @param {string[]} universalAddresses - Universal Address数组
     * @returns {string[]} 标准地址数组
     */
    static batchFromUniversalAddress(universalAddresses) {
        return universalAddresses.map(address => this.fromUniversalAddress(address));
    }
}

module.exports = AddressFormatter;
