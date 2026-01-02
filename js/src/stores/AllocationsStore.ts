/**
 * Allocations store for reactive allocation state management
 * @module stores/AllocationsStore
 */

import { computed } from 'mobx';
import { BaseStore } from './BaseStore';
import type { Allocation, AllocationStatus } from '../types/models';
import type { AllocationsAPI } from '../api/AllocationsAPI';
import type { ILogger } from '../types/config';

/**
 * Allocations store configuration
 */
export interface AllocationsStoreConfig {
  /** Allocations API client */
  api: AllocationsAPI;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Reactive store for allocations
 */
export class AllocationsStore extends BaseStore<Allocation> {
  private readonly api: AllocationsAPI;

  constructor(config: AllocationsStoreConfig) {
    super({ name: 'AllocationsStore', logger: config.logger });
    this.api = config.api;
  }

  /**
   * Get allocations by status
   */
  @computed get byStatus(): Map<AllocationStatus, Allocation[]> {
    const grouped = new Map<AllocationStatus, Allocation[]>();

    this.all.forEach(allocation => {
      const status = allocation.status;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(allocation);
    });

    return grouped;
  }

  /**
   * Get idle allocations (available for withdrawal)
   */
  @computed get idle(): Allocation[] {
    return this.filter(a => a.status === 'idle');
  }

  /**
   * Get pending allocations (part of active withdrawal request)
   */
  @computed get pending(): Allocation[] {
    return this.filter(a => a.status === 'pending');
  }

  /**
   * Get used allocations (successfully withdrawn)
   */
  @computed get used(): Allocation[] {
    return this.filter(a => a.status === 'used');
  }

  /**
   * Get allocations by checkbook ID
   */
  getByCheckbookId(checkbookId: string): Allocation[] {
    return this.filter(a => a.checkbookId === checkbookId);
  }

  /**
   * Get allocations by checkbook ID and status
   * @param checkbookId - Checkbook ID
   * @param status - Allocation status
   * @returns Filtered allocations
   */
  getByCheckbookIdAndStatus(checkbookId: string, status: AllocationStatus): Allocation[] {
    return this.filter(a => a.checkbookId === checkbookId && a.status === status);
  }

  /**
   * Get allocations by token ID
   */
  getByTokenId(tokenId: string): Allocation[] {
    return this.filter(a => a.token.id === tokenId);
  }

  /**
   * Get allocations by token ID and status
   * @param tokenId - Token ID
   * @param status - Allocation status
   * @returns Filtered allocations
   */
  getByTokenIdAndStatus(tokenId: string, status: AllocationStatus): Allocation[] {
    return this.filter(a => a.token.id === tokenId && a.status === status);
  }

  /**
   * Get allocations by owner
   * @param owner - Owner address
   * @returns Array of allocations
   */
  getByOwner(owner: string): Allocation[] {
    const { extractAddress } = require('../utils/address');
    return this.filter(a => {
      const ownerAddr = extractAddress(a.owner);
      return ownerAddr.toLowerCase() === owner.toLowerCase();
    });
  }

  /**
   * Get allocations by withdrawal request ID
   * @param withdrawRequestId - Withdrawal request ID
   * @returns Array of allocations
   */
  getByWithdrawRequestId(withdrawRequestId: string): Allocation[] {
    return this.filter(a => a.withdrawRequestId === withdrawRequestId);
  }

  /**
   * Fetch allocations from API
   * @param filters - Optional filters (owner is automatically determined from JWT if authenticated)
   * @returns Array of allocations
   */
  async fetchList(filters?: {
    checkbookId?: string;
    tokenId?: string;
    tokenKeys?: string[]; // Filter by token keys (e.g., ["USDT", "USDC"])
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Allocation[]> {
    return this.executeAction(async () => {
      const response = await this.api.listAllocations(filters);
      this.updateItems(response.data, a => a.id);
      return response.data;
    }, 'Failed to fetch allocations list');
  }

  /**
   * Fetch allocations by checkbook ID from API
   * @param checkbookId - Checkbook ID
   * @param status - Optional status filter
   * @returns Array of allocations
   */
  async fetchByCheckbookId(checkbookId: string, status?: string): Promise<Allocation[]> {
    return this.executeAction(async () => {
      const allocations = await this.api.getAllocationsByCheckbookId(checkbookId, status);
      this.updateItems(allocations, a => a.id);
      return allocations;
    }, 'Failed to fetch allocations by checkbook ID');
  }

  /**
   * Fetch allocations by token ID and status from API
   * @param tokenId - Token ID
   * @param status - Allocation status
   * @returns Array of allocations
   */
  async fetchByTokenIdAndStatus(tokenId: string, status: string): Promise<Allocation[]> {
    return this.executeAction(async () => {
      const allocations = await this.api.getAllocationsByTokenIdAndStatus(tokenId, status);
      this.updateItems(allocations, a => a.id);
      return allocations;
    }, 'Failed to fetch allocations by token ID and status');
  }

  /**
   * Fetch allocation by ID from API
   * @param id - Allocation ID
   * @returns Allocation data
   */
  async fetchById(id: string): Promise<Allocation> {
    return this.executeAction(async () => {
      const allocation = await this.api.getAllocationById(id);
      this.set(allocation.id, allocation);
      return allocation;
    }, 'Failed to fetch allocation by ID');
  }

  /**
   * Create allocations (commitment)
   * @param params - Creation parameters
   * @returns Created allocations
   */
  async create(params: {
    checkbookId: string;
    amounts: string[];
    tokenKey: string; // Use tokenKey instead of tokenId
    signature: string;
    message: string;
    commitments?: string[];
  }): Promise<Allocation[]> {
    return this.executeAction(async () => {
      const response = await this.api.createAllocations(params);

      // Update allocations in store
      this.updateItems(response.allocations, a => a.id);

      this.logger.info(`Created ${response.allocations.length} allocations`);
      return response.allocations;
    }, 'Failed to create allocations');
  }

  /**
   * Update allocation in store (typically called from WebSocket)
   * @param allocation - Updated allocation data
   */
  updateAllocation(allocation: Allocation): void {
    this.set(allocation.id, allocation);
    this.logger.debug(`Updated allocation: ${allocation.id}`);
  }

  /**
   * Update multiple allocations in store
   * @param allocations - Array of allocations
   */
  updateAllocations(allocations: Allocation[]): void {
    this.updateItems(allocations, a => a.id);
    this.logger.debug(`Updated ${allocations.length} allocations`);
  }

  /**
   * Remove allocation from store
   * @param id - Allocation ID
   */
  removeAllocation(id: string): void {
    this.delete(id);
    this.logger.debug(`Removed allocation: ${id}`);
  }

  /**
   * Calculate total amount across all allocations
   * @param status - Optional status filter
   * @returns Total amount as string
   */
  getTotalAmount(status?: AllocationStatus): string {
    const allocations = status ? this.filter(a => a.status === status) : this.all;

    return allocations
      .reduce((sum, allocation) => {
        return sum + BigInt(allocation.amount);
      }, 0n)
      .toString();
  }

  /**
   * Get total amount by token
   * @param status - Optional status filter
   */
  getTotalByToken(status?: AllocationStatus): Map<string, string> {
    const allocations = status ? this.filter(a => a.status === status) : this.all;
    const totals = new Map<string, bigint>();

    allocations.forEach(allocation => {
      const tokenId = allocation.token.id;
      const current = totals.get(tokenId) || 0n;
      totals.set(tokenId, current + BigInt(allocation.amount));
    });

    // Convert to string map
    const result = new Map<string, string>();
    totals.forEach((value, key) => {
      result.set(key, value.toString());
    });

    return result;
  }

  /**
   * Get allocations grouped by checkbook
   */
  @computed get byCheckbook(): Map<string, Allocation[]> {
    const grouped = new Map<string, Allocation[]>();

    this.all.forEach(allocation => {
      const checkbookId = allocation.checkbookId;
      if (!grouped.has(checkbookId)) {
        grouped.set(checkbookId, []);
      }
      grouped.get(checkbookId)!.push(allocation);
    });

    return grouped;
  }

  /**
   * Get allocations grouped by token
   */
  @computed get byToken(): Map<string, Allocation[]> {
    const grouped = new Map<string, Allocation[]>();

    this.all.forEach(allocation => {
      const tokenId = allocation.token.id;
      if (!grouped.has(tokenId)) {
        grouped.set(tokenId, []);
      }
      grouped.get(tokenId)!.push(allocation);
    });

    return grouped;
  }
}
