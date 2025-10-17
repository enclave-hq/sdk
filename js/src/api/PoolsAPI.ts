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
  APIResponse,
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
    const response = await this.client.get<APIResponse<ListPoolsResponse>>(
      '/api/pools',
      {
        params: {
          isActive: request.isActive,
        },
      }
    );

    if (!response.success || !response.data?.pools) {
      throw new Error(response.error || 'Failed to list pools');
    }

    return response.data.pools;
  }

  /**
   * Get pool by ID
   * @param request - Get request with pool ID
   * @returns Pool data
   */
  async getPoolById(request: GetPoolRequest): Promise<Pool> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<APIResponse<GetPoolResponse>>(
      `/api/pools/${request.id}`
    );

    if (!response.success || !response.data?.pool) {
      throw new Error(response.error || 'Failed to get pool');
    }

    return response.data.pool;
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

    const response = await this.client.get<APIResponse<ListTokensResponse>>(
      '/api/tokens',
      { params }
    );

    if (!response.success || !response.data?.tokens) {
      throw new Error(response.error || 'Failed to list tokens');
    }

    return response.data.tokens;
  }

  /**
   * Get token by ID
   * @param request - Get request with token ID
   * @returns Token data
   */
  async getTokenById(request: GetTokenRequest): Promise<Token> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<APIResponse<GetTokenResponse>>(
      `/api/tokens/${request.id}`
    );

    if (!response.success || !response.data?.token) {
      throw new Error(response.error || 'Failed to get token');
    }

    return response.data.token;
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

