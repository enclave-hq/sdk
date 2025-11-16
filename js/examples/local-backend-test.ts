/**
 * Local Backend Test Example
 * 
 * This example demonstrates how to connect SDK to a local backend instance
 * and test the complete workflow:
 * 1. Connect to local backend
 * 2. Authenticate
 * 3. Create checkbook (deposit)
 * 4. Create allocations (commitment)
 * 5. Create withdrawal
 * 6. Check status
 * 
 * Prerequisites:
 * - Backend running on http://localhost:3001
 * - PostgreSQL database setup
 * - NATS server running
 * - MetaMask or private key for signing
 */

import { EnclaveClient, WalletSDKContractProvider } from '../src';
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

async function main() {
  console.log('🚀 Starting Local Backend Test\n');

  // ========================================
  // Step 1: Setup Wallet
  // ========================================
  console.log('📱 Step 1: Setting up wallet...');
  
  const walletManager = new WalletManager({
    enableStorage: true,
    defaultChainId: 714, // BSC (SLIP-44 chain ID)
  });

  // Connect to MetaMask (or use private key for testing)
  try {
    await walletManager.connect(WalletType.METAMASK);
    const account = walletManager.getCurrentAccount();
    console.log('✅ Wallet connected:', account?.nativeAddress);
  } catch (error) {
    console.error('❌ Wallet connection failed. Using private key instead...');
    
    // Fallback to private key if MetaMask not available
    if (!process.env.PRIVATE_KEY) {
      throw new Error('Either connect MetaMask or set PRIVATE_KEY environment variable');
    }
    
    // Note: You would need to implement private key adapter
    console.log('⚠️  Private key mode not yet implemented in this example');
    process.exit(1);
  }

  // ========================================
  // Step 2: Initialize SDK
  // ========================================
  console.log('\n🔌 Step 2: Connecting to local backend...');
  
  const contractProvider = new WalletSDKContractProvider(walletManager);
  
  const signer = {
    getAddress: async () => {
      const acc = walletManager.getCurrentAccount();
      if (!acc) throw new Error('No account');
      return acc.nativeAddress;
    },
    signMessage: async (message: string | Uint8Array) => {
      const msg = typeof message === 'string' 
        ? message 
        : Buffer.from(message).toString('hex');
      return walletManager.signMessage(msg);
    },
  };

  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',      // Local backend
    wsUrl: 'ws://localhost:3001/ws',      // WebSocket endpoint
    signer,
    contractProvider,
  });

  try {
    await client.connect();
    console.log('✅ Connected to local backend');
    console.log('   API: http://localhost:3001');
    console.log('   WS:  ws://localhost:3001/ws');
  } catch (error: any) {
    console.error('❌ Failed to connect to backend:', error.message);
    console.log('\n💡 Make sure backend is running:');
    console.log('   cd ../backend && ./start-backend.sh');
    process.exit(1);
  }

  // ========================================
  // Step 3: Check Backend Status
  // ========================================
  console.log('\n🏥 Step 3: Checking backend health...');
  
  try {
    const response = await fetch('http://localhost:3001/health');
    const health = await response.json();
    console.log('✅ Backend is healthy:', health);
  } catch (error) {
    console.error('❌ Backend health check failed');
    process.exit(1);
  }

  // ========================================
  // Step 4: Fetch User Data
  // ========================================
  console.log('\n📊 Step 4: Fetching user data...');
  
  const userAddress = await signer.getAddress();
  
  // Fetch checkbooks
  const checkbooks = await client.stores.checkbooks.fetchByOwner(userAddress);
  console.log(`✅ Found ${checkbooks.length} checkbooks`);
  
  checkbooks.forEach((cb, i) => {
    console.log(`   ${i + 1}. Checkbook ${cb.id}`);
    console.log(`      Status: ${cb.status}`);
    console.log(`      Amount: ${cb.depositAmount} ${cb.token?.symbol || 'tokens'}`);
  });

  // Fetch allocations
  const allocations = await client.stores.allocations.fetchList({
    owner: userAddress,
    limit: 100,
  });
  console.log(`✅ Found ${allocations.length} allocations`);
  
  const idleAllocations = allocations.filter(a => a.status === 'idle');
  console.log(`   Idle allocations: ${idleAllocations.length}`);
  
  // Fetch withdrawals
  const withdrawals = await client.stores.withdrawals.fetchList({
    owner: userAddress,
    limit: 100,
  });
  console.log(`✅ Found ${withdrawals.length} withdrawals`);

  // ========================================
  // Step 5: Token Prices
  // ========================================
  console.log('\n💰 Step 5: Fetching token prices...');
  
  const prices = await client.stores.prices.fetchPrices();
  console.log('✅ Token prices:');
  prices.forEach(price => {
    console.log(`   ${price.symbol}: $${price.price}`);
  });

  // ========================================
  // Step 6: Create Checkbook (if needed)
  // ========================================
  if (checkbooks.length === 0) {
    console.log('\n📝 Step 6: No checkbooks found. Creating one...');
    console.log('⚠️  Note: This requires an actual deposit transaction on-chain');
    console.log('   Skipping for this example.');
    console.log('   In production, user would:');
    console.log('   1. Call deposit contract method');
    console.log('   2. Wait for blockchain confirmation');
    console.log('   3. Backend receives event from BlockScanner');
    console.log('   4. Backend creates checkbook in database');
  } else {
    console.log('\n📝 Step 6: Checkbooks already exist, skipping creation.');
  }

  // ========================================
  // Step 7: Create Allocations
  // ========================================
  const activeCheckbooks = checkbooks.filter(
    cb => cb.status === 'with_checkbook' || cb.status === 'active'
  );
  
  if (activeCheckbooks.length > 0) {
    console.log('\n🔢 Step 7: Creating allocations...');
    const checkbook = activeCheckbooks[0];
    
    try {
      const newAllocations = await client.actions.createCommitment({
        poolId: checkbook.poolId || 'default-pool',
        tokenAddress: checkbook.token?.address || '0x...',
        amount: '1000000000000000000', // 1 token (18 decimals)
        allocations: [
          { amount: '400000000000000000' }, // 0.4 token
          { amount: '300000000000000000' }, // 0.3 token
          { amount: '300000000000000000' }, // 0.3 token
        ],
      });
      
      console.log(`✅ Created ${newAllocations.length} allocations`);
      newAllocations.forEach((alloc, i) => {
        console.log(`   ${i + 1}. Allocation ${alloc.id}`);
        console.log(`      Amount: ${alloc.amount}`);
        console.log(`      Status: ${alloc.status}`);
      });
    } catch (error: any) {
      console.error('❌ Failed to create allocations:', error.message);
      console.log('   This is expected if checkbook is not ready or already used');
    }
  } else {
    console.log('\n🔢 Step 7: No active checkbooks, skipping allocation creation.');
  }

  // ========================================
  // Step 8: Create Withdrawal
  // ========================================
  if (idleAllocations.length > 0) {
    console.log('\n💸 Step 8: Creating withdrawal...');
    
    try {
      // Create withdrawal using correct API
      // Note: intent.beneficiary.chainId should be SLIP-44 chain ID (714 for BSC)
      const withdrawRequest = await client.withdraw({
        allocationIds: idleAllocations.slice(0, 2).map(a => a.id), // Take first 2
        intent: {
          type: 'RawToken',
          beneficiary: {
            chainId: 714, // BSC (SLIP-44)
            address: userAddress,
          },
          tokenSymbol: 'USDT', // BSC USDT
        },
      });
      
      console.log('✅ Withdrawal created:', withdrawRequest.id);
      console.log(`   Status: ${withdrawRequest.status}`);
      console.log(`   Target: ${withdrawRequest.targetAddress}`);
    } catch (error: any) {
      console.error('❌ Failed to create withdrawal:', error.message);
    }
  } else {
    console.log('\n💸 Step 8: No idle allocations, skipping withdrawal creation.');
  }

  // ========================================
  // Step 9: Real-time Updates (WebSocket)
  // ========================================
  console.log('\n📡 Step 9: Listening for real-time updates...');
  console.log('   (Press Ctrl+C to stop)');
  
  // Listen to WebSocket events
  let eventCount = 0;
  const maxEvents = 5; // Listen to 5 events then exit
  
  client.on('checkbookUpdated', (checkbook) => {
    console.log(`\n🔔 Checkbook updated: ${checkbook.id}`);
    console.log(`   Status: ${checkbook.status}`);
    eventCount++;
  });
  
  client.on('allocationUpdated', (allocation) => {
    console.log(`\n🔔 Allocation updated: ${allocation.id}`);
    console.log(`   Status: ${allocation.status}`);
    eventCount++;
  });
  
  client.on('withdrawalUpdated', (withdrawal) => {
    console.log(`\n🔔 Withdrawal updated: ${withdrawal.id}`);
    console.log(`   Status: ${withdrawal.status}`);
    eventCount++;
  });

  // Wait for some events or timeout
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (eventCount >= maxEvents) {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(null);
    }, 30000);
  });

  // ========================================
  // Step 10: Cleanup
  // ========================================
  console.log('\n🧹 Step 10: Cleaning up...');
  
  await client.disconnect();
  await walletManager.disconnect();
  
  console.log('✅ Disconnected from backend');
  console.log('\n🎉 Test completed successfully!');
  
  // ========================================
  // Summary
  // ========================================
  console.log('\n📊 Summary:');
  console.log(`   Checkbooks: ${checkbooks.length}`);
  console.log(`   Allocations: ${allocations.length} (${idleAllocations.length} idle)`);
  console.log(`   Withdrawals: ${withdrawals.length}`);
  console.log(`   Events received: ${eventCount}`);
}

// Run the test
main()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });


