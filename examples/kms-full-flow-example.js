#!/usr/bin/env node

// ZKPay KMS Complete Flow Example
// Complete KMS integration example from Deposit to Withdraw
// Supports client-provided private key or auto-generated private key

require("dotenv").config();

const { ZKPayClient } = require("../core/zkpay-client-library");
const {
  ZKPayKMSSigner,
  ZKPayKMSSignerFactory,
} = require("../utils/zkpay-kms-adapter");
const { createLogger } = require("../utils/logger");
const crypto = require("crypto");
const axios = require("axios");

/**
 * KMS Complete Flow Example Class
 */
class KMSFullFlowExample {
  constructor() {
    this.logger = createLogger("KMSFullFlow");
    this.client = null;
    this.kmsSigner = null;
    this.userAddress = null;
  }

  /**
   * Step 1: Initialize KMS key (supports two methods)
   */
  async initializeKMSKey(useProvidedKey = false, providedPrivateKey = null) {
    this.logger.info("🔑 Step 1: Initialize KMS key");

    const kmsBaseURL = process.env.KMS_BASE_URL || "http://localhost:18082";
    const keyAlias = `zkpay_demo_${Date.now()}`;

    let privateKey;
    let keySource;

    if (useProvidedKey && providedPrivateKey) {
      // Method1: UseClientProvide的Private Key
      privateKey = providedPrivateKey;
      keySource = "ClientProvide";
      this.logger.info(
        `🔐 UseClientProvide的Private Key: ${privateKey.slice(0, 10)}...`
      );
    } else {
      // Method2: AutoGenerate新Private Key
      privateKey = "0x" + crypto.randomBytes(32).toString("hex");
      keySource = "AutoGenerate";
      this.logger.info(
        `🎲 AutoGenerate新Private Key: ${privateKey.slice(0, 10)}...`
      );
    }

    // CallKMSEncryptionInterface
    const encryptRequest = {
      private_key: privateKey,
      key_alias: keyAlias,
      slip44_id: 714, // SLIP44标准币种ID (714=BSC)
    };

    try {
      this.logger.info("📡 向KMSSendEncryptionRequest...");
      const response = await axios.post(
        `${kmsBaseURL}/api/v1/encrypt`,
        encryptRequest,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.KMS_BEARER_TOKEN || ""}`,
            "X-Service-Key":
              process.env.KMS_SERVICE_KEY || "zkpay-service-key-zksdk",
            "X-Service-Name": "zksdk",
          },
          timeout: 30000,
        }
      );

      if (!response.data.success) {
        throw new Error(`KMSEncryptionfailed: ${response.data.error}`);
      }

      const result = response.data;
      this.userAddress = result.public_address;

      this.logger.info("✅ KMSKeyInitializesuccessful:");
      this.logger.info(`  🏷️  KeySource: ${keySource}`);
      this.logger.info(`  🔑 KeyAlias: ${keyAlias}`);
      this.logger.info(`  📍 UserAddress: ${this.userAddress}`);
      this.logger.info(`  🌐 SLIP44 ID: ${result.slip44_id}`);
      this.logger.info(`  ⛓️  EVM链ID: ${result.evm_chain_id}`);

      // CreateKMSSignature器Configuration
      const kmsConfig = {
        baseURL: kmsBaseURL,
        keyAlias: keyAlias,
        encryptedKey: result.k1 || result.encrypted_key, // PriorityUsek1，CompatibleOldFormat
        slip44Id: 714,
        address: this.userAddress,
        defaultSignatureType: "eip191",
      };

      // CreateKMSSignature器（Temporarily不Pass inRPCProvide者，Later在ClientInitialize后Then set）
      this.kmsSigner = ZKPayKMSSignerFactory.createFromExistingKey(
        kmsConfig,
        this.logger
      );

      return {
        success: true,
        keyAlias,
        address: this.userAddress,
        encryptedKey: result.encrypted_key,
        keySource,
      };
    } catch (error) {
      this.logger.error("❌ KMSKeyInitializefailed:", error.message);
      throw error;
    }
  }

  /**
   * Step2: InitializeZKPayClient并Login
   */
  async initializeZKPayClient() {
    this.logger.info("🚀 Step2: InitializeZKPayClient");

    // CreateParameterizedConfiguration
    const treasuryContracts = new Map([
      [714, "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8"], // BSC SLIP44
    ]);

    const tokenConfigs = new Map([
      ["714_test_usdt", "0xbFBD79DbF5369D013a3D31812F67784efa6e0309"],
    ]);

    const options = {
      apiConfig: {
        baseURL:
          process.env.ZKPAY_BACKEND_URL || "https://backend.zkpay.network",
        timeout: 300000,
      },
      treasuryContracts,
      tokenConfigs,
      confirmationBlocks: 3,
      maxWaitTime: 300000,
      defaultRecipientAddress:
        process.env.TEST_RECIPIENT_ADDRESS ||
        "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
    };

    // CreateClient
    this.client = new ZKPayClient(this.logger, options);
    await this.client.initialize();

    // 为KMSSignature器SetRPCProvide者
    if (
      this.kmsSigner &&
      this.client.walletManager &&
      this.client.walletManager.providers
    ) {
      // FromWalletManagement器GetRPCProvide者
      const rpcProviders = {};
      for (const [
        chainId,
        provider,
      ] of this.client.walletManager.providers.entries()) {
        rpcProviders[chainId] = provider;
      }
      this.kmsSigner.rpcProviders = rpcProviders;
      this.logger.info("🔗 Already forKMSSignature器SetRPCProvide者");
    }

    // UseKMSSignature器Login
    const loginResult = await this.client.loginWithSigner(
      this.kmsSigner,
      this.userAddress,
      "kms-demo-user"
    );

    this.logger.info("✅ ZKPayClientLoginsuccessful:", {
      address: loginResult.address,
      userName: loginResult.userName,
    });

    return loginResult;
  }

  /**
   * Step3: CheckTokenBalance和Authorization
   */
  async checkTokenStatus() {
    this.logger.info("💰 Step3: CheckTokenStatus");

    const chainId = 714; // SLIP44 BSC
    const tokenAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
    const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";

    // CheckBalance
    const balance = await this.client.checkTokenBalance(
      chainId,
      tokenAddress,
      this.userAddress
    );
    this.logger.info(`💰 CurrentBalance: ${balance.formatted} USDT`);

    // CheckAuthorization
    const allowance = await this.client.checkTokenAllowance(
      chainId,
      tokenAddress,
      this.userAddress,
      treasuryAddress
    );
    this.logger.info(`🔍 CurrentAuthorization: ${allowance.formatted} USDT`);

    return {
      balance,
      allowance,
      chainId,
      tokenAddress,
      treasuryAddress,
    };
  }

  /**
   * Step4: ExecuteDepositOperation（UseKMSSignature）
   */
  async performDeposit(amount = "10.0") {
    this.logger.info(`💳 Step4: ExecuteDepositOperation (${amount} USDT)`);

    const chainId = 714;
    const tokenAddress = "0xbFBD79DbF5369D013a3D31812F67784efa6e0309";
    const treasuryAddress = "0x83DCC14c8d40B87DE01cC641b655bD608cf537e8";

    try {
      // CheckBalanceWhetherEnough
      const balance = await this.client.checkTokenBalance(
        chainId,
        tokenAddress,
        this.userAddress
      );
      if (parseFloat(balance.formatted) < parseFloat(amount)) {
        throw new Error(
          `BalanceInsufficient: Need ${amount}, But only have ${balance.formatted}`
        );
      }

      // ExecuteDeposit（IncludeAuthorization，UseKMSSignature）
      this.logger.info("🔐 UseKMSSignatureExecuteDepositTransaction...");
      const depositResult = await this.client.deposit(
        chainId,
        tokenAddress,
        amount,
        treasuryAddress
      );

      this.logger.info("✅ DepositTransactionsuccessful:", {
        txHash: depositResult.deposit.txHash,
      });

      // Get正确的TransactionHash
      const txHash = depositResult.deposit.txHash;
      if (!txHash) {
        throw new Error("CannotGetDepositTransactionHash");
      }

      // WaitBackendDetectionDeposit
      this.logger.info("⏳ WaitBackendDetectionDeposit...");
      const depositRecord = await this.client.waitForDepositDetection(
        txHash,
        chainId,
        120 // 2MinutesTimeout
      );

      this.logger.info("✅ DepositDetectioncompleted:", {
        checkbookId: depositRecord.checkbook_id,
        status: depositRecord.status,
      });

      // WaitcheckbookStatusChange toready_for_commitment（与zkpay-client-example.js一致）
      this.logger.info("⏳ WaitcheckbookStatusChange toready_for_commitment...");
      await this.client.waitForCommitmentStatus(
        depositRecord.checkbook_id,
        ["ready_for_commitment"],
        180000 // 3MinutesTimeout（毫秒）
      );

      this.logger.info(
        "✅ checkbookStatusAlreadyChange toready_for_commitment，CanExecutecommitmentOperation"
      );

      return {
        depositResult,
        depositRecord,
      };
    } catch (error) {
      this.logger.error("❌ DepositOperationfailed:", error.message);
      throw error;
    }
  }

  /**
   * Step5: WaitcheckbookPreparecompleted
   */
  async waitForCheckbookReady(checkbookId) {
    this.logger.info("⏳ Step5: WaitcheckbookPreparecompleted");

    try {
      // WaitcheckbookStatusChange toready_for_commitment
      await this.client.waitForCommitmentStatus(
        checkbookId,
        ["ready_for_commitment"],
        300000 // 5MinutesTimeout
      );

      this.logger.info("✅ checkbookAlreadyPreparecompleted，CanExecutecommitment");

      return true;
    } catch (error) {
      this.logger.error("❌ WaitcheckbookPreparefailed:", error.message);
      throw error;
    }
  }

  /**
   * Step6: ExecuteCommitment（UseKMSSignature）
   */
  async executeCommitment(checkbookId, amount = "10.0") {
    this.logger.info("📝 Step6: ExecuteCommitment（UseKMSSignature）");

    try {
      // CreateAllocationPlan
      const allocations = [
        {
          recipient_chain_id: 714,
          recipient_address:
            process.env.TEST_RECIPIENT_ADDRESS ||
            "0x0848d929b9d35bfb7aa50641d392a4ad83e145ce",
          amount: (parseFloat(amount) * Math.pow(10, 18)).toString(), // Convert towei
        },
      ];

      this.logger.info("🔐 UseKMSSignatureExecutecommitment...");

      // ExecuteCommitment（Sync，Waitcompleted）
      const commitmentResult = await this.client.executeCommitmentSync(
        checkbookId,
        allocations,
        true // WaitTowith_checkbookStatus
      );

      this.logger.info("✅ CommitmentExecutesuccessful:", {
        checkbookId,
        status: commitmentResult.status,
        finalStatus: commitmentResult.finalStatus,
      });

      return commitmentResult;
    } catch (error) {
      this.logger.error("❌ CommitmentExecutefailed:", error.message);
      throw error;
    }
  }

  /**
   * Step7: GenerateWithdrawProof（UseKMSSignature）
   */
  async generateWithdrawProof(checkbookId, amount = "10.0") {
    this.logger.info("🔍 Step7: GenerateWithdrawProof（UseKMSSignature）");

    try {
      const recipientInfo = {
        chain_id: 714,
        address: this.userAddress, // WithdrawToOwnAddress
        amount: (parseFloat(amount) * Math.pow(10, 18)).toString(),
        token_symbol: "test_usdt",
      };

      this.logger.info("🔐 UseKMSSignatureGenerateWithdrawProof...");

      // GenerateProof（Sync，Waitcompleted）
      const proofResult = await this.client.generateProofSync(
        checkbookId,
        recipientInfo,
        true // WaitTocompletedStatus
      );

      this.logger.info("✅ WithdrawProofGeneratesuccessful:", {
        checkId: proofResult.checkId,
        finalStatus: proofResult.finalStatus,
      });

      if (proofResult.completionResult?.transaction_hash) {
        this.logger.info(
          "💰 WithdrawTransactionHash:",
          proofResult.completionResult.transaction_hash
        );
      }

      return proofResult;
    } catch (error) {
      this.logger.error("❌ WithdrawProofGeneratefailed:", error.message);
      throw error;
    }
  }

  /**
   * Run完整Flow
   */
  async runFullFlow(
    useProvidedKey = false,
    providedPrivateKey = null,
    depositAmount = "10.0"
  ) {
    this.logger.info("🚀 StartingKMS完整FlowTest...");
    this.logger.info(
      `🔐 KeyMode: ${
        useProvidedKey ? "ClientProvidePrivate Key" : "AutoGeneratePrivate Key"
      }`
    );
    this.logger.info(`💰 DepositAmount: ${depositAmount} USDT`);

    const results = {};

    try {
      // Step1: InitializeKMSKey
      results.keyInit = await this.initializeKMSKey(
        useProvidedKey,
        providedPrivateKey
      );

      // Step2: InitializeZKPayClient
      results.clientInit = await this.initializeZKPayClient();

      // Step3: CheckTokenStatus
      results.tokenStatus = await this.checkTokenStatus();

      // Step4: ExecuteDeposit
      results.deposit = await this.performDeposit(depositAmount);

      // Step5: ExecuteCommitment（checkbookStatusAlready在DepositStep中Waitcompleted）
      results.commitment = await this.executeCommitment(
        results.deposit.depositRecord.checkbook_id,
        depositAmount
      );

      // Step7: GenerateWithdrawProof
      results.withdraw = await this.generateWithdrawProof(
        results.deposit.depositRecord.checkbook_id,
        depositAmount
      );

      this.logger.info("🎉 KMS完整FlowTestsuccessfulcompleted！");

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.logger.error("❌ KMS完整FlowTestfailed:", error.message);
      return {
        success: false,
        error: error.message,
        results,
      };
    } finally {
      // CleanupResource
      if (this.client) {
        await this.client.cleanup();
      }
    }
  }

  /**
   * DisplayTestSummary
   */
  displaySummary(result) {
    console.log("\n📊 ====== KMS Complete Flow Test Summary ======");

    if (result.success) {
      console.log("✅ Test Status: Success");

      if (result.results.keyInit) {
        console.log(`🔑 Key Source: ${result.results.keyInit.keySource}`);
        console.log(`📍 User Address: ${result.results.keyInit.address}`);
      }

      if (result.results.deposit) {
        console.log(
          `💳 DepositTransaction: ${result.results.deposit.depositResult.txHash}`
        );
        console.log(
          `📋 CheckBook ID: ${result.results.deposit.depositRecord.checkbook_id}`
        );
      }

      if (result.results.commitment) {
        console.log(
          `📝 CommitmentStatus: ${result.results.commitment.finalStatus}`
        );
      }

      if (result.results.withdraw) {
        console.log(`🔍 WithdrawStatus: ${result.results.withdraw.finalStatus}`);
        if (result.results.withdraw.completionResult?.transaction_hash) {
          console.log(
            `💰 WithdrawTransaction: ${result.results.withdraw.completionResult.transaction_hash}`
          );
        }
      }
    } else {
      console.log("❌ TestStatus: failed");
      console.log(`🐛 ErrorInformation: ${result.error}`);
    }

    console.log("=====================================\n");
  }
}

// Command lineInterface
if (require.main === module) {
  const { Command } = require("commander");
  const program = new Command();

  program
    .name("kms-full-flow-example")
    .description("ZKPay KMS完整FlowExample - FromDepositToWithdraw")
    .version("1.0.0");

  program
    .option("--use-provided-key", "UseProvide的Private KeyInstead ofAutoGenerate")
    .option(
      "--private-key <key>",
      "ToUse的Private Key（NeedCooperate--use-provided-key）"
    )
    .option("--amount <amount>", "DepositAmount", "10.0")
    .action(async (options) => {
      const example = new KMSFullFlowExample();

      // VerifyParameter
      if (options.useProvidedKey && !options.privateKey) {
        console.error("❌ Use--use-provided-key时MustProvide--private-keyParameter");
        process.exit(1);
      }

      try {
        const result = await example.runFullFlow(
          options.useProvidedKey,
          options.privateKey,
          options.amount
        );

        example.displaySummary(result);
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.error("❌ ExampleRunfailed:", error.message);
        process.exit(1);
      }
    });

  program.parse();
}

module.exports = { KMSFullFlowExample };
