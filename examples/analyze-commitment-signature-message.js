/**
 * Analyze commitment data signature message generated in zkpay-client-library.js
 */

const {
  ZKPayCommitmentManager,
} = require("../managers/zkpay-commitment-manager");
const { createLogger } = require("../utils/logger");
const AddressFormatter = require("../utils/address-formatter");

async function analyzeCommitmentSignatureMessage() {
  const logger = createLogger("AnalyzeCommitmentSignature");

  // Commitment data you provided
  const commitmentData = {
    allocations: [
      {
        recipient_chain_id: 714,
        recipient_address:
          "0x0000000000000000000000000848d929b9d35bfb7aa50641d392a4ad83e145ce",
        amount: "15000000000000000000",
        token_id: 65535,
      },
    ],
    deposit_id:
      "000000000000000000000000000000000000000000000000000000000117987c",
    signature: {
      chain_id: 714,
      signature_data:
        "65e0bef7ef3dc20746690d2e50050c345d6e1ee411ca535d187abf4de1bebda05d657065232de9b7e1d76f02c40cd0cd54bbd9ce0162cc1089b756dadb443ee31c",
    },
    owner_address: {
      chain_id: 714,
      address:
        "0x000000000000000000000000aaf9cb43102654126aeff96a4ad25f23e7c969a2",
    },
  };

  console.log("🔍 Analyzing Commitment data signature message generation");
  console.log("==========================================\n");

  console.log("📋 Input data:");
  console.log(JSON.stringify(commitmentData, null, 2));
  console.log("");

  // Create mock CommitmentManager
  const mockWalletManager = {
    getUserAddress: () => "0xaAf9CB43102654126aEff96a4AD25F23E7C969A2",
  };

  const commitmentManager = new ZKPayCommitmentManager(
    mockWalletManager,
    logger
  );

  // Mock deposit record (constructed from commitment data)
  const mockDepositRecord = {
    local_deposit_id: parseInt(commitmentData.deposit_id, 16), // Convert hex to number
    token_id: commitmentData.allocations[0].token_id,
    owner: {
      data: commitmentData.owner_address.address,
    },
  };

  console.log("🔍 Mock Deposit Record:");
  console.log(JSON.stringify(mockDepositRecord, null, 2));
  console.log("");

  // GenerateSignatureMessage
  try {
    const signatureMessage =
      commitmentManager.generateCommitmentSignatureMessage(
        mockDepositRecord,
        commitmentData.allocations[0].recipient_address,
        commitmentData.allocations[0].amount,
        commitmentData.allocations[0].recipient_chain_id
      );

    console.log("📝 Generated Signature Message:");
    console.log("=====================================");
    console.log(signatureMessage);
    console.log("=====================================");
    console.log(`Message Length: ${signatureMessage.length} Characters`);
    console.log("");

    // Analysis Message Composition Part
    console.log("🔍 Message Composition Analysis:");
    console.log("---------------------------------------");

    // 1. Analysis Deposit ID
    const depositIdBigInt = BigInt("0x" + commitmentData.deposit_id);
    console.log(`📋 Deposit ID (hex): ${commitmentData.deposit_id}`);
    console.log(`📋 Deposit ID (decimal): ${depositIdBigInt.toString()}`);

    // 2. Analysis Amount
    const amountBigInt = BigInt(commitmentData.allocations[0].amount);
    const amountFormatted =
      (amountBigInt / BigInt(10 ** 18)).toString() + ".00";
    console.log(`💰 Amount (wei): ${commitmentData.allocations[0].amount}`);
    console.log(`💰 Amount (formatted): ${amountFormatted} TUSDT`);

    // 3. Analysis Receive Address
    const recipientAddress = commitmentData.allocations[0].recipient_address;
    console.log(`📍 Receive Address (Original): ${recipientAddress}`);

    // Check if it's Universal Address Format
    const cleanAddress = recipientAddress.replace(/^0x/, "");
    if (
      cleanAddress.length === 64 &&
      cleanAddress.startsWith("000000000000000000000000")
    ) {
      const chainSpecificAddress =
        AddressFormatter.fromUniversalAddress(recipientAddress);
      console.log(
        `📍 Receive Address (Chain-specific): ${chainSpecificAddress}`
      );
      console.log(
        `📍 Address Formatted: Binance Smart Chain On-chain ${chainSpecificAddress} Address`
      );
    } else {
      console.log(
        `📍 Address Formatted: Binance Smart Chain On-chain ${recipientAddress} Address`
      );
    }

    // 4. Analysis Owner Address
    const ownerAddress = commitmentData.owner_address.address;
    console.log(`🔒 Owner Address (Original): ${ownerAddress}`);

    const cleanOwnerAddress = ownerAddress.replace(/^0x/, "");
    if (
      cleanOwnerAddress.length === 64 &&
      cleanOwnerAddress.startsWith("000000000000000000000000")
    ) {
      const ownerChainSpecificAddress =
        AddressFormatter.fromUniversalAddress(ownerAddress);
      console.log(
        `🔒 Owner Address (Chain-specific): ${ownerChainSpecificAddress}`
      );
      console.log(
        `🔒 Owner Formatted: Binance Smart Chain On-chain ${ownerChainSpecificAddress} Address`
      );
    } else {
      console.log(
        `🔒 Owner Formatted: Binance Smart Chain On-chain ${ownerAddress} Address`
      );
    }

    console.log("");

    // Calculate Message Hash for Compare
    const crypto = require("crypto");
    const messageBuffer = Buffer.from(signatureMessage, "utf8");
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest("hex");
    console.log(`📋 Message SHA256 Hash: ${messageHash}`);

    // Display Provided Signature
    console.log(
      `🔐 Provided Signature: ${commitmentData.signature.signature_data}`
    );

    console.log("");
    console.log("✅ Signature Message Analysis completed");

    return {
      signatureMessage,
      messageHash,
      providedSignature: commitmentData.signature.signature_data,
      messageLength: signatureMessage.length,
    };
  } catch (error) {
    console.error("❌ Generate Signature Message failed:", error.message);
    console.error("Stack trace:", error.stack);
    throw error;
  }
}

// Run Analysis
if (require.main === module) {
  analyzeCommitmentSignatureMessage()
    .then((result) => {
      console.log("\n📊 Analysis Result Summary:");
      console.log(`  Message Length: ${result.messageLength} Characters`);
      console.log(`  Message Hash: ${result.messageHash}`);
      console.log(`  Provided Signature: ${result.providedSignature}`);
    })
    .catch((error) => {
      console.error("❌ Analysis failed:", error);
      process.exit(1);
    });
}

module.exports = { analyzeCommitmentSignatureMessage };
