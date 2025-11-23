/**
 * KYT Oracle API client
 * @module api/KYTOracleAPI
 */

import type { APIClient } from './APIClient';
import type {
  GetFeeInfoRequest,
  GetFeeInfoResponse,
  AssociateAddressRequest,
  AssociateAddressResponse,
} from '../types/api';
import { validateRequired, validateNonEmptyString } from '../utils/validation';
import { NetworkError, APIError } from '../utils/errors';

/**
 * KYT Oracle API endpoints
 */
export class KYTOracleAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Get fee info by address (with rate limiting)
   * @param request - Request with address, chain, and optional token key
   * @returns Fee information including risk score and invitation code
   */
  async getFeeInfoByAddress(request: GetFeeInfoRequest): Promise<GetFeeInfoResponse> {
    // Validate request
    validateRequired(request, 'request');
    validateNonEmptyString(request.address, 'address');
    validateNonEmptyString(request.chain, 'chain');

    try {
      const response = await this.client.post<GetFeeInfoResponse>(
        '/api/kyt-oracle/fee-info',
        {
          address: request.address,
          chain: request.chain,
          token_key: request.tokenKey, // Optional
        }
      );

      return response;
    } catch (error) {
      if (error instanceof NetworkError || error instanceof APIError) {
        throw error;
      }
      throw new Error(`Failed to get fee info: ${(error as Error).message}`);
    }
  }

  /**
   * Associate address with invitation code
   * @param request - Request with address, code, and optional chain
   * @returns Association result
   */
  async associateAddressWithCode(
    request: AssociateAddressRequest
  ): Promise<AssociateAddressResponse> {
    // Validate request
    validateRequired(request, 'request');
    validateNonEmptyString(request.address, 'address');
    validateNonEmptyString(request.code, 'code');

    try {
      const response = await this.client.post<AssociateAddressResponse>(
        '/api/kyt-oracle/associate-address',
        {
          address: request.address,
          code: request.code,
          chain: request.chain, // Optional
          token_key: request.tokenKey, // Optional token key for fee info
        }
      );

      return response;
    } catch (error) {
      if (error instanceof NetworkError || error instanceof APIError) {
        throw error;
      }
      throw new Error(`Failed to associate address: ${(error as Error).message}`);
    }
  }
}

