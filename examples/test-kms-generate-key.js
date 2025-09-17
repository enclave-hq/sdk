#!/usr/bin/env node

// 测试KMS自动生成密钥功能
// 验证新的generate-key API端点

const axios = require("axios");

async function testKMSGenerateKey() {
  console.log("🧪 测试KMS自动生成密钥功能");
  console.log("================================");

  const kmsBaseURL = process.env.KMS_BASE_URL || "http://localhost:18082";
  const keyAlias = `test_auto_${Date.now()}`;

  try {
    // 1. 测试健康检查
    console.log("1️⃣ 检查KMS服务状态...");
    const healthResponse = await axios.get(`${kmsBaseURL}/api/v1/health`);
    console.log("✅ KMS服务正常:", healthResponse.data);

    // 2. 测试自动生成密钥
    console.log("\n2️⃣ 测试自动生成密钥...");
    const generateRequest = {
      key_alias: keyAlias,
      slip44_id: 714, // BSC
    };

    const generateResponse = await axios.post(
      `${kmsBaseURL}/api/v1/generate-key`,
      generateRequest,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": "zkpay-service-key-zksdk",
          "X-Service-Name": "zksdk",
        },
      }
    );

    if (generateResponse.data.success) {
      console.log("✅ 密钥自动生成成功:");
      console.log(`  🏷️  密钥别名: ${keyAlias}`);
      console.log(`  📍 生成地址: ${generateResponse.data.public_address}`);
      console.log(`  🌐 SLIP44 ID: ${generateResponse.data.slip44_id}`);
      console.log(`  ⛓️  EVM链ID: ${generateResponse.data.evm_chain_id}`);
      console.log(
        `  🔐 加密密钥: ${generateResponse.data.encrypted_key.slice(0, 20)}...`
      );

      // 3. 测试使用生成的密钥进行签名
      console.log("\n3️⃣ 测试使用生成的密钥签名...");
      const signRequest = {
        key_alias: keyAlias,
        encrypted_key: generateResponse.data.encrypted_key,
        data_to_sign: "your_private_key",
        chain_id: 56,
        tx_hash:
          "0xabcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef",
      };

      const signResponse = await axios.post(
        `${kmsBaseURL}/api/v1/sign`,
        signRequest,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Service-Key": "zkpay-service-key-zksdk",
            "X-Service-Name": "zksdk",
          },
        }
      );

      if (signResponse.data.success) {
        console.log("✅ 签名测试成功:");
        console.log(`  📝 签名: ${signResponse.data.signature}`);
        console.log(`  📍 签名地址: ${signResponse.data.address}`);
      } else {
        console.log("❌ 签名测试失败:", signResponse.data.error);
      }

      // 4. 获取密钥列表验证
      console.log("\n4️⃣ 验证密钥已存储...");
      const keysResponse = await axios.get(`${kmsBaseURL}/api/v1/keys`);
      const foundKey = keysResponse.data.keys.find(
        (k) => k.key_alias === keyAlias
      );

      if (foundKey) {
        console.log("✅ 密钥已成功存储在KMS中");
        console.log(`  📋 密钥信息: ${JSON.stringify(foundKey, null, 2)}`);
      } else {
        console.log("❌ 在密钥列表中未找到生成的密钥");
      }
    } else {
      console.log("❌ 密钥生成失败:", generateResponse.data.error);
    }

    console.log("\n🎉 KMS自动生成密钥测试完成");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    if (error.response) {
      console.error("错误详情:", error.response.data);
    }
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testKMSGenerateKey();
}

module.exports = { testKMSGenerateKey };
