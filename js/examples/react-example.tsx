/**
 * React usage example for Enclave SDK
 */

import React from 'react';
import {
  EnclaveProvider,
  useEnclave,
  useCheckbooks,
  useAllocations,
  usePrices,
  useConnection,
  AllocationStatus,
} from '../src/platforms/react';

// App wrapper with EnclaveProvider
function App() {
  return (
    <EnclaveProvider
      config={{
        apiUrl: 'https://api.enclave-hq.com',
        wsUrl: 'wss://api.enclave-hq.com/ws',
        // In a real app, you would get this from MetaMask or other wallet
        signer: window.ethereum,
      }}
      autoConnect={true}
    >
      <Dashboard />
    </EnclaveProvider>
  );
}

// Dashboard component
function Dashboard() {
  const { client, isConnected, isConnecting, error } = useEnclave();
  const checkbooks = useCheckbooks();
  const allocations = useAllocations();
  const prices = usePrices();
  const { isConnected: connStatus } = useConnection();

  // Filter idle allocations
  const idleAllocations = allocations.filter(
    (a) => a.status === AllocationStatus.Idle
  );

  // Handle create commitment
  const handleCreateCommitment = async () => {
    if (!client || checkbooks.length === 0) return;

    try {
      const checkbook = checkbooks[0];
      const newAllocations = await client.createCommitment({
        checkbookId: checkbook.id,
        amounts: ['1000000', '2000000'],
        tokenId: checkbook.token.id,
      });
      console.log('Created allocations:', newAllocations);
    } catch (err) {
      console.error('Failed to create commitment:', err);
    }
  };

  // Handle create withdrawal
  const handleCreateWithdrawal = async () => {
    if (!client || idleAllocations.length === 0) return;

    try {
      const withdrawRequest = await client.withdraw({
        allocationIds: idleAllocations.map((a) => a.id),
        targetChain: 1,
        targetAddress: client.address!.address,
        intent: 'withdraw',
      });
      console.log('Created withdrawal:', withdrawRequest);
    } catch (err) {
      console.error('Failed to create withdrawal:', err);
    }
  };

  if (isConnecting) {
    return <div>Connecting to Enclave...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!isConnected) {
    return <div>Not connected</div>;
  }

  return (
    <div>
      <h1>Enclave Dashboard</h1>

      <section>
        <h2>Checkbooks</h2>
        <p>Total: {checkbooks.length}</p>
        <ul>
          {checkbooks.map((checkbook) => (
            <li key={checkbook.id}>
              {checkbook.token.symbol}: {checkbook.remainingAmount} /{' '}
              {checkbook.depositAmount} (Status: {checkbook.status})
            </li>
          ))}
        </ul>
        <button onClick={handleCreateCommitment} disabled={checkbooks.length === 0}>
          Create Allocations
        </button>
      </section>

      <section>
        <h2>Allocations</h2>
        <p>Total: {allocations.length}</p>
        <p>Idle: {idleAllocations.length}</p>
        <button onClick={handleCreateWithdrawal} disabled={idleAllocations.length === 0}>
          Create Withdrawal
        </button>
      </section>

      <section>
        <h2>Token Prices</h2>
        <ul>
          {prices.map((price) => (
            <li key={price.symbol}>
              {price.symbol}: ${price.price.toFixed(2)}
              {price.change24h !== undefined && (
                <span style={{ color: price.change24h > 0 ? 'green' : 'red' }}>
                  {' '}
                  ({price.change24h > 0 ? '+' : ''}
                  {price.change24h.toFixed(2)}%)
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;

