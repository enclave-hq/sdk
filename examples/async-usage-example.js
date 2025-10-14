/**
 * ZKPay Client Asynchronous Method Usage Example
 * Demonstrates how to use await to call asynchronous methods
 */

async function useAsyncMethods(client) {
  try {
    // 1. Commitment asynchronous call
    console.log("🔗 Starting Commitment...");
    const commitmentResult = await client.executeCommitmentAsync(
      checkbookId,
      allocations
    );

    console.log("✅ Commitment completed:");
    console.log("   Hash:", commitmentResult.commitmentHash);
    console.log("   Status:", commitmentResult.status);

    // Optional: wait for final status
    if (commitmentResult.status !== "with_checkbook") {
      console.log("⏳ Waiting for final status...");
      const finalCommitment = await commitmentResult.waitUntilCompleted();
      console.log("   Final status:", finalCommitment.finalStatus);
    }

    // 2. Withdraw asynchronous call
    console.log("💸 Starting withdrawal...");
    const withdrawResult = await client.generateProofAsync(
      checkbookId,
      recipientInfo
    );

    console.log("✅ Proof generation completed:");
    console.log("   Check ID:", withdrawResult.checkId);
    console.log("   Status:", withdrawResult.status);

    // Wait for withdrawal completion
    console.log("⏳ Waiting for withdrawal completion...");
    const finalWithdraw = await withdrawResult.waitUntilCompleted();

    console.log("✅ Withdrawal completed:");
    console.log("   Final status:", finalWithdraw.finalStatus);
    console.log("   Transaction hash:", finalWithdraw.transactionHash);

    return {
      commitmentHash: commitmentResult.commitmentHash,
      transactionHash: finalWithdraw.transactionHash,
    };
  } catch (error) {
    console.error("❌ Asynchronous operation failed:", error.message);
    throw error;
  }
}

// Usage example
async function main() {
  const client = new ZKPayClient(config);
  await client.initialize();
  await client.login(privateKey);

  const result = await useAsyncMethods(client);
  console.log("🎉 All operations completed:", result);
}
