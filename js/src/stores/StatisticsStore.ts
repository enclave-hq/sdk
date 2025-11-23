/**
 * Statistics store for reactive global statistics state management
 * @module stores/StatisticsStore
 */

import { computed, makeObservable, observable, action, runInAction } from 'mobx';
import type { StatisticsAPI } from '../api/StatisticsAPI';
import type { StatisticsOverviewResponse } from '../types/api';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { StoreError } from '../utils/errors';

/**
 * Statistics store configuration
 */
export interface StatisticsStoreConfig {
  /** Statistics API client */
  api: StatisticsAPI;
  /** Logger instance */
  logger?: ILogger;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
}

/**
 * Reactive store for global statistics
 */
export class StatisticsStore {
  private readonly api: StatisticsAPI;
  private readonly logger: ILogger;
  private autoRefreshInterval: number;
  private refreshIntervalId?: any;

  /** Loading state */
  @observable loading: boolean = false;

  /** Error state */
  @observable error: Error | null = null;

  /** Last sync timestamp */
  @observable lastSync: number | null = null;

  /** Statistics data */
  @observable private statistics: StatisticsOverviewResponse | null = null;

  constructor(config: StatisticsStoreConfig) {
    this.api = config.api;
    this.logger = config.logger || getLogger();
    this.autoRefreshInterval = config.autoRefreshInterval || 0;

    makeObservable(this);
  }

  /**
   * Get statistics data
   */
  @computed get data(): StatisticsOverviewResponse | null {
    return this.statistics;
  }

  /**
   * Get total locked value in USD
   */
  @computed get totalLockedValue(): string {
    return this.statistics?.total_locked_value || '0';
  }

  /**
   * Get total volume in USD
   */
  @computed get totalVolume(): string {
    return this.statistics?.total_volume || '0';
  }

  /**
   * Get private transaction count
   */
  @computed get privateTxCount(): number {
    return this.statistics?.private_tx_count || 0;
  }

  /**
   * Get active users count
   */
  @computed get activeUsers(): number {
    return this.statistics?.active_users || 0;
  }

  /**
   * Get total locked amount in wei
   */
  @computed get totalLockedAmount(): string {
    return this.statistics?.total_locked_amount || '0';
  }

  /**
   * Get total volume amount in wei
   */
  @computed get totalVolumeAmount(): string {
    return this.statistics?.total_volume_amount || '0';
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
   * Fetch statistics overview from API
   */
  @action
  async fetchOverview(): Promise<StatisticsOverviewResponse> {
    try {
      this.loading = true;
      this.error = null;

      const data = await this.api.getOverview();

      runInAction(() => {
        this.statistics = data;
        this.loading = false;
        this.lastSync = Date.now();
      });

      return data;
    } catch (error) {
      const err = error as Error;
      const storeError = new StoreError(
        `Failed to fetch statistics overview: ${err.message}`,
        'StatisticsStore',
        { originalError: error }
      );

      runInAction(() => {
        this.loading = false;
        this.error = storeError;
      });

      throw storeError;
    }
  }

  /**
   * Update statistics (typically called from WebSocket or manual refresh)
   * @param statistics - Updated statistics data
   */
  @action
  updateStatistics(statistics: StatisticsOverviewResponse): void {
    this.statistics = statistics;
    this.lastSync = Date.now();
    this.logger.debug('Updated statistics overview');
  }

  /**
   * Start auto-refresh
   * @param interval - Refresh interval in milliseconds (optional, uses config value if not provided)
   */
  startAutoRefresh(interval?: number): void {
    this.stopAutoRefresh();

    const refreshInterval = interval || this.autoRefreshInterval;
    if (refreshInterval <= 0) {
      this.logger.warn('Auto-refresh interval not set, skipping auto-refresh');
      return;
    }

    this.logger.info(`Starting auto-refresh with interval: ${refreshInterval}ms`);

    this.refreshIntervalId = setInterval(async () => {
      try {
        await this.fetchOverview();
      } catch (error) {
        this.logger.error('Auto-refresh failed:', error);
      }
    }, refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = undefined;
      this.logger.info('Stopped auto-refresh');
    }
  }

  /**
   * Clear statistics data
   */
  @action
  clear(): void {
    this.statistics = null;
    this.lastSync = null;
    this.error = null;
    this.logger.debug('Cleared statistics data');
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.clear();
  }
}







