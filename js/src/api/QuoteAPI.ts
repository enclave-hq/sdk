/**
 * Quote & Preview API client
 * @module api/QuoteAPI
 */

import type { APIClient } from './APIClient';
import type {
  RouteAndFeesRequest,
  RouteQuoteResponse,
  HookAssetRequest,
  HookAssetResponse,
} from '../types/api';

/**
 * Quote & Preview API endpoints
 * Provides route, fees, and Hook asset information for SDK
 */
export class QuoteAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Query route and fees for a withdrawal
   * @param request - Route and fees query request
   * @returns Route, fees, and timeline information
   */
  async getRouteAndFees(request: RouteAndFeesRequest): Promise<RouteQuoteResponse> {
    const response = await this.client.post<RouteQuoteResponse>(
      '/api/v2/quote/route-and-fees',
      request
    );
    return response;
  }

  /**
   * Query Hook asset information (APY, fees, conversion)
   * @param request - Hook asset query request
   * @returns Asset information including APY, fees, and protocol health
   */
  async getHookAsset(request: HookAssetRequest): Promise<HookAssetResponse> {
    const response = await this.client.post<HookAssetResponse>(
      '/api/v2/quote/hook-asset',
      request
    );
    return response;
  }
}
