/**
 * Allocations API client
 * @module api/AllocationsAPI
 */

import type { APIClient } from './APIClient';
import type {
  ListAllocationsRequest,
  ListAllocationsResponse,
  CreateAllocationsRequest,
  CreateAllocationsResponse,
} from '../types/api';
import type { Allocation } from '../types/models';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validatePagination,
  validateSignature,
} from '../utils/validation';

/**
 * Allocations API endpoints
 */
export class AllocationsAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List allocations with optional filtering
   * @param request - List request with filters
   * @returns Paginated list of allocations
   */
  async listAllocations(
    request: ListAllocationsRequest = {}
  ): Promise<ListAllocationsResponse> {
    // Validate pagination params
    if (request.page || request.limit) {
      validatePagination(request.page, request.limit);
    }

    const response = await this.client.get<ListAllocationsResponse>(
      '/api/allocations',
      {
        params: {
          owner: request.owner,
          checkbookId: request.checkbookId,
          tokenId: request.tokenId,
          status: request.status,
          page: request.page || 1,
          limit: request.limit || 20,
        },
      }
    );

    return response;
  }

  /**
   * Create allocations (commitment)
   * @param request - Create request with signed commitment
   * @returns Created allocations and updated checkbook
   */
  async createAllocations(
    request: CreateAllocationsRequest
  ): Promise<CreateAllocationsResponse> {
    // Validate request
    validateNonEmptyString(request.checkbookId, 'checkbookId');
    validateNonEmptyArray(request.amounts, 'amounts');
    validateNonEmptyString(request.tokenId, 'tokenId');
    validateNonEmptyString(request.message, 'message');
    validateSignature(request.signature, 'signature');

    // Validate each amount
    request.amounts.forEach((amount, index) => {
      validateNonEmptyString(amount, `amounts[${index}]`);
    });

    const response = await this.client.post<CreateAllocationsResponse>(
      '/api/allocations',
      {
        checkbookId: request.checkbookId,
        amounts: request.amounts,
        tokenId: request.tokenId,
        signature: request.signature,
        message: request.message,
        commitments: request.commitments,
      }
    );

    return response;
  }

  /**
   * Get allocations by checkbook ID
   * @param checkbookId - Checkbook ID
   * @param status - Optional status filter
   * @returns List of allocations
   */
  async getAllocationsByCheckbookId(
    checkbookId: string,
    status?: string
  ): Promise<Allocation[]> {
    validateNonEmptyString(checkbookId, 'checkbookId');

    const response = await this.listAllocations({
      checkbookId,
      status,
      limit: 100, // Get all allocations for checkbook
    });

    return response.data;
  }

  /**
   * Get allocations by token ID and status
   * @param tokenId - Token ID
   * @param status - Allocation status
   * @returns List of allocations
   */
  async getAllocationsByTokenIdAndStatus(
    tokenId: string,
    status: string
  ): Promise<Allocation[]> {
    validateNonEmptyString(tokenId, 'tokenId');
    validateNonEmptyString(status, 'status');

    const response = await this.listAllocations({
      tokenId,
      status,
      limit: 100,
    });

    return response.data;
  }
}

