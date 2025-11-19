/**
 * Contract Provider implementation using @enclave-hq/wallet-sdk
 *
 * This adapter bridges @enclave-hq/wallet-sdk's WalletManager to SDK's IContractProvider interface.
 * wallet-sdk remains independent and does not depend on SDK types.
 */

import type { IContractProvider, TransactionReceipt } from '../types/contract-provider';

/**
 * Type definition for WalletManager (from @enclave-hq/wallet-sdk)
 * Defined here to avoid circular dependencies
 */
interface WalletManagerLike {
  readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    chainType?: any
  ): Promise<T>;

  writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string;
      gas?: number;
      gasPrice?: string;
    },
    chainType?: any
  ): Promise<string>;

  waitForTransaction(txHash: string, confirmations?: number, chainType?: any): Promise<any>;

  getCurrentAccount(): { nativeAddress: string; chainId: number } | null;

  isConnected(): boolean;
}

/**
 * Wallet SDK Contract Provider
 *
 * Adapter that wraps @enclave-hq/wallet-sdk to provide IContractProvider interface.
 * This allows SDK to use wallet-sdk without tight coupling.
 *
 * @example
 * ```typescript
 * import { WalletManager } from '@enclave-hq/wallet-sdk';
 * import { WalletSDKContractProvider } from '@enclave-hq/sdk';
 *
 * const walletManager = new WalletManager();
 * await walletManager.connect(WalletType.METAMASK);
 *
 * // Create adapter
 * const contractProvider = new WalletSDKContractProvider(walletManager);
 *
 * // Use with SDK
 * const client = new EnclaveClient({
 *   contractProvider,
 *   // ... other config
 * });
 * ```
 */
export class WalletSDKContractProvider implements IContractProvider {
  constructor(private walletManager: WalletManagerLike) {}

  async readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[]
  ): Promise<T> {
    // Directly delegate to wallet-sdk
    return this.walletManager.readContract(address, abi, functionName, args);
  }

  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string | bigint;
      gas?: string | bigint;
      gasPrice?: string | bigint;
    }
  ): Promise<string> {
    // Convert options format
    const walletOptions = options
      ? {
          value: options.value?.toString(),
          gas: options.gas ? Number(options.gas) : undefined,
          gasPrice: options.gasPrice?.toString(),
        }
      : undefined;

    return this.walletManager.writeContract(address, abi, functionName, args, walletOptions);
  }

  async waitForTransaction(txHash: string, confirmations?: number): Promise<TransactionReceipt> {
    // Directly delegate to wallet-sdk
    return this.walletManager.waitForTransaction(txHash, confirmations);
  }

  async getAddress(): Promise<string> {
    const account = this.walletManager.getCurrentAccount();
    if (!account) {
      throw new Error('No account connected');
    }
    return account.nativeAddress;
  }

  /**
   * Get current chain ID from wallet SDK
   * Returns EVM Chain ID (e.g., 56 for BSC, 1 for Ethereum) as provided by the wallet
   * This is used for RPC operations and differs from SLIP-44 chain ID used in API calls
   */
  async getChainId(): Promise<number> {
    const account = this.walletManager.getCurrentAccount();
    if (!account) {
      throw new Error('No account connected');
    }
    return account.chainId; // Returns EVM Chain ID
  }

  isConnected(): boolean {
    return this.walletManager.isConnected();
  }
}
