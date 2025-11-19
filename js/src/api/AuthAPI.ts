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
import { NetworkError, APIError, AuthError } from '../utils/errors';

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

    // Use Universal Address format (32-byte) for user_address - REQUIRED
    if (!request.address.universalFormat) {
      throw new Error(
        'Universal Address format is required. request.address.universalFormat is missing.'
      );
    }
    const userAddress = request.address.universalFormat.replace(/^0x/, '');

    const response = await this.client.post<any>('/api/auth/login', {
      // Backend expects user_address as Universal Address (32-byte), chain_id as SLIP-44
      user_address: userAddress, // 32-byte Universal Address (required)
      chain_id: request.chainId, // SLIP-44 Chain ID
      message: request.message,
      signature: request.signature,
    });

    // Backend returns { success: bool, token: string, message: string }
    // Check if authentication was successful
    if (response.success === false || !response.token) {
      const errorMessage = response.message || 'Authentication failed';
      throw new Error(`Authentication failed: ${errorMessage}`);
    }

    // Validate token is present and not empty
    if (!response.token || typeof response.token !== 'string' || response.token.trim() === '') {
      throw new Error('Authentication response missing or invalid token');
    }

    // Store token in client
    this.client.setAuthToken(response.token);

    // Verify token was set
    const verifyToken = this.client.getAuthToken();
    if (!verifyToken) {
      throw new Error('Failed to set auth token in API client');
    }

    // Return response in expected format
    return {
      token: response.token,
      user_address: request.address,
    };
  }

  /**
   * Refresh authentication token
   * @param request - Refresh token request
   * @returns New authentication response
   */
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    validateNonEmptyString(request.token, 'token');

    const response = await this.client.post<RefreshTokenResponse>('/api/auth/refresh', {
      token: request.token,
    });

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
      const response = await this.client.get<{ valid: boolean }>('/api/auth/verify');
      return response.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication nonce for signing
   * @param address - User's address
   * @returns Nonce for signing with message
   */
  async getNonce(
    address?: string
  ): Promise<{ nonce: string; timestamp: string; message?: string }> {
    const params = address ? { owner: address } : {};

    try {
      // Backend returns { success: bool, nonce: string, message: string, timestamp: number }
      const response = await this.client.get<any>('/api/auth/nonce', { params });

      // Handle backend response format
      if (response.success === false || !response.nonce) {
        // If backend returns success: false, it's an API error
        const errorMessage = response.message || 'Failed to get nonce from backend';
        // Re-throw as APIError with 200 status (backend returned error in response body)
        throw new APIError(errorMessage, 200, 'NONCE_ERROR', '/api/auth/nonce', { response });
      }

      // Convert timestamp to string if it's a number
      return {
        nonce: response.nonce,
        timestamp:
          typeof response.timestamp === 'number'
            ? response.timestamp.toString()
            : response.timestamp || Date.now().toString(),
        message: response.message, // Include message from backend
      };
    } catch (error) {
      // Re-throw NetworkError, APIError, and AuthError as-is
      // These are already properly formatted by APIClient
      if (
        error instanceof NetworkError ||
        error instanceof APIError ||
        error instanceof AuthError
      ) {
        throw error;
      }

      // For other errors, wrap them
      throw new Error(`Failed to get nonce: ${(error as Error).message}`);
    }
  }
}
