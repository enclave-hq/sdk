/**
 * Pools and Tokens API client
 * @module api/PoolsAPI
 */

import type { APIClient } from './APIClient';
import type {
  ListPoolsRequest,
  ListPoolsResponse,
  GetPoolRequest,
  GetPoolResponse,
  ListTokensRequest,
  ListTokensResponse,
  GetTokenRequest,
  GetTokenResponse,
} from '../types/api';
import type { Pool, Token } from '../types/models';
import { validateNonEmptyString, validateChainId } from '../utils/validation';

/**
 * Pools and Tokens API endpoints
 */
export class PoolsAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List all pools
   * @param request - List request with optional filters
   * @returns List of pools
   */
  async listPools(request: ListPoolsRequest = {}): Promise<Pool[]> {
    const response = await this.client.get<ListPoolsResponse>('/api/pools', {
      params: {
        isActive: request.isActive,
      },
    });

    return response.pools;
  }

  /**
   * Get pool by ID
   * @param request - Get request with pool ID
   * @returns Pool data
   */
  async getPoolById(request: GetPoolRequest): Promise<Pool> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<GetPoolResponse>(`/api/pools/${request.id}`);

    return response.pool;
  }

  /**
   * List all tokens
   * @param request - List request with optional filters
   * @returns List of tokens
   */
  async listTokens(request: ListTokensRequest = {}): Promise<Token[]> {
    const params: any = {};

    if (request.isActive !== undefined) {
      params.isActive = request.isActive;
    }

    if (request.chainId !== undefined) {
      validateChainId(request.chainId, 'chainId');
      params.chainId = request.chainId;
    }

    const response = await this.client.get<ListTokensResponse>('/api/tokens', { params });

    return response.tokens;
  }

  /**
   * Get token by ID
   * @param request - Get request with token ID
   * @returns Token data
   */
  async getTokenById(request: GetTokenRequest): Promise<Token> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<GetTokenResponse>(`/api/tokens/${request.id}`);

    return response.token;
  }

  /**
   * Get active tokens only
   * @param chainId - Optional chain ID filter
   * @returns List of active tokens
   */
  async getActiveTokens(chainId?: number): Promise<Token[]> {
    return this.listTokens({ isActive: true, chainId });
  }
}
