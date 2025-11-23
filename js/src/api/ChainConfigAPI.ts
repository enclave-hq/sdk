/**
 * Chain Configuration API client
 * @module api/ChainConfigAPI
 */

import type { APIClient } from './APIClient';

/**
 * Chain configuration response
 * Matches the backend API response from GET /api/chains
 */
export interface ChainConfig {
  id: number;
  chain_id: number;
  chain_name: string;
  treasury_address: string;
  intent_manager_address: string;
  rpc_endpoint: string;
  explorer_url: string;
  sync_enabled: boolean;
  sync_block_number: number;
  last_synced_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Note: zkpay_address is not included here because it's a global configuration,
  // not chain-specific. Use getGlobalZKPayProxy() method instead.
}

/**
 * Chain Config API endpoints
 * Public endpoints for querying chain configurations and contract addresses
 */
export class ChainConfigAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Get chain configuration by chain ID
   * Includes Treasury address, RPC endpoint, and other contract addresses
   * @param chainId - SLIP-44 chain ID (e.g., 195 for TRON, 714 for BSC)
   * @returns Chain configuration
   * @example
   * ```typescript
   * const config = await client.chainConfig.getChainConfig(195);
   * // {
   * //   chain_id: 195,
   * //   chain_name: "TRON",
   * //   treasury_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
   * //   zkpay_address: "...",
   * //   rpc_endpoint: "https://api.trongrid.io"
   * // }
   * ```
   */
  async getChainConfig(chainId: number): Promise<ChainConfig> {
    const response = await this.client.get<{ chain: ChainConfig }>(`/api/chains/${chainId}`);
    return response.chain;
  }

  /**
   * Get Treasury contract address for a chain
   * Convenience method for common use case
   * @param chainId - SLIP-44 chain ID
   * @returns Treasury contract address
   * @example
   * ```typescript
   * const treasuryAddress = await client.chainConfig.getTreasuryAddress(195);
   * // "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
   * ```
   */
  async getTreasuryAddress(chainId: number): Promise<string> {
    const config = await this.getChainConfig(chainId);
    return config.treasury_address;
  }

  /**
   * Get IntentManager contract address for a chain
   * @param chainId - SLIP-44 chain ID
   * @returns IntentManager contract address
   */
  async getIntentManagerAddress(chainId: number): Promise<string> {
    const config = await this.getChainConfig(chainId);
    return config.intent_manager_address;
  }

  /**
   * Get RPC endpoint for a chain
   * Note: This method accepts SLIP-44 chain ID (for API consistency)
   * When using the RPC endpoint, you should use EVM Chain ID for provider initialization
   * @param chainId - SLIP-44 chain ID (e.g., 714 for BSC, 60 for Ethereum)
   * @returns RPC endpoint URL
   * @example
   * ```typescript
   * // Get RPC endpoint using SLIP-44 (API call)
   * const rpcUrl = await client.chainConfig.getRpcEndpoint(714); // BSC
   *
   * // Convert to EVM Chain ID for provider (chain operation)
   * const evmChainId = getEvmChainIdFromSlip44(714); // Returns 56
   * const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: evmChainId });
   * ```
   */
  async getRpcEndpoint(chainId: number): Promise<string> {
    const config = await this.getChainConfig(chainId);
    return config.rpc_endpoint;
  }

  /**
   * List all active chain configurations
   * @returns Array of active chain configurations
   * @example
   * ```typescript
   * const chains = await client.chainConfig.listChains();
   * // [
   * //   { chain_id: 195, chain_name: "TRON", ... },
   * //   { chain_id: 714, chain_name: "BSC", ... },
   * //   ...
   * // ]
   * ```
   */
  async listChains(): Promise<ChainConfig[]> {
    const response = await this.client.get<{ chains: ChainConfig[] }>('/api/chains');
    return response.chains;
  }

  /**
   * Get list of Treasury addresses for all active chains
   * Convenience method to get all Treasury addresses at once
   * @returns Map of chain ID to Treasury address
   * @example
   * ```typescript
   * const treasuries = await client.chainConfig.getAllTreasuryAddresses();
   * // {
   * //   195: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
   * //   714: "0xbA031be32Bea2279C0b1eDE942d8553B74Ae62DC",
   * //   ...
   * // }
   * ```
   */
  async getAllTreasuryAddresses(): Promise<Record<number, string>> {
    const chains = await this.listChains();
    const treasuries: Record<number, string> = {};

    for (const chain of chains) {
      treasuries[chain.chain_id] = chain.treasury_address;
    }

    return treasuries;
  }

  /**
   * Get global ZKPay Proxy address
   * ZKPay Proxy is a global configuration (same for all chains), not chain-specific
   * @returns Global ZKPay Proxy contract address
   * @example
   * ```typescript
   * const zkpayProxy = await client.chainConfig.getGlobalZKPayProxy();
   * // "0xF5Dc3356F755E027550d82F665664b06977fa6d0"
   * ```
   */
  async getGlobalZKPayProxy(): Promise<string> {
    const response = await this.client.get<{ zkpay_proxy: string; source: string }>('/api/admin/config/zkpay-proxy');
    return response.zkpay_proxy;
  }
}
