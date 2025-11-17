/**
 * Statistics API client
 * @module api/StatisticsAPI
 */

import type { APIClient } from './APIClient';
import type { StatisticsOverviewResponse } from '../types/api';

/**
 * Statistics API endpoints
 */
export class StatisticsAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Get global statistics overview
   * @returns Statistics overview including total locked value, total volume, private tx count, and active users
   */
  async getOverview(): Promise<StatisticsOverviewResponse> {
    const response = await this.client.get<{ success: boolean; data: StatisticsOverviewResponse }>(
      '/api/statistics/overview'
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch statistics overview');
    }

    return response.data;
  }
}

