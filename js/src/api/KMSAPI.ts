/**
 * KMS (Key Management Service) API client
 * @module api/KMSAPI
 */

import type { APIClient } from './APIClient';
import type {
  KMSSignRequest,
  KMSSignResponse,
  KMSPublicKeyRequest,
  KMSPublicKeyResponse,
  APIResponse,
} from '../types/api';
import { validateNonEmptyString, validateHex } from '../utils/validation';

/**
 * KMS API endpoints
 */
export class KMSAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Sign data using KMS
   * @param request - Sign request with data and optional key ID
   * @returns Signature and public key
   */
  async sign(request: KMSSignRequest): Promise<KMSSignResponse> {
    validateNonEmptyString(request.data, 'data');
    validateHex(request.data, 'data');

    const response = await this.client.post<KMSSignResponse>('/api/kms/sign', {
      data: request.data,
      keyId: request.keyId,
    });

    return response;
  }

  /**
   * Get public key from KMS
   * @param request - Request with optional key ID
   * @returns Public key
   */
  async getPublicKey(request: KMSPublicKeyRequest = {}): Promise<KMSPublicKeyResponse> {
    const response = await this.client.get<KMSPublicKeyResponse>('/api/kms/public-key', {
      params: {
        keyId: request.keyId,
      },
    });

    return response;
  }
}
