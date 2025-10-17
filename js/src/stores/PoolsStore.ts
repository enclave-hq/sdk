/**
 * Pools store for reactive pool and token state management
 * @module stores/PoolsStore
 */

import { computed, observable, action, makeObservable } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Pool, Token } from '../types/models';
import type { PoolsAPI } from '../api/PoolsAPI';
import type { ILogger } from '../types/config';

/**
 * Pools store configuration
 */
export interface PoolsStoreConfig {
  /** Pools API client */
  api: PoolsAPI;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Reactive store for pools and tokens
 */
export class PoolsStore extends BaseStore<Pool> {
  private readonly api: PoolsAPI;

  /** Tokens storage */
  @observable private tokens: Map<string, Token> = new Map();

  constructor(config: PoolsStoreConfig) {
    super({ name: 'PoolsStore', logger: config.logger });
    this.api = config.api;
    makeObservable(this);
  }

  /**
   * Get all tokens
   */
  @computed get allTokens(): Token[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get token by ID
   * @param id - Token ID
   * @returns Token or undefined
   */
  getToken(id: string): Token | undefined {
    return this.tokens.get(id);
  }

  /**
   * Get token by symbol
   * @param symbol - Token symbol
   * @returns Token or undefined
   */
  getTokenBySymbol(symbol: string): Token | undefined {
    return this.allTokens.find(
      (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  /**
   * Get active pools
   */
  @computed get activePools(): Pool[] {
    return this.filter((p) => p.isActive);
  }

  /**
   * Get active tokens
   */
  @computed get activeTokens(): Token[] {
    return this.allTokens.filter((t) => t.isActive);
  }

  /**
   * Get tokens by chain ID
   * @param chainId - Chain ID
   * @returns Array of tokens
   */
  getTokensByChain(chainId: number): Token[] {
    return this.allTokens.filter((t) => t.chainId === chainId);
  }

  /**
   * Get pool by token ID
   * @param tokenId - Token ID
   * @returns Pool or undefined
   */
  getPoolByTokenId(tokenId: string): Pool | undefined {
    return this.find((p) => p.token.id === tokenId);
  }

  /**
   * Fetch all pools from API
   * @param activeOnly - Fetch only active pools
   * @returns Array of pools
   */
  async fetchPools(activeOnly: boolean = true): Promise<Pool[]> {
    return this.executeAction(async () => {
      const pools = await this.api.listPools({ isActive: activeOnly ? true : undefined });
      this.updateItems(pools, (p) => p.id);
      return pools;
    }, 'Failed to fetch pools');
  }

  /**
   * Fetch single pool by ID from API
   * @param id - Pool ID
   * @returns Pool data
   */
  async fetchPoolById(id: string): Promise<Pool> {
    return this.executeAction(async () => {
      const pool = await this.api.getPoolById({ id });
      this.set(pool.id, pool);
      return pool;
    }, 'Failed to fetch pool by ID');
  }

  /**
   * Fetch all tokens from API
   * @param activeOnly - Fetch only active tokens
   * @param chainId - Optional chain ID filter
   * @returns Array of tokens
   */
  async fetchTokens(activeOnly: boolean = true, chainId?: number): Promise<Token[]> {
    return this.executeAction(async () => {
      const tokens = await this.api.listTokens({
        isActive: activeOnly ? true : undefined,
        chainId,
      });
      this.updateTokens(tokens);
      return tokens;
    }, 'Failed to fetch tokens');
  }

  /**
   * Fetch single token by ID from API
   * @param id - Token ID
   * @returns Token data
   */
  async fetchTokenById(id: string): Promise<Token> {
    return this.executeAction(async () => {
      const token = await this.api.getTokenById({ id });
      this.setToken(token.id, token);
      return token;
    }, 'Failed to fetch token by ID');
  }

  /**
   * Fetch active tokens from API
   * @param chainId - Optional chain ID filter
   * @returns Array of active tokens
   */
  async fetchActiveTokens(chainId?: number): Promise<Token[]> {
    return this.executeAction(async () => {
      const tokens = await this.api.getActiveTokens(chainId);
      this.updateTokens(tokens);
      return tokens;
    }, 'Failed to fetch active tokens');
  }

  /**
   * Update pool in store
   * @param pool - Updated pool data
   */
  @action
  updatePool(pool: Pool): void {
    this.set(pool.id, pool);
    this.logger.debug(`Updated pool: ${pool.id}`);
  }

  /**
   * Update multiple pools in store
   * @param pools - Array of pools
   */
  @action
  updatePools(pools: Pool[]): void {
    this.updateItems(pools, (p) => p.id);
    this.logger.debug(`Updated ${pools.length} pools`);
  }

  /**
   * Update token in store
   * @param token - Updated token data
   */
  @action
  setToken(id: string, token: Token): void {
    this.tokens.set(id, token);
  }

  /**
   * Update multiple tokens in store
   * @param tokens - Array of tokens
   */
  @action
  updateTokens(tokens: Token[]): void {
    tokens.forEach((token) => {
      this.tokens.set(token.id, token);
    });
    this.logger.debug(`Updated ${tokens.length} tokens`);
  }

  /**
   * Get pools grouped by token symbol
   */
  @computed get poolsByToken(): Map<string, Pool> {
    const grouped = new Map<string, Pool>();
    
    this.all.forEach((pool) => {
      grouped.set(pool.token.symbol, pool);
    });

    return grouped;
  }

  /**
   * Get tokens grouped by chain
   */
  @computed get tokensByChain(): Map<number, Token[]> {
    const grouped = new Map<number, Token[]>();
    
    this.allTokens.forEach((token) => {
      const chainId = token.chainId;
      if (!grouped.has(chainId)) {
        grouped.set(chainId, []);
      }
      grouped.get(chainId)!.push(token);
    });

    return grouped;
  }

  /**
   * Get total TVL across all pools
   */
  @computed get totalTVL(): string {
    return this.all
      .reduce((sum, pool) => {
        return sum + BigInt(pool.tvl || '0');
      }, 0n)
      .toString();
  }

  /**
   * Clear tokens from store
   */
  @action
  clearTokens(): void {
    this.tokens.clear();
    this.logger.debug('Cleared all tokens');
  }

  /**
   * Clear all data
   */
  @action
  override clear(): void {
    super.clear();
    this.tokens.clear();
  }
}

