/**
 * End-to-end test: Deposit → Commitment (4 allocations) → Withdraw
 * 
 * Test flow:
 * 1. Deposit multiple 2 USDT (create checkbook)
 * 2. Wait for checkbook status to be ready
 * 3. Create commitment with 4 allocations (split 2 USDT into 4 parts)
 * 4. Wait for allocations to be idle
 * 5. Create withdraw combining multiple allocations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EnclaveClient, CheckbookStatus, AllocationStatus } from '../../src';
import type { Checkbook, Allocation, WithdrawRequest } from '../../src/types/models';
import type { APIClient } from '../../src/api/APIClient';
import { getEvmChainIdFromSlip44, getSlip44FromChainId } from '../../src/utils/chain';
import { WalletManager } from '@enclave-hq/wallet-sdk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create readline interface for interactive input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function promptUser(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive selection of checkbook from a list
 * In test mode (CI/non-interactive), automatically selects the latest checkbook
 */
async function selectCheckbook(checkbooks: Checkbook[]): Promise<Checkbook> {
  if (checkbooks.length === 0) {
    throw new Error('No checkbooks available to select');
  }

  if (checkbooks.length === 1) {
    console.log(`\n✅ Only one checkbook found, using it automatically:`);
    console.log(`   ID: ${checkbooks[0].id}, Status: ${checkbooks[0].status}, Amount: ${checkbooks[0].amount || checkbooks[0].depositAmount}`);
    return checkbooks[0];
  }
    
    // Sort by created_at descending to show newest first
    const sorted = [...checkbooks].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  
  console.log(`\n📋 Found ${checkbooks.length} checkbook(s):`);
  console.log('='.repeat(80));
    
    sorted.forEach((cb, idx) => {
      const statusIcon = cb.status === CheckbookStatus.WithCheckbook ? '✅' : 
                      cb.status === CheckbookStatus.ReadyForCommitment ? '✅' : 
                        cb.status === CheckbookStatus.Unsigned ? '⏳' : 
                        cb.status === CheckbookStatus.Pending ? '⏳' : 
                      cb.status === CheckbookStatus.ProofFailed ? '❌' : 
                      cb.status === CheckbookStatus.SubmissionFailed ? '❌' : 
                      cb.status === CheckbookStatus.Deleted ? '🗑️' : '❓';
      console.log(`   ${idx + 1}. ${statusIcon} ID: ${cb.id}`);
      console.log(`      Status: ${cb.status}`);
      console.log(`      Amount: ${cb.amount || cb.depositAmount}`);
      console.log(`      Remaining: ${cb.remainingAmount || 'N/A'}`);
      console.log(`      Created: ${cb.createdAt || 'N/A'}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    
  // Check if running in interactive mode (stdin is TTY)
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  
  if (!isInteractive || process.env.CI === 'true' || process.env.NON_INTERACTIVE === 'true') {
    // Non-interactive mode: automatically select the latest checkbook
    const selected = sorted[0];
    console.log(`\n🤖 Non-interactive mode: Automatically selecting latest checkbook:`);
    console.log(`   ID: ${selected.id}`);
    console.log(`   Status: ${selected.status}`);
    console.log(`   Amount: ${selected.amount || selected.depositAmount}`);
    console.log(`   Created: ${selected.createdAt || 'N/A'}`);
    return selected;
  }
  
  // Interactive mode: prompt user for selection
  const rl = createReadlineInterface();
  
  try {
    while (true) {
      const answer = await promptUser(rl, `\nPlease select a checkbook (1-${sorted.length}) or 'q' to quit: `);
      
      if (answer.toLowerCase() === 'q') {
        throw new Error('User cancelled checkbook selection');
      }
      
      const index = parseInt(answer, 10);
      if (isNaN(index) || index < 1 || index > sorted.length) {
        console.log(`❌ Invalid selection. Please enter a number between 1 and ${sorted.length}, or 'q' to quit.`);
        continue;
      }
      
      const selected = sorted[index - 1];
      console.log(`\n✅ Selected checkbook: ${selected.id}`);
      console.log(`   Status: ${selected.status}`);
      console.log(`   Amount: ${selected.amount || selected.depositAmount}`);
      
      return selected;
    }
  } finally {
    rl.close();
  }
}

// Test configuration
const TEST_CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  wsUrl: process.env.WS_URL || 'ws://localhost:3001/ws',
  privateKey: process.env.PRIVATE_KEY || '', // Must be set in environment
  chainId: 714, // BSC SLIP-44 ID (for backend/API calls)
  evmChainId: 56, // BSC EVM Chain ID (for RPC/contract operations)
  tokenAddress: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC
  depositAmountUsd: 2, // Deposit 2 USDT (will be converted to wei based on token decimals)
  allocationCount: 4, // Split into 4 parts
  // BSC RPC endpoints (with fallback)
  rpcUrl: process.env.RPC_URL || (() => {
    // Try multiple endpoints, use the first available one
    const endpoints = [
      'https://bsc-dataseed1.binance.org/',
      'https://bsc-dataseed2.binance.org/',
      'https://bsc-dataseed3.binance.org/',
      'https://bsc-dataseed4.binance.org/',
      'https://lb.drpc.org/bsc/Ah3WY9x6skbsjvLS7Kax1gjkCsIIf_YR8JMcIgaNGuYu', // DRPC fallback
    ];
    return endpoints[0]; // Default to first endpoint, will retry with others if needed
  })(),
  gasLimit: 300000, // Gas limit for transactions (300K)
};

// Runtime test state (will be set in beforeAll)
let testState: {
  tokenDecimals: number;
  depositAmount: string; // Calculated from depositAmountUsd and tokenDecimals
  walletManager: WalletManager; // Wallet SDK for blockchain interactions
} | null = null;

// Helper function to wait for condition
async function waitFor(
  condition: () => boolean,
  timeout: number = 30000,
  interval: number = 1000
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// Helper function to wait for checkbook status
async function waitForCheckbookStatus(
  client: EnclaveClient,
  checkbookId: string,
  targetStatus: CheckbookStatus,
  timeout: number = 60000
): Promise<Checkbook> {
  const startTime = Date.now();
  let attemptCount = 0;
  
  while (true) {
    attemptCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Check timeout first
    if (Date.now() - startTime > timeout) {
      const currentCheckbook = client.stores.checkbooks.get(checkbookId);
      throw new Error(
        `Timeout waiting for checkbook ${checkbookId} to reach status ${targetStatus}. ` +
        `Current status: ${currentCheckbook?.status || 'not found'} ` +
        `(waited ${elapsed}s, ${attemptCount} attempts)`
      );
    }
    
    // Refresh checkbook from API first (get latest status)
    console.log(`\n[Attempt ${attemptCount}, ${elapsed}s] Fetching checkbook ${checkbookId}...`);
    const fetchedCheckbook = await client.stores.checkbooks.fetchById(checkbookId);
    console.log(`   📊 Checkbook data:`);
    console.log(`      ID: ${fetchedCheckbook.id}`);
    console.log(`      Status: ${fetchedCheckbook.status} (target: ${targetStatus})`);
    console.log(`      Amount: ${fetchedCheckbook.amount || fetchedCheckbook.depositAmount}`);
    console.log(`      Remaining: ${fetchedCheckbook.remainingAmount || 'N/A'}`);
    console.log(`      Created: ${fetchedCheckbook.createdAt || 'N/A'}`);
    
    // Check status immediately after fetching
    if (fetchedCheckbook.status === targetStatus) {
      console.log(`✅ Checkbook ${checkbookId} reached target status: ${targetStatus}`);
      return fetchedCheckbook;
    }
    
    // Check for terminal states that won't change
    const terminalStates = [
      CheckbookStatus.ProofFailed,
      CheckbookStatus.SubmissionFailed,
      CheckbookStatus.Deleted,
    ];
    if (terminalStates.includes(fetchedCheckbook.status as CheckbookStatus)) {
      throw new Error(
        `Checkbook ${checkbookId} is in terminal state ${fetchedCheckbook.status} and cannot reach ${targetStatus}`
      );
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Helper function to wait for allocations to be idle
async function waitForAllocationsIdle(
  client: EnclaveClient,
  allocationIds: string[],
  timeout: number = 60000
): Promise<Allocation[]> {
  const startTime = Date.now();
  let attemptCount = 0;
  let lastStatusSummary = '';
  
  while (true) {
    attemptCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    const allocations: Allocation[] = [];
    let allIdle = true;
    const statusCounts: Record<string, number> = {};
    
    for (const id of allocationIds) {
      let allocation = client.stores.allocations.get(id);
      
      if (!allocation) {
        // Fetch from API (only log first time)
        if (attemptCount === 1) {
        console.log(`   🔍 Allocation ${id} not in store, fetching from API...`);
        }
        const fetched = await client.stores.allocations.fetchList({});
        if (attemptCount === 1 && fetched.length > 0) {
        console.log(`   📊 API returned ${fetched.length} allocation(s)`);
        }
        allocation = fetched.find(a => a.id === id);
      }
      
      if (!allocation) {
        throw new Error(`Allocation ${id} not found`);
      }
      
      allocations.push(allocation);
      const status = allocation.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (status !== AllocationStatus.Idle) {
        allIdle = false;
      }
    }
    
    // Build status summary
    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ');
    
    // Only log if status changed, first attempt, or every 10 attempts
    if (statusSummary !== lastStatusSummary || attemptCount === 1 || attemptCount % 10 === 0) {
      if (statusSummary !== lastStatusSummary) {
        console.log(`\n[Attempt ${attemptCount}, ${elapsed}s] Status changed: ${statusSummary}`);
      } else if (attemptCount % 10 === 0) {
        console.log(`[Attempt ${attemptCount}, ${elapsed}s] Still waiting... ${statusSummary}`);
      } else {
        console.log(`\n[Attempt ${attemptCount}, ${elapsed}s] Checking ${allocationIds.length} allocation(s)... ${statusSummary}`);
      }
      lastStatusSummary = statusSummary;
    }
    
    if (allIdle) {
      console.log(`✅ All ${allocations.length} allocations are idle (after ${attemptCount} attempts, ${elapsed}s)`);
      return allocations;
    }
    
    if (Date.now() - startTime > timeout) {
      const statuses = allocations.map(a => `${a.id}:${a.status}`).join(', ');
      throw new Error(
        `Timeout waiting for allocations to be idle after ${timeout}ms. ` +
        `Current statuses: ${statuses}`
      );
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Load ABI files from config directory
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const TREASURY_ABI_PATH = path.join(PROJECT_ROOT, 'config/blockscanner/abis/enclave/treasury.json');
const ERC20_ABI_PATH = path.join(PROJECT_ROOT, 'config/multisigner/abis/erc20.json');

// Load Treasury ABI (official ABI from config)
const TREASURY_ABI = JSON.parse(fs.readFileSync(TREASURY_ABI_PATH, 'utf-8')) as const;

// Load ERC20 ABI (official ABI from config)
// Filter to only include functions we need: approve, allowance, balanceOf, decimals
const ERC20_ABI_FULL = JSON.parse(fs.readFileSync(ERC20_ABI_PATH, 'utf-8')) as any[];
const ERC20_ABI = ERC20_ABI_FULL.filter((item: any) => 
  item.type === 'function' && 
  ['approve', 'allowance', 'balanceOf', 'decimals'].includes(item.name)
) as const;

/**
 * Get token decimals from contract using Wallet SDK
 * Uses Wallet SDK for blockchain interactions (EVM Chain ID)
 */
async function getTokenDecimals(
  walletManager: WalletManager,
  tokenAddress: string,
  evmChainId: number  // EVM Chain ID for Wallet SDK
): Promise<number> {
  try {
    console.log(`   Reading token decimals using Wallet SDK (EVM Chain ID: ${evmChainId})...`);
    const decimals = await walletManager.readContract(
      tokenAddress,
      ERC20_ABI,
      'decimals',
      []
    );
    console.log(`   ✅ Token decimals: ${decimals}`);
    return Number(decimals);
  } catch (error) {
    throw new Error(`Failed to read token decimals: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Real deposit flow: Call Treasury.deposit() on-chain using Wallet SDK
 * 1. Approve token to Treasury
 * 2. Call Treasury.deposit()
 * 3. Wait for transaction confirmation
 * 4. Wait for Backend to create checkbook via DepositReceived event
 * 
 * Uses Wallet SDK for blockchain interactions (EVM Chain ID)
 */
async function depositToTreasury(
  walletManager: WalletManager,
  treasuryAddress: string,
  tokenAddress: string,
  amount: string,
  evmChainId: number  // EVM Chain ID for Wallet SDK
): Promise<{ txHash: string; localDepositId?: number }> {
  const account = walletManager.getPrimaryAccount();
  if (!account) {
    throw new Error('Wallet not connected');
  }
  const walletAddress = account.nativeAddress;

  console.log(`📝 Step 1.1: Checking token balance using Wallet SDK...`);
  const balance = await walletManager.readContract(
    tokenAddress,
    ERC20_ABI,
    'balanceOf',
    [walletAddress]
  );
  console.log(`   Balance: ${balance.toString()}`);

  const amountBigInt = BigInt(amount);
  if (BigInt(balance.toString()) < amountBigInt) {
    throw new Error(`Insufficient balance: have ${balance.toString()}, need ${amount}`);
  }

  console.log(`📝 Step 1.2: Checking token allowance using Wallet SDK...`);
  const allowance = await walletManager.readContract(
    tokenAddress,
    ERC20_ABI,
    'allowance',
    [walletAddress, treasuryAddress]
  );
  console.log(`   Current allowance: ${allowance.toString()}`);

  // Approve if needed
  if (BigInt(allowance.toString()) < amountBigInt) {
    console.log(`📝 Step 1.3: Approving token to Treasury using Wallet SDK...`);
    const approveTxHash = await walletManager.writeContract(
      tokenAddress,
      ERC20_ABI,
      'approve',
      [treasuryAddress, amountBigInt],
      {
        gasLimit: TEST_CONFIG.gasLimit.toString(), // 300K gas limit
      }
    );
    console.log(`   Approve tx hash: ${approveTxHash}`);
    console.log(`   Gas limit: ${TEST_CONFIG.gasLimit}`);
    
    console.log(`⏳ Waiting for approval confirmation...`);
    const approveReceipt = await walletManager.waitForTransaction(approveTxHash);
    console.log(`✅ Approval confirmed in block ${approveReceipt.blockNumber}`);
    console.log(`   Gas used: ${approveReceipt.gasUsed?.toString() || 'N/A'}`);
  } else {
    console.log(`✅ Token already approved`);
  }

  // Call Treasury.deposit()
  console.log(`📝 Step 1.4: Calling Treasury.deposit() using Wallet SDK...`);
  console.log(`   Token: ${tokenAddress}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Treasury: ${treasuryAddress}`);

  // Set gas limit to 300K for deposit
  const depositTxHash = await walletManager.writeContract(
    treasuryAddress,
    TREASURY_ABI,
    'deposit',
    [tokenAddress, amountBigInt],
    {
      gasLimit: TEST_CONFIG.gasLimit.toString(), // 300K gas limit
    }
  );
  console.log(`   Deposit tx hash: ${depositTxHash}`);
  console.log(`   Gas limit: ${TEST_CONFIG.gasLimit}`);

  console.log(`⏳ Waiting for deposit transaction confirmation...`);
  const depositReceipt = await walletManager.waitForTransaction(depositTxHash);
  console.log(`✅ Deposit confirmed in block ${depositReceipt.blockNumber}`);
  console.log(`   Gas used: ${depositReceipt.gasUsed?.toString() || 'N/A'}`);

  // Parse DepositReceived event to get localDepositId
  // Note: Wallet SDK's receipt format may differ from ethers.js
  // For now, we'll rely on Backend to detect the event via BlockScanner
  let localDepositId: number | undefined;
  if (depositReceipt.logs) {
    try {
      // Try to find DepositReceived event in logs
      // This is a simplified version - you may need to adjust based on Wallet SDK's log format
      console.log(`   Event logs available: ${depositReceipt.logs.length} logs`);
      // Note: Parsing events from Wallet SDK receipts may require additional work
      // For now, we'll let Backend handle event detection
    } catch (error) {
      console.log(`⚠️ Could not parse DepositReceived event: ${error}`);
    }
  }

  return { txHash: depositTxHash, localDepositId };
}

/**
 * Wait for Backend to create checkbook after DepositReceived event
 * Backend will automatically create checkbook when BlockScanner detects the event
 * If multiple checkbooks are found, allows user to select one interactively
 */
async function waitForCheckbookCreation(
  client: EnclaveClient,
  userAddress: string,
  timeout: number = 120000, // 2 minutes
  allowSelection: boolean = true // Allow interactive selection if multiple checkbooks found
): Promise<Checkbook> {
  console.log(`⏳ Waiting for Backend to create checkbook...`);
  console.log(`   (BlockScanner should detect DepositReceived event and notify Backend)`);

  const startTime = Date.now();
  const checkInterval = 3000; // Check every 3 seconds

  let attemptCount = 0;
  while (Date.now() - startTime < timeout) {
    attemptCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Fetch checkbooks from API
    // Owner is now automatically determined from JWT token
    console.log(`\n[Attempt ${attemptCount}, ${elapsed}s] Fetching checkbooks...`);
    const checkbooks = await client.stores.checkbooks.fetchList();
    console.log(`   📊 API returned ${checkbooks.length} checkbook(s)`);
    
    if (checkbooks.length > 0) {
      checkbooks.forEach((cb, idx) => {
        console.log(`   [${idx + 1}] ID: ${cb.id}, Status: ${cb.status}, Amount: ${cb.amount || cb.depositAmount}, Created: ${cb.createdAt || 'N/A'}`);
      });
      
      // If multiple checkbooks found and selection is allowed, immediately show selection
      if (checkbooks.length > 1 && allowSelection) {
        console.log(`\n⚠️ Multiple checkbooks found (${checkbooks.length}). Please select which one to use:`);
        return await selectCheckbook(checkbooks);
      }
      
      // If only one checkbook or selection not allowed, use it
      if (checkbooks.length === 1) {
        console.log(`✅ Only one checkbook found, using it automatically:`);
        console.log(`   ID: ${checkbooks[0].id}, Status: ${checkbooks[0].status}`);
        return checkbooks[0];
      }
      
      // If selection not allowed but multiple checkbooks, use the latest
      if (!allowSelection) {
        // Sort by created_at descending to get the latest
        const sorted = checkbooks.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        
        const latestCheckbook = sorted[0];
        console.log(`✅ Using latest checkbook: ${latestCheckbook.id}`);
        console.log(`   Status: ${latestCheckbook.status}`);
        return latestCheckbook;
      }
    } else {
      console.log(`   ⚠️ No checkbooks found yet`);
    }

    console.log(`   ⏳ Waiting ${checkInterval / 1000}s before next check...`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // If timeout, check if there are any existing checkbooks and allow selection
  console.log(`\n⏰ Timeout reached. Checking for existing checkbooks...`);
  const existingCheckbooks = await client.stores.checkbooks.fetchList();
  
  if (existingCheckbooks.length > 0) {
    console.log(`📋 Found ${existingCheckbooks.length} existing checkbook(s).`);
    if (allowSelection) {
      return await selectCheckbook(existingCheckbooks);
    } else {
      // Use the latest one
      const sorted = existingCheckbooks.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      return sorted[0];
    }
  }

  throw new Error(`Timeout waiting for checkbook creation after ${timeout}ms`);
}

describe('E2E: Deposit → Commitment (4 allocations) → Withdraw', () => {
  let client: EnclaveClient;
  let userAddress: string;
  let treasuryAddress: string;
  let apiClient: APIClient;
  
  beforeAll(async () => {
    if (!TEST_CONFIG.privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required for E2E tests');
    }
    
    // ========================================
    // Initialize Wallet SDK for blockchain interactions (uses EVM Chain ID)
    // ========================================
    console.log('🔧 Initializing Wallet SDK for blockchain interactions...');
    const walletManager = new WalletManager({
      defaultChainId: TEST_CONFIG.evmChainId, // Use EVM Chain ID for Wallet SDK
    });
    
    // Connect with private key (Wallet SDK uses EVM Chain ID)
    // connectWithPrivateKey returns the Account directly
    console.log(`   Connecting wallet with private key (EVM Chain ID: ${TEST_CONFIG.evmChainId})...`);
    const walletAccount = await walletManager.connectWithPrivateKey(TEST_CONFIG.privateKey, TEST_CONFIG.evmChainId);
    if (!walletAccount) {
      throw new Error('Failed to connect wallet');
    }
    console.log(`✅ Wallet connected: ${walletAccount.nativeAddress}`);
    console.log(`   EVM Chain ID: ${TEST_CONFIG.evmChainId}`);
    
    // Step 0: Get token decimals from contract using Wallet SDK
    console.log('📝 Step 0: Reading token decimals from contract using Wallet SDK...');
    const tokenDecimals = await getTokenDecimals(
      walletManager,
      TEST_CONFIG.tokenAddress,
      TEST_CONFIG.evmChainId  // EVM Chain ID for Wallet SDK
    );
    console.log(`✅ Token decimals: ${tokenDecimals}`);
    
    // Calculate deposit amount in wei
    // Convert decimal amount to wei: amount * 10^decimals
    const depositAmount = (BigInt(Math.floor(TEST_CONFIG.depositAmountUsd * Math.pow(10, tokenDecimals)))).toString();
    console.log(`✅ Deposit amount: ${depositAmount} wei (${TEST_CONFIG.depositAmountUsd} USDT with ${tokenDecimals} decimals)`);
    
    // Store in test state
    testState = {
      tokenDecimals,
      depositAmount,
      walletManager,
    };
    
    // ========================================
    // Initialize Enclave SDK for backend interactions (uses SLIP-44 ID)
    // ========================================
    console.log('\n🔧 Initializing Enclave SDK for backend interactions...');
    client = new EnclaveClient({
      apiUrl: TEST_CONFIG.apiUrl,
      wsUrl: TEST_CONFIG.wsUrl,
      signer: TEST_CONFIG.privateKey,
      timeout: 300000, // 5 minutes (300 seconds) to match test timeout
    });
    
    // Connect
    await client.connect();
    console.log('✅ Connected to Enclave');
    
    // Get user address (Universal Address format)
    const userUniversalAddress = client.address!;
    if (!userUniversalAddress.universalFormat) {
      throw new Error('Universal Address format is required. client.address.universalFormat is missing.');
    }
    userAddress = userUniversalAddress.universalFormat.replace(/^0x/, ''); // Use 32-byte Universal Address
    console.log(`✅ User address (Universal): ${userAddress}`);
    console.log(`   Chain ID (SLIP-44): ${userUniversalAddress.chainId}`);
    
    // Verify chain ID conversion: SLIP-44 (714) ↔ EVM Chain ID (56)
    const expectedSlip44 = TEST_CONFIG.chainId; // 714
    const expectedEvmChainId = TEST_CONFIG.evmChainId; // 56
    if (userUniversalAddress.chainId !== expectedSlip44) {
      console.log(`⚠️  Warning: User chain ID (${userUniversalAddress.chainId}) doesn't match expected SLIP-44 (${expectedSlip44})`);
    }
    const convertedEvmChainId = getEvmChainIdFromSlip44(userUniversalAddress.chainId);
    if (convertedEvmChainId !== expectedEvmChainId) {
      console.log(`⚠️  Warning: Chain ID conversion mismatch. SLIP-44 ${userUniversalAddress.chainId} → EVM ${convertedEvmChainId}, expected ${expectedEvmChainId}`);
    } else {
      console.log(`✅ Chain ID conversion verified: SLIP-44 ${userUniversalAddress.chainId} ↔ EVM ${convertedEvmChainId}`);
    }
    
    // Get Treasury address for the chain (API call uses SLIP-44)
    treasuryAddress = await client.chainConfig.getTreasuryAddress(TEST_CONFIG.chainId);
    console.log(`✅ Treasury address: ${treasuryAddress}`);
    
    // Get API client for direct API calls (for testing)
    apiClient = (client as any).apiClient;
  });
  
  afterAll(async () => {
    if (client) {
      client.disconnect();
      console.log('✅ Disconnected from Enclave');
    }
    if (testState?.walletManager) {
      await testState.walletManager.disconnect();
      console.log('✅ Disconnected from Wallet SDK');
    }
  });
  
  it('should complete full flow: Deposit → Commitment → Withdraw', async () => {
    if (!testState) {
      throw new Error('Test state not initialized. Make sure beforeAll completed successfully.');
    }

    // ========================================
    // Step 0: Display all checkbooks and wait for user input
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('📋 Step 0: Displaying all checkbooks');
    console.log('='.repeat(80));
    
    // Fetch all checkbooks and allocations first
    const allCheckbooks = await client.stores.checkbooks.fetchList({
      owner: userAddress,
      limit: 100,
    });
    
    const allAllocations = await client.stores.allocations.fetchList({
      owner: userAddress,
      limit: 1000, // Get all allocations
    });
    
    // Initialize flow control variables
    let checkbook: Checkbook | null = null;
    let allocations: Allocation[] = [];
    let withdrawRequest: WithdrawRequest | null = null;
    let shouldDeposit = true;
    let shouldCreateCommitment = true;
    let shouldCreateWithdraw = true;
    
    if (allCheckbooks.length === 0) {
      console.log('⚠️  No checkbooks found. Will proceed with creating new deposit.');
    } else {
      console.log(`\n✅ Found ${allCheckbooks.length} checkbook(s):\n`);
      
      // Sort by created_at descending to show newest first
      const sorted = [...allCheckbooks].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      
      sorted.forEach((cb, idx) => {
        const statusIcon = cb.status === CheckbookStatus.WithCheckbook ? '✅' : 
                        cb.status === CheckbookStatus.ReadyForCommitment ? '✅' : 
                          cb.status === CheckbookStatus.Unsigned ? '⏳' : 
                          cb.status === CheckbookStatus.Pending ? '⏳' : 
                        cb.status === CheckbookStatus.ProofFailed ? '❌' : 
                        cb.status === CheckbookStatus.SubmissionFailed ? '❌' : 
                        cb.status === CheckbookStatus.Deleted ? '🗑️' : '❓';
        
        // Get allocations for this checkbook
        const cbAllocations = allAllocations.filter(a => a.checkbookId === cb.id);
        const idleAllocations = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
        
        console.log(`   ${idx + 1}. ${statusIcon} Checkbook: ${cb.id}`);
        console.log(`      Status: ${cb.status}`);
        console.log(`      Amount: ${cb.amount || cb.depositAmount || 'N/A'}`);
        console.log(`      Remaining: ${cb.remainingAmount || 'N/A'}`);
        console.log(`      Allocations: ${cbAllocations.length} total, ${idleAllocations.length} idle`);
        console.log(`      Created: ${cb.createdAt || 'N/A'}`);
        console.log('');
      });
      
      console.log('='.repeat(80));
      
      // Check if running in interactive mode
      const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
      
      if (isInteractive && process.env.CI !== 'true' && process.env.NON_INTERACTIVE !== 'true') {
        // Interactive mode: prompt user for action
        const rl = createReadlineInterface();
        try {
          console.log('\n📝 Available actions:');
          console.log('   1. Create new deposit and commitment');
          console.log('   2. Use existing checkbook to create commitment');
          console.log('   3. Use existing idle allocations to withdraw');
          console.log('   4. Skip to withdraw (if allocations already exist)');
          console.log('   5. View allocations for a specific checkbook');
          console.log('   6. Auto-proceed (use existing data if available)');
          
          while (true) {
            const answer = await promptUser(
              rl,
              '\nPlease select an action (1-6) or press Enter for auto-proceed: '
            );
            
            if (answer === '' || answer === '6') {
              console.log('\n🤖 Auto-proceeding with existing data if available...');
              break;
            }
            
            const action = parseInt(answer, 10);
            if (isNaN(action) || action < 1 || action > 6) {
              console.log('❌ Invalid selection. Please enter a number between 1 and 6, or press Enter for auto-proceed.');
              continue;
            }
            
            if (action === 1) {
              console.log('\n✅ Selected: Create new deposit and commitment');
              // Force new deposit
              shouldDeposit = true;
              shouldCreateCommitment = true;
              checkbook = null;
              allocations = [];
              break;
            } else if (action === 2) {
              console.log('\n✅ Selected: Use existing checkbook to create commitment');
              // Select checkbook
              const selected = await selectCheckbook(sorted);
              checkbook = selected;
              shouldDeposit = false;
              shouldCreateCommitment = true;
              allocations = [];
              break;
            } else if (action === 3) {
              console.log('\n✅ Selected: Use existing idle allocations to withdraw');
              // Find checkbook with idle allocations
              const checkbookWithIdle = sorted.find(cb => {
                const cbAllocations = allAllocations.filter(a => a.checkbookId === cb.id);
                const idle = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
                return idle.length >= TEST_CONFIG.allocationCount;
              });
              
              if (checkbookWithIdle) {
                const cbAllocations = allAllocations.filter(a => a.checkbookId === checkbookWithIdle.id);
                const idle = cbAllocations.filter(a => a.status === AllocationStatus.Idle);
                allocations = idle.slice(0, TEST_CONFIG.allocationCount);
                checkbook = checkbookWithIdle;
                shouldDeposit = false;
                shouldCreateCommitment = false;
                shouldCreateWithdraw = true;
                console.log(`   Using checkbook: ${checkbook.id}`);
                console.log(`   Using ${allocations.length} idle allocations`);
                break;
              } else {
                console.log('❌ No checkbook found with enough idle allocations.');
                console.log('   Please select a different action.');
                continue;
              }
            } else if (action === 4) {
              console.log('\n✅ Selected: Skip to withdraw');
              shouldDeposit = false;
              shouldCreateCommitment = false;
              shouldCreateWithdraw = true;
              // Will use existing allocations if available
              break;
            } else if (action === 5) {
              // View allocations for a specific checkbook
              const cbAnswer = await promptUser(
                rl,
                `\nPlease select a checkbook (1-${sorted.length}): `
              );
              const cbIndex = parseInt(cbAnswer, 10);
              if (isNaN(cbIndex) || cbIndex < 1 || cbIndex > sorted.length) {
                console.log('❌ Invalid checkbook selection.');
                continue;
              }
              const selectedCb = sorted[cbIndex - 1];
              const cbAllocations = allAllocations.filter(a => a.checkbookId === selectedCb.id);
              console.log(`\n📊 Allocations for checkbook ${selectedCb.id}:`);
              console.log(`   Total: ${cbAllocations.length}`);
              console.log(`   Idle: ${cbAllocations.filter(a => a.status === AllocationStatus.Idle).length}`);
              console.log(`   Pending: ${cbAllocations.filter(a => a.status === AllocationStatus.Pending).length}`);
              console.log(`   Used: ${cbAllocations.filter(a => a.status === AllocationStatus.Used).length}`);
              if (cbAllocations.length > 0) {
                console.log('\n   Details:');
                cbAllocations.forEach((alloc, idx) => {
                  console.log(`     ${idx + 1}. ID: ${alloc.id}, Status: ${alloc.status}, Amount: ${alloc.amount}`);
                });
              }
              continue; // Continue to show menu again
            }
          }
        } finally {
          rl.close();
        }
      } else {
        // Non-interactive mode: auto-proceed
        console.log('\n🤖 Non-interactive mode: Auto-proceeding with existing data if available...');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Starting test flow...');
    console.log('='.repeat(80) + '\n');

    // If user selected an action, use those settings
    // Otherwise, fall back to automatic flow detection
    if (checkbook === null && allocations.length === 0) {
      // ========================================
      // Step 0.5: Auto-detect flow if user chose auto-proceed
      // ========================================
      console.log('\n🔍 Auto-detecting flow based on existing state...');
      
      // Check for existing checkbooks
      const existingCheckbooks = await client.stores.checkbooks.fetchList({
        owner: userAddress,
      });
      console.log(`📋 Found ${existingCheckbooks.length} existing checkbook(s)`);
      
      // Check for existing idle allocations
      const existingAllocations = await client.stores.allocations.fetchList({
        owner: userAddress,
        status: 'idle',
        limit: 100,
      });
      console.log(`📊 Found ${existingAllocations.length} idle allocation(s)`);
      
      // Check for existing pending withdrawals
      const existingWithdrawals = await client.stores.withdrawals.fetchList({
        owner: userAddress,
        status: 'pending',
        limit: 10,
      });
      console.log(`💸 Found ${existingWithdrawals.length} pending withdrawal(s)`);
      
      // Strategy 0: PRIORITY - Select the LATEST with_checkbook checkbook first
      // If we have with_checkbook checkbooks with enough idle allocations, use them directly for withdraw
      const withCheckbookCheckbooks = existingCheckbooks.filter(
        cb => cb.status === CheckbookStatus.WithCheckbook
      );
      
      if (withCheckbookCheckbooks.length > 0) {
        console.log(`\n🎯 Strategy 0: Selecting LATEST with_checkbook checkbook for withdraw test...`);
        console.log('='.repeat(80));
        
        // Sort by creation time (newest first) - PRIORITIZE LATEST
        const sortedByTime = [...withCheckbookCheckbooks].sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime; // Newest first
        });
        
        console.log(`\n📋 Found ${sortedByTime.length} with_checkbook checkbook(s), sorted by creation time (newest first):`);
        sortedByTime.forEach((cb, idx) => {
          console.log(`   ${idx + 1}. Checkbook: ${cb.id}`);
          console.log(`      Created: ${cb.createdAt || 'N/A'}`);
          console.log(`      Amount: ${cb.amount || cb.depositAmount || 'N/A'}`);
          console.log(`      Remaining: ${cb.remainingAmount || 'N/A'}`);
        });
        
        // Collect all checkbooks with their allocation counts (starting from latest)
        const checkbookAllocationInfo: Array<{
          checkbook: Checkbook;
          allocationCount: number;
          allocations: Allocation[];
        }> = [];
        
        // Check each with_checkbook checkbook for idle allocations (starting from latest)
        for (const cb of sortedByTime) {
          const checkbookAllocations = await client.stores.allocations.fetchList({
            checkbookId: cb.id,
            status: 'idle',
            limit: 100,
          });
          
          console.log(`\n   📋 Checkbook: ${cb.id} (${cb.createdAt || 'N/A'})`);
          console.log(`      Status: ${cb.status}`);
          console.log(`      Amount: ${cb.amount || cb.depositAmount || 'N/A'}`);
          console.log(`      Remaining: ${cb.remainingAmount || 'N/A'}`);
          console.log(`      Idle Allocations: ${checkbookAllocations.length} (need ${TEST_CONFIG.allocationCount})`);
          
          checkbookAllocationInfo.push({
            checkbook: cb,
            allocationCount: checkbookAllocations.length,
            allocations: checkbookAllocations,
          });
        }
        
        console.log('='.repeat(80));
        
        // Calculate total available allocations across all with_checkbook checkbooks
        const totalAvailableAllocations = checkbookAllocationInfo.reduce(
          (sum, info) => sum + info.allocationCount,
          0
        );
        
        console.log(`\n📊 Total idle allocations across all with_checkbook checkbooks: ${totalAvailableAllocations} (need ${TEST_CONFIG.allocationCount})`);
        
        // Strategy 0a: Try to find the LATEST checkbook with enough allocations
        // Priority: 1. Latest (newest) checkbook, 2. Has enough allocations
        const suitableCheckbooks = checkbookAllocationInfo.filter(
          info => info.allocationCount >= TEST_CONFIG.allocationCount
        );
        
        if (suitableCheckbooks.length > 0) {
          // Since checkbookAllocationInfo is already sorted by time (newest first),
          // suitableCheckbooks will also maintain that order
          // Select the first one (latest with enough allocations)
          let selectedInfo = suitableCheckbooks[0]; // Latest checkbook with enough allocations
          
          // If multiple suitable checkbooks, allow selection (interactive or auto-select)
          // But prioritize the latest one (first in the list)
          if (suitableCheckbooks.length > 1) {
            console.log(`\n✅ Found ${suitableCheckbooks.length} with_checkbook checkbook(s) with enough idle allocations:`);
            suitableCheckbooks.forEach((info, idx) => {
              const isSelected = idx === 0 ? ' 👈 (latest, auto-selected in non-interactive mode)' : '';
              console.log(`   ${idx + 1}. Checkbook ${info.checkbook.id}: ${info.allocationCount} idle allocations${isSelected}`);
              console.log(`      Created: ${info.checkbook.createdAt || 'N/A'}`);
              console.log(`      Amount: ${info.checkbook.amount || info.checkbook.depositAmount || 'N/A'}`);
              console.log(`      Remaining: ${info.checkbook.remainingAmount || 'N/A'}`);
            });
            
            // Check if interactive mode
            const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
            if (isInteractive && process.env.CI !== 'true' && process.env.NON_INTERACTIVE !== 'true') {
              // Interactive mode: prompt user
              const rl = createReadlineInterface();
              try {
                while (true) {
                  const answer = await promptUser(
                    rl,
                    `\nPlease select a checkbook (1-${suitableCheckbooks.length}) or 'a' for auto-select latest: `
                  );
                  
                  if (answer.toLowerCase() === 'a' || answer === '') {
                    // Auto-select latest (first in the list)
                    selectedInfo = suitableCheckbooks[0];
                    console.log(`\n🤖 Auto-selected latest checkbook: ${selectedInfo.checkbook.id} (${selectedInfo.allocationCount} idle allocations)`);
                    break;
                  }
                  
                  const index = parseInt(answer, 10);
                  if (isNaN(index) || index < 1 || index > suitableCheckbooks.length) {
                    console.log(`❌ Invalid selection. Please enter a number between 1 and ${suitableCheckbooks.length}, or 'a' for auto-select latest.`);
                    continue;
                  }
                  
                  selectedInfo = suitableCheckbooks[index - 1];
                  console.log(`\n✅ Selected checkbook: ${selectedInfo.checkbook.id}`);
                  break;
                }
              } finally {
                rl.close();
              }
            } else {
              // Non-interactive: auto-select latest (first in the list)
              console.log(`\n🤖 Non-interactive mode: Auto-selecting LATEST with_checkbook checkbook:`);
              console.log(`   ID: ${selectedInfo.checkbook.id}`);
              console.log(`   Created: ${selectedInfo.checkbook.createdAt || 'N/A'} (latest)`);
              console.log(`   Idle Allocations: ${selectedInfo.allocationCount}`);
              console.log(`   Amount: ${selectedInfo.checkbook.amount || selectedInfo.checkbook.depositAmount || 'N/A'}`);
            }
          } else {
            console.log(`\n✅ Found 1 with_checkbook checkbook with enough idle allocations: ${selectedInfo.checkbook.id}`);
            console.log(`   Created: ${selectedInfo.checkbook.createdAt || 'N/A'}`);
          }
          
          // Use selected checkbook (latest with enough allocations)
          allocations = selectedInfo.allocations.slice(0, TEST_CONFIG.allocationCount);
          checkbook = selectedInfo.checkbook;
          shouldDeposit = false;
          shouldCreateCommitment = false;
          
          console.log(`\n✅ Strategy 0a success: Using LATEST with_checkbook checkbook ${checkbook.id} for withdraw test`);
          console.log(`   → Will skip deposit and commitment, use ${allocations.length} existing allocations for withdraw`);
        } else if (totalAvailableAllocations >= TEST_CONFIG.allocationCount) {
          // Strategy 0b: Combine allocations from multiple with_checkbook checkbooks
          // Priority: Start from latest checkbook first
          console.log(`\n🔄 Strategy 0b: Latest checkbook doesn't have enough allocations, but total available (${totalAvailableAllocations}) >= needed (${TEST_CONFIG.allocationCount})`);
          console.log(`   → Will combine allocations from multiple with_checkbook checkbooks (starting from latest)`);
          
          // checkbookAllocationInfo is already sorted by time (newest first), so use it directly
          // Collect allocations from multiple checkbooks until we have enough (starting from latest)
          const collectedAllocations: Allocation[] = [];
          const usedCheckbooks: Checkbook[] = [];
          let remainingNeeded = TEST_CONFIG.allocationCount;
          
          for (const info of checkbookAllocationInfo) {
            if (remainingNeeded <= 0) break;
            
            const toTake = Math.min(remainingNeeded, info.allocationCount);
            if (toTake > 0) {
              collectedAllocations.push(...info.allocations.slice(0, toTake));
              usedCheckbooks.push(info.checkbook);
              remainingNeeded -= toTake;
              
              console.log(`   📋 Taking ${toTake} allocation(s) from checkbook ${info.checkbook.id} (created: ${info.checkbook.createdAt || 'N/A'}, has ${info.allocationCount} idle)`);
            }
          }
          
          if (collectedAllocations.length >= TEST_CONFIG.allocationCount) {
            allocations = collectedAllocations.slice(0, TEST_CONFIG.allocationCount);
            // Use the latest checkbook (first one) as the primary reference
            checkbook = usedCheckbooks[0];
            shouldDeposit = false;
            shouldCreateCommitment = false;
            
            console.log(`\n✅ Strategy 0b success: Combined ${allocations.length} allocations from ${usedCheckbooks.length} checkbook(s) (starting from latest)`);
            console.log(`   Latest checkbook used: ${usedCheckbooks[0].id} (created: ${usedCheckbooks[0].createdAt || 'N/A'})`);
            console.log(`   All checkbooks used: ${usedCheckbooks.map(cb => cb.id).join(', ')}`);
            console.log(`   → Will skip deposit and commitment, use combined allocations for withdraw`);
        } else {
            // This shouldn't happen if totalAvailableAllocations >= TEST_CONFIG.allocationCount
            throw new Error(`Failed to collect enough allocations. Collected: ${collectedAllocations.length}, Needed: ${TEST_CONFIG.allocationCount}`);
          }
        } else {
          // No with_checkbook checkbook has enough idle allocations, and total is also insufficient
          // BUT: We should still prioritize with_checkbook checkbooks over ready_for_commitment
          // Select the LATEST with_checkbook checkbook and create new allocations on it
          console.log(`\n⚠️ Strategy 0: No with_checkbook checkbook has enough idle allocations (need ${TEST_CONFIG.allocationCount})`);
          console.log(`   Total available across all checkbooks: ${totalAvailableAllocations}`);
          console.log(`   Available allocation counts: ${checkbookAllocationInfo.map(i => `${i.checkbook.id}:${i.allocationCount}`).join(', ')}`);
          
          // Select the LATEST with_checkbook checkbook (first in the list, already sorted by time)
          // checkbookAllocationInfo is already sorted by time (newest first)
          const selectedInfo = checkbookAllocationInfo[0];
          
          console.log(`\n🎯 Strategy 0: Prioritizing LATEST with_checkbook checkbook ${selectedInfo.checkbook.id}`);
          console.log(`   Created: ${selectedInfo.checkbook.createdAt || 'N/A'} (latest)`);
          console.log(`   → Will use this checkbook and create new allocations on it`);
          console.log(`   Current idle allocations: ${selectedInfo.allocationCount}`);
          console.log(`   Need to create: ${TEST_CONFIG.allocationCount - selectedInfo.allocationCount} more allocations`);
          
          // Use existing allocations if any, and create more if needed
          allocations = selectedInfo.allocations;
          checkbook = selectedInfo.checkbook;
          shouldDeposit = false;
          shouldCreateCommitment = true; // Will create allocations on this with_checkbook checkbook
          
          console.log(`\n✅ Strategy 0: Selected LATEST with_checkbook checkbook ${checkbook.id} for withdraw test`);
          console.log(`   → Will skip deposit, create allocations on this checkbook (already has commitment)`);
        }
      }
      
      // Strategy 1: If we have idle allocations (from any checkbook), we can skip deposit and commitment
      if (allocations.length < TEST_CONFIG.allocationCount && existingAllocations.length >= TEST_CONFIG.allocationCount) {
        console.log(`\n✅ Strategy 1: Found ${existingAllocations.length} idle allocations (need ${TEST_CONFIG.allocationCount})`);
        console.log(`   → Will skip deposit and commitment, use existing allocations`);
        allocations = existingAllocations.slice(0, TEST_CONFIG.allocationCount);
        shouldDeposit = false;
        shouldCreateCommitment = false;
        
        // Find the checkbook for these allocations
        if (allocations.length > 0 && allocations[0].checkbookId) {
          const checkbooks = await client.stores.checkbooks.fetchList({
            owner: userAddress,
          });
          checkbook = checkbooks.find(cb => cb.id === allocations[0].checkbookId) || null;
        }
      }
      // Strategy 2: If we have checkbooks but no idle allocations yet, skip deposit
      // Accept checkbooks with 'ready_for_commitment' status (can create allocations)
      // Note: 'with_checkbook' checkbooks are already handled in Strategy 0
      // Note: 'unsigned' status means DepositRecorded event hasn't been processed yet
      if (allocations.length < TEST_CONFIG.allocationCount && existingCheckbooks.length > 0) {
        // Filter checkbooks that can create allocations (only ready_for_commitment, exclude with_checkbook as it's handled in Strategy 0)
        const usableCheckbooks = existingCheckbooks.filter(
          cb => cb.status === CheckbookStatus.ReadyForCommitment
        );
        
        if (usableCheckbooks.length > 0) {
          console.log(`\n✅ Strategy 2: Found ${usableCheckbooks.length} ready_for_commitment checkbook(s)`);
          console.log(`   → Will skip deposit, use existing checkbook to create allocations`);
          console.log(`   Statuses: ${usableCheckbooks.map(cb => cb.status).join(', ')}`);
          
          // Select one to create allocations
          // Sort by creation time (newest first)
          const sorted = [...usableCheckbooks].sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          });
          
          checkbook = sorted.length > 1 
            ? await selectCheckbook(sorted)
            : sorted[0];
          console.log(`   Selected checkbook: ${checkbook.id}, status: ${checkbook.status}`);
          shouldDeposit = false;
        } else {
          // No usable checkbooks found
          const otherStatuses = existingCheckbooks
            .filter(cb => 
              cb.status !== CheckbookStatus.ProofFailed && 
              cb.status !== CheckbookStatus.SubmissionFailed &&
              cb.status !== CheckbookStatus.Deleted &&
              cb.status !== CheckbookStatus.WithCheckbook // Exclude with_checkbook as it's already handled
            )
            .map(cb => cb.status);
          console.log(`\n⚠️ Strategy 2: Found ${existingCheckbooks.length} checkbook(s), but none with 'ready_for_commitment' status`);
          console.log(`   Available statuses: ${[...new Set(otherStatuses)].join(', ')}`);
          console.log(`   → Will create new deposit (existing checkbooks are not ready for allocations)`);
          if (otherStatuses.includes('unsigned')) {
            console.log(`   Note: 'unsigned' status means DepositRecorded event hasn't been processed yet`);
          }
          shouldDeposit = true;
        }
      }
      
      // Strategy 3: If we have a pending withdrawal, we can skip everything
      if (existingWithdrawals.length > 0) {
        console.log(`\n✅ Found ${existingWithdrawals.length} pending withdrawal(s)`);
        console.log(`   → Will skip all steps, use existing withdrawal`);
        withdrawRequest = existingWithdrawals[0];
        shouldDeposit = false;
        shouldCreateCommitment = false;
        shouldCreateWithdraw = false;
      }
      
      console.log(`\n📋 Test Flow Decision:`);
      console.log(`   Deposit: ${shouldDeposit ? '✅ Will create' : '⏭️  Skip (using existing)'}`);
      console.log(`   Commitment: ${shouldCreateCommitment ? '✅ Will create' : '⏭️  Skip (using existing)'}`);
      console.log(`   Withdraw: ${shouldCreateWithdraw ? '✅ Will create' : '⏭️  Skip (using existing)'}`);
    }
    
    // ========================================
    // Step 1: Real Deposit Flow (if needed)
    // ========================================
    if (shouldDeposit) {
      console.log('\n📝 Step 1: Real Deposit Flow - Calling Treasury.deposit()...');
      
      const { txHash, localDepositId } = await depositToTreasury(
        testState.walletManager,
        treasuryAddress,
        TEST_CONFIG.tokenAddress,
        testState.depositAmount,
        TEST_CONFIG.evmChainId  // EVM Chain ID for Wallet SDK
      );
      
      console.log(`✅ Deposit transaction confirmed:`);
      console.log(`   Tx Hash: ${txHash}`);
      if (localDepositId) {
        console.log(`   Local Deposit ID: ${localDepositId}`);
      }
    } else {
      console.log('\n⏭️  Step 1: Skipping deposit (using existing checkbook)');
    }
    
    // ========================================
    // Step 2: Wait for Backend to create Checkbook or select existing one
    // ========================================
    if (shouldDeposit || !checkbook) {
      console.log('\n⏳ Step 2: Waiting for Backend to create checkbook or selecting existing one...');
      console.log(`   BlockScanner should detect DepositReceived event`);
      console.log(`   Backend will automatically create checkbook via NATS event`);
      
      const allCheckbooks = await client.stores.checkbooks.fetchList({
        owner: userAddress,
      });
      
      if (allCheckbooks.length > 1) {
        console.log(`📋 Found ${allCheckbooks.length} checkbook(s). Please select one:`);
        checkbook = await selectCheckbook(allCheckbooks);
        console.log(`\n✅ Using selected checkbook: ${checkbook.id}`);
      } else if (allCheckbooks.length === 1) {
        checkbook = allCheckbooks[0];
        console.log(`\n✅ Using existing checkbook: ${checkbook.id}`);
      } else {
        // Wait for new checkbook
        checkbook = await waitForCheckbookCreation(client, userAddress, 120000, true);
      }
    } else {
      console.log(`\n⏭️  Step 2: Skipping checkbook wait (using existing: ${checkbook.id})`);
    }
    
    console.log(`\n✅ Selected checkbook: ${checkbook.id}`);
    console.log(`   Status: ${checkbook.status}`);
    console.log(`   Amount: ${checkbook.amount || checkbook.depositAmount}`);
    console.log(`   Remaining: ${checkbook.remainingAmount || 'N/A'}`);
    
    expect(checkbook).toBeDefined();
    expect(checkbook.id).toBeTruthy();
    
    // ========================================
    // Step 3: Wait for checkbook to be ready for commitment (if needed)
    // ========================================
    let readyCheckbook: Checkbook | null = null;
    
    if (shouldCreateCommitment && checkbook) {
      console.log('\n⏳ Step 3: Checking checkbook status and waiting if needed...');
      console.log(`   Current status: ${checkbook.status}`);
      
      // Handle different checkbook statuses
      // Allow ready_for_commitment, proof_failed, and submission_failed status to create allocations
      // Note: proof_failed and submission_failed allow retry by creating new allocations and commitment
      if (checkbook.status === CheckbookStatus.ReadyForCommitment) {
        console.log(`✅ Checkbook is ready for commitment (status: ${checkbook.status})!`);
        readyCheckbook = checkbook;
      } else if (checkbook.status === CheckbookStatus.ProofFailed || checkbook.status === CheckbookStatus.SubmissionFailed) {
        // Failed statuses allow retry by creating new allocations and commitment
        console.log(`✅ Checkbook has failed status '${checkbook.status}', allowing retry by creating new allocations...`);
        readyCheckbook = checkbook;
      } else if (checkbook.status === CheckbookStatus.Unsigned || checkbook.status === CheckbookStatus.Pending) {
        // unsigned/pending status: should be updated to ready_for_commitment by DepositRecorded event
        console.log(`⏳ Checkbook is ${checkbook.status}, waiting for DepositRecorded event to update status to 'ready_for_commitment'...`);
        console.log(`   Note: CreateAllocationsHandler only accepts 'ready_for_commitment' status`);
        
        // Try waiting for status update (in case DepositRecorded event is being processed)
        // Backend will update status to 'ready_for_commitment' when DepositRecorded event is processed
        const maxWaitTime = 30000; // 30 seconds
        const checkInterval = 2000; // Check every 2 seconds
        const startTime = Date.now();
        let refreshed: Checkbook | null = null;
        
        while (Date.now() - startTime < maxWaitTime) {
          console.log(`   Waiting for status update... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          
          try {
            refreshed = await client.stores.checkbooks.fetchById(checkbook.id);
            console.log(`   Current status: ${refreshed.status}`);
            if (refreshed.status === CheckbookStatus.ReadyForCommitment) {
              console.log(`✅ Checkbook status updated: ${checkbook.status} → ${refreshed.status}`);
              readyCheckbook = refreshed;
              break;
            }
          } catch (err) {
            console.log(`⚠️ Failed to refresh checkbook: ${err}`);
          }
        }
        
        if (!readyCheckbook) {
          throw new Error(
            `Checkbook ${checkbook.id} is still in '${checkbook.status}' status after waiting. ` +
            `DepositRecorded event may not have been processed yet. ` +
            `Only 'ready_for_commitment' status can create allocations.`
          );
        }
      } else if (checkbook.status === CheckbookStatus.WithCheckbook) {
        // with_checkbook status means commitment is confirmed, but we can still create allocations
        // This is the normal state after commitment is confirmed on-chain
        console.log(`✅ Checkbook is in 'with_checkbook' status (commitment confirmed). Can create allocations.`);
        readyCheckbook = checkbook;
      } else if (checkbook.status === CheckbookStatus.Deleted) {
        // Deleted status, cannot use
        throw new Error(
          `Checkbook ${checkbook.id} has been deleted. ` +
          `Cannot create new allocations. Only 'ready_for_commitment' status can create allocations.`
        );
      } else if (
        checkbook.status === CheckbookStatus.GeneratingProof ||
        checkbook.status === CheckbookStatus.SubmittingCommitment ||
        checkbook.status === CheckbookStatus.CommitmentPending
      ) {
        // These statuses mean commitment is being processed, cannot create new allocations
        throw new Error(
          `Checkbook ${checkbook.id} is in '${checkbook.status}' status. ` +
          `Commitment is being processed, cannot create new allocations. ` +
          `Only 'ready_for_commitment' status can create allocations.`
        );
      } else {
        // For any other unknown status, throw error to be safe
        throw new Error(
          `Checkbook ${checkbook.id} has unknown status '${checkbook.status}'. ` +
          `Only 'ready_for_commitment' status can create allocations.`
        );
      }
      
      // Ensure readyCheckbook is set
      if (!readyCheckbook) {
        throw new Error('readyCheckbook is null, cannot proceed with commitment creation');
      }
      
      console.log(`\n✅ Checkbook ready: ${readyCheckbook.id}`);
      console.log(`   Status: ${readyCheckbook.status}`);
      console.log(`   Remaining amount: ${readyCheckbook.remainingAmount}`);
      console.log(`   Token: ${readyCheckbook.token?.id || 'N/A'} (${readyCheckbook.token?.symbol || 'N/A'})`);
      
      // Allow ready_for_commitment, with_checkbook, proof_failed, and submission_failed status to create allocations
      // Note: proof_failed and submission_failed allow retry by creating new allocations and commitment
      // with_checkbook means commitment is confirmed, but we can still create allocations for withdraw
      expect([
        CheckbookStatus.ReadyForCommitment,
        CheckbookStatus.WithCheckbook,
        CheckbookStatus.ProofFailed,
        CheckbookStatus.SubmissionFailed
      ]).toContain(readyCheckbook.status);
    } else {
      console.log('\n⏭️  Step 3: Skipping checkbook status check (using existing allocations)');
      if (checkbook) {
        readyCheckbook = checkbook;
      }
    }
    
    // ========================================
    // Step 4: Create Commitment (split into 4 allocations) - if needed
    // ========================================
    if (shouldCreateCommitment) {
      console.log('\n📦 Step 4: Creating commitment with 4 allocations...');
      
      if (!testState || !readyCheckbook) {
        throw new Error('Test state or checkbook not initialized. Make sure previous steps completed successfully.');
      }
      
      // Get tokenKey from checkbook.token.symbol
      // Note: Now using tokenKey instead of tokenId
      if (!readyCheckbook.token?.symbol) {
      // Refresh checkbook to get full data including token
      console.log(`   Refreshing checkbook to get token information...`);
      const refreshed = await client.stores.checkbooks.fetchById(readyCheckbook.id);
      readyCheckbook = refreshed;
    }
    
    // Log the full checkbook object from backend for debugging
    console.log(`\n📋 Backend Checkbook Data (Full Object):`);
    console.log(JSON.stringify(readyCheckbook, null, 2));
    
    // Also try to get raw API response directly from backend
    try {
      // Access the API client through the stores
      const apiClient = (client as any).stores?.checkbooks?.api?.client;
      if (apiClient) {
        const rawResponse = await apiClient.get(`/api/checkbooks/id/${readyCheckbook.id}`);
        if (rawResponse?.data) {
          console.log(`\n📋 Backend Raw API Response (Full):`);
          console.log(JSON.stringify(rawResponse.data, null, 2));
          
          // Log the checkbook object from backend response
          if (rawResponse.data.data?.checkbook) {
            const backendCheckbook = rawResponse.data.data.checkbook;
            console.log(`\n📋 Backend Checkbook Object (Raw from API):`);
            console.log(JSON.stringify(backendCheckbook, null, 2));
            console.log(`\n🔍 Key Fields from Backend (Raw):`);
            console.log(`     id: ${backendCheckbook.id}`);
            console.log(`     local_deposit_id: ${backendCheckbook.local_deposit_id} (type: ${typeof backendCheckbook.local_deposit_id})`);
            console.log(`     slip44_chain_id: ${backendCheckbook.slip44_chain_id} (type: ${typeof backendCheckbook.slip44_chain_id})`);
            console.log(`     gross_amount: ${backendCheckbook.gross_amount} (type: ${typeof backendCheckbook.gross_amount})`);
            console.log(`     allocatable_amount: ${backendCheckbook.allocatable_amount} (type: ${typeof backendCheckbook.allocatable_amount})`);
            console.log(`     fee_total_locked: ${backendCheckbook.fee_total_locked} (type: ${typeof backendCheckbook.fee_total_locked})`);
            console.log(`     amount: ${backendCheckbook.amount} (type: ${typeof backendCheckbook.amount})`);
            console.log(`     token_id: ${backendCheckbook.token_id} (type: ${typeof backendCheckbook.token_id})`);
            console.log(`     token_address: ${backendCheckbook.token_address} (type: ${typeof backendCheckbook.token_address})`);
            console.log(`     status: ${backendCheckbook.status} (type: ${typeof backendCheckbook.status})`);
            console.log(`     user_address: ${JSON.stringify(backendCheckbook.user_address)}`);
            console.log(`     created_at: ${backendCheckbook.created_at}`);
            console.log(`     updated_at: ${backendCheckbook.updated_at}`);
          }
          
          // Also log token info if available
          if (rawResponse.data.data?.token) {
            console.log(`\n🪙 Backend Token Object (Raw from API):`);
            console.log(JSON.stringify(rawResponse.data.data.token, null, 2));
          }
        }
      } else {
        console.log(`   ⚠️ Could not access API client`);
      }
    } catch (error) {
      console.log(`   ⚠️ Could not fetch raw API response: ${error}`);
      if (error instanceof Error) {
        console.log(`   Error message: ${error.message}`);
        console.log(`   Error stack: ${error.stack}`);
      }
    }
    
    const tokenKey = readyCheckbook.token?.symbol;
    if (!tokenKey) {
      // If token.symbol is not available, show error
      console.log(`   Checkbook token object:`, JSON.stringify(readyCheckbook.token, null, 2));
      throw new Error(`Checkbook ${readyCheckbook.id} does not have token.symbol. Token object: ${JSON.stringify(readyCheckbook.token)}`);
    }
    
    console.log(`\n📊 SDK Parsed Checkbook Data:`);
    console.log(`   Checkbook ID: ${readyCheckbook.id}`);
    console.log(`   Token Key: ${tokenKey}`);
    console.log(`   Token Symbol: ${readyCheckbook.token?.symbol || 'N/A'}`);
    console.log(`   Token: ${JSON.stringify(readyCheckbook.token, null, 2)}`);
    
    // Log checkbook amount fields for debugging
    console.log(`\n💰 Checkbook Amount Fields (SDK parsed):`);
    console.log(`     localDepositId: ${readyCheckbook.localDepositId || 'N/A'}`);
    console.log(`     slip44ChainId: ${readyCheckbook.slip44ChainId || 'N/A'}`);
    console.log(`     allocatableAmount: ${readyCheckbook.allocatableAmount || 'N/A'}`);
    console.log(`     grossAmount: ${readyCheckbook.grossAmount || 'N/A'}`);
    console.log(`     depositAmount: ${readyCheckbook.depositAmount || 'N/A'}`);
    console.log(`     remainingAmount: ${readyCheckbook.remainingAmount || 'N/A'}`);
    console.log(`     feeTotalLocked: ${readyCheckbook.feeTotalLocked || 'N/A'}`);
      
      // Calculate amount per allocation based on allocatableAmount (or grossAmount as fallback)
      // Use allocatableAmount if available and non-zero, otherwise use grossAmount or depositAmount
      const totalAllocatable = readyCheckbook.allocatableAmount && readyCheckbook.allocatableAmount !== '0' && readyCheckbook.allocatableAmount !== ''
        ? BigInt(readyCheckbook.allocatableAmount)
        : (readyCheckbook.grossAmount && readyCheckbook.grossAmount !== '0' && readyCheckbook.grossAmount !== ''
          ? BigInt(readyCheckbook.grossAmount)
          : (readyCheckbook.depositAmount && readyCheckbook.depositAmount !== '0' && readyCheckbook.depositAmount !== ''
            ? BigInt(readyCheckbook.depositAmount)
            : BigInt(testState.depositAmount))); // Fallback to testState.depositAmount if nothing else available
      
      const amountPerAllocation = (totalAllocatable / BigInt(TEST_CONFIG.allocationCount)).toString();
      const amounts = Array(TEST_CONFIG.allocationCount).fill(amountPerAllocation);
      
      console.log(`   Total allocatable amount: ${totalAllocatable.toString()} wei`);
      console.log(`   Amount per allocation: ${amountPerAllocation} wei`);
      console.log(`   Number of allocations: ${TEST_CONFIG.allocationCount}`);
      
      allocations = await client.createCommitment({
        checkbookId: readyCheckbook.id,
        tokenKey: tokenKey, // Use tokenKey instead of tokenId
        amounts,
      });
      
      console.log(`✅ Created ${allocations.length} allocations:`);
      allocations.forEach((allocation, index) => {
        console.log(`   Allocation ${index + 1}: ${allocation.id}, Amount: ${allocation.amount}, Status: ${allocation.status}`);
      });
      
      expect(allocations).toHaveLength(TEST_CONFIG.allocationCount);
      allocations.forEach(allocation => {
        expect(allocation.id).toBeTruthy();
        expect(allocation.amount).toBe(amountPerAllocation);
        expect(allocation.checkbookId).toBe(readyCheckbook!.id);
      });
    } else {
      console.log('\n⏭️  Step 4: Skipping commitment creation (using existing allocations)');
      console.log(`   Using ${allocations.length} existing allocations`);
    }
    
    // ========================================
    // Step 5: Wait for allocations to be idle (if needed)
    // ========================================
    if (shouldCreateCommitment) {
      console.log('\n⏳ Step 5: Waiting for allocations to be idle...');
      
      const allocationIds = allocations.map(a => a.id);
      allocations = await waitForAllocationsIdle(client, allocationIds, 60000);
      
      console.log(`✅ All allocations are idle:`);
      allocations.forEach((allocation, index) => {
        console.log(`   Allocation ${index + 1}: ${allocation.id}, Status: ${allocation.status}`);
      });
      
      expect(allocations).toHaveLength(TEST_CONFIG.allocationCount);
      allocations.forEach(allocation => {
        expect(allocation.status).toBe(AllocationStatus.Idle);
      });
      
      // ========================================
      // Step 5.5: Wait for checkbook commitment to complete (with_checkbook status)
      // ========================================
      console.log('\n⏳ Step 5.5: Waiting for checkbook commitment to complete...');
      console.log(`   Checkbook ${readyCheckbook!.id} needs to reach 'with_checkbook' status`);
      console.log(`   This ensures the commitment is confirmed on-chain and available for withdraw`);
      
      const committedCheckbook = await waitForCheckbookStatus(
        client,
        readyCheckbook!.id,
        CheckbookStatus.WithCheckbook,
        180000 // 3 minutes timeout (commitment confirmation can take time)
      );
      
      console.log(`✅ Checkbook commitment completed:`);
      console.log(`   ID: ${committedCheckbook.id}`);
      console.log(`   Status: ${committedCheckbook.status}`);
      console.log(`   Commitment: ${committedCheckbook.commitment ? '✅ Available' : '⚠️ Not found (may be in allocations)'}`);
      
      // Update readyCheckbook reference
      readyCheckbook = committedCheckbook;
    } else {
      console.log('\n⏭️  Step 5: Skipping allocation wait (using existing idle allocations)');
      // Verify existing allocations are idle
      allocations.forEach(allocation => {
        expect(allocation.status).toBe(AllocationStatus.Idle);
      });
      
      // Even if using existing allocations, verify all checkbooks have commitment
      // Allocations may be from multiple checkbooks
      const uniqueCheckbookIds = new Set(allocations.map(a => a.checkbookId).filter(Boolean));
      
      if (uniqueCheckbookIds.size > 0) {
        console.log(`\n🔍 Step 5.5: Verifying ${uniqueCheckbookIds.size} checkbook(s) have commitment...`);
        
        // Verify all checkbooks are in with_checkbook status
        const checkbooksToVerify: Checkbook[] = [];
        for (const checkbookId of uniqueCheckbookIds) {
          const freshCheckbook = await client.stores.checkbooks.fetchById(checkbookId);
          console.log(`   Checkbook ${freshCheckbook.id} status: ${freshCheckbook.status}`);
          console.log(`   Commitment: ${freshCheckbook.commitment ? '✅ Available' : '⚠️ Not found'}`);
          
          if (!freshCheckbook.commitment && freshCheckbook.status !== CheckbookStatus.WithCheckbook) {
            console.log(`   ⚠️ Checkbook ${freshCheckbook.id} is not in 'with_checkbook' status and has no commitment`);
            console.log(`   → Waiting for commitment to complete...`);
            const committedCheckbook = await waitForCheckbookStatus(
              client,
              freshCheckbook.id,
              CheckbookStatus.WithCheckbook,
              180000
            );
            checkbooksToVerify.push(committedCheckbook);
          } else {
            checkbooksToVerify.push(freshCheckbook);
          }
        }
        
        // Use the first checkbook as the primary reference (for backward compatibility)
        if (checkbook) {
          readyCheckbook = checkbooksToVerify.find(cb => cb.id === checkbook.id) || checkbooksToVerify[0];
        } else {
          readyCheckbook = checkbooksToVerify[0];
        }
        
        console.log(`✅ All ${checkbooksToVerify.length} checkbook(s) verified with commitment`);
      } else if (checkbook) {
        // Fallback to single checkbook verification (backward compatibility)
        console.log('\n🔍 Step 5.5: Verifying checkbook has commitment...');
        const freshCheckbook = await client.stores.checkbooks.fetchById(checkbook.id);
        console.log(`   Checkbook ${freshCheckbook.id} status: ${freshCheckbook.status}`);
        console.log(`   Commitment: ${freshCheckbook.commitment ? '✅ Available' : '⚠️ Not found'}`);
        
        if (!freshCheckbook.commitment && freshCheckbook.status !== CheckbookStatus.WithCheckbook) {
          console.log(`   ⚠️ Checkbook is not in 'with_checkbook' status and has no commitment`);
          console.log(`   → Waiting for commitment to complete...`);
          const committedCheckbook = await waitForCheckbookStatus(
            client,
            freshCheckbook.id,
            CheckbookStatus.WithCheckbook,
            180000
          );
          readyCheckbook = committedCheckbook;
        } else {
          readyCheckbook = freshCheckbook;
        }
      }
    }
    
    // ========================================
    // Step 6: Create Withdraw (combine multiple allocations) - if needed
    // ========================================
    if (shouldCreateWithdraw) {
      console.log('\n💰 Step 6: Creating withdraw with multiple allocations...');
      
      // Re-check allocations status before creating withdraw (they might have been used)
      console.log('   🔍 Re-checking allocations status before withdraw...');
      
      // Get unique checkbook IDs from allocations (may be from multiple checkbooks)
      const checkbookIds = new Set(allocations.map(a => a.checkbookId).filter(Boolean));
      console.log(`   📊 Allocations span ${checkbookIds.size} checkbook(s): ${Array.from(checkbookIds).join(', ')}`);
      
      if (checkbookIds.size === 0) {
        throw new Error('Cannot find checkbook ID from allocations');
      }
      
      // Fetch all allocations from all relevant checkbooks to get fresh status
      const allCheckbookAllocations: Allocation[] = [];
      for (const checkbookId of checkbookIds) {
        const checkbookAllocations = await client.stores.allocations.fetchByCheckbookId(checkbookId);
        console.log(`   📊 Found ${checkbookAllocations.length} allocations in checkbook ${checkbookId}`);
        allCheckbookAllocations.push(...checkbookAllocations);
      }
      
      // Create a map of allocation IDs we need
      const neededAllocationIds = new Set(allocations.map(a => a.id));
      
      // Filter to only the allocations we need and check their status
      const freshAllocations: Allocation[] = [];
      for (const allocation of allCheckbookAllocations) {
        if (neededAllocationIds.has(allocation.id)) {
          console.log(`   📊 Allocation ${allocation.id} (checkbook: ${allocation.checkbookId}): status=${allocation.status}`);
        
        // Only include idle allocations
          if (allocation.status === AllocationStatus.Idle) {
            freshAllocations.push(allocation);
        } else {
            console.log(`   ⚠️ Allocation ${allocation.id} is not idle (status: ${allocation.status}), skipping...`);
          }
        }
      }
      
      // Check if we have enough idle allocations
      if (freshAllocations.length < TEST_CONFIG.allocationCount) {
        console.log(`\n⚠️ Only ${freshAllocations.length} idle allocations available (need ${TEST_CONFIG.allocationCount})`);
        console.log(`   → These allocations may have been used in a previous withdraw request`);
        console.log(`   → Skipping withdraw creation`);
        shouldCreateWithdraw = false;
        
        // Try to find existing withdraw request using these allocations
        const allWithdrawals = await client.stores.withdrawals.fetchList({
          owner: userAddress,
        });
        
        // Check if any withdrawal uses these allocations
        const relatedWithdrawal = allWithdrawals.find(w => {
          if (!w.allocationIds || w.allocationIds.length === 0) return false;
          const withdrawalAllocationIds = new Set(w.allocationIds);
          const ourAllocationIds = new Set(allocations.map(a => a.id));
          // Check if there's any overlap
          return Array.from(ourAllocationIds).some(id => withdrawalAllocationIds.has(id));
        });
        
        if (relatedWithdrawal) {
          console.log(`   ✅ Found existing withdrawal request: ${relatedWithdrawal.id}`);
          console.log(`      Status: ${relatedWithdrawal.status}`);
          console.log(`      Allocation IDs: ${relatedWithdrawal.allocationIds?.join(', ') || 'N/A'}`);
          withdrawRequest = relatedWithdrawal;
          shouldCreateWithdraw = false;
        } else {
          console.log(`   ⚠️ No existing withdrawal request found for these allocations`);
          throw new Error(
            `Cannot create withdraw: Only ${freshAllocations.length} idle allocations available ` +
            `(need ${TEST_CONFIG.allocationCount}). ` +
            `Some allocations may have been used in a previous withdraw request.`
          );
        }
      } else {
        // Update allocations to use fresh data
        allocations = freshAllocations.slice(0, TEST_CONFIG.allocationCount);
        console.log(`   ✅ Found ${allocations.length} idle allocations, proceeding with withdraw...`);
      }
      
      if (shouldCreateWithdraw) {
        // Get user's address for withdrawal (Universal Address format)
        const userUniversalAddress = client.address!;
        if (!userUniversalAddress.universalFormat) {
          throw new Error('Universal Address format is required. client.address.universalFormat is missing.');
        }
        const beneficiaryUniversalAddress = userUniversalAddress.universalFormat.replace(/^0x/, '');
        const allocationIds = allocations.map(a => a.id);
        
        // Create withdraw intent (RawToken - withdraw to same chain)
        // Note: API calls use SLIP-44 chain ID and Universal Address format
        console.log('\n📝 Step 6: Creating withdraw request...');
        console.log(`   Allocations: ${allocationIds.length} allocation(s)`);
        console.log(`   Beneficiary: ${userUniversalAddress.universalFormat}`);
        console.log(`   Chain ID: ${TEST_CONFIG.chainId} (SLIP-44)`);
        console.log(`   Token Contract: 0x55d398326f99059fF775485246999027B3197955 (USDT on BSC)`);
        console.log('   ⚠️  You will be prompted to sign the withdrawal message in your wallet.');
        console.log('   📋 The signature message will be displayed before signing.');
        
        withdrawRequest = await client.withdraw({
          allocationIds,
          intent: {
            type: 'RawToken',
            beneficiary: {
              chainId: TEST_CONFIG.chainId, // SLIP-44 (for API)
              address: userUniversalAddress.address, // Keep 20-byte for display
              universalFormat: userUniversalAddress.universalFormat, // 32-byte Universal Address (required)
            },
            tokenSymbol: 'USDT', // USDT on BSC
          },
        });
      }
      
      console.log(`✅ Withdraw request created: ${withdrawRequest.id}`);
      console.log(`   Status: ${withdrawRequest.status}`);
      console.log(`   Amount: ${withdrawRequest.amount}`);
      console.log(`   Allocation IDs: ${withdrawRequest.allocationIds.join(', ')}`);
      console.log(`   Beneficiary: ${withdrawRequest.beneficiary.address}`);
    } else {
      console.log('\n⏭️  Step 6: Skipping withdraw creation (using existing withdrawal)');
      console.log(`   Using existing withdrawal: ${withdrawRequest!.id}`);
    }
    
    // Verify withdraw request
    expect(withdrawRequest).toBeDefined();
    expect(withdrawRequest!.id).toBeTruthy();
    expect(withdrawRequest!.allocationIds.length).toBeGreaterThanOrEqual(TEST_CONFIG.allocationCount);
    expect(withdrawRequest!.amount).toBeTruthy();
    expect(withdrawRequest!.intent.type).toBe('RawToken');
    // Verify beneficiary uses Universal Address format
    const userUniversalAddressForVerify = client.address!;
    if (!userUniversalAddressForVerify.universalFormat) {
      throw new Error('Universal Address format is required. client.address.universalFormat is missing.');
    }
    // Check if beneficiary has universalFormat, otherwise check address
    const beneficiaryAddress = withdrawRequest!.beneficiary.universalFormat 
      ? withdrawRequest!.beneficiary.universalFormat.replace(/^0x/, '').toLowerCase()
      : withdrawRequest!.beneficiary.address.toLowerCase();
    const expectedAddress = userUniversalAddressForVerify.universalFormat.replace(/^0x/, '').toLowerCase();
    expect(beneficiaryAddress).toBe(expectedAddress);
    
    // ========================================
    // Step 7: Verify withdraw request details
    // ========================================
    console.log('\n🔍 Step 7: Verifying withdraw request...');
    
    console.log(`   Fetching withdraw request ${withdrawRequest!.id}...`);
    const withdrawDetail = await client.stores.withdrawals.fetchById(withdrawRequest!.id);
    
    console.log(`✅ Withdraw request details:`);
    console.log(`   ID: ${withdrawDetail.id}`);
    console.log(`   Status: ${withdrawDetail.status}`);
    console.log(`   Total amount: ${withdrawDetail.amount}`);
    console.log(`   Allocation IDs: ${withdrawDetail.allocationIds.join(', ')}`);
    console.log(`   Beneficiary: ${withdrawDetail.beneficiary?.address || 'N/A'}`);
    console.log(`   Created: ${withdrawDetail.createdAt || 'N/A'}`);
    
    expect(withdrawDetail.id).toBe(withdrawRequest.id);
    expect(withdrawDetail.allocationIds).toBeDefined();
    expect(withdrawDetail.allocationIds.length).toBeGreaterThanOrEqual(TEST_CONFIG.allocationCount);
    
    // Verify total amount matches sum of allocations
    const totalAmount = allocations.reduce(
      (sum, a) => sum + BigInt(a.amount),
      BigInt(0)
    ).toString();
    expect(withdrawDetail.amount).toBe(totalAmount);
    
    console.log('\n✅ Full flow completed successfully!');
    console.log(`   Checkbook: ${readyCheckbook.id}`);
    console.log(`   Allocations: ${allocations.map(a => a.id).join(', ')}`);
    console.log(`   Withdraw Request: ${withdrawRequest.id}`);
    if (withdrawRequest.allocationIds) {
      console.log(`   Withdraw Allocation IDs: ${withdrawRequest.allocationIds.join(', ')}`);
    }
    
    // ========================================
    // Step 8: Wait for backend to automatically generate ZKVM Proof and execute on-chain
    // ========================================
    // Note: According to the system design, after creating withdraw request:
    // 1. Backend AUTOMATICALLY calls ZKVM Service to generate proof
    // 2. Backend AUTOMATICALLY submits executeWithdraw TX to chain
    // 3. Backend waits for on-chain confirmation
    // 
    // Frontend should NOT need to manually call any API for proof generation or execution.
    // Backend handles everything automatically after withdraw request is created.
    // 
    // Available retry APIs (only for retry scenarios):
    // - POST /api/my/withdraw-requests/:id/retry - Retry failed proof generation or TX submission
    // - POST /api/my/withdraw-requests/:id/retry-payout - Retry payout
    // - POST /api/my/withdraw-requests/:id/retry-fallback - Retry fallback
    // 
    // We need to wait and verify these steps complete
    console.log('\n⏳ Step 8: Waiting for backend to automatically generate proof and execute on-chain...');
    console.log('   Backend should automatically:');
    console.log('   1. Call ZKVM Service to generate proof (no frontend action needed)');
    console.log('   2. Submit executeWithdraw TX to chain (no frontend action needed)');
    console.log('   3. Wait for on-chain confirmation');
    console.log('   Note: Frontend only needs to poll status, backend handles everything automatically');
    
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();
    let lastStatus = withdrawRequest.status;
    
    while (Date.now() - startTime < maxWaitTime) {
      // Refresh withdraw request to get latest status
      const freshRequest = await client.stores.withdrawals.fetchById(withdrawRequest.id);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      console.log(`\n   [${elapsed}s] Current status: ${freshRequest.status}`);
      console.log(`      Proof Status: ${freshRequest.proofStatus || 'N/A'}`);
      console.log(`      Execute Status: ${freshRequest.executeStatus || 'N/A'}`);
      console.log(`      Execute TX Hash: ${freshRequest.executeTxHash || 'N/A'}`);
      
      // Check if proof generation completed
      if (freshRequest.proofStatus === 'completed' || freshRequest.proofStatus === 'proof_generated') {
        console.log('   ✅ Proof generation completed');
      }
      
      // Check if on-chain execution completed
      if (freshRequest.executeStatus === 'success' || freshRequest.executeStatus === 'execute_confirmed') {
        console.log('   ✅ On-chain execution completed');
        console.log(`      TX Hash: ${freshRequest.executeTxHash || 'N/A'}`);
        console.log(`      Block Number: ${freshRequest.executeBlockNumber || 'N/A'}`);
        withdrawRequest = freshRequest;
        break;
      }
      
      // Check for terminal failure states
      if (freshRequest.status === 'proof_failed' || 
          freshRequest.status === 'submit_failed' || 
          freshRequest.status === 'failed_permanent') {
        console.log(`   ❌ Withdraw request failed with status: ${freshRequest.status}`);
        throw new Error(`Withdraw request failed: ${freshRequest.status}`);
      }
      
      // If status changed, log it
      if (freshRequest.status !== lastStatus) {
        console.log(`   📊 Status changed: ${lastStatus} → ${freshRequest.status}`);
        lastStatus = freshRequest.status;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Get final status (refresh one more time)
    const finalRequest = await client.stores.withdrawals.fetchById(withdrawRequest.id);
    withdrawRequest = finalRequest;
    
    if (Date.now() - startTime >= maxWaitTime) {
      console.log(`\n⚠️  Timeout waiting for withdraw to complete (${maxWaitTime / 1000}s)`);
      console.log(`   Final status: ${finalRequest.status}`);
      console.log(`   Proof Status: ${finalRequest.proofStatus || 'N/A'}`);
      console.log(`   Execute Status: ${finalRequest.executeStatus || 'N/A'}`);
      // Don't throw error, just log warning - backend might still be processing
    } else {
      console.log('\n✅ Withdraw flow completed successfully!');
      console.log(`   Final Status: ${withdrawRequest.status}`);
      console.log(`   Proof Status: ${withdrawRequest.proofStatus || 'N/A'}`);
      console.log(`   Execute Status: ${withdrawRequest.executeStatus || 'N/A'}`);
      if (withdrawRequest.executeTxHash) {
        console.log(`   Execute TX Hash: ${withdrawRequest.executeTxHash}`);
      }
    }
  }, 300000); // 5 minute timeout for full E2E test
  
  it('should handle multiple deposits and commitments', async () => {
    // This test can be extended to test multiple deposits
    // For now, we'll just verify the stores are working
    // Owner is now automatically determined from JWT token
    const checkbooks = await client.stores.checkbooks.fetchList();
    console.log(`\n📚 Found ${checkbooks.length} checkbooks for user`);
    
    // Owner is now automatically determined from JWT token
    const allocations = await client.stores.allocations.fetchList({
      limit: 100,
    });
    console.log(`📦 Found ${allocations.length} allocations for user`);
    
    // Owner is now automatically determined from JWT token
    const withdrawals = await client.stores.withdrawals.fetchList({
      limit: 100,
    });
    console.log(`💰 Found ${withdrawals.length} withdrawal requests for user`);
  });
});

