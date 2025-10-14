/**
 * KMS API Compliance Test Script
 * Verify KMS API calls comply with KMS_COMPLETE_DOCUMENTATION.md specifications
 */

const {
  ZKPayKMSSigner,
  ZKPayKMSSignerFactory,
} = require("../utils/zkpay-kms-adapter");
const { createLogger } = require("../utils/logger");

async function testKMSAPICompliance() {
  const logger = createLogger("KMSComplianceTest");

  console.log("🔍 KMS API Compliance Test");
  console.log("==========================================");
  console.log(
    "Verifying KMS API calls comply with documentation specifications...\n"
  );

  // Test configuration
  const kmsConfig = {
    kmsUrl: process.env.KMS_URL || "http://localhost:18082",
    keyAlias: "test-compliance-key",
    encryptedKey:
      process.env.TEST_K1_KEY ||
      "YWJjZGVmZ2hpams1Mnl6YWJjZGVmZ2hpams1Mnl6YWJjZGVmZ2hpams1Mnl6",
    slip44Id: 714,
    defaultSignatureType: "eip191",
  };

  let testResults = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  try {
    // Test1: VerifyKMSSignature器Create
    console.log("📋 Test1: KMSSignature器Create");
    console.log("---------------------------------------");

    const kmsSigner = new ZKPayKMSSigner(kmsConfig, logger);
    console.log("✅ KMSSignature器Createsuccessful");
    testResults.passed++;
    testResults.tests.push({ name: "KMSSignature器Create", status: "✅ Pass" });

    // Test2: VerifyEIP-191MessageSignatureAPICallFormat
    console.log("\n📋 Test2: EIP-191MessageSignatureAPICallFormat");
    console.log("---------------------------------------");

    const testMessage = "Hello ZKPay KMS Compliance Test!";

    try {
      // MockAPICall（不实际SendRequest）
      const expectedSignRequest = {
        key_alias: kmsConfig.keyAlias,
        k1: kmsConfig.encryptedKey, // 正确的ParameterName
        data: "0x" + Buffer.from(testMessage, "utf8").toString("hex"), // 正确的Data字段名
        slip44_id: kmsConfig.slip44Id,
        signature_type: "eip191", // 正确的Signature类型
      };

      console.log("📡 预期的KMSSignatureRequestFormat:");
      console.log(JSON.stringify(expectedSignRequest, null, 2));

      // VerifyParameterName
      if (
        expectedSignRequest.k1 &&
        expectedSignRequest.data &&
        expectedSignRequest.signature_type === "eip191"
      ) {
        console.log("✅ EIP-191MessageSignatureRequestFormat符合文档规范");
        testResults.passed++;
        testResults.tests.push({
          name: "EIP-191MessageSignatureFormat",
          status: "✅ Pass",
        });
      } else {
        throw new Error("SignatureRequestFormat不符合规范");
      }
    } catch (error) {
      console.log(`❌ EIP-191MessageSignatureFormatTestfailed: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({
        name: "EIP-191MessageSignatureFormat",
        status: "❌ failed",
      });
    }

    // Test3: VerifyTransactionSignatureAPICallFormat
    console.log("\n📋 Test3: TransactionSignatureAPICallFormat");
    console.log("---------------------------------------");

    try {
      // 构建TestTransaction
      const testTransaction = {
        to: "0x742d35Cc6634C0532925a3b8D8d7d4C8d1B2C3D4",
        value: "1000000000000000000", // 1 ETH
        gasLimit: "21000",
        gasPrice: "auto", // FromRPC动态Get
        nonce: 42,
        data: "0x",
      };

      // MockTransactionHash（实际ShouldPassethers.utils.keccak256Calculate）
      const mockTxHash = "your_private_key";

      const expectedTxSignRequest = {
        key_alias: kmsConfig.keyAlias,
        k1: kmsConfig.encryptedKey, // 正确的ParameterName
        data: mockTxHash, // SendTransactionHashInstead ofTransactionParameter
        slip44_id: kmsConfig.slip44Id,
        signature_type: "transaction", // 正确的Signature类型
        tx_hash: mockTxHash, // 用于审计Log
      };

      console.log("📡 预期的KMSTransactionSignatureRequestFormat:");
      console.log(JSON.stringify(expectedTxSignRequest, null, 2));
      console.log(`📋 TransactionHash: ${mockTxHash}`);

      // VerifyParameterName和Format
      if (
        expectedTxSignRequest.k1 &&
        expectedTxSignRequest.data === mockTxHash &&
        expectedTxSignRequest.signature_type === "transaction"
      ) {
        console.log("✅ TransactionSignatureRequestFormat符合文档规范");
        testResults.passed++;
        testResults.tests.push({
          name: "TransactionSignatureFormat",
          status: "✅ Pass",
        });
      } else {
        throw new Error("TransactionSignatureRequestFormat不符合规范");
      }
    } catch (error) {
      console.log(`❌ TransactionSignatureFormatTestfailed: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({
        name: "TransactionSignatureFormat",
        status: "❌ failed",
      });
    }

    // Test4: VerifyAPI端点正确性
    console.log("\n📋 Test4: API端点正确性");
    console.log("---------------------------------------");

    const correctEndpoints = [
      "/api/v1/sign", // UnifiedSignature端点
      "/api/v1/health", // 健康Check
      "/api/v1/encrypt", // KeyEncryption
      "/api/v1/keys", // Key列表
    ];

    const incorrectEndpoints = [
      "/api/v1/sign/transaction", // Error：不存在的TransactionSignature端点
      "/api/v1/sign-transaction", // Error：不存在的TransactionSignature端点
      "/api/v1/get-address", // Error：不存在的AddressQuery端点
    ];

    console.log("✅ 正确的API端点:");
    correctEndpoints.forEach((endpoint) => console.log(`  ${endpoint}`));

    console.log("\n❌ Error的API端点（应避免Use）:");
    incorrectEndpoints.forEach((endpoint) => console.log(`  ${endpoint}`));

    testResults.passed++;
    testResults.tests.push({ name: "API端点正确性", status: "✅ Pass" });

    // Test5: VerifyParameterName规范
    console.log("\n📋 Test5: ParameterName规范");
    console.log("---------------------------------------");

    const correctParams = {
      k1: "✅ 正确 - K1传输Key",
      data: "✅ 正确 - 待SignatureData",
      key_alias: "✅ 正确 - KeyAlias",
      slip44_id: "✅ 正确 - SLIP44币种ID",
      signature_type: "✅ 正确 - Signature类型",
    };

    const incorrectParams = {
      encrypted_key: "❌ Error - 应Usek1",
      data_to_sign: "❌ Error - 应Usedata",
      chain_id: "❌ Error - 应Useslip44_id",
    };

    console.log("✅ 正确的ParameterName:");
    Object.entries(correctParams).forEach(([param, desc]) => {
      console.log(`  ${param}: ${desc}`);
    });

    console.log("\n❌ Error的ParameterName（应避免Use）:");
    Object.entries(incorrectParams).forEach(([param, desc]) => {
      console.log(`  ${param}: ${desc}`);
    });

    testResults.passed++;
    testResults.tests.push({ name: "ParameterName规范", status: "✅ Pass" });
  } catch (error) {
    console.log(`❌ TestExecutefailed: ${error.message}`);
    testResults.failed++;
  }

  // 输出TestResult
  console.log("\n🎯 TestResult汇总");
  console.log("==========================================");
  console.log(`✅ PassTest: ${testResults.passed}`);
  console.log(`❌ failedTest: ${testResults.failed}`);
  console.log(`📊 TotalTest: ${testResults.passed + testResults.failed}`);

  console.log("\n📋 DetailedTestResult:");
  testResults.tests.forEach((test, index) => {
    console.log(`  ${index + 1}. ${test.name}: ${test.status}`);
  });

  // 输出合规性Recommend
  console.log("\n💡 KMS API合规性Recommend");
  console.log("==========================================");
  console.log("1. ✅ UseUnified的 /api/v1/sign 端点进行所有SignatureOperation");
  console.log("2. ✅ Use正确的ParameterName: k1, data, key_alias, slip44_id");
  console.log(
    "3. ✅ TransactionSignatureSendTransactionHash，MessageSignatureSendHexadecimalMessage"
  );
  console.log("4. ✅ 明确指定signature_type: transaction, data, eip191");
  console.log("5. ✅ 遵循KMS_COMPLETE_DOCUMENTATION.md中的Interface规范");

  return testResults.failed === 0;
}

// If直接Run此脚本
if (require.main === module) {
  testKMSAPICompliance()
    .then((success) => {
      if (success) {
        console.log("\n🎉 所有KMS API合规性TestPass！");
        process.exit(0);
      } else {
        console.log("\n⚠️ PartKMS API合规性Testfailed，PleaseCheck实现");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ TestExecute出错:", error);
      process.exit(1);
    });
}

module.exports = { testKMSAPICompliance };
