/**
 * Withdrawals store for reactive withdrawal request state management
 * @module stores/WithdrawalsStore
 */

import { computed } from 'mobx';
import { BaseStore } from './BaseStore';
import type { WithdrawRequest, WithdrawRequestStatus } from '../types/models';
import type { WithdrawalsAPI } from '../api/WithdrawalsAPI';
import type { ILogger } from '../types/config';

/**
 * Withdrawals store configuration
 */
export interface WithdrawalsStoreConfig {
  /** Withdrawals API client */
  api: WithdrawalsAPI;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Reactive store for withdrawal requests
 */
export class WithdrawalsStore extends BaseStore<WithdrawRequest> {
  private readonly api: WithdrawalsAPI;

  constructor(config: WithdrawalsStoreConfig) {
    super({ name: 'WithdrawalsStore', logger: config.logger });
    this.api = config.api;
  }

  /**
   * Get withdrawal requests by status
   */
  @computed get byStatus(): Map<WithdrawRequestStatus, WithdrawRequest[]> {
    const grouped = new Map<WithdrawRequestStatus, WithdrawRequest[]>();
    
    this.all.forEach((withdrawal) => {
      const status = withdrawal.status;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(withdrawal);
    });

    return grouped;
  }

  /**
   * Get pending withdrawal requests
   */
  @computed get pending(): WithdrawRequest[] {
    return this.filter((w) => w.status === 'pending');
  }

  /**
   * Get completed withdrawal requests
   */
  @computed get completed(): WithdrawRequest[] {
    return this.filter((w) => w.status === 'completed');
  }

  /**
   * Get failed withdrawal requests
   */
  @computed get failed(): WithdrawRequest[] {
    return this.filter((w) => w.status === 'failed');
  }

  /**
   * Get withdrawal requests by token ID
   */
  getByTokenId(tokenId: string): WithdrawRequest[] {
    return this.filter((w) => w.token.id === tokenId);
  }

  /**
   * Get withdrawal requests by owner
   * @param owner - Owner address
   * @returns Array of withdrawal requests
   */
  getByOwner(owner: string): WithdrawRequest[] {
    return this.filter((w) => 
      w.owner.address.toLowerCase() === owner.toLowerCase()
    );
  }

  /**
   * Get withdrawal requests by target chain
   * @param targetChain - Target chain ID
   * @returns Array of withdrawal requests
   */
  getByTargetChain(targetChain: number): WithdrawRequest[] {
    return this.filter((w) => w.targetChain === targetChain);
  }

  /**
   * Get withdrawal request by nullifier
   * @param nullifier - Nullifier hash
   * @returns Withdrawal request or undefined
   */
  getByNullifier(nullifier: string): WithdrawRequest | undefined {
    return this.find((w) => w.nullifier === nullifier);
  }

  /**
   * Fetch withdrawal requests list from API
   * @param filters - Optional filters
   * @returns Array of withdrawal requests
   */
  async fetchList(filters?: {
    owner?: string;
    status?: string;
    tokenId?: string;
    targetChain?: number;
    page?: number;
    limit?: number;
  }): Promise<WithdrawRequest[]> {
    return this.executeAction(async () => {
      const response = await this.api.listWithdrawRequests(filters);
      this.updateItems(response.data, (w) => w.id);
      return response.data;
    }, 'Failed to fetch withdrawal requests list');
  }

  /**
   * Fetch single withdrawal request by ID from API
   * @param id - Withdrawal request ID
   * @returns Withdrawal request detail
   */
  async fetchById(id: string): Promise<WithdrawRequest> {
    return this.executeAction(async () => {
      const withdrawal = await this.api.getWithdrawRequestById({ id });
      this.set(withdrawal.id, withdrawal);
      return withdrawal;
    }, 'Failed to fetch withdrawal request by ID');
  }

  /**
   * Fetch withdrawal request by nullifier from API
   * @param nullifier - Nullifier hash
   * @returns Withdrawal request detail
   */
  async fetchByNullifier(nullifier: string): Promise<WithdrawRequest> {
    return this.executeAction(async () => {
      const withdrawal = await this.api.getWithdrawRequestByNullifier({ nullifier });
      this.set(withdrawal.id, withdrawal);
      return withdrawal;
    }, 'Failed to fetch withdrawal request by nullifier');
  }

  /**
   * Create withdrawal request
   * @param params - Creation parameters
   * @returns Created withdrawal request
   */
  async create(params: {
    allocationIds: string[];
    targetChain: number;
    targetAddress: string;
    intent: string;
    signature: string;
    message: string;
    nullifier: string;
    proof?: string;
    metadata?: Record<string, any>;
  }): Promise<WithdrawRequest> {
    return this.executeAction(async () => {
      const withdrawal = await this.api.createWithdrawRequest(params);
      this.set(withdrawal.id, withdrawal);
      this.logger.info(`Created withdrawal request: ${withdrawal.id}`);
      return withdrawal;
    }, 'Failed to create withdrawal request');
  }

  /**
   * Retry failed withdrawal request
   * @param id - Withdrawal request ID
   * @returns Updated withdrawal request
   */
  async retry(id: string): Promise<WithdrawRequest> {
    return this.executeAction(async () => {
      const withdrawal = await this.api.retryWithdrawRequest({ id });
      this.set(withdrawal.id, withdrawal);
      this.logger.info(`Retrying withdrawal request: ${id}`);
      return withdrawal;
    }, 'Failed to retry withdrawal request');
  }

  /**
   * Cancel pending withdrawal request
   * @param id - Withdrawal request ID
   * @returns Cancelled withdrawal request
   */
  async cancel(id: string): Promise<WithdrawRequest> {
    return this.executeAction(async () => {
      const withdrawal = await this.api.cancelWithdrawRequest({ id });
      this.set(withdrawal.id, withdrawal);
      this.logger.info(`Cancelled withdrawal request: ${id}`);
      return withdrawal;
    }, 'Failed to cancel withdrawal request');
  }

  /**
   * Fetch withdrawal statistics
   * @param owner - Optional owner filter
   * @param tokenId - Optional token ID filter
   * @returns Withdrawal statistics
   */
  async fetchStats(owner?: string, tokenId?: string) {
    return this.executeAction(async () => {
      return await this.api.getWithdrawStats({ owner, tokenId });
    }, 'Failed to fetch withdrawal statistics');
  }

  /**
   * Update withdrawal request in store (typically called from WebSocket)
   * @param withdrawal - Updated withdrawal request data
   */
  updateWithdrawal(withdrawal: WithdrawRequest): void {
    this.set(withdrawal.id, withdrawal);
    this.logger.debug(`Updated withdrawal request: ${withdrawal.id}`);
  }

  /**
   * Update multiple withdrawal requests in store
   * @param withdrawals - Array of withdrawal requests
   */
  updateWithdrawals(withdrawals: WithdrawRequest[]): void {
    this.updateItems(withdrawals, (w) => w.id);
    this.logger.debug(`Updated ${withdrawals.length} withdrawal requests`);
  }

  /**
   * Remove withdrawal request from store
   * @param id - Withdrawal request ID
   */
  removeWithdrawal(id: string): void {
    this.delete(id);
    this.logger.debug(`Removed withdrawal request: ${id}`);
  }

  /**
   * Calculate total withdrawn amount across all requests
   * @param status - Optional status filter
   * @returns Total amount as string
   */
  getTotalAmount(status?: WithdrawRequestStatus): string {
    const withdrawals = status ? this.filter((w) => w.status === status) : this.all;
    
    return withdrawals
      .reduce((sum, withdrawal) => {
        return sum + BigInt(withdrawal.amount);
      }, 0n)
      .toString();
  }

  /**
   * Get total amount by token
   * @param status - Optional status filter
   */
  getTotalByToken(status?: WithdrawRequestStatus): Map<string, string> {
    const withdrawals = status ? this.filter((w) => w.status === status) : this.all;
    const totals = new Map<string, bigint>();

    withdrawals.forEach((withdrawal) => {
      const tokenId = withdrawal.token.id;
      const current = totals.get(tokenId) || 0n;
      totals.set(tokenId, current + BigInt(withdrawal.amount));
    });

    // Convert to string map
    const result = new Map<string, string>();
    totals.forEach((value, key) => {
      result.set(key, value.toString());
    });

    return result;
  }

  /**
   * Get withdrawal requests grouped by target chain
   */
  @computed get byTargetChain(): Map<number, WithdrawRequest[]> {
    const grouped = new Map<number, WithdrawRequest[]>();
    
    this.all.forEach((withdrawal) => {
      const chainId = withdrawal.targetChain;
      if (!grouped.has(chainId)) {
        grouped.set(chainId, []);
      }
      grouped.get(chainId)!.push(withdrawal);
    });

    return grouped;
  }

  /**
   * Get withdrawal requests grouped by token
   */
  @computed get byToken(): Map<string, WithdrawRequest[]> {
    const grouped = new Map<string, WithdrawRequest[]>();
    
    this.all.forEach((withdrawal) => {
      const tokenId = withdrawal.token.id;
      if (!grouped.has(tokenId)) {
        grouped.set(tokenId, []);
      }
      grouped.get(tokenId)!.push(withdrawal);
    });

    return grouped;
  }

  /**
   * Get count by status
   */
  @computed get countByStatus(): Map<WithdrawRequestStatus, number> {
    const counts = new Map<WithdrawRequestStatus, number>();
    
    this.all.forEach((withdrawal) => {
      const status = withdrawal.status;
      counts.set(status, (counts.get(status) || 0) + 1);
    });

    return counts;
  }
}

