# Integration Tests

This directory contains end-to-end integration tests for the Enclave SDK.

## Test: Deposit → Commitment → Withdraw

**File**: `deposit-commitment-withdraw.test.ts`

This test verifies the complete flow:
1. **Deposit**: Create a checkbook (simulating a deposit of 2 USDT)
2. **Wait**: Wait for checkbook status to be ready for commitment
3. **Commitment**: Create commitment with 4 allocations (split 2 USDT into 4 parts of 0.5 USDT each)
4. **Wait**: Wait for allocations to be idle
5. **Withdraw**: Create withdraw request combining all 4 allocations

## Prerequisites

1. Backend server must be running and accessible
2. Environment variables must be set:
   - `PRIVATE_KEY`: Private key for wallet authentication (required)
   - `API_URL`: Backend API URL (default: `http://localhost:3001`)
   - `WS_URL`: WebSocket URL (default: `ws://localhost:3001/ws`)

## Running the Test

```bash
# Set environment variables
export PRIVATE_KEY="your-private-key-here"
export API_URL="http://localhost:3001"
export WS_URL="ws://localhost:3001/ws"

# Run the test
npm test -- tests/integration/deposit-commitment-withdraw.test.ts

# Or run with vitest directly
npx vitest tests/integration/deposit-commitment-withdraw.test.ts
```

## Test Configuration

The test uses the following configuration (can be modified in the test file):

- **Chain ID**: 714 (BSC)
- **Token ID**: 1 (USDT)
- **Deposit Amount**: 2 USDT (2000000 in smallest unit, 6 decimals)
- **Allocation Count**: 4 (split into 4 parts)
- **Amount per Allocation**: 0.5 USDT (500000 in smallest unit)

## Notes

- The test creates a checkbook via API for testing purposes. In production, checkbooks are created automatically by the backend when `DepositReceived` events are detected from the blockscanner.
- The test includes timeouts and retry logic to handle asynchronous state updates.
- The test verifies:
  - Checkbook creation and status transitions
  - Commitment creation with multiple allocations
  - Allocation status transitions
  - Withdraw request creation with multiple allocations
  - Data consistency (amounts, IDs, etc.)

## Expected Output

The test will output detailed logs for each step:
- ✅ Checkbook creation
- ✅ Checkbook status updates
- ✅ Allocation creation
- ✅ Allocation status updates
- ✅ Withdraw request creation
- ✅ Withdraw request verification

