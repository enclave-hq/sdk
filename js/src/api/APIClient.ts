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

  constructor(config: APIClientConfig) {
    this.logger = config.logger || getLogger();
    this.enableRetry = config.enableRetry ?? true;
    this.maxRetries = config.maxRetries ?? 3;

    // Create axios instance
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
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
    this.logger.debug('Auth token updated');
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
          this.axios.defaults.timeout || 30000,
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
      this.clearAuthToken();
      return new AuthError(
        data?.error || 'Authentication failed',
        {
          statusCode: status,
          endpoint: error.config?.url,
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
          const response = await requestFn();
          return response.data;
        },
        {
          maxAttempts: this.maxRetries,
          shouldRetry: (error, _attempt) => {
            // Don't retry auth errors
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

