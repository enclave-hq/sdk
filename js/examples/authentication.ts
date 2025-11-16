/**
 * Authentication example for Enclave SDK
 */

import { EnclaveClient } from '../src';
import { ethers } from 'ethers';

async function main() {
  // Initialize wallet (in production, use proper wallet management)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
  console.log('Wallet address:', wallet.address);

  // Initialize Enclave client
  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001/ws',
    signer: wallet.privateKey,
  });

  try {
    // Step 1: Get nonce for signing
    console.log('Getting nonce for authentication...');
    const nonceResponse = await client.auth.getNonce(wallet.address);
    console.log('Nonce:', nonceResponse.nonce);

    // Step 2: Create message to sign
    const message = `Sign to authenticate with Enclave\nNonce: ${nonceResponse.nonce}\nTimestamp: ${nonceResponse.timestamp}`;
    console.log('Message to sign:', message);

    // Step 3: Sign the message
    const signature = await wallet.signMessage(message);
    console.log('Signature:', signature);

    // Step 4: Authenticate with signed message
    console.log('Authenticating...');
    const authResponse = await client.auth.authenticate({
      address: wallet.address,
      chainId: 714, // BSC (SLIP-44 chain ID)
      message: message,
      signature: signature,
    });

    console.log('Authentication successful!');
    console.log('Token:', authResponse.token);
    console.log('User address:', authResponse.user_address);

    // Step 5: Verify token is valid
    const isValid = await client.auth.verifyToken();
    console.log('Token is valid:', isValid);

    // Step 6: Connect to WebSocket for real-time updates
    await client.connect();
    console.log('Connected to WebSocket');

    // Now you can use authenticated endpoints
    const checkbooks = await client.stores.checkbooks.fetchList();
    console.log(`Found ${checkbooks.data.length} checkbooks`);

    // Disconnect
    client.disconnect();
    console.log('Disconnected from Enclave');

  } catch (error) {
    console.error('Authentication error:', error);
    client.disconnect();
  }
}

main();





