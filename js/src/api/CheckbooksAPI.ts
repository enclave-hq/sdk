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

    const response = await this.client.get<ListCheckbooksResponse>(
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

    return response;
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

    const response = await this.client.get<GetCheckbookResponse>(
      `/api/checkbooks/id/${request.id}`
    );

    return response.checkbook;
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

  /**
   * Delete checkbook by ID
   * @param id - Checkbook ID
   * @returns Success response
   */
  async deleteCheckbook(id: string): Promise<{ success: boolean; message: string; checkbook_id: string }> {
    validateNonEmptyString(id, 'id');

    return this.client.delete<{ success: boolean; message: string; checkbook_id: string }>(
      `/api/checkbooks/${id}`
    );
  }
}

