/**
 * SDK Signature Data Test Script
 * 
 * Test Content:
 * 1. Create mock Deposit, Checkbook, then generate commitment, view:
 *    - SDK generated commitment signature message
 *    - SDK generated commitment/submit data submitted to backend
 * 
 * 2. Create Withdraw request combining multiple Checkbooks from same Owner:
 *    - View SDK generated withdrawal signature message
 *    - View SDK generated withdraw/submit data submitted to backend
 */

import { EnclaveClient, createUniversalAddress } from '../../src';
import type { CommitmentSignData, WithdrawalSignData } from '../../src/types/models';
import { CommitmentFormatter } from '../../src/formatters/CommitmentFormatter';
import { WithdrawFormatter } from '../../src/formatters/WithdrawFormatter';
import { CommitmentCore } from '../../src/utils/CommitmentCore';
import type { UniversalAddress, Allocation } from '../../src/types/models';

// 测试配置
const TEST_CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:8080',
  chainId: 714, // BSC (SLIP-44)
  tokenSymbol: 'USDT',
  tokenId: 1,
  ownerAddress: '0x1234567890123456789012345678901234567890',
  beneficiaryAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
};

/**
 * Create mock Checkbook data
 */
function createMockCheckbook(localDepositId: number, amount: string) {
  return {
    id: `checkbook-${localDepositId}`,
    localDepositId: localDepositId,
    depositId: `0x${localDepositId.toString(16).padStart(64, '0')}`,
    amount: amount,
    remainingAmount: amount,
    status: 'with_checkbook' as const,
    slip44ChainId: TEST_CONFIG.chainId,
    token: {
      id: TEST_CONFIG.tokenId.toString(),
      symbol: TEST_CONFIG.tokenSymbol,
      chainId: TEST_CONFIG.chainId,
    },
    commitment: '0x' + '1'.repeat(64), // Mock commitment hash
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create mock Allocation data
 */
function createMockAllocation(
  checkbookId: string,
  seq: number,
  amount: string,
  localDepositId: number
): Allocation {
  return {
    id: `alloc-${checkbookId}-${seq}`,
    checkbookId: checkbookId,
    seq: seq,
    amount: amount,
    status: 'idle' as const,
    token: {
      id: TEST_CONFIG.tokenId.toString(),
      symbol: TEST_CONFIG.tokenSymbol,
      chainId: TEST_CONFIG.chainId,
    },
    commitment: '0x' + '1'.repeat(64), // Mock commitment hash
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Test 1: Generate commitment signature message and submit data
 */
async function testCommitmentSignature() {
  console.log('\n' + '='.repeat(80));
  console.log('📝 Test 1: Generate Commitment Signature Message and Submit Data');
  console.log('='.repeat(80));

  // Create mock Checkbook
  const checkbook = createMockCheckbook(1, '2000000000000000000'); // 2 USDT
  console.log('\n✅ Created mock Checkbook:');
  console.log(`   ID: ${checkbook.id}`);
  console.log(`   Local Deposit ID: ${checkbook.localDepositId}`);
  console.log(`   Amount: ${checkbook.amount}`);
  console.log(`   Deposit ID (hex): ${checkbook.depositId}`);

  // Create Owner address
  const ownerAddress: UniversalAddress = createUniversalAddress(
    TEST_CONFIG.ownerAddress,
    TEST_CONFIG.chainId
  );
  console.log('\n✅ Created Owner address:');
  console.log(`   Chain ID: ${ownerAddress.chainId}`);
  console.log(`   Data: ${ownerAddress.data}`);

  // Prepare allocations (4 allocations, 0.5 USDT each)
  const allocations = [
    { seq: 0, amount: '500000000000000000' }, // 0.5 USDT
    { seq: 1, amount: '500000000000000000' }, // 0.5 USDT
    { seq: 2, amount: '500000000000000000' }, // 0.5 USDT
    { seq: 3, amount: '500000000000000000' }, // 0.5 USDT
  ];

  console.log('\n✅ Prepared allocations:');
  allocations.forEach((alloc, idx) => {
    console.log(`   Allocation ${idx}: seq=${alloc.seq}, amount=${alloc.amount}`);
  });

  // Display SDK input parameters
  console.log('\n' + '─'.repeat(80));
  console.log('📥 SDK Input Parameters (prepareCommitment):');
  console.log('─'.repeat(80));
  const commitmentParams = {
    checkbookId: checkbook.id,
    amounts: allocations.map(a => a.amount),
    tokenKey: TEST_CONFIG.tokenSymbol,
  };
  console.log(JSON.stringify(commitmentParams, null, 2));

  // 生成 nullifiers
  const depositIdHex = checkbook.depositId;
  // Convert depositIdHex string to Uint8Array
  const depositIdBytes = new Uint8Array(
    Buffer.from(depositIdHex.replace(/^0x/, ''), 'hex')
  );
  // Convert allocations to format expected by CommitmentCore (amount as Uint8Array)
  const allocationsForCore = allocations.map(alloc => ({
    seq: alloc.seq,
    amount: CommitmentCore.amountToBytes32(alloc.amount),
  }));
  const nullifiers = CommitmentCore.generateNullifiersBatch(
    allocationsForCore,
    ownerAddress,
    depositIdBytes,
    TEST_CONFIG.chainId,
    TEST_CONFIG.tokenId.toString()
  );

  console.log('\n✅ Generated Nullifiers:');
  nullifiers.forEach((nullifier, idx) => {
    const nullifierHex = '0x' + Array.from(nullifier)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log(`   Allocation ${idx} nullifier: ${nullifierHex}`);
  });

  // Use CommitmentFormatter to generate signature data
  const signData: CommitmentSignData = CommitmentFormatter.prepareSignData(
    allocations,
    depositIdHex,
    TEST_CONFIG.tokenId,
    TEST_CONFIG.tokenSymbol,
    TEST_CONFIG.chainId,
    ownerAddress,
    CommitmentFormatter.LANG_EN, // English
    'Binance Smart Chain',
    checkbook.localDepositId // localDepositId for display
  );

  console.log('\n' + '─'.repeat(80));
  console.log('📋 1.1 SDK Generated Commitment Signature Message:');
  console.log('─'.repeat(80));
  console.log('\nMessage to Sign:');
  console.log('─'.repeat(80));
  console.log(signData.message);
  console.log('─'.repeat(80));
  console.log(`\nMessage Hash: ${signData.messageHash}`);
  console.log(`Checkbook ID: ${signData.checkbookId}`);
  console.log(`Token ID: ${signData.tokenId}`);
  console.log(`Amounts: ${signData.amounts.join(', ')}`);

  // Mock signature (should use wallet signature in production)
  const mockSignature = '0x' + 'a'.repeat(130); // Mock signature

  // Build actual data submitted to backend
  // Actual format SDK submits to /api/commitments/submit
  const ownerAddressData = ownerAddress.data.replace(/^0x/, ''); // Remove 0x prefix
  const submitData = {
    allocations: signData.amounts.map((amount, idx) => ({
      recipient_chain_id: TEST_CONFIG.chainId, // SLIP-44 Chain ID
      recipient_address: ownerAddressData, // 32-byte Universal Address (without 0x)
      amount: amount, // Amount in hex string
    })),
    deposit_id: checkbook.localDepositId.toString(), // Local Deposit ID as string
    signature: {
      chain_id: TEST_CONFIG.chainId, // SLIP-44 Chain ID
      signature_data: mockSignature, // Signature hex string
      public_key: null as string | null, // Optional public key
    },
    owner_address: {
      chain_id: TEST_CONFIG.chainId, // SLIP-44 Chain ID
      address: ownerAddressData, // 32-byte Universal Address (without 0x)
    },
    token_symbol: TEST_CONFIG.tokenSymbol, // Token symbol (e.g., "USDT")
    token_decimals: 18, // Token decimals (default: 18)
    lang: 1, // Language code (1=English)
  };

  console.log('\n' + '─'.repeat(80));
  console.log('📤 1.2 SDK Generated commitment/submit Data Submitted to Backend:');
  console.log('─'.repeat(80));
  console.log(JSON.stringify(submitData, null, 2));
}

/**
 * Test 2: Generate Withdraw signature message and submit data (multiple Checkbooks)
 */
async function testWithdrawSignature() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📝 Test 2: Generate Withdraw Signature Message and Submit Data (Multiple Checkbooks)');
  console.log('='.repeat(80));

  // Create multiple Checkbooks
  const checkbook1 = createMockCheckbook(1, '1000000000000000000'); // 1 USDT
  const checkbook2 = createMockCheckbook(2, '1500000000000000000'); // 1.5 USDT
  const checkbook3 = createMockCheckbook(3, '500000000000000000');  // 0.5 USDT

  console.log('\n✅ Created multiple Checkbooks:');
  console.log(`   Checkbook 1: ID=${checkbook1.id}, Deposit ID=${checkbook1.localDepositId}, Amount=${checkbook1.amount}`);
  console.log(`   Checkbook 2: ID=${checkbook2.id}, Deposit ID=${checkbook2.localDepositId}, Amount=${checkbook2.amount}`);
  console.log(`   Checkbook 3: ID=${checkbook3.id}, Deposit ID=${checkbook3.localDepositId}, Amount=${checkbook3.amount}`);

  // Create Owner address
  const ownerAddress: UniversalAddress = createUniversalAddress(
    TEST_CONFIG.ownerAddress,
    TEST_CONFIG.chainId
  );

  // Create multiple Allocations (from different Checkbooks)
  const allocations: Allocation[] = [
    // Checkbook 1 allocations
    createMockAllocation(checkbook1.id, 0, '500000000000000000', checkbook1.localDepositId), // 0.5 USDT
    createMockAllocation(checkbook1.id, 1, '500000000000000000', checkbook1.localDepositId), // 0.5 USDT
    // Checkbook 2 allocations
    createMockAllocation(checkbook2.id, 0, '750000000000000000', checkbook2.localDepositId), // 0.75 USDT
    createMockAllocation(checkbook2.id, 1, '750000000000000000', checkbook2.localDepositId), // 0.75 USDT
    // Checkbook 3 allocations
    createMockAllocation(checkbook3.id, 0, '500000000000000000', checkbook3.localDepositId), // 0.5 USDT
  ];

  console.log('\n✅ Created multiple Allocations (from different Checkbooks):');
  allocations.forEach((alloc, idx) => {
    console.log(`   Allocation ${idx}: ID=${alloc.id}, Checkbook=${alloc.checkbookId}, Seq=${alloc.seq}, Amount=${alloc.amount}`);
  });

  // Create Beneficiary address
  const beneficiary: UniversalAddress = createUniversalAddress(
    TEST_CONFIG.beneficiaryAddress,
    TEST_CONFIG.chainId
  );
  console.log('\n✅ Created Beneficiary address:');
  console.log(`   Chain ID: ${beneficiary.chainId}`);
  console.log(`   Data: ${beneficiary.data}`);

  // Prepare Withdraw Intent
  const intent = {
    type: 'RawToken' as const,
    beneficiary: beneficiary,
    tokenSymbol: TEST_CONFIG.tokenSymbol,
  };

  // Display SDK input parameters
  console.log('\n' + '─'.repeat(80));
  console.log('📥 SDK Input Parameters (prepareWithdraw):');
  console.log('─'.repeat(80));
  const withdrawalParams = {
    allocationIds: allocations.map(a => a.id),
    intent: {
      type: intent.type,
      beneficiary: {
        chainId: intent.beneficiary.chainId,
        data: intent.beneficiary.data,
      },
      tokenSymbol: intent.tokenSymbol,
    },
  };
  console.log(JSON.stringify(withdrawalParams, null, 2));

  // Build allocationCheckbookMap (for cross-Checkbook support)
  const allocationCheckbookMap = new Map<string, { localDepositId?: number; slip44ChainId?: number }>();
  allocations.forEach(alloc => {
    const checkbook = alloc.checkbookId === checkbook1.id ? checkbook1 :
                     alloc.checkbookId === checkbook2.id ? checkbook2 :
                     checkbook3;
    allocationCheckbookMap.set(alloc.id, {
      localDepositId: checkbook.localDepositId,
      slip44ChainId: checkbook.slip44ChainId,
    });
  });

  // Use WithdrawFormatter to generate signature data
  const signData: WithdrawalSignData = WithdrawFormatter.prepareSignData(
    allocations,
    intent,
    TEST_CONFIG.tokenSymbol,
    WithdrawFormatter.LANG_EN, // English
    'Binance Smart Chain',
    undefined, // checkbookInfo (not needed for multi-checkbook)
    '0', // minOutput
    allocationCheckbookMap
  );

  console.log('\n' + '─'.repeat(80));
  console.log('📋 2.1 SDK Generated Withdraw Signature Message:');
  console.log('─'.repeat(80));
  console.log('\nMessage to Sign:');
  console.log('─'.repeat(80));
  console.log(signData.message);
  console.log('─'.repeat(80));
  console.log(`\nMessage Hash: ${signData.messageHash}`);
  console.log(`Nullifier: ${signData.nullifier}`);
  console.log(`Target Chain: ${signData.targetChain}`);
  console.log(`Target Address: ${signData.targetAddress}`);
  console.log(`Token Symbol: ${signData.tokenSymbol}`);
  console.log(`Allocation IDs: ${signData.allocationIds.join(', ')}`);

  // Mock signature (should use wallet signature in production)
  const mockSignature = '0x' + 'b'.repeat(130); // Mock signature

  // Build data submitted to backend
  const submitData = {
    allocations: signData.allocationIds,
    intent: {
      type: 0, // RawToken
      beneficiaryChainId: intent.beneficiary.chainId,
      beneficiaryAddress: intent.beneficiary.data.replace(/^0x/, ''), // Remove 0x prefix
      tokenSymbol: intent.tokenSymbol,
    },
    signature: mockSignature,
    chainId: TEST_CONFIG.chainId,
  };

  console.log('\n' + '─'.repeat(80));
  console.log('📤 2.2 SDK Generated withdraw/submit Data Submitted to Backend:');
  console.log('─'.repeat(80));
  console.log(JSON.stringify(submitData, null, 2));
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🚀 SDK Signature Data Test Script');
    console.log('='.repeat(80));

    // Test 1: Commitment signature data
    await testCommitmentSignature();

    // Test 2: Withdraw signature data (multiple Checkbooks)
    await testWithdrawSignature();

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

export { testCommitmentSignature, testWithdrawSignature };

