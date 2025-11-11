/**
 * Cross-platform consistency test
 * This test uses the same test data as zkvm/lib.rs test_cross_platform_consistency
 * to verify that SDK implementation matches lib.rs exactly
 */

import { describe, it, expect } from 'vitest';
import { CommitmentCore } from '../../src/utils/CommitmentCore';
import { CommitmentFormatter } from '../../src/formatters/CommitmentFormatter';
import type { UniversalAddress } from '../../src/types/models';

// Test data (same as lib.rs test_cross_platform_consistency)
const TEST_DATA = {
  deposit_id: '0x1111111111111111111111111111111111111111111111111111111111111111',
  chain_id: 60, // Ethereum
  token_id: 1,
  owner_address: {
    chain_id: 60, // Ethereum
    address: '0x4da7cf999162ecb79749d0186e5759c7a6bd4477',
    data: '0x0000000000000000000000004da7cf999162ecb79749d0186e5759c7a6bd4477',
  },
  allocations: [
    {
      seq: 0,
      amount: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1.0 ETH
    },
    {
      seq: 1,
      amount: '0x00000000000000000000000000000000000000000000000006f05b59d3b20000', // 0.5 ETH
    },
    {
      seq: 2,
      amount: '0x0000000000000000000000000000000000000000000000001bc16d674ec80000', // 2.0 ETH
    },
  ],
  // Expected values from zkvm/lib.rs test output
  expected_commitment: '0xd0eb6692fdf3c2f5a09a9017419120ee1f746b7433be2f50d927736789c42109',
  expected_nullifiers: [
    '0x2e01cb509c4a8f39e28efe002fd4f16848cc8b425cbc67a7fa4e6a8a356cebde',
    '0xb3caa18d330c8d703498e1504d7bdf7ad5788b8d6154e93f47fc4b358e7f3000',
    '0xafc1e52d4243364c48c3d7d00165a284c45980d94686c0b0402fec29dc5b93e5',
  ],
  expected_allocation_hashes: [
    '0xbba19f7b6bf933f6afced6fc8320b406d457245dd8d0f6132addd8b76b4e8cff',
    '0x9a142274282368aaaaac27c814c3127cbd6b5ef645e418e29b24dc55d6ded30d',
    '0xe790ea07431bb49c221f03c9813f37d49ddcd2eabd51b73d2a00f1dfcfa8f87b',
  ],
};

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Cross-Platform Consistency Test', () => {
  it('should generate commitment matching lib.rs', () => {
    console.log('\n🧪 Cross-Platform Consistency Test (SDK)');
    console.log('==========================================\n');

    // Prepare test data
    const depositId = hexToBytes(TEST_DATA.deposit_id);
    const ownerAddress: UniversalAddress = {
      chainId: TEST_DATA.owner_address.chain_id,
      address: TEST_DATA.owner_address.address,
    };

    const allocations = TEST_DATA.allocations.map(alloc => ({
      seq: alloc.seq,
      amount: hexToBytes(alloc.amount),
    }));

    console.log('📋 Test Data:');
    console.log(`  Deposit ID: ${TEST_DATA.deposit_id}`);
    console.log(`  Chain ID: ${TEST_DATA.chain_id}`);
    console.log(`  Token ID: ${TEST_DATA.token_id}`);
    console.log(`  Owner Address: ${TEST_DATA.owner_address.address} on Ethereum`);
    console.log(`  Owner Chain ID: ${TEST_DATA.owner_address.chain_id}`);
    console.log(`  Owner Address Data: ${TEST_DATA.owner_address.data}`);
    console.log('  Allocations:');
    TEST_DATA.allocations.forEach((alloc, i) => {
      const amountBigInt = BigInt(alloc.amount);
      const displayAmount = Number(amountBigInt) / 1_000_000_000_000_000_000;
      console.log(`    [${i}] seq=${alloc.seq}, amount=${alloc.amount} (${displayAmount} ETH)`);
    });
    console.log();

    // 1. Generate commitment
    console.log('1️⃣  Commitment Generation:');
    const commitment = CommitmentCore.generateCommitmentWithOwner(
      allocations,
      ownerAddress,
      depositId,
      TEST_DATA.chain_id,
      TEST_DATA.token_id,
    );
    const commitmentHex = bytesToHex(commitment);
    console.log(`   Commitment: ${commitmentHex}`);
    console.log(`   Expected:   ${TEST_DATA.expected_commitment}`);
    expect(commitmentHex.toLowerCase()).toBe(TEST_DATA.expected_commitment.toLowerCase());
    console.log('   ✅ Commitment matches!\n');

    // 2. Generate nullifiers
    console.log('2️⃣  Nullifier Generation:');
    const nullifiers = CommitmentCore.generateNullifiersBatch(
      allocations,
      ownerAddress,
      depositId,
      TEST_DATA.chain_id,
      TEST_DATA.token_id,
    );
    nullifiers.forEach((nullifier, i) => {
      const nullifierHex = bytesToHex(nullifier);
      const expectedHex = TEST_DATA.expected_nullifiers[i];
      console.log(`   Allocation [${i}] (seq=${allocations[i].seq}) nullifier: ${nullifierHex}`);
      console.log(`   Expected: ${expectedHex}`);
      expect(nullifierHex.toLowerCase()).toBe(expectedHex.toLowerCase());
    });
    console.log('   ✅ All nullifiers match!\n');

    // 3. Generate allocation hashes
    console.log('3️⃣  Allocation Hash Generation:');
    allocations.forEach((alloc, i) => {
      const hash = CommitmentCore.hashAllocation(alloc);
      const hashHex = bytesToHex(hash);
      const expectedHex = TEST_DATA.expected_allocation_hashes[i];
      console.log(`   Allocation [${i}] (seq=${alloc.seq}) hash: ${hashHex}`);
      console.log(`   Expected: ${expectedHex}`);
      expect(hashHex.toLowerCase()).toBe(expectedHex.toLowerCase());
    });
    console.log('   ✅ All allocation hashes match!\n');

    // 4. Generate message to sign (English)
    console.log('4️⃣  Message to Sign (English):');
    const allocationsWithSeq = TEST_DATA.allocations.map(alloc => ({
      seq: alloc.seq,
      amount: alloc.amount,
    }));
    const signDataEn = CommitmentFormatter.prepareSignData(
      allocationsWithSeq,
      TEST_DATA.deposit_id,
      TEST_DATA.token_id,
      'ETH', // tokenSymbol
      TEST_DATA.chain_id, // chainId (SLIP-44: 60 = Ethereum)
      ownerAddress, // UniversalAddress object
      CommitmentFormatter.LANG_EN,
      'Ethereum', // chainName (optional, for extensibility)
    );
    console.log(`   Message: ${signDataEn.message}`);
    console.log();

    // 5. Generate message to sign (Chinese)
    console.log('5️⃣  Message to Sign (Chinese):');
    const signDataZh = CommitmentFormatter.prepareSignData(
      allocationsWithSeq,
      TEST_DATA.deposit_id,
      TEST_DATA.token_id,
      'ETH', // tokenSymbol
      TEST_DATA.chain_id, // chainId
      ownerAddress, // UniversalAddress object
      CommitmentFormatter.LANG_ZH,
      'Ethereum', // chainName (optional, for extensibility)
    );
    console.log(`   Message: ${signDataZh.message}`);
    console.log();

    console.log('✅ All tests passed! SDK matches lib.rs exactly.');
  });
});

