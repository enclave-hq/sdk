/**
 * Authentication API client
 * @module api/AuthAPI
 */

import type { APIClient } from './APIClient';
import type {
  AuthRequest,
  AuthResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  APIResponse,
} from '../types/api';
import {
  validateRequired,
  validateNonEmptyString,
  validateUniversalAddress,
  validateSignature,
  validatePositiveNumber,
} from '../utils/validation';

/**
 * Authentication API endpoints
 */
export class AuthAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Authenticate user with signed message
   * @param request - Authentication request
   * @returns Authentication response with token
   */
  async authenticate(request: AuthRequest): Promise<AuthResponse> {
    // Validate request
    validateUniversalAddress(request.address, 'address');
    validateNonEmptyString(request.message, 'message');
    validateSignature(request.signature, 'signature');
    validatePositiveNumber(request.chainId, 'chainId');

    const response = await this.client.post<AuthResponse>(
      '/api/auth/login',
      {
        user_address: request.address,
        chain_id: request.chainId,
        message: request.message,
        signature: request.signature,
      }
    );

    // Store token in client
    this.client.setAuthToken(response.token);

    return response;
  }

  /**
   * Refresh authentication token
   * @param request - Refresh token request
   * @returns New authentication response
   */
  async refreshToken(
    request: RefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    validateNonEmptyString(request.token, 'token');

    const response = await this.client.post<RefreshTokenResponse>(
      '/api/auth/refresh',
      { token: request.token }
    );

    // Update token in client
    this.client.setAuthToken(response.token);

    return response;
  }

  /**
   * Logout (clear authentication)
   */
  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      // Clear token even if logout request fails
      this.client.clearAuthToken();
    }
  }

  /**
   * Verify current authentication token
   * @returns True if token is valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await this.client.get<{ valid: boolean }>(
        '/api/auth/verify'
      );
      return response.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication nonce for signing
   * @param address - User's address
   * @returns Nonce for signing
   */
  async getNonce(address?: string): Promise<{ nonce: string; timestamp: string }> {
    const params = address ? { owner: address } : {};
    return this.client.get<{ nonce: string; timestamp: string }>(
      '/api/auth/nonce',
      { params }
    );
  }
}

