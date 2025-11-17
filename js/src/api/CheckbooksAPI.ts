/**
 * Checkbooks API client (merged with deposits)
 * @module api/CheckbooksAPI
 */

import type { APIClient } from './APIClient';
import type {
  ListCheckbooksRequest,
  ListCheckbooksResponse,
  GetCheckbookRequest,
} from '../types/api';
import type { Checkbook } from '../types/models';
import {
  validateNonEmptyString,
  validatePagination,
} from '../utils/validation';

/**
 * Checkbooks API endpoints
 */
export class CheckbooksAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * List checkbooks with optional filtering
   * @param request - List request with filters
   * @returns Paginated list of checkbooks
   */
  async listCheckbooks(
    request: ListCheckbooksRequest = {}
  ): Promise<ListCheckbooksResponse> {
    // Validate pagination params
    if (request.page || request.limit) {
      validatePagination(request.page, request.limit);
    }

    // Owner is now automatically determined from JWT token - no need to pass it
    const response = await this.client.get<{
      data: any[];
      pagination: any;
    }>(
      '/api/checkbooks',
      {
        params: {
          status: request.status,
          tokenId: request.tokenId,
          page: request.page || 1,
          limit: request.limit || 20,
          deleted: request.deleted !== undefined ? String(request.deleted) : undefined,
        },
      }
    );

    // Convert backend snake_case to frontend camelCase, including timestamps and amount fields
    const convertedData = (response.data || []).map((backendCheckbook: any) => {
      const checkbook: any = { ...backendCheckbook };
      
      // Convert local_deposit_id to localDepositId
      if (backendCheckbook.local_deposit_id !== undefined && backendCheckbook.local_deposit_id !== null) {
        checkbook.localDepositId = backendCheckbook.local_deposit_id;
      }
      
      // Convert slip44_chain_id to slip44ChainId
      if (backendCheckbook.slip44_chain_id !== undefined && backendCheckbook.slip44_chain_id !== null) {
        checkbook.slip44ChainId = backendCheckbook.slip44_chain_id;
      }
      
      // Convert amount fields: gross_amount, allocatable_amount, fee_total_locked
      if (backendCheckbook.gross_amount !== undefined && backendCheckbook.gross_amount !== null) {
        checkbook.grossAmount = String(backendCheckbook.gross_amount);
        // Also set depositAmount = grossAmount for compatibility
        if (!checkbook.depositAmount) {
          checkbook.depositAmount = String(backendCheckbook.gross_amount);
        }
      } else if (backendCheckbook.amount !== undefined && backendCheckbook.amount !== null && !checkbook.depositAmount) {
        // Fallback to amount if gross_amount is not available
        checkbook.depositAmount = String(backendCheckbook.amount);
      }
      
      if (backendCheckbook.allocatable_amount !== undefined && backendCheckbook.allocatable_amount !== null) {
        checkbook.allocatableAmount = String(backendCheckbook.allocatable_amount);
      }
      
      if (backendCheckbook.fee_total_locked !== undefined && backendCheckbook.fee_total_locked !== null) {
        checkbook.feeTotalLocked = String(backendCheckbook.fee_total_locked);
      }
      
      // Convert created_at to createdAt (timestamp)
      if (backendCheckbook.created_at) {
        checkbook.createdAt = typeof backendCheckbook.created_at === 'string'
          ? new Date(backendCheckbook.created_at).getTime()
          : (backendCheckbook.created_at instanceof Date
            ? backendCheckbook.created_at.getTime()
            : backendCheckbook.created_at);
      } else if (backendCheckbook.createdAt) {
        // Already in camelCase, ensure it's a number
        checkbook.createdAt = typeof backendCheckbook.createdAt === 'string'
          ? new Date(backendCheckbook.createdAt).getTime()
          : backendCheckbook.createdAt;
      }
      
      // Convert updated_at to updatedAt (timestamp)
      if (backendCheckbook.updated_at) {
        checkbook.updatedAt = typeof backendCheckbook.updated_at === 'string'
          ? new Date(backendCheckbook.updated_at).getTime()
          : (backendCheckbook.updated_at instanceof Date
            ? backendCheckbook.updated_at.getTime()
            : backendCheckbook.updated_at);
      } else if (backendCheckbook.updatedAt) {
        // Already in camelCase, ensure it's a number
        checkbook.updatedAt = typeof backendCheckbook.updatedAt === 'string'
          ? new Date(backendCheckbook.updatedAt).getTime()
          : backendCheckbook.updatedAt;
      }
      
      return checkbook;
    });

    // Convert pagination format: backend uses "size" and "pages", frontend expects "limit" and "totalPages"
    const pagination = response.pagination ? {
      page: response.pagination.page || 1,
      limit: response.pagination.limit || response.pagination.size || 20,
      total: response.pagination.total || 0,
      totalPages: response.pagination.totalPages || response.pagination.pages || 1,
      hasNext: response.pagination.hasNext !== undefined 
        ? response.pagination.hasNext 
        : (response.pagination.page || 1) < (response.pagination.totalPages || response.pagination.pages || 1),
      hasPrev: response.pagination.hasPrev !== undefined 
        ? response.pagination.hasPrev 
        : (response.pagination.page || 1) > 1,
    } : undefined;

    return {
      ...response,
      data: convertedData,
      pagination,
    } as ListCheckbooksResponse;
  }

  /**
   * Get checkbook by ID
   * @param request - Get request with checkbook ID
   * @returns Checkbook data
   */
  async getCheckbookById(
    request: GetCheckbookRequest
  ): Promise<Checkbook> {
    validateNonEmptyString(request.id, 'id');

    const response = await this.client.get<{
      success: boolean;
      data: {
        checkbook: Checkbook;
        checks: any[];
        checks_count: number;
        token?: {
          symbol: string;
          name?: string;
          decimals?: number;
          address?: string;
          chain_id?: number;
          chain_name?: string;
          is_active?: boolean;
        };
      };
    }>(`/api/checkbooks/id/${request.id}`);

    // Backend returns { success: true, data: { checkbook: ..., checks: ..., token: ... } }
    if (response.data?.checkbook) {
      const checkbook = response.data.checkbook;
      // Attach token info to checkbook if available
      if (response.data.token) {
        const tokenInfo = response.data.token;
        // Convert backend token format to SDK Token interface
        (checkbook as any).token = {
          id: tokenInfo.address || `token_${checkbook.token?.id || 'unknown'}`,
          symbol: tokenInfo.symbol || 'UNKNOWN',
          name: tokenInfo.name || tokenInfo.symbol || 'Unknown Token',
          decimals: tokenInfo.decimals || 18,
          contractAddress: tokenInfo.address || '',
          chainId: tokenInfo.chain_id || 0,
          iconUrl: undefined,
          isActive: tokenInfo.is_active !== undefined ? Boolean(tokenInfo.is_active) : true, // Use backend is_active, default to true if not provided
          metrics: undefined,
        };
      }
      // Ensure all checkbook fields are preserved from backend response
      // Backend returns: local_deposit_id, slip44_chain_id, gross_amount, allocatable_amount, fee_total_locked
      const backendCheckbook = response.data.checkbook as any;
      
      // Log backend response for debugging
      console.log('📋 [CheckbooksAPI.getCheckbookById] Backend checkbook data:', {
        id: backendCheckbook.id,
        local_deposit_id: backendCheckbook.local_deposit_id,
        local_deposit_id_type: typeof backendCheckbook.local_deposit_id,
        slip44_chain_id: backendCheckbook.slip44_chain_id,
      });
      
      if (backendCheckbook.local_deposit_id !== undefined && backendCheckbook.local_deposit_id !== null) {
        (checkbook as any).localDepositId = backendCheckbook.local_deposit_id;
        console.log('✅ [CheckbooksAPI.getCheckbookById] Set localDepositId:', backendCheckbook.local_deposit_id);
      } else {
        console.warn('⚠️ [CheckbooksAPI.getCheckbookById] Backend checkbook missing local_deposit_id:', {
          checkbookId: backendCheckbook.id,
          hasLocalDepositId: backendCheckbook.local_deposit_id !== undefined,
          localDepositIdValue: backendCheckbook.local_deposit_id,
        });
      }
      if (backendCheckbook.slip44_chain_id !== undefined) {
        (checkbook as any).slip44ChainId = backendCheckbook.slip44_chain_id;
        // Also set token.chainId from slip44_chain_id if not already set
        if (!checkbook.token?.chainId) {
          if (!checkbook.token) {
            (checkbook as any).token = {};
          }
          (checkbook.token as any).chainId = backendCheckbook.slip44_chain_id;
        }
      }
      // Preserve amount fields from backend
      // Backend returns these as strings, preserve them even if empty (for debugging)
      // depositAmount should be gross_amount (total deposit amount before fees)
      if (backendCheckbook.gross_amount !== undefined && backendCheckbook.gross_amount !== null) {
        (checkbook as any).grossAmount = String(backendCheckbook.gross_amount);
        (checkbook as any).depositAmount = String(backendCheckbook.gross_amount); // depositAmount = gross_amount
      } else if (backendCheckbook.amount !== undefined && backendCheckbook.amount !== null) {
        // Fallback to amount if gross_amount is not available
        (checkbook as any).depositAmount = String(backendCheckbook.amount);
      }
      if (backendCheckbook.allocatable_amount !== undefined && backendCheckbook.allocatable_amount !== null) {
        (checkbook as any).allocatableAmount = String(backendCheckbook.allocatable_amount);
      }
      if (backendCheckbook.fee_total_locked !== undefined && backendCheckbook.fee_total_locked !== null) {
        (checkbook as any).feeTotalLocked = String(backendCheckbook.fee_total_locked);
      }
      
      // Preserve commitment field from backend
      if (backendCheckbook.commitment !== undefined && backendCheckbook.commitment !== null) {
        (checkbook as any).commitment = String(backendCheckbook.commitment);
      }
      
      // Convert created_at to createdAt (timestamp)
      if (backendCheckbook.created_at) {
        (checkbook as any).createdAt = typeof backendCheckbook.created_at === 'string'
          ? new Date(backendCheckbook.created_at).getTime()
          : (backendCheckbook.created_at instanceof Date
            ? backendCheckbook.created_at.getTime()
            : backendCheckbook.created_at);
      } else if (!checkbook.createdAt && backendCheckbook.createdAt) {
        // Already in camelCase, ensure it's a number
        (checkbook as any).createdAt = typeof backendCheckbook.createdAt === 'string'
          ? new Date(backendCheckbook.createdAt).getTime()
          : backendCheckbook.createdAt;
      }
      
      // Convert updated_at to updatedAt (timestamp)
      if (backendCheckbook.updated_at) {
        (checkbook as any).updatedAt = typeof backendCheckbook.updated_at === 'string'
          ? new Date(backendCheckbook.updated_at).getTime()
          : (backendCheckbook.updated_at instanceof Date
            ? backendCheckbook.updated_at.getTime()
            : backendCheckbook.updated_at);
      } else if (!checkbook.updatedAt && backendCheckbook.updatedAt) {
        // Already in camelCase, ensure it's a number
        (checkbook as any).updatedAt = typeof backendCheckbook.updatedAt === 'string'
          ? new Date(backendCheckbook.updatedAt).getTime()
          : backendCheckbook.updatedAt;
      }
      
      // Log for debugging
      if (!backendCheckbook.allocatable_amount || backendCheckbook.allocatable_amount === '0' || backendCheckbook.allocatable_amount === '') {
        console.warn('⚠️ Checkbook missing or zero allocatable_amount', {
          checkbookId: checkbook.id,
          allocatable_amount: backendCheckbook.allocatable_amount,
          gross_amount: backendCheckbook.gross_amount,
          depositAmount: checkbook.depositAmount,
        });
      }
      return checkbook;
    }

    // Fallback to legacy format if available
    if ((response as any).checkbook) {
      return (response as any).checkbook;
    }

    throw new Error('Invalid response format: missing checkbook data');
  }

  /**
   * Get checkbooks for authenticated user
   * @param tokenId - Optional token ID filter
   * @param status - Optional status filter
   * @returns List of checkbooks
   * @deprecated Use listCheckbooks() instead - owner is now determined from JWT
   */
  async getCheckbooksByOwner(
    _owner: string, // Owner parameter is ignored - address is taken from JWT token
    tokenId?: string,
    status?: string
  ): Promise<Checkbook[]> {
    // Owner parameter is ignored - address is taken from JWT token
    const response = await this.listCheckbooks({
      tokenId,
      status,
      limit: 100, // Get all checkbooks for authenticated user
    });

    return response.data;
  }

  /**
   * Delete checkbook by ID
   * @param id - Checkbook ID
   * @returns Success response
   */
  async deleteCheckbook(id: string): Promise<{ success: boolean; message: string; checkbook_id: string }> {
    validateNonEmptyString(id, 'id');

    return this.client.delete<{ success: boolean; message: string; checkbook_id: string }>(
      `/api/checkbooks/${id}`
    );
  }
}

