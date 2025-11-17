/**
 * Base HTTP API client with authentication support
 * @module api/APIClient
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import {
  APIError,
  NetworkError,
  AuthError,
  TimeoutError,
} from '../utils/errors';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { retry, shouldRetryHttpStatus } from '../utils/retry';

/**
 * API client configuration
 */
export interface APIClientConfig {
  /** Base URL for API */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Logger instance */
  logger?: ILogger;
  /** Enable request retries */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Callback to re-authenticate when receiving 401 errors */
  onAuthError?: () => Promise<void>;
}

/**
 * Base HTTP API client
 */
export class APIClient {
  private readonly axios: AxiosInstance;
  private readonly logger: ILogger;
  private readonly enableRetry: boolean;
  private readonly maxRetries: number;
  private authToken?: string;
  private onAuthError?: () => Promise<void>;
  private isReauthenticating: boolean = false;

  constructor(config: APIClientConfig) {
    this.logger = config.logger || getLogger();
    this.enableRetry = config.enableRetry ?? false; // Disable retry by default
    this.maxRetries = config.maxRetries ?? 3;
    this.onAuthError = config.onAuthError;

    // Create axios instance
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 300000, // 5 minutes (300 seconds) default timeout
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Add request interceptor for logging and auth
    this.axios.interceptors.request.use(
      (config) => {
        this.logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);

        // Add auth token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
          this.logger.debug(`Added Authorization header: Bearer ${this.authToken.substring(0, 20)}... for ${config.method?.toUpperCase()} ${config.url}`);
        } else {
          // Only warn for endpoints that require auth, debug for public endpoints
          const url = config.url || '';
          const isPublicEndpoint = url.includes('/api/auth/nonce') || url.includes('/api/auth/login');
          if (isPublicEndpoint) {
            this.logger.debug(`No auth token for public endpoint: ${config.method?.toUpperCase()} ${config.url}`);
          } else {
            this.logger.warn(`No auth token available for request: ${config.method?.toUpperCase()} ${config.url}`);
          }
        }

        return config;
      },
      (error) => {
        this.logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.logger.debug(`Auth token updated: ${token ? token.substring(0, 20) + '...' : 'empty'}`);
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
    this.logger.debug('Auth token cleared');
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): Error {
    // Network error (no response)
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return new TimeoutError(
          'Request timeout',
          this.axios.defaults.timeout || 300000, // 5 minutes default
          { originalError: error.message }
        );
      }

      return new NetworkError(
        error.message || 'Network error',
        undefined,
        { originalError: error.message }
      );
    }

    const response = error.response;
    const status = response.status;
    const data = response.data as any;

    // Authentication error
    if (status === 401) {
      // Only clear token if it's not an auth endpoint (to avoid clearing token during login)
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/refresh');
      
      if (!isAuthEndpoint) {
        // Clear token only for non-auth endpoints (token expired or invalid)
        this.clearAuthToken();
        this.logger.warn(`Auth token cleared due to 401 error on ${url}`);
      } else {
        // For auth endpoints, log but don't clear (might not have token yet)
        this.logger.debug(`401 error on auth endpoint ${url} - token not cleared`);
      }
      
      return new AuthError(
        data?.error || data?.message || 'Authentication required',
        {
          statusCode: status,
          endpoint: url,
        }
      );
    }

    // API error with structured response
    if (data?.error || data?.message) {
      return new APIError(
        data.error || data.message,
        status,
        data.errorCode || `HTTP_${status}`,
        error.config?.url,
        data.details
      );
    }

    // Generic HTTP error
    return new NetworkError(
      `HTTP ${status}: ${error.message}`,
      status,
      { endpoint: error.config?.url }
    );
  }

  /**
   * Execute request with optional retry
   */
  private async executeRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>
  ): Promise<T> {
    if (this.enableRetry) {
      return retry(
        async () => {
          try {
            const response = await requestFn();
            return response.data;
          } catch (error) {
            // If we get an AuthError and have a re-auth callback, try to re-authenticate
            if (error instanceof AuthError && this.onAuthError && !this.isReauthenticating) {
              const url = (error as any).details?.endpoint || '';
              const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/refresh');
              
              // Only re-authenticate for non-auth endpoints
              if (!isAuthEndpoint) {
                this.logger.info('Attempting to re-authenticate after 401 error...');
                this.isReauthenticating = true;
                try {
                  await this.onAuthError();
                  
                  // Verify token was set after re-authentication
                  const newToken = this.getAuthToken();
                  if (!newToken) {
                    this.logger.error('Re-authentication completed but token is still missing');
                    throw new Error('Token not set after re-authentication');
                  }
                  
                  this.logger.info(`Re-authentication successful. New token: ${newToken.substring(0, 20)}..., retrying request to ${url}...`);
                  
                  // Small delay to ensure token is fully set (though it should be immediate)
                  await new Promise(resolve => setTimeout(resolve, 10));
                  
                  // Verify token is still available before retry
                  const tokenBeforeRetry = this.getAuthToken();
                  if (!tokenBeforeRetry || tokenBeforeRetry !== newToken) {
                    this.logger.error(`Token changed or missing before retry. Expected: ${newToken.substring(0, 20)}..., Got: ${tokenBeforeRetry ? tokenBeforeRetry.substring(0, 20) + '...' : 'MISSING'}`);
                    throw new Error('Token not available for retry');
                  }
                  
                  // Retry the original request after re-authentication
                  const response = await requestFn();
                  this.logger.info(`Request retry successful after re-authentication`);
                  return response.data;
                } catch (reauthError) {
                  this.logger.error('Re-authentication failed:', reauthError);
                  throw error; // Throw original auth error
                } finally {
                  this.isReauthenticating = false;
                }
              }
            }
            throw error;
          }
        },
        {
          maxAttempts: this.maxRetries,
          shouldRetry: (error, _attempt) => {
            // Don't retry auth errors (they're handled above)
            if (error instanceof AuthError) return false;

            // Retry network and timeout errors
            if (
              error instanceof NetworkError ||
              error instanceof TimeoutError
            ) {
              return true;
            }

            // Retry on 5xx and 429 status codes
            if (error instanceof APIError) {
              return shouldRetryHttpStatus(error.statusCode);
            }

            return false;
          },
          logger: this.logger,
        }
      );
    } else {
      const response = await requestFn();
      return response.data;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.executeRequest(() => this.axios.get<T>(url, config));
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.executeRequest(() => this.axios.post<T>(url, data, config));
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.executeRequest(() => this.axios.put<T>(url, data, config));
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.executeRequest(() => this.axios.patch<T>(url, data, config));
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.executeRequest(() => this.axios.delete<T>(url, config));
  }

  /**
   * Generic request
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    return this.executeRequest(() => this.axios.request<T>(config));
  }
}

