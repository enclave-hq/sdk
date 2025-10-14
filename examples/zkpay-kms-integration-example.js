// ZKPay KMS Service Integration Example
// Demonstrates how to integrate your existing KMS service with zksdk

const { ZKPayClient } = require("../core/zkpay-client-library");
const {
  ZKPayKMSSigner,
  ZKPayKMSSignerFactory,
} = require("../utils/zkpay-kms-adapter");
const { createLogger } = require("../utils/logger");

/**
 * Example 1: Create signer using existing KMS key
 */
async function useExistingKMSKey() {
  const logger = createLogger("KMSIntegration");
  logger.info("🚀 Example 1: Using existing KMS key");

  try {
    // 1. KMS configuration (using key already stored in your KMS)
    const kmsConfig = {
      baseURL: "http://localhost:18082",
      keyAlias: "bsc_relayer", // Your key alias in KMS
      encryptedKey:
        "YWRzZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGY=", // Encrypted key obtained from KMS
      slip44Id: 714, // BSCUseSLIP44 ID 714
      address: "0x4Da7cf999162ecb79749D0186E5759c7a6BD4477", // 对应的Address
      // 可选的SignatureConfiguration
      defaultSignatureType: "eip191", // BSCUseEIP-191Signature
      // 可选的认证Configuration
      // bearerToken: 'your-bearer-token',
      // serviceKey: 'zkpay-service-key-your-service',
      // serviceName: 'zksdk'
    };

    // 2. CreateKMSSignature器
    const kmsSigner = ZKPayKMSSignerFactory.createFromExistingKey(
      kmsConfig,
      logger
    );

    // 3. VerifyKMSConfiguration
    const isValid = await kmsSigner.validateConfig();
    if (!isValid) {
      throw new Error("KMSConfigurationVerifyfailed");
    }

    // 4. CreateZKPayClient并UseKMSSignature器Login
    const client = new ZKPayClient(logger);
    await client.initialize();

    const loginResult = await client.loginWithSigner(
      kmsSigner,
      kmsConfig.address,
      "kms-user"
    );

    logger.info("✅ KMSLoginsuccessful:", loginResult);

    // 5. 现在所有Operation都会UseKMSSignature
    return { client, kmsSigner };
  } catch (error) {
    logger.error("❌ Example1failed:", error.message);
    throw error;
  }
}

/**
 * Example2: CreateNewKMSKey并Use
 */
async function createNewKMSKey() {
  const logger = createLogger("KMSNewKey");
  logger.info("🚀 Example2: CreateNewKMSKey");

  try {
    // 1. 新KeyConfiguration
    const newKeyConfig = {
      baseURL: "http://localhost:18082",
      privateKey: "your_private_key", // ToEncryptionStorage的Private Key
      keyAlias: "zksdk_user_001", // NewKeyAlias
      slip44Id: 714, // BSCUseSLIP44 ID 714
      defaultSignatureType: "eip191", // BSCUseEIP-191Signature
      timeout: 30000,
    };

    // 2. CreateKMSSignature器（会AutoEncryption并StoragePrivate Key）
    const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(
      newKeyConfig,
      logger
    );

    // 3. Use新Create的Signature器
    const client = new ZKPayClient(logger);
    await client.initialize();

    const loginResult = await client.loginWithSigner(
      kmsSigner,
      kmsSigner.getAddress(),
      "new-kms-user"
    );

    logger.info("✅ 新KMSKeyCreate并Loginsuccessful:", loginResult);

    return { client, kmsSigner };
  } catch (error) {
    logger.error("❌ Example2failed:", error.message);
    throw error;
  }
}

/**
 * Example3: 完整的Deposit和WithdrawFlow（UseKMSSignature）
 */
async function fullKMSWorkflow() {
  const logger = createLogger("KMSWorkflow");
  logger.info("🚀 Example3: 完整的KMS工作Flow");

  try {
    // 1. UseExistingKMSKey
    const { client } = await useExistingKMSKey();

    // 2. ExecuteDeposit（ERC20Transaction会UseKMS的signTransaction）
    logger.info("📋 Step1: ExecuteDeposit...");
    const depositResult = await client.deposit(
      714, // BSC链ID (SLIP44)
      "USDT", // TokenSymbol
      "100.50", // Amount
      "0x1234567890123456789012345678901234567890" // TreasuryAddress
    );

    logger.info("✅ DepositTransactionAlreadySend:", depositResult.txHash);

    // 3. WaitDepositDetection
    logger.info("📋 Step2: WaitDepositDetection...");
    const depositRecord = await client.waitForDepositDetection(
      depositResult.txHash,
      714,
      60 // Timeout时间（秒）
    );

    logger.info("✅ DepositAlreadyDetectionTo:", depositRecord.checkbookId);

    // 4. CreateAllocationPlan并提交Commitment（MessageSignature会UseKMS的signMessage）
    logger.info("📋 Step3: 提交Commitment...");
    const allocations = [
      {
        recipient_address: "0x9876543210987654321098765432109876543210",
        recipient_chain_id: 714,
        amount: "100.50",
      },
    ];

    const commitmentResult = await client.submitCommitment(
      depositRecord.checkbookId,
      allocations,
      true // Auto提交
    );

    logger.info(
      "✅ CommitmentAlready提交:",
      commitmentResult.signature.slice(0, 20) + "..."
    );

    // 5. ExecuteWithdraw
    logger.info("📋 Step4: ExecuteWithdraw...");
    const withdrawResult = await client.performWithdraw(
      depositRecord.checkbookId,
      {
        recipient_address: "0x9876543210987654321098765432109876543210",
        recipient_chain_id: 714,
        amount: "100.50",
      },
      true // Auto提交
    );

    logger.info("✅ Withdrawcompleted:", withdrawResult);

    return {
      deposit: depositResult,
      commitment: commitmentResult,
      withdraw: withdrawResult,
    };
  } catch (error) {
    logger.error("❌ 完整KMS工作Flowfailed:", error.message);
    throw error;
  }
}

/**
 * Example4: KMS健康Check和KeyManagement
 */
async function kmsManagementExample() {
  const logger = createLogger("KMSManagement");
  logger.info("🚀 Example4: KMSManagementFunction");

  try {
    // 1. CreateKMSSignature器
    const kmsConfig = {
      baseURL: "http://localhost:18082",
      keyAlias: "management_test",
      encryptedKey: "sample_encrypted_key",
      chainId: 56,
      address: "0x1234567890123456789012345678901234567890",
    };

    const kmsSigner = new ZKPayKMSSigner(kmsConfig, logger);

    // 2. 健康Check
    const isHealthy = await kmsSigner.isAvailable();
    logger.info(
      `🔍 KMSService健康Status: ${isHealthy ? "✅ 健康" : "❌ 不健康"}`
    );

    // 3. GetKey列表
    const keysList = await kmsSigner.getKeysList();
    logger.info("📋 KMS中的Key列表:");
    keysList.forEach((key, index) => {
      logger.info(
        `  ${index + 1}. ${key.key_alias} (Chain ${key.chain_id}) - ${
          key.public_address
        }`
      );
    });

    // 4. ConfigurationVerify
    const isValidConfig = await kmsSigner.validateConfig();
    logger.info(
      `🔍 KMSConfigurationVerify: ${isValidConfig ? "✅ 有效" : "❌ 无效"}`
    );

    return {
      isHealthy,
      keysList,
      isValidConfig,
    };
  } catch (error) {
    logger.error("❌ KMSManagementExamplefailed:", error.message);
    throw error;
  }
}

/**
 * Example5: ErrorProcess和重试机制
 */
async function errorHandlingExample() {
  const logger = createLogger("KMSErrorHandling");
  logger.info("🚀 Example5: KMSErrorProcess");

  try {
    // 1. Use无效ConfigurationTestErrorProcess
    const invalidConfig = {
      baseURL: "http://localhost:18082",
      keyAlias: "non_existent_key",
      encryptedKey: "invalid_encrypted_key",
      chainId: 56,
      address: "0x0000000000000000000000000000000000000000",
    };

    const kmsSigner = new ZKPayKMSSigner(invalidConfig, logger);

    // 2. Test健康Check
    try {
      const isHealthy = await kmsSigner.isAvailable();
      logger.info(`健康CheckResult: ${isHealthy}`);
    } catch (error) {
      logger.warn("健康Check异常:", error.message);
    }

    // 3. Test无效Signature
    try {
      await kmsSigner.signMessage("test message", invalidConfig.address);
    } catch (error) {
      logger.info("✅ 正确捕获SignatureError:", error.message);
    }

    // 4. TestConfigurationVerify
    try {
      const isValid = await kmsSigner.validateConfig();
      logger.info(`ConfigurationVerifyResult: ${isValid}`);
    } catch (error) {
      logger.info("✅ 正确捕获ConfigurationError:", error.message);
    }

    return true;
  } catch (error) {
    logger.error("❌ ErrorProcessExamplefailed:", error.message);
    throw error;
  }
}

// 导出所有Example函数
module.exports = {
  useExistingKMSKey,
  createNewKMSKey,
  fullKMSWorkflow,
  kmsManagementExample,
  errorHandlingExample,
};

// If直接Run此File，ExecuteExample
if (require.main === module) {
  (async () => {
    try {
      console.log("🔐 ZKPay KMS集成Example");
      console.log("=====================================");

      // SelectToRun的Example
      const examples = [
        { name: "UseExistingKMSKey", fn: useExistingKMSKey },
        { name: "Create新KMSKey", fn: createNewKMSKey },
        { name: "完整KMS工作Flow", fn: fullKMSWorkflow },
        { name: "KMSManagementFunction", fn: kmsManagementExample },
        { name: "ErrorProcess", fn: errorHandlingExample },
      ];

      // 取消注释ToRun的Example
      // await examples[0].fn(); // Example1
      // await examples[1].fn(); // Example2
      // await examples[2].fn(); // Example3
      // await examples[3].fn(); // Example4
      // await examples[4].fn(); // Example5

      console.log("✅ 所有ExampleAlreadyPrepare就绪，Please根据Need取消注释相应的Example");
    } catch (error) {
      console.error("❌ ExampleRunfailed:", error.message);
    }
  })();
}
