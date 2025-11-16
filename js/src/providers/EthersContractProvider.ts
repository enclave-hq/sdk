/**
 * Contract Provider implementation using ethers.js
 */

import type { IContractProvider, TransactionReceipt } from '../types/contract-provider';
import type { Contract, Provider, Signer } from 'ethers';

/**
 * Ethers Contract Provider
 * 
 * Wraps ethers.js to provide IContractProvider interface
 */
export class EthersContractProvider implements IContractProvider {
  constructor(
    private providerOrSigner: Provider | Signer,
    private address?: string
  ) {}

  async readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[]
  ): Promise<T> {
    // Dynamic import to avoid bundling ethers if not used
    const { Contract } = await import('ethers');
    
    const contract = new Contract(address, abi, this.providerOrSigner);
    const result = await contract[functionName](...(args || []));
    return result as T;
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
    const { Contract } = await import('ethers');
    
    // Check if we have a signer
    if (!('sendTransaction' in this.providerOrSigner)) {
      throw new Error('Signer required for write operations');
    }
    
    const contract = new Contract(address, abi, this.providerOrSigner as Signer);
    
    // Build transaction options
    const txOptions: any = {};
    if (options?.value) txOptions.value = options.value;
    if (options?.gas) txOptions.gasLimit = options.gas;
    if (options?.gasPrice) txOptions.gasPrice = options.gasPrice;
    
    const tx = await contract[functionName](...(args || []), txOptions);
    return tx.hash;
  }

  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<TransactionReceipt> {
    // Get provider from signer if needed
    let provider: Provider;
    if ('provider' in this.providerOrSigner && this.providerOrSigner.provider) {
      provider = this.providerOrSigner.provider;
    } else {
      provider = this.providerOrSigner as Provider;
    }
    
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      from: receipt.from,
      to: receipt.to || '',
      status: receipt.status === 1 ? 'success' : 'failed',
      gasUsed: receipt.gasUsed.toString(),
      logs: receipt.logs,
    };
  }

  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address;
    }
    
    if ('getAddress' in this.providerOrSigner) {
      this.address = await this.providerOrSigner.getAddress();
      return this.address;
    }
    
    throw new Error('Address not available');
  }

  /**
   * Get current chain ID from ethers.js provider
   * Returns EVM Chain ID (e.g., 56 for BSC, 1 for Ethereum) as provided by the RPC
   * This is used for RPC operations and differs from SLIP-44 chain ID used in API calls
   */
  async getChainId(): Promise<number> {
    let provider: Provider;
    if ('provider' in this.providerOrSigner && this.providerOrSigner.provider) {
      provider = this.providerOrSigner.provider;
    } else {
      provider = this.providerOrSigner as Provider;
    }
    
    const network = await provider.getNetwork();
    return Number(network.chainId); // Returns EVM Chain ID
  }

  isConnected(): boolean {
    return true; // ethers doesn't have a clear "connected" state
  }
}


