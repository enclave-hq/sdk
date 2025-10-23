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
  validateSignature,
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

    const response = await this.client.get<ListWithdrawRequestsResponse>(
      '/api/withdrawals',
      {
        params: {
          owner: request.owner,
          status: request.status,
          tokenId: request.tokenId,
          targetChain: request.targetChain,
          page: request.page || 1,
          limit: request.limit || 20,
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

    const response = await this.client.get<GetWithdrawRequestResponse>(
      `/api/withdrawals/${request.id}`
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

    const response = await this.client.get<GetWithdrawRequestResponse>(
      `/api/withdrawals/nullifier/${request.nullifier}`
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
    validateNonEmptyArray(request.allocationIds, 'allocationIds');
    validateChainId(request.targetChain, 'targetChain');
    validateNonEmptyString(request.targetAddress, 'targetAddress');
    validateNonEmptyString(request.intent, 'intent');
    validateNonEmptyString(request.message, 'message');
    validateSignature(request.signature, 'signature');
    validateNonEmptyString(request.nullifier, 'nullifier');

    const response = await this.client.post<CreateWithdrawRequestResponse>(
      '/api/withdrawals',
      {
        allocationIds: request.allocationIds,
        targetChain: request.targetChain,
        targetAddress: request.targetAddress,
        intent: request.intent,
        signature: request.signature,
        message: request.message,
        nullifier: request.nullifier,
        proof: request.proof,
        metadata: request.metadata,
      }
    );

    return response.withdrawRequest;
  }

  /**
   * Retry failed withdrawal request
   * @param request - Retry request with withdrawal ID
   * @returns Updated withdrawal request
   */
  async retryWithdrawRequest(
    request: RetryWithdrawRequestRequest
  ): Promise<WithdrawRequest> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.post<RetryWithdrawRequestResponse>(
      `/api/withdrawals/${request.id}/retry`
    );

    return response.withdrawRequest;
  }

  /**
   * Cancel pending withdrawal request
   * @param request - Cancel request with withdrawal ID
   * @returns Cancelled withdrawal request
   */
  async cancelWithdrawRequest(
    request: CancelWithdrawRequestRequest
  ): Promise<WithdrawRequest> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.post<CancelWithdrawRequestResponse>(
      `/api/withdrawals/${request.id}/cancel`
    );

    return response.withdrawRequest;
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

