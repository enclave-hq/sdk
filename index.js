// ZKPay E2E Automation Library Index
// Unified export of all available classes and tools

// Core client library
const { ZKPayClient } = require("./core/zkpay-client-library");

// Original managers (for advanced usage)
const { ZKPayWalletManager } = require("./managers/zkpay-wallet-manager");
const { ZKPayDepositManager } = require("./managers/zkpay-deposit-manager");
const {
  ZKPayCommitmentManager,
} = require("./managers/zkpay-commitment-manager");
const { ZKPayWithdrawManager } = require("./managers/zkpay-withdraw-manager");

// Test and example classes
const { ZKPayE2ETest } = require("../zkpay-e2e-test");
const { ZKPayClientExample } = require("./examples/zkpay-client-example");
const { ZKPayClientTest } = require("./tests/test-zkpay-client");

// Tools and logging
const { createLogger, TestResultLogger } = require("./utils/logger");

// Note: Signature message generation now uses internal methods of CommitmentManager, no longer exports independent signature tools

// Main exports (recommended usage)
module.exports = {
  // 🌟 Main client library - recommended usage
  ZKPayClient,

  // 📋 Original managers - advanced usage
  ZKPayWalletManager,
  ZKPayDepositManager,
  ZKPayCommitmentManager,
  ZKPayWithdrawManager,

  // 🧪 Tests and examples
  ZKPayE2ETest,
  ZKPayClientExample,
  ZKPayClientTest,

  // 🛠️ Tools
  createLogger,
  TestResultLogger,

  // Note: Signature message tools have been moved to internal implementation of CommitmentManager
};

// Convenience export (backward compatibility)
module.exports.default = ZKPayClient;
