/**
 * Checkbooks API client (merged with deposits)
 * @module api/CheckbooksAPI
 */

import type { APIClient } from './APIClient';
import type {
  ListCheckbooksRequest,
  ListCheckbooksResponse,
  GetCheckbookRequest,
  GetCheckbookResponse,
  APIResponse,
} from '../types/api';
import type { Checkbook } from '../types/models';
import {
  validateNonEmptyString,
  validatePagination,
} from '../utils/validation';

/**
 * Checkbooks API endpoints
 */
export class CheckbooksAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List checkbooks with optional filtering
   * @param request - List request with filters
   * @returns Paginated list of checkbooks
   */
  async listCheckbooks(
    request: ListCheckbooksRequest = {}
  ): Promise<ListCheckbooksResponse> {
    // Validate pagination params
    if (request.page || request.limit) {
      validatePagination(request.page, request.limit);
    }

    const response = await this.client.get<APIResponse<ListCheckbooksResponse>>(
      '/api/checkbooks',
      {
        params: {
          owner: request.owner,
          status: request.status,
          tokenId: request.tokenId,
          page: request.page || 1,
          limit: request.limit || 20,
        },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list checkbooks');
    }

    return response.data;
  }

  /**
   * Get checkbook by ID
   * @param request - Get request with checkbook ID
   * @returns Checkbook data
   */
  async getCheckbookById(
    request: GetCheckbookRequest
  ): Promise<Checkbook> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<APIResponse<GetCheckbookResponse>>(
      `/api/checkbooks/${request.id}`
    );

    if (!response.success || !response.data?.checkbook) {
      throw new Error(response.error || 'Failed to get checkbook');
    }

    return response.data.checkbook;
  }

  /**
   * Get checkbooks by owner address
   * @param owner - Owner address
   * @param tokenId - Optional token ID filter
   * @param status - Optional status filter
   * @returns List of checkbooks
   */
  async getCheckbooksByOwner(
    owner: string,
    tokenId?: string,
    status?: string
  ): Promise<Checkbook[]> {
    validateNonEmptyString(owner, 'owner');

    const response = await this.listCheckbooks({
      owner,
      tokenId,
      status,
      limit: 100, // Get all checkbooks for owner
    });

    return response.data;
  }
}

