#!/usr/bin/env node

// Test KMS automatic key generation functionality
// Verify new generate-key API endpoint

const axios = require("axios");

async function testKMSGenerateKey() {
  console.log("🧪 Test KMS automatic key generation functionality");
  console.log("================================");

  const kmsBaseURL = process.env.KMS_BASE_URL || "http://localhost:18082";
  const keyAlias = `test_auto_${Date.now()}`;

  try {
    // 1. Test health check
    console.log("1️⃣ Checking KMS service status...");
    const healthResponse = await axios.get(`${kmsBaseURL}/api/v1/health`);
    console.log("✅ KMS service normal:", healthResponse.data);

    // 2. Test automatic key generation
    console.log("\n2️⃣ Testing automatic key generation...");
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
      console.log("✅ Key auto-generation successful:");
      console.log(`  🏷️  Key alias: ${keyAlias}`);
      console.log(
        `  📍 Generated address: ${generateResponse.data.public_address}`
      );
      console.log(`  🌐 SLIP44 ID: ${generateResponse.data.slip44_id}`);
      console.log(`  ⛓️  EVM链ID: ${generateResponse.data.evm_chain_id}`);
      console.log(
        `  🔐 EncryptionKey: ${generateResponse.data.encrypted_key.slice(0, 20)}...`
      );

      // 3. TestUseGenerate的Key进行Signature
      console.log("\n3️⃣ TestUseGenerate的KeySignature...");
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
        console.log("✅ SignatureTestsuccessful:");
        console.log(`  📝 Signature: ${signResponse.data.signature}`);
        console.log(`  📍 SignatureAddress: ${signResponse.data.address}`);
      } else {
        console.log("❌ SignatureTestfailed:", signResponse.data.error);
      }

      // 4. GetKey列表Verify
      console.log("\n4️⃣ VerifyKeyAlreadyStorage...");
      const keysResponse = await axios.get(`${kmsBaseURL}/api/v1/keys`);
      const foundKey = keysResponse.data.keys.find(
        (k) => k.key_alias === keyAlias
      );

      if (foundKey) {
        console.log("✅ KeyAlreadysuccessfulStorage在KMS中");
        console.log(
          `  📋 KeyInformation: ${JSON.stringify(foundKey, null, 2)}`
        );
      } else {
        console.log("❌ 在Key列表中未找ToGenerate的Key");
      }
    } else {
      console.log("❌ KeyGeneratefailed:", generateResponse.data.error);
    }

    console.log("\n🎉 KMSAutoGenerateKeyTestcompleted");
  } catch (error) {
    console.error("❌ Testfailed:", error.message);
    if (error.response) {
      console.error("ErrorDetails:", error.response.data);
    }
    process.exit(1);
  }
}

// RunTest
if (require.main === module) {
  testKMSGenerateKey();
}

module.exports = { testKMSGenerateKey };
