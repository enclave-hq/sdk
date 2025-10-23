/**
 * @enclave-hq/wallet-sdk Integration Example
 * 
 * This example demonstrates how to integrate @enclave-hq/wallet-sdk with @enclave-hq/sdk
 * using the Adapter pattern.
 * 
 * Architecture:
 * - wallet-sdk: Independent package for wallet connection, signing, and contract calls
 * - SDK: Business logic, backend communication, and data management
 * - Contract Provider: Abstraction layer that allows SDK to use wallet-sdk or other solutions
 * 
 * Key Design Principles:
 * 1. wallet-sdk does NOT depend on SDK (remains independent)
 * 2. SDK defines IContractProvider interface (abstraction)
 * 3. SDK provides adapters to bridge wallet-sdk → IContractProvider
 * 4. Users can choose different contract providers (wallet-sdk, ethers, viem, etc.)
 */

import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { EnclaveClient, WalletSDKContractProvider } from '@enclave-hq/sdk';
import { WalletManager, WalletType, ChainType } from '@enclave-hq/wallet-sdk';
import type { Account } from '@enclave-hq/wallet-sdk';

/**
 * Create a signer adapter that bridges wallet-sdk to SDK
 */
function createWalletSigner(walletManager: WalletManager) {
  return {
    // Get address from wallet
    getAddress: async (): Promise<string> => {
      const account = walletManager.getCurrentAccount();
      if (!account) {
        throw new Error('No account connected');
      }
      return account.nativeAddress;
    },
    
    // Sign message using wallet
    signMessage: async (message: string | Uint8Array): Promise<string> => {
      const messageStr = typeof message === 'string' 
        ? message 
        : Buffer.from(message).toString('hex');
      
      return await walletManager.signMessage(messageStr);
    },
  };
}

/**
 * Enclave App with wallet-sdk integration
 */
export const EnclaveWalletSDKExample: React.FC = observer(() => {
  // Wallet SDK state
  const [walletManager] = useState(() => new WalletManager());
  const [account, setAccount] = useState<Account | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Enclave SDK state
  const [enclaveClient, setEnclaveClient] = useState<EnclaveClient | null>(null);
  const [isEnclaveConnected, setIsEnclaveConnected] = useState(false);
  
  // UI state
  const [status, setStatus] = useState<string>('Not connected');
  const [error, setError] = useState<string>('');

  // ============================================
  // Step 1: Connect Wallet (wallet-sdk)
  // ============================================
  const handleConnectWallet = async (walletType: WalletType) => {
    try {
      setStatus('Connecting to wallet...');
      setError('');
      
      // Connect wallet using wallet-sdk
      await walletManager.connect(walletType);
      
      const currentAccount = walletManager.getCurrentAccount();
      if (!currentAccount) {
        throw new Error('Failed to get account after connection');
      }
      
      setAccount(currentAccount);
      setIsConnected(true);
      setStatus(`Connected to ${walletType}`);
      
    } catch (err: any) {
      setError(`Wallet connection failed: ${err.message}`);
      setStatus('Connection failed');
      console.error('Wallet connection error:', err);
    }
  };

  // ============================================
  // Step 2: Connect to Enclave (SDK)
  // ============================================
  const handleConnectEnclave = async () => {
    if (!isConnected || !account) {
      setError('Please connect wallet first');
      return;
    }
    
    try {
      setStatus('Connecting to Enclave...');
      setError('');
      
      // Create signer adapter (for message signing)
      const signer = createWalletSigner(walletManager);
      
      // Create contract provider adapter (for contract read/write)
      const contractProvider = new WalletSDKContractProvider(walletManager);
      
      // Initialize Enclave SDK
      const client = new EnclaveClient({
        apiUrl: 'https://api.enclave-hq.com',
        wsUrl: 'wss://api.enclave-hq.com/ws',
        signer,           // For message signing
        contractProvider, // For contract interactions
      });
      
      // Connect to Enclave
      await client.connect();
      
      setEnclaveClient(client);
      setIsEnclaveConnected(true);
      setStatus('Connected to Enclave');
      
    } catch (err: any) {
      setError(`Enclave connection failed: ${err.message}`);
      setStatus('Enclave connection failed');
      console.error('Enclave connection error:', err);
    }
  };

  // ============================================
  // Step 3: Read Contract
  // ============================================
  // Option A: Use wallet-sdk directly (no SDK needed)
  const handleReadContractDirect = async () => {
    if (!isConnected || !account) {
      setError('Wallet not connected');
      return;
    }
    
    try {
      setStatus('Reading contract (via wallet-sdk)...');
      setError('');
      
      const ERC20_ABI = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ];
      
      // Direct use of wallet-sdk API
      const balance = await walletManager.readContract(
        '0xYourTokenAddress',
        ERC20_ABI,
        'balanceOf',
        [account.nativeAddress]
      );
      
      setStatus(`Balance: ${balance.toString()}`);
      console.log('Contract read result:', balance);
      
    } catch (err: any) {
      setError(`Read contract failed: ${err.message}`);
      console.error('Read contract error:', err);
    }
  };

  // Option B: Use SDK's contract provider (if SDK is connected)
  const handleReadContractViaSDK = async () => {
    if (!enclaveClient || !isEnclaveConnected) {
      setError('Enclave SDK not connected');
      return;
    }
    
    try {
      setStatus('Reading contract (via SDK)...');
      setError('');
      
      const ERC20_ABI = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ];
      
      // Use SDK's contract provider (internally uses wallet-sdk)
      const balance = await enclaveClient.contractProvider.readContract(
        '0xYourTokenAddress',
        ERC20_ABI,
        'balanceOf',
        [account!.nativeAddress]
      );
      
      setStatus(`Balance (via SDK): ${balance.toString()}`);
      console.log('Contract read result:', balance);
      
    } catch (err: any) {
      setError(`Read contract failed: ${err.message}`);
      console.error('Read contract error:', err);
    }
  };

  // ============================================
  // Step 4: Write Contract
  // ============================================
  const handleWriteContract = async () => {
    if (!isConnected || !account) {
      setError('Wallet not connected');
      return;
    }
    
    try {
      setStatus('Writing to contract...');
      setError('');
      
      const ERC20_ABI = [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ];
      
      // Use wallet-sdk directly
      const txHash = await walletManager.writeContract(
        '0xYourTokenAddress',
        ERC20_ABI,
        'approve',
        ['0xSpenderAddress', '1000000000000000000'] // 1 token (18 decimals)
      );
      
      setStatus(`Transaction sent: ${txHash}`);
      console.log('Transaction hash:', txHash);
      
      // Wait for confirmation
      const receipt = await walletManager.waitForTransaction(txHash);
      setStatus(`Transaction confirmed in block ${receipt.blockNumber}`);
      
    } catch (err: any) {
      setError(`Write contract failed: ${err.message}`);
      console.error('Write contract error:', err);
    }
  };

  // ============================================
  // Step 5: SDK Business Operations
  // ============================================
  const handleCreateCheckbook = async () => {
    if (!enclaveClient || !isEnclaveConnected) {
      setError('Enclave SDK not connected');
      return;
    }
    
    try {
      setStatus('Creating checkbook...');
      setError('');
      
      // Use SDK for business logic
      const result = await enclaveClient.actions.createCommitment({
        poolId: 'pool-id',
        tokenAddress: '0xTokenAddress',
        amount: '1000000000000000000', // 1 token
        allocations: [
          { amount: '500000000000000000' }, // 0.5 token
          { amount: '500000000000000000' }, // 0.5 token
        ],
      });
      
      setStatus(`Checkbook created: ${result.checkbookId}`);
      console.log('Checkbook result:', result);
      
    } catch (err: any) {
      setError(`Create checkbook failed: ${err.message}`);
      console.error('Create checkbook error:', err);
    }
  };

  const handleWithdraw = async () => {
    if (!enclaveClient || !isEnclaveConnected) {
      setError('Enclave SDK not connected');
      return;
    }
    
    try {
      setStatus('Creating withdrawal...');
      setError('');
      
      // Use SDK for business logic
      const result = await enclaveClient.actions.createWithdrawal({
        allocationIds: ['allocation-1', 'allocation-2'],
        targetChainId: account!.chainId,
        targetAddress: account!.nativeAddress,
        intent: {
          type: 'RawTokenIntent',
          data: {},
        },
      });
      
      setStatus(`Withdrawal created: ${result.withdrawRequestId}`);
      console.log('Withdrawal result:', result);
      
    } catch (err: any) {
      setError(`Withdrawal failed: ${err.message}`);
      console.error('Withdrawal error:', err);
    }
  };

  // ============================================
  // Event Listeners
  // ============================================
  useEffect(() => {
    if (!walletManager) return;
    
    // Listen to account changes
    const handleAccountChanged = (newAccount: Account | null) => {
      setAccount(newAccount);
      if (newAccount) {
        setStatus(`Account changed: ${newAccount.nativeAddress}`);
      } else {
        setStatus('Account disconnected');
        setIsConnected(false);
        setIsEnclaveConnected(false);
      }
    };
    
    // Listen to chain changes
    const handleChainChanged = (chainId: number) => {
      setStatus(`Chain changed to: ${chainId}`);
      
      // Optionally reconnect Enclave SDK
      if (enclaveClient) {
        console.warn('Chain changed. Consider reconnecting Enclave SDK.');
      }
    };
    
    walletManager.on('accountChanged', handleAccountChanged);
    walletManager.on('chainChanged', handleChainChanged);
    
    return () => {
      walletManager.off('accountChanged', handleAccountChanged);
      walletManager.off('chainChanged', handleChainChanged);
    };
  }, [walletManager, enclaveClient]);

  // ============================================
  // Cleanup
  // ============================================
  const handleDisconnect = async () => {
    try {
      if (enclaveClient) {
        await enclaveClient.disconnect();
      }
      await walletManager.disconnect();
      
      setAccount(null);
      setIsConnected(false);
      setEnclaveClient(null);
      setIsEnclaveConnected(false);
      setStatus('Disconnected');
      
    } catch (err: any) {
      setError(`Disconnect failed: ${err.message}`);
      console.error('Disconnect error:', err);
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔐 Enclave + Wallet SDK Integration</h1>
      
      {/* Status */}
      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <strong>Status:</strong> {status}
        {account && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Account:</strong> {account.nativeAddress}
            <br />
            <strong>Chain:</strong> {account.chainId} ({account.chainType})
          </div>
        )}
      </div>
      
      {/* Error */}
      {error && (
        <div style={{ marginBottom: '2rem', padding: '1rem', background: '#fee', color: '#c00', borderRadius: '8px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Step 1: Connect Wallet */}
      {!isConnected && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Step 1: Connect Wallet</h2>
          <button 
            onClick={() => handleConnectWallet(WalletType.METAMASK)}
            style={{ marginRight: '1rem' }}
          >
            Connect MetaMask
          </button>
          <button onClick={() => handleConnectWallet(WalletType.TRONLINK)}>
            Connect TronLink
          </button>
        </section>
      )}
      
      {/* Step 2: Connect Enclave */}
      {isConnected && !isEnclaveConnected && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Step 2: Connect to Enclave</h2>
          <button onClick={handleConnectEnclave}>
            Connect to Enclave
          </button>
        </section>
      )}
      
      {/* Step 3: Read Contract */}
      {isConnected && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Step 3: Read Contract (Two Options)</h2>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
            <strong>Option A:</strong> Use wallet-sdk directly (no SDK connection needed)
            <br />
            <button 
              onClick={handleReadContractDirect}
              style={{ marginTop: '0.5rem' }}
            >
              Read Contract (Direct)
            </button>
          </div>
          {isEnclaveConnected && (
            <div style={{ padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
              <strong>Option B:</strong> Use SDK's contract provider (requires SDK connection)
              <br />
              <button 
                onClick={handleReadContractViaSDK}
                style={{ marginTop: '0.5rem' }}
              >
                Read Contract (via SDK)
              </button>
            </div>
          )}
        </section>
      )}
      
      {/* Step 4: Write Contract */}
      {isConnected && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Step 4: Write Contract</h2>
          <button onClick={handleWriteContract}>
            Write Contract (Approve)
          </button>
        </section>
      )}
      
      {/* Step 5: Business Operations */}
      {isEnclaveConnected && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Enclave Operations (via SDK)</h2>
          <button 
            onClick={handleCreateCheckbook}
            style={{ marginRight: '1rem' }}
          >
            Create Checkbook
          </button>
          <button onClick={handleWithdraw}>
            Withdraw
          </button>
        </section>
      )}
      
      {/* Disconnect */}
      {isConnected && (
        <section>
          <button 
            onClick={handleDisconnect}
            style={{ background: '#c00', color: 'white' }}
          >
            Disconnect
          </button>
        </section>
      )}
      
      {/* MobX Stores Demo */}
      {isEnclaveConnected && enclaveClient && (
        <section style={{ marginTop: '2rem' }}>
          <h2>SDK Stores (Reactive Data)</h2>
          <div>
            <strong>Checkbooks:</strong> {enclaveClient.stores.checkbooks.all.length}
            <br />
            <strong>Allocations:</strong> {enclaveClient.stores.allocations.all.length}
            <br />
            <strong>Withdrawals:</strong> {enclaveClient.stores.withdrawals.all.length}
          </div>
        </section>
      )}
    </div>
  );
});

export default EnclaveWalletSDKExample;

