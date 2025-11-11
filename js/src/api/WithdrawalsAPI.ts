/**
 * Withdrawals API client
 * @module api/WithdrawalsAPI
 */

import type { APIClient } from './APIClient';
import type {
  ListWithdrawRequestsRequest,
  ListWithdrawRequestsResponse,
  GetWithdrawRequestRequest,
  GetWithdrawRequestResponse,
  GetWithdrawRequestByNullifierRequest,
  CreateWithdrawRequestRequest,
  CreateWithdrawRequestResponse,
  RetryWithdrawRequestRequest,
  RetryWithdrawRequestResponse,
  CancelWithdrawRequestRequest,
  CancelWithdrawRequestResponse,
  GetWithdrawStatsRequest,
  GetWithdrawStatsResponse,
} from '../types/api';
import type { WithdrawRequest, WithdrawRequestDetail } from '../types/models';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validatePagination,
  validateChainId,
} from '../utils/validation';

/**
 * Withdrawals API endpoints
 */
export class WithdrawalsAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List withdrawal requests with optional filtering
   * @param request - List request with filters
   * @returns Paginated list of withdrawal requests
   */
  async listWithdrawRequests(
    request: ListWithdrawRequestsRequest = {}
  ): Promise<ListWithdrawRequestsResponse> {
    // Validate pagination params
    if (request.page || request.limit) {
      validatePagination(request.page, request.limit);
    }

    // Validate chain ID if provided
    if (request.targetChain) {
      validateChainId(request.targetChain, 'targetChain');
    }

    // Unified API endpoint
    const response = await this.client.get<ListWithdrawRequestsResponse>(
      '/api/my/withdraw-requests',
      {
        params: {
          owner: request.owner,
          status: request.status,
          tokenId: request.tokenId,
          targetChain: request.targetChain,
          page: request.page || 1,
          page_size: request.limit || 20,
        },
      }
    );

    return response;
  }

  /**
   * Get withdrawal request by ID
   * @param request - Get request with withdrawal ID
   * @returns Withdrawal request detail
   */
  async getWithdrawRequestById(
    request: GetWithdrawRequestRequest
  ): Promise<WithdrawRequestDetail> {
    validateNonEmptyString(request.id, 'id');

    // Unified API endpoint
    const response = await this.client.get<GetWithdrawRequestResponse>(
      `/api/my/withdraw-requests/${request.id}`
    );

    return response.withdrawRequest;
  }

  /**
   * Get withdrawal request by nullifier
   * @param request - Get request with nullifier
   * @returns Withdrawal request detail
   */
  async getWithdrawRequestByNullifier(
    request: GetWithdrawRequestByNullifierRequest
  ): Promise<WithdrawRequestDetail> {
    validateNonEmptyString(request.nullifier, 'nullifier');

    // Unified API endpoint
    const response = await this.client.get<GetWithdrawRequestResponse>(
      `/api/my/withdraw-requests/by-nullifier/${request.nullifier}`
    );

    return response.withdrawRequest;
  }

  /**
   * Create withdrawal request
   * @param request - Create request with signed withdrawal
   * @returns Created withdrawal request
   */
  async createWithdrawRequest(
    request: CreateWithdrawRequestRequest
  ): Promise<WithdrawRequestDetail> {
    // Validate request
    validateNonEmptyString(request.checkbookId, 'checkbookId');
    validateNonEmptyArray(request.allocationIds, 'allocationIds');
    
    // Validate intent
    if (!request.intent) {
      throw new Error('intent is required');
    }
    validateChainId(request.intent.beneficiaryChainId, 'intent.beneficiaryChainId');
    validateNonEmptyString(request.intent.beneficiaryAddress, 'intent.beneficiaryAddress');

    // Unified API endpoint
    const response = await this.client.post<CreateWithdrawRequestResponse>(
      '/api/withdraws/submit',
      {
        checkbook_id: request.checkbookId,
        allocations: request.allocationIds,
        intent: request.intent,
        signature: request.signature,
        message: request.message,
        nullifier: request.nullifier,
        proof: request.proof,
        metadata: request.metadata,
      }
    );

    // Backend v2 returns { success: true, data: { id, status, ... } }
    // We need to fetch the full withdraw request detail
    if (response.data?.id) {
      const fullRequest = await this.getWithdrawRequestById({ id: response.data.id });
      return fullRequest;
    }

    // Fallback to legacy format if available
    if (response.withdrawRequest) {
      return response.withdrawRequest;
    }

    throw new Error('Failed to create withdraw request: invalid response format');
  }

  /**
   * Retry failed withdrawal request
   * Note: According to simplified design, Payout/Hook/Fallback failures are not retried automatically.
   * This API will return an error if the request is in a state that cannot be retried.
   * @param request - Retry request with withdrawal ID
   * @returns Updated withdrawal request
   */
  async retryWithdrawRequest(
    request: RetryWithdrawRequestRequest
  ): Promise<WithdrawRequest> {
    validateNonEmptyString(request.id, 'id');

    // Unified API endpoint
    const response = await this.client.post<RetryWithdrawRequestResponse>(
      `/api/my/withdraw-requests/${request.id}/retry`
    );

    return response.withdrawRequest;
  }

  /**
   * Cancel pending withdrawal request
   * Note: Only cancellable during Stage 1 (proof phase)
   * @param request - Cancel request with withdrawal ID
   * @returns Cancelled withdrawal request
   */
  async cancelWithdrawRequest(
    request: CancelWithdrawRequestRequest
  ): Promise<WithdrawRequest> {
    validateNonEmptyString(request.id, 'id');

    // Unified API endpoint
    const response = await this.client.delete<CancelWithdrawRequestResponse>(
      `/api/my/withdraw-requests/${request.id}`
    );

    if (!response.withdrawRequest && !response.data) {
      throw new Error('Invalid response: missing withdraw request data');
    }

    return response.withdrawRequest || response.data!;
  }

  /**
   * Get withdrawal statistics
   * @param request - Stats request with optional filters
   * @returns Withdrawal statistics
   */
  async getWithdrawStats(
    request: GetWithdrawStatsRequest = {}
  ): Promise<GetWithdrawStatsResponse> {
    const response = await this.client.get<GetWithdrawStatsResponse>(
      '/api/withdrawals/stats',
      {
        params: {
          owner: request.owner,
          tokenId: request.tokenId,
        },
      }
    );

    return response;
  }
}

