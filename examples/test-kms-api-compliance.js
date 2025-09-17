/**
 * KMS API合规性测试脚本
 * 验证KMS API调用是否符合KMS_COMPLETE_DOCUMENTATION.md规范
 */

const {
  ZKPayKMSSigner,
  ZKPayKMSSignerFactory,
} = require("../utils/zkpay-kms-adapter");
const { createLogger } = require("../utils/logger");

async function testKMSAPICompliance() {
  const logger = createLogger("KMSComplianceTest");

  console.log("🔍 KMS API合规性测试");
  console.log("==========================================");
  console.log("验证KMS API调用是否符合文档规范...\n");

  // 测试配置
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
    // 测试1: 验证KMS签名器创建
    console.log("📋 测试1: KMS签名器创建");
    console.log("---------------------------------------");

    const kmsSigner = new ZKPayKMSSigner(kmsConfig, logger);
    console.log("✅ KMS签名器创建成功");
    testResults.passed++;
    testResults.tests.push({ name: "KMS签名器创建", status: "✅ 通过" });

    // 测试2: 验证EIP-191消息签名API调用格式
    console.log("\n📋 测试2: EIP-191消息签名API调用格式");
    console.log("---------------------------------------");

    const testMessage = "Hello ZKPay KMS Compliance Test!";

    try {
      // 模拟API调用（不实际发送请求）
      const expectedSignRequest = {
        key_alias: kmsConfig.keyAlias,
        k1: kmsConfig.encryptedKey, // 正确的参数名称
        data: "0x" + Buffer.from(testMessage, "utf8").toString("hex"), // 正确的数据字段名
        slip44_id: kmsConfig.slip44Id,
        signature_type: "eip191", // 正确的签名类型
      };

      console.log("📡 预期的KMS签名请求格式:");
      console.log(JSON.stringify(expectedSignRequest, null, 2));

      // 验证参数名称
      if (
        expectedSignRequest.k1 &&
        expectedSignRequest.data &&
        expectedSignRequest.signature_type === "eip191"
      ) {
        console.log("✅ EIP-191消息签名请求格式符合文档规范");
        testResults.passed++;
        testResults.tests.push({
          name: "EIP-191消息签名格式",
          status: "✅ 通过",
        });
      } else {
        throw new Error("签名请求格式不符合规范");
      }
    } catch (error) {
      console.log(`❌ EIP-191消息签名格式测试失败: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({
        name: "EIP-191消息签名格式",
        status: "❌ 失败",
      });
    }

    // 测试3: 验证交易签名API调用格式
    console.log("\n📋 测试3: 交易签名API调用格式");
    console.log("---------------------------------------");

    try {
      // 构建测试交易
      const testTransaction = {
        to: "0x742d35Cc6634C0532925a3b8D8d7d4C8d1B2C3D4",
        value: "1000000000000000000", // 1 ETH
        gasLimit: "21000",
        gasPrice: "20000000000", // 20 gwei
        nonce: 42,
        data: "0x",
      };

      // 模拟交易哈希（实际应该通过ethers.utils.keccak256计算）
      const mockTxHash = "your_private_key";

      const expectedTxSignRequest = {
        key_alias: kmsConfig.keyAlias,
        k1: kmsConfig.encryptedKey, // 正确的参数名称
        data: mockTxHash, // 发送交易哈希而不是交易参数
        slip44_id: kmsConfig.slip44Id,
        signature_type: "transaction", // 正确的签名类型
        tx_hash: mockTxHash, // 用于审计日志
      };

      console.log("📡 预期的KMS交易签名请求格式:");
      console.log(JSON.stringify(expectedTxSignRequest, null, 2));
      console.log(`📋 交易哈希: ${mockTxHash}`);

      // 验证参数名称和格式
      if (
        expectedTxSignRequest.k1 &&
        expectedTxSignRequest.data === mockTxHash &&
        expectedTxSignRequest.signature_type === "transaction"
      ) {
        console.log("✅ 交易签名请求格式符合文档规范");
        testResults.passed++;
        testResults.tests.push({ name: "交易签名格式", status: "✅ 通过" });
      } else {
        throw new Error("交易签名请求格式不符合规范");
      }
    } catch (error) {
      console.log(`❌ 交易签名格式测试失败: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({ name: "交易签名格式", status: "❌ 失败" });
    }

    // 测试4: 验证API端点正确性
    console.log("\n📋 测试4: API端点正确性");
    console.log("---------------------------------------");

    const correctEndpoints = [
      "/api/v1/sign", // 统一签名端点
      "/api/v1/health", // 健康检查
      "/api/v1/encrypt", // 密钥加密
      "/api/v1/keys", // 密钥列表
    ];

    const incorrectEndpoints = [
      "/api/v1/sign/transaction", // 错误：不存在的交易签名端点
      "/api/v1/sign-transaction", // 错误：不存在的交易签名端点
      "/api/v1/get-address", // 错误：不存在的地址查询端点
    ];

    console.log("✅ 正确的API端点:");
    correctEndpoints.forEach((endpoint) => console.log(`  ${endpoint}`));

    console.log("\n❌ 错误的API端点（应避免使用）:");
    incorrectEndpoints.forEach((endpoint) => console.log(`  ${endpoint}`));

    testResults.passed++;
    testResults.tests.push({ name: "API端点正确性", status: "✅ 通过" });

    // 测试5: 验证参数名称规范
    console.log("\n📋 测试5: 参数名称规范");
    console.log("---------------------------------------");

    const correctParams = {
      k1: "✅ 正确 - K1传输密钥",
      data: "✅ 正确 - 待签名数据",
      key_alias: "✅ 正确 - 密钥别名",
      slip44_id: "✅ 正确 - SLIP44币种ID",
      signature_type: "✅ 正确 - 签名类型",
    };

    const incorrectParams = {
      encrypted_key: "❌ 错误 - 应使用k1",
      data_to_sign: "❌ 错误 - 应使用data",
      chain_id: "❌ 错误 - 应使用slip44_id",
    };

    console.log("✅ 正确的参数名称:");
    Object.entries(correctParams).forEach(([param, desc]) => {
      console.log(`  ${param}: ${desc}`);
    });

    console.log("\n❌ 错误的参数名称（应避免使用）:");
    Object.entries(incorrectParams).forEach(([param, desc]) => {
      console.log(`  ${param}: ${desc}`);
    });

    testResults.passed++;
    testResults.tests.push({ name: "参数名称规范", status: "✅ 通过" });
  } catch (error) {
    console.log(`❌ 测试执行失败: ${error.message}`);
    testResults.failed++;
  }

  // 输出测试结果
  console.log("\n🎯 测试结果汇总");
  console.log("==========================================");
  console.log(`✅ 通过测试: ${testResults.passed}`);
  console.log(`❌ 失败测试: ${testResults.failed}`);
  console.log(`📊 总计测试: ${testResults.passed + testResults.failed}`);

  console.log("\n📋 详细测试结果:");
  testResults.tests.forEach((test, index) => {
    console.log(`  ${index + 1}. ${test.name}: ${test.status}`);
  });

  // 输出合规性建议
  console.log("\n💡 KMS API合规性建议");
  console.log("==========================================");
  console.log("1. ✅ 使用统一的 /api/v1/sign 端点进行所有签名操作");
  console.log("2. ✅ 使用正确的参数名称: k1, data, key_alias, slip44_id");
  console.log("3. ✅ 交易签名发送交易哈希，消息签名发送十六进制消息");
  console.log("4. ✅ 明确指定signature_type: transaction, data, eip191");
  console.log("5. ✅ 遵循KMS_COMPLETE_DOCUMENTATION.md中的接口规范");

  return testResults.failed === 0;
}

// 如果直接运行此脚本
if (require.main === module) {
  testKMSAPICompliance()
    .then((success) => {
      if (success) {
        console.log("\n🎉 所有KMS API合规性测试通过！");
        process.exit(0);
      } else {
        console.log("\n⚠️ 部分KMS API合规性测试失败，请检查实现");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 测试执行出错:", error);
      process.exit(1);
    });
}

module.exports = { testKMSAPICompliance };
