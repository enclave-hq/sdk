/**
 * KYT Oracle API Usage Examples
 * 
 * This example demonstrates how to use the three KYT Oracle APIs:
 * 1. Get invitation code by address
 * 2. Get fee info by address (with rate limiting)
 * 3. Associate address with invitation code
 */

import { EnclaveClient } from '../src';

async function kytOracleExamples() {
  // Initialize the client
  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',
    signer: async (message: string) => {
      // Your signer implementation
      return '0x...';
    },
  });

  await client.connect();

  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const chain = 'bsc';
  const tokenKey = 'USDT';

  // ============ Example 1: Get Invitation Code by Address ============
  console.log('=== Example 1: Get Invitation Code by Address ===');
  try {
    const codeInfo = await client.kytOracle.getInvitationCodeByAddress({
      address,
      chain,
    });

    console.log('Invitation Code:', codeInfo.data.code);
    console.log('Fee Rate:', codeInfo.data.fee_rate_percent, '%');
    console.log('Source:', codeInfo.data.source);
    console.log('Enabled:', codeInfo.data.enabled);
  } catch (error) {
    console.error('Failed to get invitation code:', error);
  }

  // ============ Example 2: Get Fee Info by Address (with Rate Limiting) ============
  console.log('\n=== Example 2: Get Fee Info by Address ===');
  try {
    const feeInfo = await client.kytOracle.getFeeInfoByAddress({
      address,
      chain,
      tokenKey,
    });

    if (feeInfo.success && feeInfo.data) {
      console.log('Base Fee:', feeInfo.data.baseFee);
      console.log('Fee Rate (BPS):', feeInfo.data.feeRateBps);
      console.log('Base Fee Rate:', feeInfo.data.baseFeeRatePercent, '%');
      console.log('Risk-Based Fee:', feeInfo.data.riskBasedFeePercent, '%');
      console.log('Final Fee Rate:', feeInfo.data.finalFeeRatePercent, '%');
      console.log('Risk Score:', feeInfo.data.riskScore);
      console.log('Risk Level:', feeInfo.data.riskLevel);
      console.log('Invitation Code:', feeInfo.data.invitationCode);
      console.log('Invitation Source:', feeInfo.data.invitationSource);
      console.log('Last Query Time:', feeInfo.last_query_time);
    } else if (feeInfo.rate_limit_error) {
      console.log('Rate Limited:', feeInfo.rate_limit_error);
      console.log('Last Query Time:', feeInfo.last_query_time);
      // Even when rate limited, the response includes last query data
      if (feeInfo.data) {
        console.log('Last Fee Info (from cached data):');
        console.log('  Base Fee:', feeInfo.data.baseFee);
        console.log('  Fee Rate (BPS):', feeInfo.data.feeRateBps);
        console.log('  Base Fee Rate:', feeInfo.data.baseFeeRatePercent, '%');
        console.log('  Risk-Based Fee:', feeInfo.data.riskBasedFeePercent, '%');
        console.log('  Final Fee Rate:', feeInfo.data.finalFeeRatePercent, '%');
        console.log('  Risk Score:', feeInfo.data.riskScore);
        console.log('  Risk Level:', feeInfo.data.riskLevel);
        console.log('  Invitation Code:', feeInfo.data.invitationCode);
        console.log('  Invitation Source:', feeInfo.data.invitationSource);
      } else {
        // Fallback to top-level risk score/level if data is not available
        console.log('Last Risk Score:', feeInfo.risk_score);
        console.log('Last Risk Level:', feeInfo.risk_level);
      }
    }
  } catch (error) {
    console.error('Failed to get fee info:', error);
  }

  // ============ Example 3: Associate Address with Invitation Code ============
  console.log('\n=== Example 3: Associate Address with Invitation Code ===');
  try {
    const result = await client.kytOracle.associateAddressWithCode({
      address,
      code: 'INVATE3',
      chain,
    });

    console.log('Success:', result.success);
    console.log('Message:', result.message);
  } catch (error) {
    console.error('Failed to associate address:', error);
  }

  // ============ Example 4: Re-associate with Different Code (Update to Lower Rate) ============
  console.log('\n=== Example 4: Re-associate with Different Code ===');
  try {
    // First associate with one code
    await client.kytOracle.associateAddressWithCode({
      address,
      code: 'INVATE3',
      chain,
    });

    // Then update to a different code (e.g., with lower rate)
    const result = await client.kytOracle.associateAddressWithCode({
      address,
      code: 'TEST001',
      chain,
    });

    console.log('Updated to new code:', result.success);
    console.log('Message:', result.message);

    // Verify the update by querying fee info
    const updatedFeeInfo = await client.kytOracle.getFeeInfoByAddress({
      address,
      chain,
      tokenKey,
    });

    if (updatedFeeInfo.data) {
      console.log('New Invitation Code:', updatedFeeInfo.data.invitationCode);
      console.log('New Fee Rate:', updatedFeeInfo.data.finalFeeRatePercent, '%');
    }
  } catch (error) {
    console.error('Failed to re-associate address:', error);
  }

  // ============ Example 5: Handle Rate Limiting ============
  console.log('\n=== Example 5: Handle Rate Limiting ===');
  try {
    // First query - should succeed
    const firstQuery = await client.kytOracle.getFeeInfoByAddress({
      address,
      chain,
      tokenKey,
    });

    console.log('First Query - Success:', firstQuery.success);
    if (firstQuery.data) {
      console.log('First Query - Fee Rate:', firstQuery.data.finalFeeRatePercent, '%');
    }

    // Second query immediately - should be rate limited
    const secondQuery = await client.kytOracle.getFeeInfoByAddress({
      address,
      chain,
      tokenKey,
    });

    if (secondQuery.rate_limit_error) {
      console.log('Second Query - Rate Limited:', secondQuery.rate_limit_error);
      // Even when rate limited, the response includes last query data
      if (secondQuery.data) {
        console.log('Second Query - Last Fee Info (from cached data):');
        console.log('  Final Fee Rate:', secondQuery.data.finalFeeRatePercent, '%');
        console.log('  Risk Score:', secondQuery.data.riskScore);
        console.log('  Risk Level:', secondQuery.data.riskLevel);
      } else {
        // Fallback to top-level risk score/level if data is not available
        console.log('Second Query - Last Risk Score:', secondQuery.risk_score);
        console.log('Second Query - Last Risk Level:', secondQuery.risk_level);
      }
    } else if (secondQuery.data) {
      console.log('Second Query - Success:', secondQuery.success);
      console.log('Second Query - Fee Rate:', secondQuery.data.finalFeeRatePercent, '%');
    }
  } catch (error) {
    console.error('Failed to handle rate limiting:', error);
  }
}

// Run examples
if (require.main === module) {
  kytOracleExamples().catch(console.error);
}

export { kytOracleExamples };

