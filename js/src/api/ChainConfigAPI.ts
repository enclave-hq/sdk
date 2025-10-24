/**
 * Chain Configuration API client
 * @module api/ChainConfigAPI
 */

import type { APIClient } from './APIClient';

/**
 * Chain configuration response
 */
export interface ChainConfig {
  id: number;
  chain_id: number;
  chain_name: string;
  treasury_address: string;
  intent_manager_address: string;
  zkpay_address: string;
  rpc_endpoint: string;
  explorer_url: string;
  sync_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
    const response = await this.client.get<{ chain: ChainConfig }>(
      `/api/chains/${chainId}`
    );
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
   * @param chainId - SLIP-44 chain ID
   * @returns RPC endpoint URL
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
    const response = await this.client.get<{ chains: ChainConfig[] }>(
      '/api/chains'
    );
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
}
