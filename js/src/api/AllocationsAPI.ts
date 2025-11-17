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
   * Convert backend allocation (snake_case) to frontend format (camelCase)
   * Backend uses snake_case (Go standard), frontend uses camelCase (TypeScript standard)
   */
  convertAllocation(backendAllocation: any): Allocation {
    // Convert backend token format to SDK Token interface
    let token = { id: '', symbol: '', name: '', decimals: 18, contractAddress: '', chainId: 0, isActive: true };
    if (backendAllocation.token) {
      const backendToken = backendAllocation.token;
      token = {
        id: backendToken.id || `token_${backendAllocation.checkbook?.token_id || backendAllocation.token_id || 'unknown'}`,
        symbol: backendToken.symbol || 'UNKNOWN',
        name: backendToken.name || backendToken.symbol || 'Unknown Token',
        decimals: backendToken.decimals || 18,
        contractAddress: backendToken.address || backendToken.contractAddress || '',
        chainId: backendToken.chain_id || backendToken.chainId || 0,
        // iconUrl: undefined, // Removed - not in Token type
        isActive: backendToken.is_active !== undefined ? Boolean(backendToken.is_active) : (backendToken.isActive !== undefined ? Boolean(backendToken.isActive) : true),
        // metrics: undefined, // Removed - not in Token type
      };
    }

    return {
      id: backendAllocation.id,
      checkbookId: backendAllocation.checkbook_id || backendAllocation.checkbookId, // Convert snake_case to camelCase
      seq: backendAllocation.seq,
      amount: backendAllocation.amount,
      status: backendAllocation.status,
      nullifier: backendAllocation.nullifier,
      withdrawRequestId: backendAllocation.withdraw_request_id || backendAllocation.withdrawRequestId,
      commitment: backendAllocation.commitment,
      createdAt: backendAllocation.created_at ? new Date(backendAllocation.created_at).getTime() : (backendAllocation.createdAt || Date.now()),
      updatedAt: backendAllocation.updated_at ? new Date(backendAllocation.updated_at).getTime() : (backendAllocation.updatedAt || Date.now()),
      // Owner and token - now token is included in backend response
      owner: backendAllocation.owner || { chainId: 0, address: '' },
      token: token,
      // Preserve checkbook info from backend (for localDepositId access)
      ...(backendAllocation.checkbook && { _checkbook: backendAllocation.checkbook }),
    } as any; // Use 'as any' to allow _checkbook field
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

    // Owner is now automatically determined from JWT token if authenticated - no need to pass it
    const response = await this.client.get<{
      data: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(
      '/api/allocations',
      {
        params: {
          checkbookId: request.checkbookId,
          tokenId: request.tokenId,
          status: request.status,
          page: request.page || 1,
          limit: request.limit || 20,
        },
      }
    );

    // Convert backend snake_case to frontend camelCase
    const convertedData = (response.data || []).map(allocation => this.convertAllocation(allocation));

    // Convert backend pagination format to frontend format
    const backendPagination = response.pagination;
    const totalPages = backendPagination.pages || Math.ceil(backendPagination.total / backendPagination.limit);
    const pagination = {
      page: backendPagination.page,
      limit: backendPagination.limit,
      total: backendPagination.total,
      totalPages: totalPages,
      hasNext: backendPagination.page < totalPages,
      hasPrev: backendPagination.page > 1,
    };

    return {
      data: convertedData,
      pagination,
    };
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
    validateNonEmptyString(request.tokenKey, 'tokenKey');
    validateNonEmptyString(request.message, 'message');
    validateSignature(request.signature, 'signature');

    // Validate each amount
    request.amounts.forEach((amount, index) => {
      validateNonEmptyString(amount, `amounts[${index}]`);
    });

    const response = await this.client.post<{
      success: boolean;
      allocations: any[];
      checkbook: any;
    }>(
      '/api/allocations',
      {
        checkbookId: request.checkbookId,
        amounts: request.amounts,
        tokenKey: request.tokenKey, // Use tokenKey instead of tokenId
        signature: request.signature,
        message: request.message,
        commitments: request.commitments,
      }
    );

    // Convert backend snake_case to frontend camelCase
    const convertedAllocations = (response.allocations || []).map(allocation => this.convertAllocation(allocation));

    return {
      allocations: convertedAllocations,
      checkbook: response.checkbook, // Checkbook conversion is handled in CheckbooksAPI
    };
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

