/**
 * Prices store for reactive token price state management
 * @module stores/PricesStore
 */

import { computed } from 'mobx';
import { BaseStore } from './BaseStore';
import type { TokenPrice } from '../types/models';
import type { PricesAPI } from '../api/PricesAPI';
import type { ILogger } from '../types/config';

/**
 * Prices store configuration
 */
export interface PricesStoreConfig {
  /** Prices API client */
  api: PricesAPI;
  /** Logger instance */
  logger?: ILogger;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
}

/**
 * Reactive store for token prices
 */
export class PricesStore extends BaseStore<TokenPrice> {
  private readonly api: PricesAPI;
  private autoRefreshInterval: number;
  private refreshIntervalId?: any;

  constructor(config: PricesStoreConfig) {
    super({ name: 'PricesStore', logger: config.logger });
    this.api = config.api;
    this.autoRefreshInterval = config.autoRefreshInterval || 0;
  }

  /**
   * Get price by token symbol
   * @param symbol - Token symbol
   * @returns Token price or undefined
   */
  getBySymbol(symbol: string): TokenPrice | undefined {
    return this.find((p) => p.symbol.toLowerCase() === symbol.toLowerCase());
  }

  /**
   * Get prices for multiple symbols
   * @param symbols - Array of token symbols
   * @returns Array of token prices
   */
  getBySymbols(symbols: string[]): TokenPrice[] {
    const symbolsLower = symbols.map((s) => s.toLowerCase());
    return this.filter((p) => symbolsLower.includes(p.symbol.toLowerCase()));
  }

  /**
   * Get all symbols
   */
  @computed get symbols(): string[] {
    return this.all.map((p) => p.symbol);
  }

  /**
   * Get prices as map (symbol -> price)
   */
  @computed get priceMap(): Map<string, number> {
    const map = new Map<string, number>();
    this.all.forEach((price) => {
      map.set(price.symbol.toLowerCase(), price.price);
    });
    return map;
  }

  /**
   * Fetch all token prices from API
   * @param symbols - Optional array of symbols to fetch
   * @returns Array of token prices
   */
  async fetchPrices(symbols?: string[]): Promise<TokenPrice[]> {
    return this.executeAction(async () => {
      const prices = await this.api.getTokenPrices({ symbols });
      this.updateItems(prices, (p) => p.symbol);
      return prices;
    }, 'Failed to fetch token prices');
  }

  /**
   * Fetch single token price from API
   * @param symbol - Token symbol
   * @returns Token price or undefined
   */
  async fetchPrice(symbol: string): Promise<TokenPrice | undefined> {
    return this.executeAction(async () => {
      const price = await this.api.getTokenPrice(symbol);
      if (price) {
        this.set(price.symbol, price);
      }
      return price;
    }, 'Failed to fetch token price');
  }

  /**
   * Update price in store (typically called from WebSocket)
   * @param price - Updated token price
   */
  updatePrice(price: TokenPrice): void {
    this.set(price.symbol, price);
    this.logger.debug(`Updated price for ${price.symbol}: $${price.price}`);
  }

  /**
   * Update multiple prices in store
   * @param prices - Array of token prices
   */
  updatePrices(prices: TokenPrice[]): void {
    this.updateItems(prices, (p) => p.symbol);
    this.logger.debug(`Updated ${prices.length} prices`);
  }

  /**
   * Start auto-refresh
   * @param interval - Refresh interval in milliseconds (optional, uses config value if not provided)
   */
  startAutoRefresh(interval?: number): void {
    this.stopAutoRefresh();

    const refreshInterval = interval || this.autoRefreshInterval;
    if (refreshInterval <= 0) {
      this.logger.warn('Auto-refresh interval not set, skipping auto-refresh');
      return;
    }

    this.logger.info(`Starting auto-refresh with interval: ${refreshInterval}ms`);
    
    this.refreshIntervalId = setInterval(async () => {
      try {
        await this.fetchPrices();
      } catch (error) {
        this.logger.error('Auto-refresh failed:', error);
      }
    }, refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = undefined;
      this.logger.info('Stopped auto-refresh');
    }
  }

  /**
   * Get price in USD for symbol
   * @param symbol - Token symbol
   * @returns Price in USD or null if not found
   */
  getPriceUSD(symbol: string): number | null {
    const price = this.getBySymbol(symbol);
    return price ? price.price : null;
  }

  /**
   * Convert amount to USD
   * @param symbol - Token symbol
   * @param amount - Amount in token units
   * @param decimals - Token decimals
   * @returns Amount in USD or null if price not found
   */
  toUSD(symbol: string, amount: string, decimals: number): number | null {
    const price = this.getPriceUSD(symbol);
    if (!price) return null;

    const amountBig = BigInt(amount);
    const decimalsBig = BigInt(10 ** decimals);
    const amountFloat = Number(amountBig) / Number(decimalsBig);

    return amountFloat * price;
  }

  /**
   * Get 24h price change percentage
   * @param symbol - Token symbol
   * @returns Price change percentage or null
   */
  getChange24h(symbol: string): number | null {
    const price = this.getBySymbol(symbol);
    return price?.change24h ?? null;
  }

  /**
   * Get prices with positive 24h change
   */
  @computed get gainers(): TokenPrice[] {
    return this.filter((p) => (p.change24h ?? 0) > 0).sort(
      (a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)
    );
  }

  /**
   * Get prices with negative 24h change
   */
  @computed get losers(): TokenPrice[] {
    return this.filter((p) => (p.change24h ?? 0) < 0).sort(
      (a, b) => (a.change24h ?? 0) - (b.change24h ?? 0)
    );
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopAutoRefresh();
  }
}

