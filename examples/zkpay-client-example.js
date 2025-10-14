#!/usr/bin/env node

// ZKPay Client Library Usage Example
// Demonstrates how to use ZKPay client library for complete operation flow

// Load environment variables
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ZKPayClient } = require("../core/zkpay-client-library");
const { createLogger } = require("../utils/logger");

/**
 * ZKPay Client Usage Example
 */
class ZKPayClientExample {
  constructor(configFile) {
    this.configFile = configFile;
    this.config = null;
    this.options = null;
    this.logger = createLogger("ZKPayExample");
    this.client = null;
  }

  /**
   * Initialize example
   */
  async initialize() {
    // Create configuration directly from environment variables
    this.createConfigFromEnv();

    // Create client - using new parameterized approach
    this.client = new ZKPayClient(this.logger, this.options);

    // Initialize client
    await this.client.initialize();

    this.logger.info("✅ ZKPay client example initialization completed");
  }

  /**
   * Create configuration from environment variables
   */
  createConfigFromEnv() {
    const testPrivateKey = process.env.TEST_PRIVATE_KEY;
    if (!testPrivateKey || testPrivateKey === "YOUR_TEST_PRIVATE_KEY_HERE") {
      throw new Error(
        "Please set TEST_PRIVATE_KEY environment variable in .env file"
      );
    }

    // Create参数化Configuration
    const treasuryContracts = new Map([
      [714, "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8"], // SLIP44 BSC
    ]);

    const tokenConfigs = new Map([
      ["714_test_usdt", "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"], // SLIP44 BSC
    ]);

    this.options = {
      apiConfig: {
        baseURL:
          process.env.ZKPAY_BACKEND_URL || "https://backend.zkpay.network",
        timeout: parseInt(process.env.ZKPAY_API_TIMEOUT) || 300000,
      },
      treasuryContracts,
      tokenConfigs,
      confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS) || 3,
      maxWaitTime: parseInt(process.env.MAX_WAIT_TIME) || 300000,
      defaultRecipientAddress:
        process.env.TEST_RECIPIENT_ADDRESS ||
        "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
    };

    this.logger.info("✅ 从Environment变量Create参数化Configurationsuccessful");
  }

  // ==================== 基础OperationExample ====================

  /**
   * Example1: 登录和基础InformationQuery
   */
  async example1_LoginAndBasicInfo() {
    this.logger.info("🔰 Example1: 登录和基础InformationQuery");

    try {
      // UseEnvironment变量中的Private Key登录
      const privateKey = process.env.TEST_PRIVATE_KEY;
      const loginResult = await this.client.login(privateKey);

      this.logger.info("✅ 登录successful:", {
        address: loginResult.address,
        userName: loginResult.userName,
      });

      // CheckToken余额
      const chainId = 714; // SLIP44 BSC
      const testUsdtAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
      const balance = await this.client.checkTokenBalance(
        chainId,
        testUsdtAddress
      );
      this.logger.info("💰 Token余额:", balance);

      // Check授权额度
      const allowance = await this.client.checkTokenAllowance(
        chainId,
        testUsdtAddress
      );
      this.logger.info("🔍 授权额度:", allowance);

      // GetUserDeposit记录
      const deposits = await this.client.getUserDeposits();
      this.logger.info(`📋 UserDeposit记录: ${deposits.length} 条`);

      return { loginResult, balance, allowance, deposits };
    } catch (error) {
      this.logger.error("❌ Example1Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example2: ExecuteDepositOperation
   */
  async example2_PerformDeposit() {
    this.logger.info("🔰 Example2: ExecuteDepositOperation");

    try {
      const chainId = 714; // SLIP44 BSC
      const tokenSymbol = "test_usdt";
      const amount = "10.0";

      // 先Check余额
      const balance = await this.client.checkTokenBalance(chainId, tokenSymbol);
      if (parseFloat(balance.formatted) < parseFloat(amount)) {
        throw new Error(
          `余额不足: 需要 ${amount}, 但只有 ${balance.formatted}`
        );
      }

      // ExecuteDeposit（包含授权）
      const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";
      const tokenAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
      const depositResult = await this.client.deposit(
        chainId,
        tokenAddress,
        amount,
        treasuryAddress
      );

      this.logger.info("✅ Depositsuccessful:", {
        txHash: depositResult.deposit.txHash,
      });

      // Wait后端检测Deposit
      const depositRecord = await this.client.waitForDepositDetection(
        depositResult.deposit.txHash,
        chainId,
        60
      );

      this.logger.info("✅ Deposit检测completed:", {
        checkbookId: depositRecord.checkbook_id,
        status: depositRecord.status,
      });

      // WaitcheckbookStatus变为ready_for_commitment
      this.logger.info("⏳ WaitcheckbookStatus变为ready_for_commitment...");
      await this.client.waitForCommitmentStatus(
        depositRecord.checkbook_id,
        ["ready_for_commitment"],
        180000 // 3分钟超时（毫秒）
      );

      this.logger.info(
        "✅ checkbookStatus已变为ready_for_commitment，可以ExecutecommitmentOperation"
      );

      return { depositResult, depositRecord };
    } catch (error) {
      this.logger.error("❌ Example2Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example3: Create分配并ExecuteCommitment（同步方式）
   */
  async example3_CommitmentSync(checkbookId) {
    this.logger.info("🔰 Example3: Create分配并ExecuteCommitment（同步方式）");

    try {
      // 首先CheckcheckbookStatus
      this.logger.info("🔍 CheckcheckbookStatus...");
      const checkbook = await this.client.getCheckbookDetails(checkbookId);
      this.logger.info(`📊 当前checkbookStatus: ${checkbook.status}`);

      if (checkbook.status !== "ready_for_commitment") {
        this.logger.info(
          "⏳ checkbookStatus不是ready_for_commitment，WaitStatus变化..."
        );
        await this.client.waitForCommitmentStatus(
          checkbookId,
          ["ready_for_commitment"],
          180000 // 3分钟超时（毫秒）
        );
      }

      // Create分配Plan
      const allocations = [
        {
          recipient_chain_id: 714,
          recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
          amount: "10000000000000000000", // 10.0 USDT (18 decimals)
        },
      ];

      // ExecuteCommitment（同步，Waitcompleted）
      const commitmentResult = await this.client.executeCommitmentSync(
        checkbookId,
        allocations,
        true // Wait到with_checkbookStatus
      );

      this.logger.info("✅ CommitmentExecutesuccessful（同步）:", {
        checkbookId,
        status: commitmentResult.status,
        finalStatus: commitmentResult.finalStatus,
      });

      return commitmentResult;
    } catch (error) {
      this.logger.error("❌ Example3Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example4: Create分配并ExecuteCommitment（异步方式）
   */
  async example4_CommitmentAsync(checkbookId) {
    this.logger.info("🔰 Example4: Create分配并ExecuteCommitment（异步方式）");

    try {
      // 首先CheckcheckbookStatus
      this.logger.info("🔍 CheckcheckbookStatus...");
      const checkbook = await this.client.getCheckbookDetails(checkbookId);
      this.logger.info(`📊 当前checkbookStatus: ${checkbook.status}`);

      if (checkbook.status !== "ready_for_commitment") {
        this.logger.info(
          "⏳ checkbookStatus不是ready_for_commitment，WaitStatus变化..."
        );
        await this.client.waitForCommitmentStatus(
          checkbookId,
          ["ready_for_commitment"],
          180000 // 3分钟超时（毫秒）
        );
      }

      // Create分配Plan
      const allocations = [
        {
          recipient_chain_id: 714,
          recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
          amount: "10000000000000000000", // 10.0 USDT (18 decimals)
        },
      ];

      // ExecuteCommitment（异步，Immediate返回）
      const commitmentResult = await this.client.executeCommitmentAsync(
        checkbookId,
        allocations
      );

      this.logger.info("✅ Commitment提交successful（异步）:", {
        checkbookId,
        status: commitmentResult.status,
      });

      // 可以SelectWaitcompleted
      this.logger.info("⏳ WaitCommitmentcompleted...");
      const finalResult = await commitmentResult.waitForCompletion();

      this.logger.info("✅ Commitmentcompleted:", {
        finalStatus: finalResult.status,
      });

      return { commitmentResult, finalResult };
    } catch (error) {
      this.logger.error("❌ Example4Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example5: Generate提现证明（同步方式）
   */
  async example5_GenerateProofSync(checkbookId) {
    this.logger.info("🔰 Example5: Generate提现证明（同步方式）");

    try {
      const recipientInfo = {
        chain_id: 714,
        address: this.client.getCurrentUser().address,
        amount: "10000000000000000000",
        token_symbol: "test_usdt",
      };

      // Generate证明（同步，Waitcompleted）
      const proofResult = await this.client.generateProofSync(
        checkbookId,
        recipientInfo,
        true // Wait到completedStatus
      );

      this.logger.info("✅ 证明Generatesuccessful（同步）:", {
        checkId: proofResult.checkId,
        finalStatus: proofResult.finalStatus,
      });

      if (proofResult.completionResult?.transaction_hash) {
        this.logger.info(
          "💰 提现交易Hash:",
          proofResult.completionResult.transaction_hash
        );
      }

      return proofResult;
    } catch (error) {
      this.logger.error("❌ Example5Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example6: Generate提现证明（异步方式）
   */
  async example6_GenerateProofAsync(checkbookId) {
    this.logger.info("🔰 Example6: Generate提现证明（异步方式）");

    try {
      const recipientInfo = {
        chain_id: 714,
        address: this.client.getCurrentUser().address,
        amount: "10000000000000000000",
        token_symbol: "test_usdt",
      };

      // Generate证明（异步，Immediate返回）
      const proofResult = await this.client.generateProofAsync(
        checkbookId,
        recipientInfo
      );

      this.logger.info("✅ 证明GenerateRequest提交successful（异步）:", {
        checkId: proofResult.checkId,
      });

      // 可以SelectWaitcompleted
      this.logger.info("⏳ Wait证明Generatecompleted...");
      const completionResult = await proofResult.waitForCompletion();

      this.logger.info("✅ 证明Generatecompleted:", {
        status: completionResult.status,
      });

      if (completionResult.transaction_hash) {
        this.logger.info("💰 提现交易Hash:", completionResult.transaction_hash);
      }

      return { proofResult, completionResult };
    } catch (error) {
      this.logger.error("❌ Example6Executefailed:", error.message);
      throw error;
    }
  }

  // ==================== 高级OperationExample ====================

  /**
   * Example6: Demo正确的checkbookStatusWait流程
   */
  async example6_CheckbookStatusFlow() {
    this.logger.info("🔰 Example6: Demo正确的checkbookStatusWait流程");

    try {
      // GetUserDeposit记录
      const deposits = await this.client.getUserDeposits();
      this.logger.info(`📋 找到 ${deposits.length} 条Deposit记录`);

      if (deposits.length === 0) {
        this.logger.warn("⚠️ 没有Deposit记录，Please先ExecuteDepositOperation");
        return null;
      }

      // 找到最NewDeposit记录
      const latestDeposit = deposits[0];
      const checkbookId = latestDeposit.checkbook_id;

      this.logger.info("🔍 Check最新Deposit的checkbookStatus:", {
        checkbookId,
        currentStatus: latestDeposit.status,
      });

      // GetDetailed的checkbookStatus
      const checkbook = await this.client.getCheckbookDetails(checkbookId);
      this.logger.info(`📊 DetailedcheckbookStatus: ${checkbook.status}`);

      // 根据当前Status决定下一步Operation
      switch (checkbook.status) {
        case "ready_for_commitment":
          this.logger.info("✅ checkbook已准备好，可以Executecommitment");
          break;

        case "with_checkbook":
        case "issued":
          this.logger.info(
            "⏳ checkbookStatus为with_checkbook/issued，Wait变为ready_for_commitment..."
          );
          await this.client.waitForCommitmentStatus(
            checkbookId,
            ["ready_for_commitment"],
            180000 // 3分钟超时（毫秒）
          );
          this.logger.info("✅ checkbookStatus已变为ready_for_commitment");
          break;

        case "proof_failed":
        case "submission_failed":
          this.logger.warn(
            `⚠️ checkbookStatus为${checkbook.status}，可以重试commitment`
          );
          break;

        default:
          this.logger.info(`📊 当前Status: ${checkbook.status}，继续Wait...`);
          await this.client.waitForCommitmentStatus(
            checkbookId,
            ["ready_for_commitment"],
            180000 // 3分钟超时（毫秒）
          );
          break;
      }

      return {
        checkbookId,
        initialStatus: latestDeposit.status,
        finalStatus: checkbook.status,
      };
    } catch (error) {
      this.logger.error("❌ Example6Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example7: 完整的Deposit到Commitment流程
   */
  async example7_FullDepositToCommitment() {
    this.logger.info("🔰 Example7: 完整的Deposit到Commitment流程");

    try {
      const chainId = 714; // SLIP44 BSC
      const tokenSymbol = "test_usdt";
      const amount = "15.0";

      const allocations = [
        {
          recipient_chain_id: 714,
          recipient_address: "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
          amount: "15000000000000000000", // 15.0 USDT
        },
      ];

      // Execute完整流程
      const result = await this.client.performFullDepositToCommitment(
        chainId,
        tokenSymbol,
        amount,
        allocations,
        {
          waitForCommitment: true,
          maxWaitTime: 300,
        }
      );

      this.logger.info("✅ 完整流程Executesuccessful:", {
        depositTxHash: result.deposit.deposit.txHash,
        checkbookId: result.depositRecord.checkbook_id,
        commitmentStatus: result.commitment.status,
      });

      return result;
    } catch (error) {
      this.logger.error("❌ Example7Executefailed:", error.message);
      throw error;
    }
  }

  /**
   * Example8: 完整的Commitment到提现流程
   */
  async example8_FullCommitmentToWithdraw(checkbookId) {
    this.logger.info("🔰 Example8: 完整的Commitment到提现流程");

    try {
      const recipientInfo = {
        chain_id: 714,
        address: this.client.getCurrentUser().address,
        amount: "15000000000000000000",
        token_symbol: "test_usdt",
      };

      // Execute完整提现流程
      const result = await this.client.performFullCommitmentToWithdraw(
        checkbookId,
        recipientInfo,
        {
          waitForProof: true,
          maxWaitTime: 300,
        }
      );

      this.logger.info("✅ 完整提现流程Executesuccessful:", {
        checkbookId,
        checkId: result.proof.checkId,
        finalStatus: result.proof.finalStatus,
      });

      if (result.proof.completionResult?.transaction_hash) {
        this.logger.info(
          "💰 提现交易Hash:",
          result.proof.completionResult.transaction_hash
        );
      }

      return result;
    } catch (error) {
      this.logger.error("❌ Example8Executefailed:", error.message);
      throw error;
    }
  }

  // ==================== 运行Example ====================

  /**
   * 运行所有Example
   */
  async runAllExamples() {
    this.logger.info("🚀 Starting运行所有ZKPay客户端Example...");

    const results = {};

    try {
      // Example1: 登录和基础Information
      results.example1 = await this.example1_LoginAndBasicInfo();

      // Example2: ExecuteDeposit
      results.example2 = await this.example2_PerformDeposit();
      const checkbookId = results.example2.depositRecord.checkbook_id;

      // Example6: DemocheckbookStatusWait流程
      results.example6 = await this.example6_CheckbookStatusFlow();

      // Example3: Commitment（同步）
      results.example3 = await this.example3_CommitmentSync(checkbookId);

      // Example5: Generate证明（同步）
      results.example5 = await this.example5_GenerateProofSync(checkbookId);

      this.logger.info("🎉 所有Example运行successful！");

      // DisplaySummary
      this.displaySummary(results);

      return results;
    } catch (error) {
      this.logger.error("❌ Example运行failed:", error.message);
      throw error;
    }
  }

  /**
   * 运行单个Example
   */
  async runSingleExample(exampleName, ...args) {
    this.logger.info(`🚀 运行单个Example: ${exampleName}`);

    try {
      // 确保已登录
      if (!this.client.isLoggedIn()) {
        const privateKey = process.env.TEST_PRIVATE_KEY;
        await this.client.login(privateKey);
      }

      // Process不同的Example名称Format
      let methodName;
      if (exampleName.startsWith("example")) {
        const num = exampleName.replace("example", "");
        switch (num) {
          case "1":
            methodName = "example1_LoginAndBasicInfo";
            break;
          case "2":
            methodName = "example2_PerformDeposit";
            break;
          case "3":
            methodName = "example3_CommitmentSync";
            break;
          case "4":
            methodName = "example4_CommitmentAsync";
            break;
          case "5":
            methodName = "example5_GenerateProofSync";
            break;
          case "6":
            methodName = "example6_CheckbookStatusFlow";
            break;
          case "7":
            methodName = "example7_FullDepositToCommitment";
            break;
          case "8":
            methodName = "example8_FullCommitmentToWithdraw";
            break;
          default:
            methodName = `example${num}`;
            break;
        }
      } else {
        methodName = exampleName;
      }

      if (typeof this[methodName] !== "function") {
        throw new Error(`ExampleMethod不存在: ${methodName}`);
      }

      const result = await this[methodName](...args);
      this.logger.info(`✅ Example ${exampleName} 运行successful`);

      return result;
    } catch (error) {
      this.logger.error(`❌ Example ${exampleName} 运行failed:`, error.message);
      throw error;
    }
  }

  /**
   * Display运行Summary
   */
  displaySummary(results) {
    console.log("\n📊 ====== 运行Summary ======");

    if (results.example1) {
      console.log(`✅ 登录successful: ${results.example1.loginResult.address}`);
    }

    if (results.example2) {
      console.log(
        `✅ Depositsuccessful: ${results.example2.depositResult.deposit.txHash}`
      );
      console.log(
        `📋 CheckBook ID: ${results.example2.depositRecord.checkbook_id}`
      );
    }

    if (results.example6) {
      console.log(
        `✅ CheckbookStatusCheck: ${results.example6.initialStatus} → ${results.example6.finalStatus}`
      );
    }

    if (results.example3) {
      console.log(`✅ Commitmentsuccessful: ${results.example3.status}`);
    }

    if (results.example5) {
      console.log(`✅ 提现successful: ${results.example5.checkId}`);
      if (results.example5.completionResult?.transaction_hash) {
        console.log(
          `💰 提现交易: ${results.example5.completionResult.transaction_hash}`
        );
      }
    }

    console.log("========================\n");
  }

  /**
   * Cleanup资源
   */
  async cleanup() {
    this.logger.info("🧹 CleanupExample资源...");

    if (this.client) {
      await this.client.cleanup();
    }

    this.logger.info("✅ ExampleCleanupcompleted");
  }
}

// 命令行Interface
if (require.main === module) {
  const { Command } = require("commander");
  const program = new Command();

  program
    .name("zkpay-client-example")
    .description("ZKPay 客户端库UseExample")
    .version("1.0.0");

  program
    .option("-c, --config <file>", "ConfigurationFile路径", "config.yaml")
    .option("-e, --example <name>", "运行指定Example (例如: example1, example2)")
    .option("--checkbook-id <id>", "CheckBook ID (用于某些Example)")
    .option("--all", "运行所有Example");

  program.action(async (options) => {
    const example = new ZKPayClientExample(options.config);

    try {
      await example.initialize();

      if (options.all) {
        await example.runAllExamples();
      } else if (options.example) {
        const args = options.checkbookId ? [options.checkbookId] : [];
        await example.runSingleExample(options.example, ...args);
      } else {
        console.log(
          "Please指定 --all 运行所有Example，或 --example <name> 运行指定Example"
        );
        program.help();
      }
    } catch (error) {
      console.error("❌ ExampleExecutefailed:", error.message);
      process.exit(1);
    } finally {
      await example.cleanup();
    }
  });

  program.parse();
}

module.exports = { ZKPayClientExample };
