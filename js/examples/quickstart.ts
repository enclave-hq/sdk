/**
 * Quickstart: Connect SDK + Wallet SDK
 * 
 * This example shows the minimal setup needed to get started.
 */

import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk';

async function main() {
  // ========================================
  // Step 1: Create Wallet Manager
  // ========================================
  const walletManager = new WalletManager({
    enableStorage: true,
    defaultChainId: 1, // Ethereum
  });

  // ========================================
  // Step 2: Connect Wallet
  // ========================================
  console.log('Connecting to MetaMask...');
  await walletManager.connect(WalletType.METAMASK);
  
  const account = walletManager.getCurrentAccount();
  console.log('✅ Wallet connected:', account?.nativeAddress);

  // ========================================
  // Step 3: Create Contract Provider
  // ========================================
  const contractProvider = new WalletSDKContractProvider(walletManager);

  // ========================================
  // Step 4: Create Signer
  // ========================================
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

  // ========================================
  // Step 5: Initialize Enclave SDK
  // ========================================
  console.log('Connecting to Enclave...');
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer,
    contractProvider,
  });

  await client.connect();
  console.log('✅ SDK connected');

  // ========================================
  // Step 6: Use SDK
  // ========================================
  
  // Example: Read contract via wallet-sdk
  console.log('\n--- Reading Contract ---');
  const ERC20_ABI = [
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const balance = await walletManager.readContract(
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
    ERC20_ABI,
    'balanceOf',
    [account!.nativeAddress]
  );
  console.log('💰 USDT Balance:', balance.toString());

  // Example: Use SDK business logic
  console.log('\n--- Using SDK ---');
  const checkbooks = client.stores.checkbooks.all;
  console.log('📚 Checkbooks:', checkbooks.length);

  // Example: Create checkbook
  console.log('\n--- Creating Checkbook ---');
  const result = await client.actions.createCommitment({
    poolId: 'pool-example',
    tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    amount: '1000000000000000000', // 1 token
    allocations: [
      { amount: '500000000000000000' },
      { amount: '500000000000000000' },
    ],
  });
  console.log('✅ Checkbook created:', result.checkbookId);

  // ========================================
  // Step 7: Cleanup
  // ========================================
  await client.disconnect();
  await walletManager.disconnect();
  console.log('\n✅ All done!');
}

// Run
main().catch(console.error);

