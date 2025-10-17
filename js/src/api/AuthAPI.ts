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
    validatePositiveNumber(request.timestamp, 'timestamp');

    const response = await this.client.post<APIResponse<AuthResponse>>(
      '/api/auth/login',
      {
        address: request.address,
        signature: request.signature,
        message: request.message,
        timestamp: request.timestamp,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Authentication failed');
    }

    // Store token in client
    this.client.setAuthToken(response.data.token);

    return response.data;
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

    const response = await this.client.post<APIResponse<RefreshTokenResponse>>(
      '/api/auth/refresh',
      { token: request.token }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Token refresh failed');
    }

    // Update token in client
    this.client.setAuthToken(response.data.token);

    return response.data;
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
      const response = await this.client.get<APIResponse<{ valid: boolean }>>(
        '/api/auth/verify'
      );
      return response.success && response.data?.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication message to sign
   * @param address - User's address
   * @returns Message to sign
   */
  async getAuthMessage(address: string): Promise<string> {
    validateNonEmptyString(address, 'address');

    const response = await this.client.get<APIResponse<{ message: string }>>(
      '/api/auth/message',
      { params: { address } }
    );

    if (!response.success || !response.data?.message) {
      throw new Error(response.error || 'Failed to get auth message');
    }

    return response.data.message;
  }
}

