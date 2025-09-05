// ZKPay E2E Automation Library Index
// 统一导出所有可用的类和工具

// 核心客户端库
const { ZKPayClient } = require('./core/zkpay-client-library');

// 原始管理器（用于高级用法）
const { ZKPayWalletManager } = require('./managers/zkpay-wallet-manager');
const { ZKPayDepositManager } = require('./managers/zkpay-deposit-manager');
const { ZKPayCommitmentManager } = require('./managers/zkpay-commitment-manager');
const { ZKPayWithdrawManager } = require('./managers/zkpay-withdraw-manager');

// 测试和示例类
const { ZKPayE2ETest } = require('../zkpay-e2e-test');
const { ZKPayClientExample } = require('./examples/zkpay-client-example');
const { ZKPayClientTest } = require('./tests/test-zkpay-client');

// 工具和日志
const { createLogger, TestResultLogger } = require('../logger');

// 注意：签名消息生成现在使用CommitmentManager内部的方法，不再导出独立的签名工具

// 主要导出（推荐使用）
module.exports = {
    // 🌟 主要客户端库 - 推荐使用
    ZKPayClient,
    
    // 📋 原始管理器 - 高级用法
    ZKPayWalletManager,
    ZKPayDepositManager,
    ZKPayCommitmentManager,
    ZKPayWithdrawManager,
    
    // 🧪 测试和示例
    ZKPayE2ETest,
    ZKPayClientExample,
    ZKPayClientTest,
    
    // 🛠️ 工具
    createLogger,
    TestResultLogger,
    
    // 注意：签名消息工具已移至CommitmentManager内部实现
};

// 便捷导出（向后兼容）
module.exports.default = ZKPayClient;
