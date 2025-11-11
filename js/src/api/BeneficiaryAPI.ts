/**
 * Beneficiary Withdraw Requests API client
 * @module api/BeneficiaryAPI
 */

import type { APIClient } from './APIClient';
import type { WithdrawRequest, WithdrawRequestDetail } from '../types/models';
import { validateNonEmptyString } from '../utils/validation';

/**
 * List beneficiary withdraw requests request
 */
export interface ListBeneficiaryWithdrawRequestsRequest {
  /** Page number */
  page?: number;
  /** Items per page */
  page_size?: number;
  /** Filter by status */
  status?: string;
}

/**
 * List beneficiary withdraw requests response
 */
export interface ListBeneficiaryWithdrawRequestsResponse {
  /** Withdraw requests */
  data: WithdrawRequest[];
  /** Pagination info */
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

/**
 * Request payout execution request
 */
export interface RequestPayoutExecutionRequest {
  /** Withdraw request ID */
  id: string;
}

/**
 * Request payout execution response
 */
export interface RequestPayoutExecutionResponse {
  /** Message */
  message: string;
  /** Updated withdraw request */
  withdrawRequest?: WithdrawRequest;
}

/**
 * Claim timeout request
 */
export interface ClaimTimeoutRequest {
  /** Withdraw request ID */
  id: string;
}

/**
 * Claim timeout response
 */
export interface ClaimTimeoutResponse {
  /** Message */
  message: string;
  /** Updated withdraw request */
  withdrawRequest?: WithdrawRequest;
}

/**
 * Beneficiary Withdraw Requests API endpoints
 * Allows users to view and manage withdraw requests where they are the beneficiary
 */
export class BeneficiaryAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List all withdraw requests where the authenticated user is the beneficiary
   * @param request - List request with optional filters
   * @returns Paginated list of beneficiary withdraw requests
   * @example
   * ```typescript
   * const requests = await client.beneficiary.listBeneficiaryWithdrawRequests({
   *   page: 1,
   *   page_size: 20,
   *   status: 'waiting_for_payout'
   * });
   * ```
   */
  async listBeneficiaryWithdrawRequests(
    request: ListBeneficiaryWithdrawRequestsRequest = {}
  ): Promise<ListBeneficiaryWithdrawRequestsResponse> {
    const response = await this.client.get<ListBeneficiaryWithdrawRequestsResponse>(
      '/api/my/beneficiary-withdraw-requests',
      {
        params: {
          page: request.page || 1,
          page_size: request.page_size || 20,
          status: request.status,
        },
      }
    );

    return response;
  }

  // ⚠️ 注意：后端没有提供 GET /api/my/beneficiary-withdraw-requests/:id 接口
  // 如果需要查询单个请求详情，请使用 listBeneficiaryWithdrawRequests() 然后过滤

  /**
   * Request payout execution
   * Triggers multisig service to execute payout (cross-chain transfer)
   * @param request - Request with withdraw request ID
   * @returns Response with updated withdraw request
   * @example
   * ```typescript
   * await client.beneficiary.requestPayoutExecution({
   *   id: 'withdraw-request-id'
   * });
   * ```
   */
  async requestPayoutExecution(
    request: RequestPayoutExecutionRequest
  ): Promise<RequestPayoutExecutionResponse> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.post<RequestPayoutExecutionResponse>(
      `/api/my/beneficiary-withdraw-requests/${request.id}/request-payout`
    );

    return response;
  }

  /**
   * Claim timeout
   * When payout times out, claim funds directly on the source chain
   * @param request - Request with withdraw request ID
   * @returns Response with updated withdraw request
   * @example
   * ```typescript
   * await client.beneficiary.claimTimeout({
   *   id: 'withdraw-request-id'
   * });
   * ```
   */
  async claimTimeout(
    request: ClaimTimeoutRequest
  ): Promise<ClaimTimeoutResponse> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.post<ClaimTimeoutResponse>(
      `/api/my/beneficiary-withdraw-requests/${request.id}/claim-timeout`
    );

    return response;
  }
}

