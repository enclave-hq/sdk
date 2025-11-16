/**
 * Quote & Preview API example
 * 
 * Demonstrates how to use the Quote API to:
 * 1. Query optimal cross-chain routes and fees
 * 2. Query Hook asset information (APY, fees, etc.)
 */

import {
  EnclaveClient,
  type RouteAndFeesRequest,
  type HookAssetRequest,
} from '../src';

async function main() {
  // Initialize Enclave client (Quote API doesn't require authentication)
  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001/ws',
    signer: process.env.PRIVATE_KEY!,
  });

  try {
    console.log('=== Quote API Examples ===\n');

    // Example 1: Query route and fees
    console.log('1. Query Route and Fees');
    console.log('-'.repeat(50));

    const routeRequest: RouteAndFeesRequest = {
      ownerData: {
        chainId: 714,  // BSC (SLIP-44)
        data: '0x1234567890123456789012345678901234567890',
      },
      depositToken: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT
      intent: {
        type: 'RawToken',
        beneficiary: {
          chainId: 60,  // Ethereum (SLIP-44)
          data: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        },
        tokenSymbol: 'USDT', // ETH USDT
      },
      amount: '100000000000',  // 100 USDT (6 decimals)
      includeHook: false,
    };

    const routeQuote = await client.quote.getRouteAndFees(routeRequest);
    
    console.log('Route Information:');
    console.log(`  Bridge: ${routeQuote.route.bridge}`);
    console.log(`  Protocol: ${routeQuote.route.bridgeProtocol}`);
    console.log(`  Estimated Time: ${routeQuote.route.estimatedTime}`);
    console.log(`  Steps: ${routeQuote.route.steps.length}`);
    
    console.log('\nFee Summary:');
    console.log(`  Total Gas Cost: $${routeQuote.fees.summary.totalGasCostUSD}`);
    console.log(`  Total Bridge Fee: $${routeQuote.fees.summary.totalBridgeFeeUSD}`);
    console.log(`  Total Cost: $${routeQuote.fees.summary.totalCostUSD}`);
    console.log(`  Estimated Received: ${routeQuote.fees.summary.estimatedReceived}`);
    
    console.log('\nQuote Metadata:');
    console.log(`  Quote ID: ${routeQuote.meta.quoteId}`);
    console.log(`  Valid Until: ${routeQuote.meta.validUntil}`);
    
    // Example 2: Query route with Hook
    console.log('\n\n2. Query Route with Hook Execution');
    console.log('-'.repeat(50));

    const routeWithHook: RouteAndFeesRequest = {
      ...routeRequest,
      includeHook: true,  // Include Hook execution fee
    };

    const routeQuoteWithHook = await client.quote.getRouteAndFees(routeWithHook);
    
    console.log('Route Information (with Hook):');
    console.log(`  Total Gas Cost: $${routeQuoteWithHook.fees.summary.totalGasCostUSD}`);
    console.log(`  Total Bridge Fee: $${routeQuoteWithHook.fees.summary.totalBridgeFeeUSD}`);
    console.log(`  Total Cost (with Hook): $${routeQuoteWithHook.fees.summary.totalCostUSD}`);
    
    if (routeQuoteWithHook.fees.hookExecution) {
      console.log('\nHook Execution Fee:');
      console.log(`  Gas: ${routeQuoteWithHook.fees.hookExecution.estimatedGas}`);
      console.log(`  Cost in Native: ${routeQuoteWithHook.fees.hookExecution.gasCostInNative}`);
      console.log(`  Cost in USD: $${routeQuoteWithHook.fees.hookExecution.gasCostInUSD}`);
    }

    // Example 3: Query Hook asset information (Aave USDT)
    console.log('\n\n3. Query Hook Asset Info - Aave USDT');
    console.log('-'.repeat(50));

    const aaveRequest: HookAssetRequest = {
      chain: 60,           // Ethereum (SLIP-44)
      protocol: 'aave',
      baseToken: 'USDT',
      amount: '100000000000',  // 100 USDT
    };

    const aaveAsset = await client.quote.getHookAsset(aaveRequest);
    
    console.log('Asset Information:');
    console.log(`  Protocol: ${aaveAsset.asset.protocol}`);
    console.log(`  Base Token: ${aaveAsset.asset.baseToken}`);
    console.log(`  Yield Token: ${aaveAsset.asset.yieldToken}`);
    
    console.log('\nYield Information:');
    console.log(`  Current APY: ${aaveAsset.asset.yield.currentAPY}`);
    console.log(`  7-Day APY: ${aaveAsset.asset.yield.apy7d}`);
    console.log(`  30-Day APY: ${aaveAsset.asset.yield.apy30d}`);
    
    console.log('\nFee Information:');
    console.log(`  Deposit Fee: ${aaveAsset.asset.fees.depositFee}`);
    console.log(`  Withdrawal Fee: ${aaveAsset.asset.fees.withdrawalFee}`);
    console.log(`  Performance Fee: ${aaveAsset.asset.fees.performanceFee}`);
    console.log(`  Estimated Fees: ${aaveAsset.asset.fees.estimatedFees.fees}`);
    
    console.log('\nPrice Information:');
    console.log(`  Base Token Price: ${aaveAsset.asset.price.baseTokenPrice}`);
    console.log(`  Yield Token Price: ${aaveAsset.asset.price.yieldTokenPrice}`);
    console.log(`  Exchange Rate: ${aaveAsset.asset.price.exchangeRate}`);
    
    console.log('\nConversion:');
    console.log(`  Input: ${aaveAsset.asset.conversion.input.amount} ${aaveAsset.asset.conversion.input.token}`);
    console.log(`  Output: ${aaveAsset.asset.conversion.output.expectedAmount} ${aaveAsset.asset.conversion.output.token}`);
    console.log(`  Min Amount: ${aaveAsset.asset.conversion.output.minAmount}`);
    
    console.log('\nProtocol Health:');
    console.log(`  Status: ${aaveAsset.asset.protocolHealth.status}`);
    console.log(`  TVL: ${aaveAsset.asset.protocolHealth.tvl}`);
    console.log(`  Utilization Rate: ${aaveAsset.asset.protocolHealth.utilizationRate}`);
    
    // Example 4: Query Hook asset information (Compound USDT)
    console.log('\n\n4. Query Hook Asset Info - Compound USDT');
    console.log('-'.repeat(50));

    const compoundRequest: HookAssetRequest = {
      chain: 60,  // Ethereum (SLIP-44)
      protocol: 'compound',
      baseToken: 'USDT',
      amount: '100000000000',
    };

    const compoundAsset = await client.quote.getHookAsset(compoundRequest);
    
    console.log(`Protocol: ${compoundAsset.asset.protocol}`);
    console.log(`Current APY: ${compoundAsset.asset.yield.currentAPY}`);
    console.log(`Deposit Fee: ${compoundAsset.asset.fees.depositFee}`);
    console.log(`Withdrawal Fee: ${compoundAsset.asset.fees.withdrawalFee}`);
    console.log(`Performance Fee: ${compoundAsset.asset.fees.performanceFee}`);
    
    // Example 5: Compare alternatives
    console.log('\n\n5. Alternative Protocols Comparison');
    console.log('-'.repeat(50));

    if (aaveAsset.alternatives && aaveAsset.alternatives.length > 0) {
      console.log('Available alternatives:');
      aaveAsset.alternatives.forEach((alt, index) => {
        console.log(`  ${index + 1}. ${alt.protocol}`);
        console.log(`     Yield Token: ${alt.yieldToken}`);
        console.log(`     APY: ${alt.currentAPY}`);
        console.log(`     Reason: ${alt.reason}`);
      });
    }

    console.log('\n\n=== Examples Complete ===');
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

main();

