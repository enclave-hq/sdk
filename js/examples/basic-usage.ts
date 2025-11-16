/**
 * Basic usage example for Enclave SDK
 */

import {
  EnclaveClient,
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '../src';

async function main() {
  // Initialize Enclave client
  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001/ws',
    signer: process.env.PRIVATE_KEY!,
  });

  try {
    // Connect to Enclave
    await client.connect();
    console.log('Connected to Enclave');
    console.log('User address:', client.address?.address);

    // Fetch user's checkbooks
    const checkbooks = await client.stores.checkbooks.fetchByOwner(
      client.address!.address
    );
    console.log(`Found ${checkbooks.length} checkbooks`);

    // Get active checkbooks
    const activeCheckbooks = client.stores.checkbooks.filter(
      (c) => c.status === CheckbookStatus.WithCheckbook
    );
    console.log(`Active checkbooks: ${activeCheckbooks.length}`);

    // Fetch allocations
    const allocations = await client.stores.allocations.fetchList({
      owner: client.address!.address,
      limit: 100,
    });
    console.log(`Found ${allocations.length} allocations`);

    // Get idle allocations (available for withdrawal)
    const idleAllocations = client.stores.allocations.filter(
      (a) => a.status === AllocationStatus.Idle
    );
    console.log(`Idle allocations: ${idleAllocations.length}`);

    // Create commitment (allocations) if we have an active checkbook
    if (activeCheckbooks.length > 0) {
      const checkbook = activeCheckbooks[0];
      console.log(`\nCreating allocations for checkbook: ${checkbook.id}`);

      const newAllocations = await client.createCommitment({
        checkbookId: checkbook.id,
        amounts: ['1000000', '2000000', '3000000'], // In smallest token unit
        tokenId: checkbook.token.id,
      });

      console.log(`Created ${newAllocations.length} allocations`);
    }

    // Create withdrawal if we have idle allocations
    if (idleAllocations.length > 0) {
      console.log(`\nCreating withdrawal with ${idleAllocations.length} allocations`);

      const withdrawRequest = await client.withdraw({
        allocationIds: idleAllocations.map((a) => a.id),
        intent: {
          type: 'RawToken',
          beneficiary: {
            chainId: 60, // Ethereum (SLIP-44 chain ID)
            address: client.address!.address,
          },
          tokenSymbol: 'USDT', // USDT on Ethereum
        },
      });

      console.log(`Withdrawal created: ${withdrawRequest.id}`);
      console.log(`Status: ${withdrawRequest.status}`);
    }

    // Fetch token prices
    const prices = await client.stores.prices.fetchPrices();
    console.log(`\nToken prices:`);
    prices.forEach((price) => {
      console.log(`  ${price.symbol}: $${price.price}`);
    });

    // Disconnect
    client.disconnect();
    console.log('\nDisconnected from Enclave');
  } catch (error) {
    console.error('Error:', error);
    client.disconnect();
  }
}

main();

