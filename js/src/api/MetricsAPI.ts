import { APIClient } from './APIClient';
import type {
  PoolMetricsResponse,
  TokenMetricsResponse,
  MetricsHistoryResponse,
  BatchPoolMetricsResponse,
  BatchTokenMetricsResponse,
} from '../types/api';

/**
 * MetricsAPI handles fetching dynamic metrics for pools and tokens
 * 
 * Metrics include:
 * - APY (Annual Percentage Yield)
 * - TVL (Total Value Locked)
 * - Yield rates
 * - Price changes
 * - Custom metrics
 * 
 * @example
 * ```typescript
 * const metricsAPI = new MetricsAPI(client);
 * 
 * // Get pool metrics
 * const poolMetrics = await metricsAPI.getPoolMetrics(1);
 * console.log(poolMetrics.metrics.apy?.value); // "4.25"
 * 
 * // Get metrics history
 * const history = await metricsAPI.getPoolMetricsHistory(1, 'apy', 30);
 * ```
 */
export class MetricsAPI {
  constructor(private client: APIClient) {}

  /**
   * Get current metrics for a pool
   * 
   * @param poolId - Pool ID
   * @returns Pool metrics including APY, TVL, etc.
   * 
   * @example
   * ```typescript
   * const metrics = await metricsAPI.getPoolMetrics(1);
   * const apy = metrics.metrics.apy?.value; // "4.25"
   * const tvl = metrics.metrics.tvl?.value; // "1250000000"
   * ```
   */
  async getPoolMetrics(poolId: number): Promise<PoolMetricsResponse> {
    return this.client.get<PoolMetricsResponse>(`/pools/${poolId}/metrics`);
  }

  /**
   * Get current metrics for a token
   * 
   * @param assetId - Asset Token ID (bytes32 hex string)
   * @returns Token metrics including yield, price changes, etc.
   * 
   * @example
   * ```typescript
   * const metrics = await metricsAPI.getTokenMetrics('0x000002ca...');
   * const yield = metrics.metrics.yield?.value; // "3.85"
   * ```
   */
  async getTokenMetrics(assetId: string): Promise<TokenMetricsResponse> {
    return this.client.get<TokenMetricsResponse>(`/tokens/${assetId}/metrics`);
  }

  /**
   * Get historical metrics for a pool (for charting)
   * 
   * @param poolId - Pool ID
   * @param metricType - Type of metric (e.g., 'apy', 'tvl')
   * @param days - Number of days of history (default: 7)
   * @returns Time-series data points
   * 
   * @example
   * ```typescript
   * const history = await metricsAPI.getPoolMetricsHistory(1, 'apy', 30);
   * const chartData = history.data.map(d => ({
   *   x: new Date(d.timestamp),
   *   y: parseFloat(d.value)
   * }));
   * ```
   */
  async getPoolMetricsHistory(
    poolId: number,
    metricType: string,
    days: number = 7
  ): Promise<MetricsHistoryResponse> {
    return this.client.get<MetricsHistoryResponse>(
      `/pools/${poolId}/metrics/history`,
      { metric_type: metricType, days: days.toString() }
    );
  }

  /**
   * Get historical metrics for a token (for charting)
   * 
   * @param assetId - Asset Token ID
   * @param metricType - Type of metric (e.g., 'yield', 'price_change_24h')
   * @param days - Number of days of history (default: 7)
   * @returns Time-series data points
   */
  async getTokenMetricsHistory(
    assetId: string,
    metricType: string,
    days: number = 7
  ): Promise<MetricsHistoryResponse> {
    return this.client.get<MetricsHistoryResponse>(
      `/tokens/${assetId}/metrics/history`,
      { metric_type: metricType, days: days.toString() }
    );
  }

  /**
   * Get metrics for multiple pools at once (batch operation)
   * 
   * @param poolIds - Array of pool IDs
   * @returns Map of pool ID to metrics
   * 
   * @example
   * ```typescript
   * const metrics = await metricsAPI.getBatchPoolMetrics([1, 2, 3]);
   * const pool1APY = metrics.metrics[1].apy?.value;
   * const pool2APY = metrics.metrics[2].apy?.value;
   * ```
   */
  async getBatchPoolMetrics(poolIds: number[]): Promise<BatchPoolMetricsResponse> {
    return this.client.post<BatchPoolMetricsResponse>('/pools/metrics', {
      pool_ids: poolIds,
    });
  }

  /**
   * Get metrics for multiple tokens at once (batch operation)
   * 
   * @param assetIds - Array of asset token IDs
   * @returns Map of asset ID to metrics
   * 
   * @example
   * ```typescript
   * const metrics = await metricsAPI.getBatchTokenMetrics([
   *   '0x000002ca...',
   *   '0x000002ca...'
   * ]);
   * const token1Yield = metrics.metrics['0x000002ca...'].yield?.value;
   * ```
   */
  async getBatchTokenMetrics(assetIds: string[]): Promise<BatchTokenMetricsResponse> {
    return this.client.post<BatchTokenMetricsResponse>('/tokens/metrics', {
      asset_ids: assetIds,
    });
  }
}

