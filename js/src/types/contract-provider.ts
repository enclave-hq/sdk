/**
 * Contract Provider Interface
 * 
 * Abstraction layer for contract interactions.
 * Can be implemented by:
 * - @enclave-hq/wallet-sdk
 * - ethers.js
 * - viem
 * - TronWeb
 * - Custom implementations
 */

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number | bigint;
  blockHash: string;
  from: string;
  to: string;
  status: 'success' | 'failed' | 'pending';
  gasUsed: string;
  logs: any[];
}

/**
 * Contract Provider Interface
 * 
 * Provides unified interface for contract read/write operations
 */
export interface IContractProvider {
  /**
   * Read contract (call view/pure functions)
   * @param address Contract address
   * @param abi Contract ABI
   * @param functionName Function name
   * @param args Function arguments
   * @returns Function return value
   */
  readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[]
  ): Promise<T>;

  /**
   * Write contract (send transactions)
   * @param address Contract address
   * @param abi Contract ABI
   * @param functionName Function name
   * @param args Function arguments
   * @param options Transaction options (gas, value, etc.)
   * @returns Transaction hash
   */
  writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string | bigint;
      gas?: string | bigint;
      gasPrice?: string | bigint;
    }
  ): Promise<string>;

  /**
   * Wait for transaction confirmation
   * @param txHash Transaction hash
   * @param confirmations Number of confirmations to wait
   * @returns Transaction receipt
   */
  waitForTransaction(
    txHash: string,
    confirmations?: number
  ): Promise<TransactionReceipt>;

  /**
   * Get current account address
   * @returns Account address
   */
  getAddress(): Promise<string>;

  /**
   * Get current chain ID from RPC provider
   * Note: Returns EVM Chain ID (e.g., 56 for BSC, 1 for Ethereum) as provided by the RPC provider
   * This is different from SLIP-44 chain ID used in API calls (e.g., 714 for BSC, 60 for Ethereum)
   * @returns EVM Chain ID (for RPC operations)
   */
  getChainId(): Promise<number>;

  /**
   * Check if provider is connected
   * @returns True if connected
   */
  isConnected(): boolean;
}


