/**
 * Checkbooks store for reactive checkbook state management
 * @module stores/CheckbooksStore
 */

import { computed } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Checkbook, CheckbookStatus } from '../types/models';
import type { CheckbooksAPI } from '../api/CheckbooksAPI';
import type { ILogger } from '../types/config';

/**
 * Checkbooks store configuration
 */
export interface CheckbooksStoreConfig {
  /** Checkbooks API client */
  api: CheckbooksAPI;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Reactive store for checkbooks (merged with deposits)
 */
export class CheckbooksStore extends BaseStore<Checkbook> {
  private readonly api: CheckbooksAPI;

  constructor(config: CheckbooksStoreConfig) {
    super({ name: 'CheckbooksStore', logger: config.logger });
    this.api = config.api;
  }

  /**
   * Get checkbooks by status
   */
  @computed get byStatus(): Map<CheckbookStatus, Checkbook[]> {
    const grouped = new Map<CheckbookStatus, Checkbook[]>();
    
    this.all.forEach((checkbook) => {
      const status = checkbook.status;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(checkbook);
    });

    return grouped;
  }

  /**
   * Get pending checkbooks
   */
  @computed get pending(): Checkbook[] {
    return this.filter((c) => c.status === 'pending');
  }

  /**
   * Get unsigned checkbooks
   */
  @computed get unsigned(): Checkbook[] {
    return this.filter((c) => c.status === 'unsigned');
  }

  /**
   * Get active checkbooks (with_checkbook status)
   */
  @computed get active(): Checkbook[] {
    return this.filter((c) => c.status === 'with_checkbook');
  }

  /**
   * Get completed checkbooks
   * Note: CheckbookStatus enum doesn't have 'completed' status
   * This method is kept for backward compatibility but will return empty array
   */
  @computed get completed(): Checkbook[] {
    // CheckbookStatus doesn't have 'completed' - return empty array
    // Use WithCheckbook status instead if needed
    return [];
  }

  /**
   * Get checkbooks by token ID
   */
  getByTokenId(tokenId: string): Checkbook[] {
    return this.filter((c) => c.token.id === tokenId);
  }

  /**
   * Get checkbooks by owner
   * @param owner - Owner address
   * @returns Array of checkbooks
   */
  getByOwner(owner: string): Checkbook[] {
    return this.filter((c) => 
      c.owner.address.toLowerCase() === owner.toLowerCase()
    );
  }

  /**
   * Fetch checkbooks from API for authenticated user
   * @param owner - Owner address (deprecated, ignored - address is taken from JWT)
   * @param tokenId - Optional token ID filter
   * @param status - Optional status filter
   * @returns Array of checkbooks
   * @deprecated Use fetchList() instead - owner is now determined from JWT token
   */
  async fetchByOwner(
    owner: string,
    tokenId?: string,
    status?: string
  ): Promise<Checkbook[]> {
    return this.executeAction(async () => {
      // Owner parameter is ignored - address is taken from JWT token
      const checkbooks = await this.api.getCheckbooksByOwner(owner, tokenId, status);
      this.updateItems(checkbooks, (c) => c.id);
      return checkbooks;
    }, 'Failed to fetch checkbooks');
  }

  /**
   * Fetch checkbooks list from API
   * @param filters - Optional filters (owner is automatically determined from JWT)
   * @returns Paginated checkbooks response
   */
  async fetchList(filters?: {
    status?: string;
    tokenId?: string;
    page?: number;
    limit?: number;
  }): Promise<Checkbook[]> {
    return this.executeAction(async () => {
      const response = await this.api.listCheckbooks(filters);
      this.updateItems(response.data, (c) => c.id);
      return response.data;
    }, 'Failed to fetch checkbooks list');
  }

  /**
   * Fetch single checkbook by ID from API
   * @param id - Checkbook ID
   * @returns Checkbook data
   */
  async fetchById(id: string): Promise<Checkbook> {
    return this.executeAction(async () => {
      const checkbook = await this.api.getCheckbookById({ id });
      this.set(checkbook.id, checkbook);
      return checkbook;
    }, 'Failed to fetch checkbook by ID');
  }

  /**
   * Update checkbook in store (typically called from WebSocket)
   * @param checkbook - Updated checkbook data
   */
  updateCheckbook(checkbook: Checkbook): void {
    this.set(checkbook.id, checkbook);
    this.logger.debug(`Updated checkbook: ${checkbook.id}`);
  }

  /**
   * Update multiple checkbooks in store
   * @param checkbooks - Array of checkbooks
   */
  updateCheckbooks(checkbooks: Checkbook[]): void {
    this.updateItems(checkbooks, (c) => c.id);
    this.logger.debug(`Updated ${checkbooks.length} checkbooks`);
  }

  /**
   * Remove checkbook from store
   * @param id - Checkbook ID
   */
  removeCheckbook(id: string): void {
    this.delete(id);
    this.logger.debug(`Removed checkbook: ${id}`);
  }

  /**
   * Calculate total deposited amount across all checkbooks
   * @param tokenId - Optional token ID filter
   * @returns Total amount as string
   */
  @computed get totalDeposited(): string {
    return this.all
      .reduce((sum, checkbook) => {
        return sum + BigInt(checkbook.depositAmount);
      }, 0n)
      .toString();
  }

  /**
   * Calculate total remaining amount across all checkbooks
   * @param tokenId - Optional token ID filter
   * @returns Total amount as string
   */
  @computed get totalRemaining(): string {
    return this.all
      .reduce((sum, checkbook) => {
        return sum + BigInt(checkbook.remainingAmount);
      }, 0n)
      .toString();
  }

  /**
   * Get total deposited by token
   */
  @computed get totalByToken(): Map<string, string> {
    const totals = new Map<string, bigint>();

    this.all.forEach((checkbook) => {
      const tokenId = checkbook.token.id;
      const current = totals.get(tokenId) || 0n;
      totals.set(tokenId, current + BigInt(checkbook.depositAmount));
    });

    // Convert to string map
    const result = new Map<string, string>();
    totals.forEach((value, key) => {
      result.set(key, value.toString());
    });

    return result;
  }
}

