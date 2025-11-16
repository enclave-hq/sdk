/**
 * Script to check all CheckBook statuses for withdraw testing
 * 
 * Usage:
 *   npm run check-checkbook-status
 * 
 * This script will:
 *   1. Connect to Enclave backend
 *   2. List all checkbooks and their statuses
 *   3. Show which checkbooks are ready for withdraw
 *   4. Display allocation counts (idle, pending, used)
 */

import { EnclaveClient, CheckbookStatus, AllocationStatus } from '../src';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TEST_CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  wsUrl: process.env.WS_URL || 'ws://localhost:3001/ws',
  privateKey: process.env.PRIVATE_KEY || '',
};

async function checkCheckbookStatus() {
  if (!TEST_CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  console.log('🔧 Initializing Enclave SDK...');
  const client = new EnclaveClient({
    apiUrl: TEST_CONFIG.apiUrl,
    wsUrl: TEST_CONFIG.wsUrl,
    signer: TEST_CONFIG.privateKey,
    timeout: 30000,
  });

  await client.connect();
  console.log('✅ Connected to Enclave\n');

  // Get user address
  const userUniversalAddress = client.address!;
  if (!userUniversalAddress.universalFormat) {
    throw new Error('Universal Address format is required');
  }
  const userAddress = userUniversalAddress.universalFormat.replace(/^0x/, '');
  console.log(`👤 User address (Universal): ${userAddress}`);
  console.log(`   Chain ID (SLIP-44): ${userUniversalAddress.chainId}\n`);

  // Fetch all checkbooks
  console.log('📋 Fetching all checkbooks...');
  const checkbooks = await client.stores.checkbooks.fetchList({
    owner: userAddress,
    limit: 100,
  });
  console.log(`✅ Found ${checkbooks.length} checkbook(s)\n`);

  if (checkbooks.length === 0) {
    console.log('⚠️  No checkbooks found. You need to create a deposit first.');
    await client.disconnect();
    return;
  }

  // Fetch all allocations
  console.log('📦 Fetching all allocations...');
  const allAllocations = await client.stores.allocations.fetchList({
    owner: userAddress,
    limit: 1000,
  });
  console.log(`✅ Found ${allAllocations.length} allocation(s)\n`);

  // Sort checkbooks by created_at descending
  const sorted = [...checkbooks].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  console.log('='.repeat(80));
  console.log('📊 CHECKBOOK STATUS REPORT');
  console.log('='.repeat(80));
  console.log('');

  sorted.forEach((cb, idx) => {
    const statusIcon = 
      cb.status === CheckbookStatus.WithCheckbook ? '✅' : 
      cb.status === CheckbookStatus.ReadyForCommitment ? '✅' : 
      cb.status === CheckbookStatus.Unsigned ? '⏳' : 
      cb.status === CheckbookStatus.Pending ? '⏳' : 
      cb.status === CheckbookStatus.ProofFailed ? '❌' : 
      cb.status === CheckbookStatus.SubmissionFailed ? '❌' : 
      cb.status === CheckbookStatus.Deleted ? '🗑️' : '❓';

    // Get allocations for this checkbook
    const cbAllocations = allAllocations.filter(a => a.checkbookId === cb.id);
    const idleAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
    const pendingAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Pending);
    const usedAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Used);

    console.log(`${idx + 1}. ${statusIcon} Checkbook: ${cb.id}`);
    console.log(`   Status: ${cb.status}`);
    console.log(`   Amount: ${cb.amount || cb.depositAmount || 'N/A'}`);
    console.log(`   Remaining: ${cb.remainingAmount || 'N/A'}`);
    console.log(`   Token: ${cb.token?.symbol || 'N/A'} (${cb.token?.id || 'N/A'})`);
    console.log(`   Created: ${cb.createdAt || 'N/A'}`);
    console.log(`   Allocations:`);
    console.log(`      Total: ${cbAllocations.length}`);
    console.log(`      Idle: ${idleAllocations.length} ${idleAllocations.length > 0 ? '✅ (can withdraw)' : '❌'}`);
    console.log(`      Pending: ${pendingAllocations.length}`);
    console.log(`      Used: ${usedAllocations.length}`);
    
    // Check if ready for withdraw
    const canWithdraw = (
      (cb.status === CheckbookStatus.WithCheckbook || 
       cb.status === CheckbookStatus.ReadyForCommitment) &&
      idleAllocations.length > 0
    );
    
    if (canWithdraw) {
      console.log(`   🎯 READY FOR WITHDRAW: ${idleAllocations.length} idle allocation(s) available`);
      if (idleAllocations.length > 0) {
        console.log(`      Allocation IDs: ${idleAllocations.slice(0, 5).map(a => a.id).join(', ')}${idleAllocations.length > 5 ? '...' : ''}`);
      }
    } else {
      if (cb.status !== CheckbookStatus.WithCheckbook && cb.status !== CheckbookStatus.ReadyForCommitment) {
        console.log(`   ⚠️  Cannot withdraw: Checkbook status is '${cb.status}' (need 'with_checkbook' or 'ready_for_commitment')`);
      }
      if (idleAllocations.length === 0) {
        console.log(`   ⚠️  Cannot withdraw: No idle allocations available`);
      }
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('📝 SUMMARY');
  console.log('='.repeat(80));
  
  const withCheckbookCount = checkbooks.filter(cb => cb.status === CheckbookStatus.WithCheckbook).length;
  const readyForCommitmentCount = checkbooks.filter(cb => cb.status === CheckbookStatus.ReadyForCommitment).length;
  const totalIdleAllocations = allAllocations.filter(a => a.status === AllocationStatus.Idle).length;
  const totalPendingAllocations = allAllocations.filter(a => a.status === AllocationStatus.Pending).length;
  const totalUsedAllocations = allAllocations.filter(a => a.status === AllocationStatus.Used).length;

  console.log(`Total Checkbooks: ${checkbooks.length}`);
  console.log(`  - with_checkbook: ${withCheckbookCount}`);
  console.log(`  - ready_for_commitment: ${readyForCommitmentCount}`);
  console.log(`Total Allocations: ${allAllocations.length}`);
  console.log(`  - Idle: ${totalIdleAllocations} ${totalIdleAllocations > 0 ? '✅ (can withdraw)' : '❌'}`);
  console.log(`  - Pending: ${totalPendingAllocations}`);
  console.log(`  - Used: ${totalUsedAllocations}`);
  console.log('');

  // Find checkbooks ready for withdraw
  const readyForWithdraw = sorted.filter(cb => {
    const cbAllocations = allAllocations.filter(a => a.checkbookId === cb.id);
    const idleAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
    return (
      (cb.status === CheckbookStatus.WithCheckbook || 
       cb.status === CheckbookStatus.ReadyForCommitment) &&
      idleAllocations.length > 0
    );
  });

  if (readyForWithdraw.length > 0) {
    console.log(`✅ ${readyForWithdraw.length} checkbook(s) ready for withdraw:`);
    readyForWithdraw.forEach((cb, idx) => {
      const cbAllocations = allAllocations.filter(a => a.checkbookId === cb.id);
      const idleAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
      console.log(`   ${idx + 1}. ${cb.id} - ${idleAllocations.length} idle allocation(s)`);
    });
  } else {
    console.log(`⚠️  No checkbooks ready for withdraw.`);
    console.log(`   You may need to:`);
    console.log(`   1. Create a deposit (if no checkbooks exist)`);
    console.log(`   2. Wait for checkbook status to become 'with_checkbook' or 'ready_for_commitment'`);
    console.log(`   3. Create allocations (commitment) if checkbook is ready`);
  }

  console.log('');
  console.log('='.repeat(80));

  await client.disconnect();
  console.log('\n✅ Disconnected from Enclave');
}

// Run the script
checkCheckbookStatus().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

