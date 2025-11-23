/**
 * Chain Configuration Store
 * Manages chain configurations including Treasury addresses, RPC endpoints, and other chain-specific settings
 * Note: ZKPay address is a global configuration (not chain-specific), use client.chainConfig.getGlobalZKPayProxy() instead
 * @module stores/ChainConfigStore
 */

import { computed, action } from 'mobx';
import { BaseStore } from './BaseStore';
import type { ChainConfig } from '../api/ChainConfigAPI';
import type { ChainConfigAPI } from '../api/ChainConfigAPI';
import type { ILogger } from '../types/config';

/**
 * Chain Config Store configuration
 */
export interface ChainConfigStoreConfig {
  /** Chain Config API client */
  api: ChainConfigAPI;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Reactive store for chain configurations
 */
export class ChainConfigStore extends BaseStore<ChainConfig> {
  private readonly api: ChainConfigAPI;

  constructor(config: ChainConfigStoreConfig) {
    super({ name: 'ChainConfigStore', logger: config.logger });
    this.api = config.api;
  }

  /**
   * Get all chain configurations as array
   */
  @computed get allChains(): ChainConfig[] {
    return Array.from(this.data.values());
  }

  /**
   * Get chain configuration by chain ID
   * @param chainId - SLIP-44 chain ID
   * @returns Chain configuration or undefined
   */
  getChain(chainId: number): ChainConfig | undefined {
    return this.data.get(chainId.toString());
  }

  /**
   * Get Treasury address for a chain
   * @param chainId - SLIP-44 chain ID
   * @returns Treasury address or undefined
   */
  getTreasuryAddress(chainId: number): string | undefined {
    const chain = this.getChain(chainId);
    return chain?.treasury_address;
  }

  /**
   * Get IntentManager address for a chain
   * @param chainId - SLIP-44 chain ID
   * @returns IntentManager address or undefined
   */
  getIntentManagerAddress(chainId: number): string | undefined {
    const chain = this.getChain(chainId);
    return chain?.intent_manager_address;
  }

  /**
   * Get RPC endpoint for a chain
   * @param chainId - SLIP-44 chain ID
   * @returns RPC endpoint or undefined
   */
  getRpcEndpoint(chainId: number): string | undefined {
    const chain = this.getChain(chainId);
    return chain?.rpc_endpoint;
  }

  /**
   * Get explorer URL for a chain
   * @param chainId - SLIP-44 chain ID
   * @returns Explorer URL or undefined
   */
  getExplorerUrl(chainId: number): string | undefined {
    const chain = this.getChain(chainId);
    return chain?.explorer_url;
  }

  /**
   * Get all active chains
   */
  @computed get activeChains(): ChainConfig[] {
    return this.allChains.filter(chain => chain.is_active);
  }

  /**
   * Get all Treasury addresses as a map
   */
  @computed get allTreasuryAddresses(): Record<number, string> {
    const result: Record<number, string> = {};
    for (const chain of this.allChains) {
      if (chain.treasury_address) {
        result[chain.chain_id] = chain.treasury_address;
      }
    }
    return result;
  }

  /**
   * Fetch all chain configurations
   */
  @action
  async fetchChains(): Promise<ChainConfig[]> {
    this.loading = true;
    this.error = null;

    try {
      const chains = await this.api.listChains();

      // Update store with fetched chains
      for (const chain of chains) {
        this.data.set(chain.chain_id.toString(), chain);
      }

      this.lastSync = Date.now();
      this.logger.info(`Loaded ${chains.length} chain configurations`);

      return chains;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch chain configurations');
      this.error = error;
      this.logger.error('Failed to fetch chain configurations:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Fetch a single chain configuration
   * @param chainId - SLIP-44 chain ID
   */
  @action
  async fetchChain(chainId: number): Promise<ChainConfig> {
    this.loading = true;
    this.error = null;

    try {
      const chain = await this.api.getChainConfig(chainId);

      // Update store
      this.data.set(chain.chain_id.toString(), chain);
      this.lastSync = Date.now();

      this.logger.info(`Loaded chain configuration for chain ${chainId}`);
      return chain;
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(`Failed to fetch chain configuration for chain ${chainId}`);
      this.error = error;
      this.logger.error(`Failed to fetch chain configuration for chain ${chainId}:`, error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Refresh all chain configurations
   */
  @action
  async refresh(): Promise<void> {
    await this.fetchChains();
  }
}
