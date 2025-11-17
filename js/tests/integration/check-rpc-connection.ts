/**
 * Quick script to test RPC connection
 * Run with: npx tsx tests/integration/check-rpc-connection.ts
 */

import { ethers } from 'ethers';

const RPC_ENDPOINTS = [
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://lb.drpc.org/bsc/Ah3WY9x6skbsjvLS7Kax1gjkCsIIf_YR8JMcIgaNGuYu', // DRPC fallback
];

async function testRpcConnection(endpoint: string): Promise<boolean> {
  try {
    console.log(`\n🔍 Testing: ${endpoint}`);
    const provider = new ethers.JsonRpcProvider(endpoint, {
      chainId: 56,
      name: 'bsc',
    });
    
    const startTime = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const elapsed = Date.now() - startTime;
    
    console.log(`   ✅ Connected! Block number: ${blockNumber}, Time: ${elapsed}ms`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🌐 Testing BSC RPC Endpoints...');
  console.log('='.repeat(80));
  
  let connected = false;
  for (const endpoint of RPC_ENDPOINTS) {
    if (await testRpcConnection(endpoint)) {
      connected = true;
      console.log(`\n✅ Found working endpoint: ${endpoint}`);
      break;
    }
  }
  
  if (!connected) {
    console.log('\n❌ All RPC endpoints failed!');
    console.log('\nPossible solutions:');
    console.log('1. Check your internet connection');
    console.log('2. Check if you need to use a proxy (set HTTP_PROXY/HTTPS_PROXY)');
    console.log('3. Try using a different RPC endpoint via RPC_URL environment variable');
    console.log('4. Use a local test node (Anvil) for testing');
    process.exit(1);
  }
}

main().catch(console.error);




