# Local Backend Testing Guide

This guide shows you how to test the SDK with a local backend instance, simulating the complete Enclave workflow.

## Overview

```
┌──────────────┐      HTTP/WebSocket      ┌──────────────┐
│   SDK Test   │ ←─────────────────────→  │   Backend    │
│  (Node.js)   │   localhost:3001         │  (Go Server) │
└──────────────┘                           └──────┬───────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │  PostgreSQL  │
                                           │   Database   │
                                           └──────────────┘
```

## Prerequisites

### 1. Backend Requirements
- Go 1.23+
- PostgreSQL 13+
- NATS Server with JetStream
- Blockchain RPC endpoints (BSC, Tron, etc.)

### 2. SDK Requirements
- Node.js 18+
- npm or yarn
- MetaMask browser extension (or private key)

## Setup Steps

### Step 1: Start Backend Services

#### Option A: Using Docker Compose (Recommended)

```bash
# Navigate to backend directory
cd /Users/qizhongzhu/enclave/backend

# Start all services (PostgreSQL, NATS, Backend)
docker-compose up -d

# Check logs
docker-compose logs -f zkpay-backend

# Wait for backend to be ready
curl http://localhost:3001/health
```

#### Option B: Manual Setup

```bash
# 1. Start PostgreSQL
docker run -d \
  --name zkpay-postgres \
  -e POSTGRES_USER=zkpay \
  -e POSTGRES_PASSWORD=zkpay \
  -e POSTGRES_DB=zkpay-backend \
  -p 5432:5432 \
  postgres:13-alpine

# 2. Start NATS with JetStream
docker run -d \
  --name zkpay-nats \
  -p 4222:4222 \
  nats:latest -js

# 3. Setup database
psql -h localhost -U zkpay -d zkpay-backend -f setup-postgresql.sql

# 4. Configure backend
cp config.yaml.example config.yaml
nano config.yaml  # Edit configuration

# 5. Start backend
./start-backend.sh

# Or run directly:
go run cmd/server/main.go -conf config.yaml
```

### Step 2: Verify Backend is Running

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-01T00:00:00Z",
#   "version": "2.0.0"
# }

# Check API documentation
curl http://localhost:3001/api/v2/swagger/index.html
```

### Step 3: Install SDK Dependencies

```bash
# Navigate to SDK directory
cd /Users/qizhongzhu/enclave/sdk/js

# Install dependencies
npm install

# Install wallet-sdk (if not already)
npm install @enclave-hq/wallet-sdk

# Build SDK (if needed)
npm run build
```

### Step 4: Run the Test

```bash
# Run local backend test
npm run test:local

# Or run directly with ts-node
npx ts-node examples/local-backend-test.ts

# With MetaMask (opens browser)
WALLET=metamask npx ts-node examples/local-backend-test.ts

# With private key (for CI/automated testing)
PRIVATE_KEY=0x... npx ts-node examples/local-backend-test.ts
```

## Test Workflow

The test executes the following steps:

### 1. Wallet Connection
```typescript
// Connect to MetaMask or use private key
const walletManager = new WalletManager();
await walletManager.connect(WalletType.METAMASK);
```

### 2. SDK Initialization
```typescript
// Connect to local backend
const client = new EnclaveClient({
  apiUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3001/ws',
  signer,
  contractProvider,
});
await client.connect();
```

### 3. Fetch User Data
```typescript
// Fetch checkbooks
const checkbooks = await client.stores.checkbooks.fetchByOwner(userAddress);

// Fetch allocations
const allocations = await client.stores.allocations.fetchList({
  owner: userAddress,
  limit: 100,
});

// Fetch withdrawals
const withdrawals = await client.stores.withdrawals.fetchList({
  owner: userAddress,
  limit: 100,
});
```

### 4. Create Allocations
```typescript
// Create commitment (allocations)
const newAllocations = await client.actions.createCommitment({
  poolId: 'pool-id',
  tokenAddress: '0x...',
  amount: '1000000000000000000', // 1 token
  allocations: [
    { amount: '400000000000000000' }, // 0.4 token
    { amount: '300000000000000000' }, // 0.3 token
    { amount: '300000000000000000' }, // 0.3 token
  ],
});
```

### 5. Create Withdrawal
```typescript
// Create withdrawal request
const withdrawRequest = await client.actions.createWithdrawal({
  allocationIds: ['alloc-1', 'alloc-2'],
  targetChainId: 56, // BSC
  targetAddress: userAddress,
  intent: {
    type: 'RawTokenIntent',
    data: {},
  },
});
```

### 6. Real-time Updates
```typescript
// Listen to WebSocket events
client.on('checkbookUpdated', (checkbook) => {
  console.log('Checkbook updated:', checkbook.id);
});

client.on('allocationUpdated', (allocation) => {
  console.log('Allocation updated:', allocation.id);
});

client.on('withdrawalUpdated', (withdrawal) => {
  console.log('Withdrawal updated:', withdrawal.id);
});
```

## Expected Output

```bash
🚀 Starting Local Backend Test

📱 Step 1: Setting up wallet...
✅ Wallet connected: 0x1234...5678

🔌 Step 2: Connecting to local backend...
✅ Connected to local backend
   API: http://localhost:3001
   WS:  ws://localhost:3001/ws

🏥 Step 3: Checking backend health...
✅ Backend is healthy: { status: 'ok', version: '2.0.0' }

📊 Step 4: Fetching user data...
✅ Found 2 checkbooks
   1. Checkbook cb-123
      Status: with_checkbook
      Amount: 1000000000000000000 USDT
   2. Checkbook cb-456
      Status: completed
      Amount: 500000000000000000 USDT
✅ Found 5 allocations
   Idle allocations: 3
✅ Found 1 withdrawals

💰 Step 5: Fetching token prices...
✅ Token prices:
   USDT: $1.00
   USDC: $1.00
   BNB: $320.50

🔢 Step 7: Creating allocations...
✅ Created 3 allocations
   1. Allocation alloc-789
      Amount: 400000000000000000
      Status: idle
   2. Allocation alloc-790
      Amount: 300000000000000000
      Status: idle
   3. Allocation alloc-791
      Amount: 300000000000000000
      Status: idle

💸 Step 8: Creating withdrawal...
✅ Withdrawal created: wd-999
   Status: pending
   Target: 0x1234...5678

📡 Step 9: Listening for real-time updates...
   (Press Ctrl+C to stop)

🔔 Allocation updated: alloc-789
   Status: used

🔔 Withdrawal updated: wd-999
   Status: completed

🧹 Step 10: Cleaning up...
✅ Disconnected from backend

🎉 Test completed successfully!

📊 Summary:
   Checkbooks: 2
   Allocations: 8 (3 idle)
   Withdrawals: 2
   Events received: 2

✅ All tests passed!
```

## Troubleshooting

### Backend Not Running

**Error**: `Failed to connect to backend: ECONNREFUSED`

**Solution**:
```bash
# Check if backend is running
curl http://localhost:3001/health

# If not, start backend
cd ../backend && ./start-backend.sh

# Check logs
tail -f backend.log
```

### Database Connection Error

**Error**: `Database connection failed`

**Solution**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U zkpay -d zkpay-backend -c "SELECT version();"

# Restart PostgreSQL if needed
docker restart zkpay-postgres
```

### NATS Connection Error

**Error**: `NATS connection failed`

**Solution**:
```bash
# Check NATS is running
docker ps | grep nats

# Restart NATS if needed
docker restart zkpay-nats

# Check NATS server info
curl http://localhost:8222/varz
```

### Wallet Connection Failed

**Error**: `No wallet detected`

**Solution**:
1. **For MetaMask**:
   - Install MetaMask browser extension
   - Connect to the correct network (BSC, etc.)
   - Unlock your wallet

2. **For Private Key**:
   ```bash
   # Set private key environment variable
   export PRIVATE_KEY=0x...
   npx ts-node examples/local-backend-test.ts
   ```

### No Checkbooks Found

This is normal for new accounts. To create checkbooks:

1. **Option 1**: Make a real deposit on-chain
   ```typescript
   // Call deposit contract method
   await depositContract.deposit(tokenAddress, amount);
   ```

2. **Option 2**: Insert test data directly into database
   ```sql
   -- Connect to database
   psql -h localhost -U zkpay -d zkpay-backend
   
   -- Insert test checkbook
   INSERT INTO checkbooks (id, owner_address, deposit_amount, status, ...)
   VALUES ('test-cb-1', '0x...', '1000000000000000000', 'with_checkbook', ...);
   ```

3. **Option 3**: Use backend API to simulate deposit
   ```bash
   curl -X POST http://localhost:3001/api/v2/test/create-checkbook \
     -H "Content-Type: application/json" \
     -d '{
       "owner": "0x...",
       "amount": "1000000000000000000",
       "token": "USDT"
     }'
   ```

### WebSocket Connection Issues

**Error**: `WebSocket connection failed`

**Solution**:
```bash
# Check WebSocket endpoint
wscat -c ws://localhost:3001/ws

# If connection fails, check backend logs
tail -f ../backend/backend.log | grep websocket

# Check firewall/proxy settings
```

## Advanced Testing

### Test with Multiple Wallets

```bash
# Terminal 1: User A
PRIVATE_KEY=0xAAA... npx ts-node examples/local-backend-test.ts

# Terminal 2: User B
PRIVATE_KEY=0xBBB... npx ts-node examples/local-backend-test.ts
```

### Test Cross-Chain Withdrawals

```typescript
// Withdraw from BSC to Tron
await client.actions.createWithdrawal({
  allocationIds: ['alloc-1'],
  targetChainId: 195, // Tron
  targetAddress: 'TRx...', // Tron address
  intent: {
    type: 'AssetTokenIntent',
    assetId: '0x...', // Target token on Tron
    data: {},
  },
});
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test config (artillery.yml)
# Run load test
artillery run load-test.yml
```

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: SDK Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13-alpine
        env:
          POSTGRES_USER: zkpay
          POSTGRES_PASSWORD: zkpay
          POSTGRES_DB: zkpay-backend
        ports:
          - 5432:5432
      
      nats:
        image: nats:latest
        args: ["-js"]
        ports:
          - 4222:4222
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Go
        uses: actions/setup-go@v2
        with:
          go-version: 1.23
      
      - name: Start Backend
        run: |
          cd backend
          go run cmd/server/main.go -conf config.yaml &
          sleep 5
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: 18
      
      - name: Install SDK Dependencies
        run: |
          cd sdk/js
          npm install
      
      - name: Run Tests
        env:
          PRIVATE_KEY: ${{ secrets.TEST_PRIVATE_KEY }}
        run: |
          cd sdk/js
          npm run test:local
```

## Next Steps

1. **Read API Documentation**: Check backend's `API_DOCUMENTATION.md`
2. **Explore WebSocket Events**: See `WEBSOCKET_INTEGRATION.md`
3. **Test Contract Interactions**: Try `readContract` and `writeContract`
4. **Build Your App**: Use this as a template for your application

## Support

- **Backend Issues**: [Backend GitHub Issues](https://github.com/enclave-hq/backend/issues)
- **SDK Issues**: [SDK GitHub Issues](https://github.com/enclave-hq/sdk/issues)
- **Discord**: [Join Community](https://discord.gg/enclave)

Happy testing! 🚀


