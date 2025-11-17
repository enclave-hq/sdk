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

    // Owner is now automatically determined from JWT token - no need to pass it
    const response = await this.client.get<ListWithdrawRequestsResponse>(
      '/api/my/withdraw-requests',
      {
        params: {
          status: request.status,
          tokenId: request.tokenId,
          targetChain: request.targetChain,
          page: request.page || 1,
          page_size: request.limit || 10,
        },
      }
    );

    // Normalize each withdraw request in the list
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map(item => this.normalizeWithdrawRequest(item));
    }

    return response;
  }

  /**
   * Normalize backend response - only do minimal necessary conversions
   * Keep data structure as close to backend as possible
   * 
   * Only converts:
   * - allocation_ids (JSON string) -> allocationIds (array) for convenience
   * 
   * Other fields remain as backend format:
   * - intent_type, token_identifier, asset_id (flat fields)
   * - recipient_* (embedded fields from GORM)
   * - owner_* (embedded fields from GORM)
   */
  normalizeWithdrawRequest(data: unknown): WithdrawRequestDetail {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = data as any;
    
    // Debug: Log available fields to understand backend structure
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      const recipientFields = Object.keys(obj).filter(k => k.includes('recipient'));
      const ownerFields = Object.keys(obj).filter(k => k.includes('owner'));
      if (recipientFields.length > 0 || ownerFields.length > 0) {
        console.log('[WithdrawalsAPI] Available fields:', {
          recipientFields,
          ownerFields,
          hasRecipient: !!obj.recipient,
          hasOwnerAddress: !!obj.owner_address,
        });
      }
    }
    
    // Only convert allocation_ids JSON string to array (necessary for type safety)
    if (obj.allocation_ids && typeof obj.allocation_ids === 'string') {
      try {
        obj.allocationIds = JSON.parse(obj.allocation_ids);
      } catch (e) {
        obj.allocationIds = [];
      }
      // Keep original field for backward compatibility
      // delete obj.allocation_ids;
    } else if (obj.allocation_ids && Array.isArray(obj.allocation_ids)) {
      obj.allocationIds = obj.allocation_ids;
    } else if (!obj.allocationIds) {
      obj.allocationIds = [];
    }

    // Build convenience getters (but keep original backend fields)
    // These are computed properties that don't modify the original data
    
    // Build beneficiary from recipient_* if not already present
    // GORM embedded fields with prefix: recipient_slip44_chain_id, recipient_data
    // UniversalAddress fields: slip44_chain_id, evm_chain_id, data
    if (!obj.beneficiary) {
      // Try different possible field names (GORM embedded with prefix)
      const recipientChainId = obj.recipient_slip44_chain_id || 
                               obj.recipient_chain_id || 
                               obj.target_slip44_chain_id || 
                               0;
      // recipient_data is the Data field from UniversalAddress with prefix
      const recipientData = obj.recipient_data || 
                           (obj.recipient && typeof obj.recipient === 'object' ? obj.recipient.data : null) || 
                           '';
      
      if (recipientData) {
        obj.beneficiary = {
          chainId: recipientChainId,
          address: recipientData, // Use data as address
          data: recipientData,
        };
      } else if (obj.recipient && typeof obj.recipient === 'object') {
        // If recipient is already an object, use it directly
        const recipient = obj.recipient;
        obj.beneficiary = {
          chainId: recipient.slip44_chain_id || recipient.chainId || 0,
          address: recipient.data || recipient.address || '',
          data: recipient.data || recipient.address || '',
        };
      } else {
        // Fallback: create empty beneficiary to avoid undefined errors
        obj.beneficiary = {
          chainId: 0,
          address: '',
          data: '',
        };
      }
    }
    
    // Ensure beneficiary always has address field (fallback to data if address is missing)
    if (obj.beneficiary) {
      if (!obj.beneficiary.address) {
        obj.beneficiary.address = obj.beneficiary.data || '';
      }
      if (!obj.beneficiary.data && obj.beneficiary.address) {
        obj.beneficiary.data = obj.beneficiary.address;
      }
    }

    // Build owner from owner_* if not already present
    // GORM embedded fields with prefix: owner_slip44_chain_id, owner_data
    if (!obj.owner) {
      const ownerChainId = obj.owner_slip44_chain_id || 
                          obj.owner_chain_id || 
                          0;
      const ownerData = obj.owner_data || 
                       obj.owner_address?.data || 
                       '';
      
      if (ownerData) {
        obj.owner = {
          chainId: ownerChainId,
          address: ownerData,
          data: ownerData,
        };
      } else if (obj.owner_address && typeof obj.owner_address === 'object') {
        // If owner_address is already an object, use it directly
        obj.owner = {
          chainId: obj.owner_address.slip44_chain_id || obj.owner_address.chainId || 0,
          address: obj.owner_address.data || obj.owner_address.address || '',
          data: obj.owner_address.data || obj.owner_address.address || '',
        };
      }
    }
    
    // Ensure owner has address field (fallback to data if address is missing)
    if (obj.owner && !obj.owner.address && obj.owner.data) {
      obj.owner.address = obj.owner.data;
    }

    // Build intent from flattened fields if not already present
    if (!obj.intent) {
      const intentType = obj.intent_type ?? 0;
      const beneficiary = obj.beneficiary || {
        chainId: obj.recipient_slip44_chain_id || obj.recipient_chain_id || obj.target_slip44_chain_id || 0,
        address: obj.recipient_data || '',
        data: obj.recipient_data || '',
      };

      if (intentType === 0) {
        obj.intent = {
          type: 'RawToken',
          beneficiary: beneficiary,
          tokenSymbol: obj.token_symbol || obj.tokenSymbol || '',
        };
      } else if (intentType === 1) {
        obj.intent = {
          type: 'AssetToken',
          beneficiary: beneficiary,
          assetId: obj.asset_id || '',
          assetTokenSymbol: obj.asset_token_symbol || obj.assetTokenSymbol || '',
        };
      } else {
        obj.intent = {
          type: 'RawToken',
          beneficiary: beneficiary,
          tokenSymbol: obj.token_symbol || obj.tokenSymbol || '',
        };
      }
    }

    // Note: We keep all original backend fields (intent_type, recipient_*, owner_*, etc.)
    // for backward compatibility and to maintain data consistency with backend

    return obj as WithdrawRequestDetail;
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

    // Backend returns { success: true, data: {...} } format
    let requestData: unknown;
    if (response.data) {
      requestData = response.data;
    } else if (response.withdrawRequest) {
      requestData = response.withdrawRequest;
    } else {
      throw new Error('Failed to get withdraw request: invalid response format');
    }

    // Normalize the response (convert allocation_ids to allocationIds)
    return this.normalizeWithdrawRequest(requestData);
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

    // Backend returns { success: true, data: {...} } format
    let requestData: unknown;
    if (response.data) {
      requestData = response.data;
    } else if (response.withdrawRequest) {
      requestData = response.withdrawRequest;
    } else {
      throw new Error('Failed to get withdraw request by nullifier: invalid response format');
    }

    // Normalize the response (convert allocation_ids to allocationIds)
    return this.normalizeWithdrawRequest(requestData);
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
    // Validate intent fields (flat structure matching backend v2 format)
    validateChainId(request.intent.beneficiaryChainId, 'intent.beneficiaryChainId');
    validateNonEmptyString(request.intent.beneficiaryAddress, 'intent.beneficiaryAddress');

    // Validate signature and chainId (required by backend)
    if (!request.signature) {
      throw new Error('signature is required for withdraw request');
    }
    if (request.chainId === undefined || request.chainId === null) {
      throw new Error('chainId is required for withdraw request');
    }

    // Unified API endpoint
    // Backend expects: allocations, intent, signature, and chainId
    const requestBody = {
      allocations: request.allocationIds,
      intent: request.intent,
      signature: request.signature,
      chainId: request.chainId,
    };
    
    // Debug: Log request body (without signature for security)
    const debugBody = { ...requestBody, signature: '[REDACTED]' };
    console.log('🔍 [DEBUG] Sending withdraw request:', JSON.stringify(debugBody, null, 2));
    
    const response = await this.client.post<CreateWithdrawRequestResponse>(
      '/api/withdraws/submit',
      requestBody
    );

    // Backend v2 returns { success: true, data: { id, status, ... } }
    // We need to fetch the full withdraw request detail
    if (response.data?.id) {
      const fullRequest = await this.getWithdrawRequestById({ id: response.data.id });
      return fullRequest;
    }

    // Fallback to legacy format if available
    if (response.withdrawRequest) {
      return this.normalizeWithdrawRequest(response.withdrawRequest);
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
    // Owner is now automatically determined from JWT token - no need to pass it
    const response = await this.client.get<GetWithdrawStatsResponse>(
      '/api/my/withdraw-requests/stats',
      {
        params: {
          tokenId: request.tokenId,
        },
      }
    );

    return response;
  }

}

