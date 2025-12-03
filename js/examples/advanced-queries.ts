/**
 * Advanced Queries Example
 * 
 * This example demonstrates how to use the advanced query features:
 * 1. Search Allocations: Query allocations by chain ID and a list of addresses (recipients)
 * 2. Get Checkbook By Deposit: Look up a checkbook by Chain SLIP44 ID and Deposit Transaction Hash
 * 
 * These features are typically used by backend services or specialized frontend components
 * and may require IP whitelisting on the backend.
 * 
 * Prerequisites:
 * - Backend running on http://localhost:3001 (with IP whitelist configured if applicable)
 * - PostgreSQL database accessible (optional, will use dummy data if not available)
 * 
 * Usage:
 *   npx tsx examples/advanced-queries.ts
 * 
 * The script will automatically fetch real data from the database (same as test_allocation_search.sh)
 */

import { APIClient } from '../src/api/APIClient';
import { AllocationsAPI } from '../src/api/AllocationsAPI';
import { CheckbooksAPI } from '../src/api/CheckbooksAPI';
import { execSync } from 'child_process';

// Database configuration (matching test_allocation_search.sh)
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  user: process.env.DB_USER || 'zkpay',
  password: process.env.DB_PASS || 'zkpay',
  database: process.env.DB_NAME || 'zkpay-backend',
};

/**
 * Fetch test data from database using psql (same as shell scripts)
 */
function fetchDataFromDB(): {
  chainId: number | null;
  addresses: string[];
  checkbookChainId: number | null;
  checkbookTxHash: string | null;
} {
  const result = {
    chainId: null as number | null,
    addresses: [] as string[],
    checkbookChainId: null as number | null,
    checkbookTxHash: null as string | null,
  };

  try {
    // Set PGPASSWORD for psql
    process.env.PGPASSWORD = DB_CONFIG.password;

    // 1. Get Chain ID from latest check (for allocations search)
    const chainIdQuery = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -t -c "SELECT recipient_chain_id FROM checks ORDER BY created_at DESC LIMIT 1;" 2>/dev/null`;
    const chainIdStr = execSync(chainIdQuery, { encoding: 'utf-8' }).trim();
    
    if (chainIdStr) {
      result.chainId = parseInt(chainIdStr, 10);
      
      // 2. Get up to 5 distinct addresses for this chain
      const addressesQuery = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -t -c "SELECT DISTINCT recipient_data FROM checks WHERE recipient_chain_id = ${result.chainId} LIMIT 5;" 2>/dev/null`;
      const addressesOutput = execSync(addressesQuery, { encoding: 'utf-8' });
      
      result.addresses = addressesOutput
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);
    }

    // 3. Get checkbook data (for checkbook lookup)
    const checkbookQuery = `psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -t -c "SELECT chain_id, deposit_transaction_hash FROM checkbooks WHERE deposit_transaction_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1;" 2>/dev/null`;
    const checkbookOutput = execSync(checkbookQuery, { encoding: 'utf-8' }).trim();
    
    if (checkbookOutput) {
      // Parse output (format: "chain_id | tx_hash" or "chain_id tx_hash")
      const parts = checkbookOutput.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        result.checkbookChainId = parseInt(parts[0], 10);
        result.checkbookTxHash = parts[1];
      } else {
        // Try space-separated
        const spaceParts = checkbookOutput.split(/\s+/);
        if (spaceParts.length >= 2) {
          result.checkbookChainId = parseInt(spaceParts[0], 10);
          result.checkbookTxHash = spaceParts[spaceParts.length - 1];
        }
      }
    }
  } catch (error) {
    // Database query failed, will use fallback data
    console.log('⚠️  Database query failed, will use fallback data');
  }

  return result;
}

async function main() {
  console.log('🚀 Starting Advanced Queries Example\n');

  // ========================================
  // Step 0: Fetch real data from database
  // ========================================
  console.log('📊 Step 0: Fetching test data from database...');
  const dbData = fetchDataFromDB();

  // ========================================
  // Step 1: Initialize API Clients
  // ========================================
  console.log('\n🔌 Step 1: Initializing API clients...');

  // Note: These specific APIs do not require authentication (signature),
  // but they might be IP-restricted on the backend.
  // We can use APIClient directly without full EnclaveClient setup.
  const apiClient = new APIClient({
    baseUrl: 'http://localhost:3001',
  });

  const allocationsAPI = new AllocationsAPI(apiClient);
  const checkbooksAPI = new CheckbooksAPI(apiClient);

  console.log('✅ API clients initialized');

  // ========================================
  // Step 2: Search Allocations
  // ========================================
  console.log('\n🔍 Step 2: Searching Allocations...');
  
  try {
    // Use real data from database, or fallback to dummy data
    const chainId = dbData.chainId || 714; // BSC
    const addressesToSearch = dbData.addresses.length > 0 
      ? dbData.addresses 
      : [
          '0x1234567890123456789012345678901234567890', // Fallback dummy address
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Fallback dummy address
        ];

    if (dbData.chainId && dbData.addresses.length > 0) {
      console.log(`   ✅ Using real data from database`);
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Addresses: ${addressesToSearch.length} (from database)`);
    } else {
      console.log(`   ⚠️  Using fallback dummy data (database query failed or no data)`);
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Addresses: ${addressesToSearch.length} (dummy)`);
    }

    const response = await allocationsAPI.searchAllocations({
      chain_slip44_id: chainId,
      addresses: addressesToSearch,
      status: 'pending', // Optional: filter by status ('idle', 'pending', 'used')
      token_keys: ['USDT', 'USDC'], // Optional: filter by token keys
    });

    console.log(`✅ Found ${response.count} allocations`);
    if (response.data && response.data.length > 0) {
      // Group allocations by checkbook
      const allocationsByCheckbook = new Map<string, typeof response.data>();
      
      response.data.forEach((alloc) => {
        const checkbookId = alloc.checkbookId || (alloc as any)._checkbook?.id || 'unknown';
        if (!allocationsByCheckbook.has(checkbookId)) {
          allocationsByCheckbook.set(checkbookId, []);
        }
        allocationsByCheckbook.get(checkbookId)!.push(alloc);
      });

      console.log(`   Grouped by ${allocationsByCheckbook.size} checkbook(s):`);
      
      // Display allocations grouped by checkbook
      allocationsByCheckbook.forEach((allocs, checkbookId) => {
        const firstAlloc = allocs[0];
        const checkbook = (firstAlloc as any)._checkbook;
        const tokenKey = checkbook?.token_key || firstAlloc.token?.symbol || 'UNKNOWN';
        const localDepositId = checkbook?.local_deposit_id || 'N/A';
        
        console.log(`\n   📋 Checkbook: ${checkbookId}`);
        console.log(`      Token: ${tokenKey}, Local Deposit ID: ${localDepositId}`);
        console.log(`      Allocations: ${allocs.length}`);
        
        // Show sample allocations from this checkbook
        allocs.slice(0, 3).forEach((alloc, i) => {
          console.log(`      ${i + 1}. Allocation ${alloc.id}: ${alloc.amount} (status: ${alloc.status})`);
        });
        if (allocs.length > 3) {
          console.log(`      ... and ${allocs.length - 3} more in this checkbook`);
        }
      });
    } else {
      console.log('   No allocations found for these addresses');
    }

  } catch (error: any) {
    console.error('❌ Search Allocations failed:', error.message);
    if (error.response) {
      console.error('   Backend Error:', error.response.data);
    }
  }

  // ========================================
  // Step 3: Get Checkbook By Deposit
  // ========================================
  console.log('\n📖 Step 3: Looking up Checkbook by Deposit...');

  try {
    // Use real data from database, or fallback to dummy data
    const chainId = dbData.checkbookChainId || 714; // BSC
    const depositTxHash = dbData.checkbookTxHash || '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    if (dbData.checkbookChainId && dbData.checkbookTxHash) {
      console.log(`   ✅ Using real data from database`);
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Tx Hash: ${depositTxHash}`);
    } else {
      console.log(`   ⚠️  Using fallback dummy data (database query failed or no data)`);
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Tx Hash: ${depositTxHash}`);
    }

    const response = await checkbooksAPI.getCheckbookByDeposit({
      chainId: chainId,
      txHash: depositTxHash,
    });

    if (response.success && response.checkbook) {
      console.log('✅ Checkbook found:');
      console.log(`   ID: ${response.checkbook.id}`);
      console.log(`   Status: ${response.checkbook.status}`);
      console.log(`   Amount: ${response.checkbook.depositAmount}`);
      console.log(`   Token: ${response.token?.symbol || 'N/A'}`);
      if (response.checkbook.allocations && response.checkbook.allocations.length > 0) {
        console.log(`   Allocations: ${response.checkbook.allocations.length}`);
      }
    } else {
      console.log('❌ Checkbook not found (success=false)');
    }

  } catch (error: any) {
    // 404 is expected if the transaction hash doesn't exist
    if (error.response && error.response.status === 404) {
      console.log('✅ Request executed (404: Checkbook not found as expected for dummy hash)');
    } else {
      console.error('❌ Get Checkbook failed:', error.message);
      if (error.response) {
        console.error('   Backend Error:', error.response.data);
      }
    }
  }

  console.log('\n🎉 Example completed!');
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

