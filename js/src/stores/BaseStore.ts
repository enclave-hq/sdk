/**
 * Base store class for all MobX stores
 * @module stores/BaseStore
 */

import { makeObservable, observable, action, computed, runInAction } from 'mobx';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { StoreError } from '../utils/errors';

/**
 * Base store configuration
 */
export interface BaseStoreConfig {
  /** Store name for logging */
  name: string;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Abstract base class for all stores
 * Provides common functionality and reactive state management
 */
export abstract class BaseStore<T = any> {
  protected readonly name: string;
  protected readonly logger: ILogger;

  /** Loading state */
  @observable loading: boolean = false;

  /** Error state */
  @observable error: Error | null = null;

  /** Last sync timestamp */
  @observable lastSync: number | null = null;

  /** Internal data storage */
  @observable protected data: Map<string, T> = new Map();

  constructor(config: BaseStoreConfig) {
    this.name = config.name;
    this.logger = config.logger || getLogger();

    makeObservable(this);
  }

  /**
   * Get all items as array
   */
  @computed get all(): T[] {
    return Array.from(this.data.values());
  }

  /**
   * Get number of items
   */
  @computed get count(): number {
    return this.data.size;
  }

  /**
   * Check if store is empty
   */
  @computed get isEmpty(): boolean {
    return this.data.size === 0;
  }

  /**
   * Check if store has error
   */
  @computed get hasError(): boolean {
    return this.error !== null;
  }

  /**
   * Check if data is stale (older than threshold)
   * @param threshold - Staleness threshold in milliseconds (default: 60000 = 1 minute)
   */
  isStale(threshold: number = 60000): boolean {
    if (!this.lastSync) return true;
    return Date.now() - this.lastSync > threshold;
  }

  /**
   * Get item by ID
   * @param id - Item ID
   * @returns Item or undefined if not found
   */
  get(id: string): T | undefined {
    return this.data.get(id);
  }

  /**
   * Check if item exists
   * @param id - Item ID
   * @returns True if item exists
   */
  has(id: string): boolean {
    return this.data.has(id);
  }

  /**
   * Set item
   * @param id - Item ID
   * @param item - Item data
   */
  @action
  protected set(id: string, item: T): void {
    this.data.set(id, item);
  }

  /**
   * Set multiple items
   * @param items - Array of [id, item] tuples
   */
  @action
  protected setMany(items: Array<[string, T]>): void {
    items.forEach(([id, item]) => {
      this.data.set(id, item);
    });
  }

  /**
   * Delete item
   * @param id - Item ID
   */
  @action
  protected delete(id: string): void {
    this.data.delete(id);
  }

  /**
   * Clear all items
   */
  @action
  clear(): void {
    this.data.clear();
    this.logger.debug(`${this.name}: Cleared all data`);
  }

  /**
   * Set loading state
   * @param loading - Loading state
   */
  @action
  protected setLoading(loading: boolean): void {
    this.loading = loading;
  }

  /**
   * Set error state
   * @param error - Error object or null
   */
  @action
  protected setError(error: Error | null): void {
    this.error = error;
    if (error) {
      this.logger.error(`${this.name}: Error -`, error);
    }
  }

  /**
   * Update last sync timestamp
   */
  @action
  protected updateLastSync(): void {
    this.lastSync = Date.now();
  }

  /**
   * Execute action with loading and error handling
   * @param action - Async action to execute
   * @param errorMessage - Error message prefix
   * @returns Result of action
   */
  protected async executeAction<R>(
    action: () => Promise<R>,
    errorMessage: string = 'Action failed'
  ): Promise<R> {
    try {
      this.setLoading(true);
      this.setError(null);

      const result = await action();

      runInAction(() => {
        this.setLoading(false);
        this.updateLastSync();
      });

      return result;
    } catch (error) {
      const err = error as Error;
      const storeError = new StoreError(
        `${errorMessage}: ${err.message}`,
        this.name,
        { originalError: error }
      );

      runInAction(() => {
        this.setLoading(false);
        this.setError(storeError);
      });

      throw storeError;
    }
  }

  /**
   * Update items in store from array
   * @param items - Array of items
   * @param getKey - Function to extract key from item
   */
  @action
  protected updateItems(items: T[], getKey: (item: T) => string): void {
    items.forEach((item) => {
      const key = getKey(item);
      this.data.set(key, item);
    });
  }

  /**
   * Remove items by IDs
   * @param ids - Array of item IDs
   */
  @action
  protected removeItems(ids: string[]): void {
    ids.forEach((id) => this.data.delete(id));
  }

  /**
   * Filter items by predicate
   * @param predicate - Filter function
   * @returns Filtered items
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.all.filter(predicate);
  }

  /**
   * Find item by predicate
   * @param predicate - Search function
   * @returns Found item or undefined
   */
  find(predicate: (item: T) => boolean): T | undefined {
    return this.all.find(predicate);
  }

  /**
   * Map items to new array
   * @param mapper - Map function
   * @returns Mapped array
   */
  map<R>(mapper: (item: T) => R): R[] {
    return this.all.map(mapper);
  }

  /**
   * Get store state summary
   * @returns State summary object
   */
  getState(): {
    count: number;
    loading: boolean;
    hasError: boolean;
    lastSync: number | null;
  } {
    return {
      count: this.count,
      loading: this.loading,
      hasError: this.hasError,
      lastSync: this.lastSync,
    };
  }
}

