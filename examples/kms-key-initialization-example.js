#!/usr/bin/env node

// KMSKeyInitialize完整Example
// Demo如何From零Starting在KMS中Create和ManagementKey

const {
  ZKPayKMSSigner,
  ZKPayKMSSignerFactory,
} = require("../utils/zkpay-kms-adapter");
const { ZKPayClient } = require("../core/zkpay-client-library");
const { createLogger } = require("../logger");
const crypto = require("crypto");
const axios = require("axios");

/**
 * Example1: Generate新Private Key并在KMS中Initialize
 */
async function initializeNewKeyInKMS() {
  const logger = createLogger("KMSKeyInit");
  logger.info("🚀 Example1: Generate新Private Key并在KMS中Initialize");

  try {
    // 1. GenerateNewPrivate Key
    const privateKey = "0x" + crypto.randomBytes(32).toString("hex");
    logger.info(`🔑 Generate新Private Key: ${privateKey.slice(0, 10)}...`);

    // 2. ConfigurationKMSInitializeParameter
    const initConfig = {
      baseURL: "http://localhost:18082",
      privateKey: privateKey,
      keyAlias: `zksdk_${Date.now()}`, // UseTimestamp确保唯一性
      slip44Id: 714, // BSC网络
      timeout: 30000,
      // 可选的认证Configuration
      bearerToken: process.env.KMS_BEARER_TOKEN,
      serviceKey: process.env.KMS_SERVICE_KEY,
    };

    logger.info(`📝 KMSConfiguration:`, {
      keyAlias: initConfig.keyAlias,
      slip44Id: initConfig.slip44Id,
      baseURL: initConfig.baseURL,
    });

    // 3. CallKMSEncryptionInterfaceInitializeKey
    logger.info("🔐 正在向KMSSendEncryptionRequest...");

    const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(
      initConfig,
      logger
    );

    logger.info("✅ KeyAlreadysuccessful在KMS中Initialize");
    logger.info(`📍 Generate的Address: ${kmsSigner.getAddress()}`);
    logger.info(`🔗 链Information: ${JSON.stringify(kmsSigner.getChainInfo(714))}`);
    logger.info(`📋 Signature类型: ${kmsSigner.config.defaultSignatureType}`);

    return {
      signer: kmsSigner,
      keyAlias: initConfig.keyAlias,
      address: kmsSigner.getAddress(),
      encryptedKey: kmsSigner.config.encryptedKey,
    };
  } catch (error) {
    logger.error("❌ KMSKeyInitializefailed:", error.message);

    // ProvideDetailed的Error诊断
    if (error.response) {
      logger.error("🔍 KMSServiceResponse:", error.response.data);
      logger.error("📡 HTTPStatus码:", error.response.status);
    } else if (error.request) {
      logger.error(
        "🔍 网络连接failed，PleaseCheckKMSServiceWhetherRun在 http://localhost:18082"
      );
    }

    throw error;
  }
}

/**
 * Example2: 批量Initialize多链Key
 */
async function initializeMultiChainKeys() {
  const logger = createLogger("MultiChainInit");
  logger.info("🚀 Example2: 批量Initialize多链Key");

  const chains = [
    { name: "Ethereum", slip44Id: 60, signatureType: "eip191" },
    { name: "BSC", slip44Id: 714, signatureType: "eip191" },
    { name: "Tron", slip44Id: 195, signatureType: "tip191t" },
    { name: "Polygon", slip44Id: 966, signatureType: "eip191" },
  ];

  const results = [];

  for (const chain of chains) {
    try {
      logger.info(`\n🔗 Initialize ${chain.name} Key (SLIP44: ${chain.slip44Id})`);

      // 为每条链Generate独立的Private Key
      const privateKey = "0x" + crypto.randomBytes(32).toString("hex");
      const keyAlias = `${chain.name.toLowerCase()}_key_${Date.now()}`;

      const initConfig = {
        baseURL: "http://localhost:18082",
        privateKey: privateKey,
        keyAlias: keyAlias,
        slip44Id: chain.slip44Id,
        defaultSignatureType: chain.signatureType,
        timeout: 30000,
      };

      // CallKMSInitialize
      const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(
        initConfig,
        logger
      );

      logger.info(`  ✅ ${chain.name} KeyInitializesuccessful`);
      logger.info(`  📍 Address: ${kmsSigner.getAddress()}`);
      logger.info(`  🔐 KeyAlias: ${keyAlias}`);

      results.push({
        chain: chain.name,
        slip44Id: chain.slip44Id,
        keyAlias: keyAlias,
        address: kmsSigner.getAddress(),
        signatureType: chain.signatureType,
        status: "SUCCESS",
      });

      // 添加延迟避免KMSService过载
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error(`  ❌ ${chain.name} KeyInitializefailed: ${error.message}`);

      results.push({
        chain: chain.name,
        slip44Id: chain.slip44Id,
        status: "FAILED",
        error: error.message,
      });
    }
  }

  logger.info("\n📊 多链KeyInitializeResult:");
  console.table(results);

  return results;
}

/**
 * Example3: FromExistingPrivate Key在KMS中CreateKey
 */
async function initializeFromExistingPrivateKey() {
  const logger = createLogger("ExistingKeyInit");
  logger.info("🚀 Example3: FromExistingPrivate Key在KMS中CreateKey");

  try {
    // UseExisting的Private Key（实际应用中FromSecurityStorageGet）
    const existingPrivateKey =
      process.env.EXISTING_PRIVATE_KEY || "your_private_key";

    logger.info("🔑 UseExistingPrivate Key进行KMSInitialize");

    // 支持多种网络的Initialize
    const networkConfigs = [
      {
        name: "BSC主网",
        slip44Id: 714,
        keyAlias: "production_bsc_key",
      },
      {
        name: "Tron主网",
        slip44Id: 195,
        keyAlias: "production_tron_key",
      },
    ];

    const initializedKeys = [];

    for (const config of networkConfigs) {
      logger.info(`\n🔗 在 ${config.name} 上InitializeKey`);

      const initConfig = {
        baseURL: "http://localhost:18082",
        privateKey: existingPrivateKey,
        keyAlias: config.keyAlias,
        slip44Id: config.slip44Id,
        timeout: 30000,
      };

      try {
        const kmsSigner = await ZKPayKMSSignerFactory.createWithNewKey(
          initConfig,
          logger
        );

        logger.info(`  ✅ ${config.name} KeyInitializesuccessful`);
        logger.info(`  📍 Address: ${kmsSigner.getAddress()}`);
        logger.info(`  🔐 Alias: ${config.keyAlias}`);

        initializedKeys.push({
          network: config.name,
          signer: kmsSigner,
          keyAlias: config.keyAlias,
        });
      } catch (error) {
        logger.warn(`  ⚠️ ${config.name} Initializefailed: ${error.message}`);
      }
    }

    return initializedKeys;
  } catch (error) {
    logger.error("❌ FromExistingPrivate KeyInitializefailed:", error.message);
    throw error;
  }
}

/**
 * Example4: KMSKeyStatusCheck和Verify
 */
async function verifyKMSKeyStatus() {
  const logger = createLogger("KMSKeyVerify");
  logger.info("🚀 Example4: KMSKeyStatusCheck和Verify");

  try {
    // TestKeyConfiguration
    const testKeys = [
      {
        keyAlias: "test_bsc_key",
        encryptedKey: "mock_encrypted_key_bsc",
        slip44Id: 714,
        address: "0x1234567890123456789012345678901234567890",
      },
      {
        keyAlias: "test_tron_key",
        encryptedKey: "mock_encrypted_key_tron",
        slip44Id: 195,
        address: "TRON1234567890123456789012345678901234",
      },
    ];

    const verificationResults = [];

    for (const keyConfig of testKeys) {
      logger.info(`\n🔍 VerifyKey: ${keyConfig.keyAlias}`);

      try {
        // CreateSignature器实例
        const kmsSigner = new ZKPayKMSSigner(
          {
            baseURL: "http://localhost:18082",
            ...keyConfig,
          },
          logger
        );

        // CheckConfiguration
        const chainInfo = kmsSigner.getChainInfo(keyConfig.slip44Id);
        const signatureType = kmsSigner.config.defaultSignatureType;

        logger.info(`  ✅ Configuration有效`);
        logger.info(`  🔗 链: ${chainInfo.name} (${chainInfo.nativeCoin})`);
        logger.info(`  📋 Signature类型: ${signatureType}`);
        logger.info(`  📍 Address: ${keyConfig.address}`);

        // 尝试TestSignature（Mock）
        logger.info(`  🧪 Signature能力Test: Prepare就绪`);

        verificationResults.push({
          keyAlias: keyConfig.keyAlias,
          chain: chainInfo.name,
          slip44Id: keyConfig.slip44Id,
          signatureType: signatureType,
          status: "VERIFIED",
        });
      } catch (error) {
        logger.error(`  ❌ Verifyfailed: ${error.message}`);

        verificationResults.push({
          keyAlias: keyConfig.keyAlias,
          slip44Id: keyConfig.slip44Id,
          status: "FAILED",
          error: error.message,
        });
      }
    }

    logger.info("\n📊 KeyVerifyResult:");
    console.table(verificationResults);

    return verificationResults;
  } catch (error) {
    logger.error("❌ KMSKeyVerifyfailed:", error.message);
    throw error;
  }
}

/**
 * Example5: KMSService连接Test
 */
async function testKMSServiceConnection() {
  const logger = createLogger("KMSConnection");
  logger.info("🚀 Example5: KMSService连接Test");

  const kmsBaseURL = "http://localhost:18082";

  try {
    // 1. TestKMSServiceWhetherRun
    logger.info("🔍 CheckKMSService连接...");

    const client = axios.create({
      baseURL: kmsBaseURL,
      timeout: 5000,
    });

    // Test健康Check端点
    try {
      const healthResponse = await client.get("/health");
      logger.info("✅ KMSService健康CheckPass:", healthResponse.data);
    } catch (error) {
      logger.warn("⚠️ 健康Check端点不可用，尝试其他端点...");
    }

    // 2. TestAPI端点可用性
    const endpoints = [
      { path: "/api/v1/encrypt", method: "POST", name: "KeyEncryption" },
      { path: "/api/v1/sign", method: "POST", name: "MessageSignature" },
      { path: "/api/v1/sign-transaction", method: "POST", name: "TransactionSignature" },
    ];

    const endpointResults = [];

    for (const endpoint of endpoints) {
      try {
        // SendTestRequest（预期会因ParameterInsufficient而failed，但Proof端点存在）
        await client[endpoint.method.toLowerCase()](endpoint.path, {});

        endpointResults.push({
          endpoint: endpoint.path,
          name: endpoint.name,
          status: "AVAILABLE",
        });
      } catch (error) {
        if (error.response && error.response.status !== 404) {
          // 非404Error说明端点存在但Parameter有Issue，这是预期的
          endpointResults.push({
            endpoint: endpoint.path,
            name: endpoint.name,
            status: "AVAILABLE",
            note: "端点可用（ParameterVerifyfailed为Normal现象）",
          });
        } else {
          endpointResults.push({
            endpoint: endpoint.path,
            name: endpoint.name,
            status: "NOT_FOUND",
          });
        }
      }
    }

    logger.info("\n📊 KMS API端点CheckResult:");
    console.table(endpointResults);

    // 3. 连接Summary
    const availableEndpoints = endpointResults.filter(
      (r) => r.status === "AVAILABLE"
    ).length;
    const totalEndpoints = endpointResults.length;

    logger.info(`\n📈 连接Summary:`);
    logger.info(`  KMSServiceAddress: ${kmsBaseURL}`);
    logger.info(`  可用端点: ${availableEndpoints}/${totalEndpoints}`);

    if (availableEndpoints === totalEndpoints) {
      logger.info(`  ✅ KMSService完全可用，Can进行KeyInitialize`);
    } else {
      logger.warn(`  ⚠️ Part端点不可用，PleaseCheckKMSServiceVersion`);
    }

    return {
      serviceAvailable: availableEndpoints > 0,
      endpointResults: endpointResults,
      baseURL: kmsBaseURL,
    };
  } catch (error) {
    logger.error("❌ KMSService连接failed:", error.message);
    logger.error("🔧 Please确保KMSService正在Run在:", kmsBaseURL);

    return {
      serviceAvailable: false,
      error: error.message,
      baseURL: kmsBaseURL,
    };
  }
}

/**
 * 主函数：Run所有KMSKeyInitializeExample
 */
async function runAllKMSInitializationExamples() {
  console.log("🌟 KMSKeyInitialize完整Example");
  console.log("=====================================");

  try {
    // 1. 首先TestKMSService连接
    const connectionTest = await testKMSServiceConnection();

    if (!connectionTest.serviceAvailable) {
      console.log("❌ KMSService不可用，跳过KeyInitializeExample");
      console.log("💡 Please先启动KMSService，然后重新Run此Example");
      return;
    }

    // 2. VerifyExistingKeyStatus
    await verifyKMSKeyStatus();

    // 3. Generate新Key并Initialize（IfKMSService可用）
    if (process.env.ENABLE_REAL_KMS_INIT === "true") {
      await initializeNewKeyInKMS();
      await initializeMultiChainKeys();
      await initializeFromExistingPrivateKey();
    } else {
      console.log("\n💡 To启用真实的KMSInitialize，PleaseSetEnvironment变量:");
      console.log("   export ENABLE_REAL_KMS_INIT=true");
    }

    console.log("\n✅ 所有KMSKeyInitializeExampleDemocompleted！");
  } catch (error) {
    console.error("❌ KMSInitializeExampleRunfailed:", error.message);
    throw error;
  }
}

// 导出所有Example函数
module.exports = {
  initializeNewKeyInKMS,
  initializeMultiChainKeys,
  initializeFromExistingPrivateKey,
  verifyKMSKeyStatus,
  testKMSServiceConnection,
  runAllKMSInitializationExamples,
};

// If直接Run此File
if (require.main === module) {
  runAllKMSInitializationExamples()
    .then(() => {
      console.log("\n🎉 ExampleRuncompleted");
    })
    .catch((error) => {
      console.error("💥 ExampleRun异常:", error);
      process.exit(1);
    });
}
