/**
 * Test script for KYT Oracle APIs using SDK
 */

import { EnclaveClient } from './src';

async function testKYTOracleAPIs() {
  console.log('==========================================');
  console.log('Testing KYT Oracle APIs with SDK');
  console.log('==========================================\n');

  // Initialize the client
  const client = new EnclaveClient({
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001/ws',
    signer: async (message: string) => {
      // For testing, we can use a dummy signer
      // In production, this would be a real wallet signer
      console.log('Signing message:', message);
      return '0x' + '0'.repeat(130); // Dummy signature
    },
    logLevel: 'info',
  });

  // Test addresses
  const testAddress1 = '0x' + Math.random().toString(16).substring(2, 42).padStart(40, '0');
  const testAddress2 = '0x' + Math.random().toString(16).substring(2, 42).padStart(40, '0');
  const chain = 'bsc';
  const tokenKey = 'USDT';

  console.log('Test Address 1:', testAddress1);
  console.log('Test Address 2:', testAddress2);
  console.log('Chain:', chain);
  console.log('Token Key:', tokenKey);
  console.log('');

  try {
    // Note: We don't need to connect/authenticate for these public APIs
    // But if authentication is required, we would need to call client.connect() first

    // ============ Test 1: Associate Address with Invitation Code ============
    console.log('==========================================');
    console.log('Test 1: Associate Address with Invitation Code');
    console.log('==========================================\n');

    console.log('1.1 Associate Address 1 with INVATE3:');
    try {
      const result1 = await client.kytOracle.associateAddressWithCode({
        address: testAddress1,
        code: 'INVATE3',
        chain: chain,
      });
      console.log('✅ Success:', result1.success);
      console.log('   Message:', result1.message);
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('1.2 Associate Address 2 with TEST001:');
    try {
      const result2 = await client.kytOracle.associateAddressWithCode({
        address: testAddress2,
        code: 'TEST001',
        chain: chain,
      });
      console.log('✅ Success:', result2.success);
      console.log('   Message:', result2.message);
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    // ============ Test 2: Get Invitation Code by Address ============
    console.log('==========================================');
    console.log('Test 2: Get Invitation Code by Address');
    console.log('==========================================\n');

    console.log('2.1 Query Invitation Code for Address 1 (should return INVATE3):');
    try {
      const codeInfo1 = await client.kytOracle.getInvitationCodeByAddress({
        address: testAddress1,
        chain: chain,
      });
      console.log('✅ Success:', codeInfo1.success);
      console.log('   Code:', codeInfo1.data.code);
      console.log('   Fee Rate:', codeInfo1.data.fee_rate_percent, '%');
      console.log('   Source:', codeInfo1.data.source);
      console.log('   Enabled:', codeInfo1.data.enabled);
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('2.2 Query Invitation Code for Address 2 (should return TEST001):');
    try {
      const codeInfo2 = await client.kytOracle.getInvitationCodeByAddress({
        address: testAddress2,
        chain: chain,
      });
      console.log('✅ Success:', codeInfo2.success);
      console.log('   Code:', codeInfo2.data.code);
      console.log('   Fee Rate:', codeInfo2.data.fee_rate_percent, '%');
      console.log('   Source:', codeInfo2.data.source);
      console.log('   Enabled:', codeInfo2.data.enabled);
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    // ============ Test 3: Get Fee Info by Address (with Rate Limiting) ============
    console.log('==========================================');
    console.log('Test 3: Get Fee Info by Address (with Rate Limiting)');
    console.log('==========================================\n');

    console.log('3.1 First Fee Query for Address 1 (should succeed):');
    try {
      const feeInfo1 = await client.kytOracle.getFeeInfoByAddress({
        address: testAddress1,
        chain: chain,
        tokenKey: tokenKey,
      });

      if (feeInfo1.success && feeInfo1.data) {
        console.log('✅ Success:', feeInfo1.success);
        console.log('   Base Fee:', feeInfo1.data.baseFee);
        console.log('   Fee Rate (BPS):', feeInfo1.data.feeRateBps);
        console.log('   Base Fee Rate:', feeInfo1.data.baseFeeRatePercent, '%');
        console.log('   Risk-Based Fee:', feeInfo1.data.riskBasedFeePercent, '%');
        console.log('   Final Fee Rate:', feeInfo1.data.finalFeeRatePercent, '%');
        console.log('   Risk Score:', feeInfo1.data.riskScore);
        console.log('   Risk Level:', feeInfo1.data.riskLevel);
        console.log('   Invitation Code:', feeInfo1.data.invitationCode);
        console.log('   Invitation Source:', feeInfo1.data.invitationSource);
        console.log('   Last Query Time:', feeInfo1.last_query_time);
      } else if (feeInfo1.rate_limit_error) {
        console.log('⚠️  Rate Limited:', feeInfo1.rate_limit_error);
        console.log('   Last Query Time:', feeInfo1.last_query_time);
        console.log('   Last Risk Score:', feeInfo1.risk_score);
        console.log('   Last Risk Level:', feeInfo1.risk_level);
      } else {
        console.log('❌ Unexpected response:', feeInfo1);
      }
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('3.2 Second Fee Query for Address 1 immediately (should be rate limited):');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      const feeInfo2 = await client.kytOracle.getFeeInfoByAddress({
        address: testAddress1,
        chain: chain,
        tokenKey: tokenKey,
      });

      if (feeInfo2.rate_limit_error) {
        console.log('✅ Rate Limited (expected):', feeInfo2.rate_limit_error);
        console.log('   Last Query Time:', feeInfo2.last_query_time);
        console.log('   Last Risk Score:', feeInfo2.risk_score);
        console.log('   Last Risk Level:', feeInfo2.risk_level);
      } else if (feeInfo2.success && feeInfo2.data) {
        console.log('⚠️  Not Rate Limited (unexpected):');
        console.log('   Final Fee Rate:', feeInfo2.data.finalFeeRatePercent, '%');
      } else {
        console.log('❌ Unexpected response:', feeInfo2);
      }
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('3.3 First Fee Query for Address 2 (should succeed):');
    try {
      const feeInfo3 = await client.kytOracle.getFeeInfoByAddress({
        address: testAddress2,
        chain: chain,
        tokenKey: tokenKey,
      });

      if (feeInfo3.success && feeInfo3.data) {
        console.log('✅ Success:', feeInfo3.success);
        console.log('   Final Fee Rate:', feeInfo3.data.finalFeeRatePercent, '%');
        console.log('   Invitation Code:', feeInfo3.data.invitationCode);
        console.log('   Risk Score:', feeInfo3.data.riskScore);
        console.log('   Risk Level:', feeInfo3.data.riskLevel);
      } else if (feeInfo3.rate_limit_error) {
        console.log('⚠️  Rate Limited:', feeInfo3.rate_limit_error);
      } else {
        console.log('❌ Unexpected response:', feeInfo3);
      }
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    // ============ Test 4: Re-associate Address ============
    console.log('==========================================');
    console.log('Test 4: Re-associate Address (Update to Lower Rate)');
    console.log('==========================================\n');

    console.log('4.1 Re-associate Address 1 with TEST001:');
    try {
      const result3 = await client.kytOracle.associateAddressWithCode({
        address: testAddress1,
        code: 'TEST001',
        chain: chain,
      });
      console.log('✅ Success:', result3.success);
      console.log('   Message:', result3.message);
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('4.2 Query Invitation Code for Address 1 again (should now return TEST001):');
    try {
      const codeInfo3 = await client.kytOracle.getInvitationCodeByAddress({
        address: testAddress1,
        chain: chain,
      });
      console.log('✅ Success:', codeInfo3.success);
      console.log('   Code:', codeInfo3.data.code);
      console.log('   Fee Rate:', codeInfo3.data.fee_rate_percent, '%');
      console.log('');
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      console.log('');
    }

    console.log('==========================================');
    console.log('All Tests Completed!');
    console.log('==========================================');
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
testKYTOracleAPIs().catch(console.error);

