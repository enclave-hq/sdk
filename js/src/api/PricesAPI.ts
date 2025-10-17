/**
 * Token Prices API client
 * @module api/PricesAPI
 */

import type { APIClient } from './APIClient';
import type {
  GetTokenPricesRequest,
  GetTokenPricesResponse,
  APIResponse,
} from '../types/api';
import type { TokenPrice } from '../types/models';

/**
 * Token Prices API endpoints
 */
export class PricesAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Get token prices
   * @param request - Request with optional symbol filters
   * @returns Token prices
   */
  async getTokenPrices(
    request: GetTokenPricesRequest = {}
  ): Promise<TokenPrice[]> {
    const params: any = {};

    if (request.symbols && request.symbols.length > 0) {
      params.symbols = request.symbols.join(',');
    }

    const response = await this.client.get<APIResponse<GetTokenPricesResponse>>(
      '/api/prices',
      { params }
    );

    if (!response.success || !response.data?.prices) {
      throw new Error(response.error || 'Failed to get token prices');
    }

    return response.data.prices;
  }

  /**
   * Get price for a single token
   * @param symbol - Token symbol
   * @returns Token price
   */
  async getTokenPrice(symbol: string): Promise<TokenPrice | undefined> {
    const prices = await this.getTokenPrices({ symbols: [symbol] });
    return prices.find((p) => p.symbol === symbol);
  }

  /**
   * Get all token prices
   * @returns All token prices
   */
  async getAllPrices(): Promise<TokenPrice[]> {
    return this.getTokenPrices();
  }
}

