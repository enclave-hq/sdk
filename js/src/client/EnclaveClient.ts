/**
 * Main Enclave SDK client
 * @module client/EnclaveClient
 */

import { makeObservable, observable, action, computed } from 'mobx';
import type {
  EnclaveConfig,
  ConnectionInfo,
  ConnectionState as ConfigConnectionState,
} from '../types/config';
import { ConnectionState } from '../types/config';
import type {
  CommitmentParams,
  WithdrawalParams,
  Allocation,
  WithdrawRequest,
  UniversalAddress,
} from '../types/models';

// API Clients
import { APIClient } from '../api/APIClient';
import { AuthAPI } from '../api/AuthAPI';
import { CheckbooksAPI } from '../api/CheckbooksAPI';
import { AllocationsAPI } from '../api/AllocationsAPI';
import { WithdrawalsAPI } from '../api/WithdrawalsAPI';
import { PoolsAPI } from '../api/PoolsAPI';
import { PricesAPI } from '../api/PricesAPI';
import { MetricsAPI } from '../api/MetricsAPI';
import { QuoteAPI } from '../api/QuoteAPI';
import { ChainConfigAPI } from '../api/ChainConfigAPI';

// Stores
import { CheckbooksStore } from '../stores/CheckbooksStore';
import { AllocationsStore } from '../stores/AllocationsStore';
import { WithdrawalsStore } from '../stores/WithdrawalsStore';
import { PricesStore } from '../stores/PricesStore';
import { PoolsStore } from '../stores/PoolsStore';

// WebSocket
import { WebSocketClient } from '../websocket/WebSocketClient';
import { WSChannel, WSMessageType } from '../types/websocket';

// Blockchain
import { WalletManager } from '../blockchain/WalletManager';

// Actions
import { CommitmentAction } from '../actions/CommitmentAction';
import { WithdrawalAction } from '../actions/WithdrawalAction';

// Utils
import { createLogger } from '../utils/logger';
import type { ILogger } from '../types/config';
import { ConfigError, AuthError } from '../utils/errors';
import { validateRequired, validateUrl } from '../utils/validation';

/**
 * Main Enclave SDK client
 * Provides unified interface for all Enclave operations
 */
export class EnclaveClient {
  // Configuration
  private readonly config: Required<Omit<EnclaveConfig, 'address' | 'authToken' | 'headers' | 'storageAdapter' | 'wsAdapter'>>;
  private readonly logger: ILogger;

  // Core components
  private readonly apiClient: APIClient;
  private readonly wsClient: WebSocketClient;
  private readonly walletManager: WalletManager;

  // API clients
  private readonly authAPI: AuthAPI;
  private readonly checkbooksAPI: CheckbooksAPI;
  private readonly allocationsAPI: AllocationsAPI;
  private readonly withdrawalsAPI: WithdrawalsAPI;
  private readonly poolsAPI: PoolsAPI;
  private readonly pricesAPI: PricesAPI;
  private readonly metricsAPI: MetricsAPI;
  private readonly quoteAPI: QuoteAPI;
  private readonly chainConfigAPI: ChainConfigAPI;

  // Stores
  public readonly stores: {
    checkbooks: CheckbooksStore;
    allocations: AllocationsStore;
    withdrawals: WithdrawalsStore;
    prices: PricesStore;
    pools: PoolsStore;
  };

  // Actions
  private readonly commitmentAction: CommitmentAction;
  private readonly withdrawalAction: WithdrawalAction;

  // State
  @observable private connectionState: ConfigConnectionState = ConnectionState.DISCONNECTED;
  @observable private authenticated: boolean = false;
  @observable private userAddress: UniversalAddress | null = null;

  constructor(config: EnclaveConfig) {
    // Validate config
    this.validateConfig(config);

    // Initialize logger
    this.logger = config.logger || createLogger(config.logLevel);

    // Set default config
    this.config = {
      apiUrl: config.apiUrl,
      wsUrl: config.wsUrl,
      signer: config.signer,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      timeout: config.timeout ?? 30000,
      logLevel: config.logLevel || 'info' as any,
      logger: this.logger,
      cacheAuth: config.cacheAuth ?? true,
      env: config.env || 'production',
    };

    this.logger.info('Initializing Enclave SDK', {
      apiUrl: this.config.apiUrl,
      wsUrl: this.config.wsUrl,
      env: this.config.env,
    });

    // Initialize API client
    this.apiClient = new APIClient({
      baseUrl: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: config.headers,
      logger: this.logger,
      enableRetry: true,
      maxRetries: 3,
    });

    // Set auth token if provided
    if (config.authToken) {
      this.apiClient.setAuthToken(config.authToken);
      this.authenticated = true;
    }

    // Initialize API clients
    this.authAPI = new AuthAPI(this.apiClient);
    this.checkbooksAPI = new CheckbooksAPI(this.apiClient);
    this.allocationsAPI = new AllocationsAPI(this.apiClient);
    this.withdrawalsAPI = new WithdrawalsAPI(this.apiClient);
    this.poolsAPI = new PoolsAPI(this.apiClient);
    this.pricesAPI = new PricesAPI(this.apiClient);
    this.metricsAPI = new MetricsAPI(this.apiClient);
    this.quoteAPI = new QuoteAPI(this.apiClient);
    this.chainConfigAPI = new ChainConfigAPI(this.apiClient);

    // Initialize wallet manager
    this.walletManager = new WalletManager({
      signer: config.signer,
      address: config.address,
      logger: this.logger,
    });

    // Initialize stores
    this.stores = {
      checkbooks: new CheckbooksStore({
        api: this.checkbooksAPI,
        logger: this.logger,
      }),
      allocations: new AllocationsStore({
        api: this.allocationsAPI,
        logger: this.logger,
      }),
      withdrawals: new WithdrawalsStore({
        api: this.withdrawalsAPI,
        logger: this.logger,
      }),
      prices: new PricesStore({
        api: this.pricesAPI,
        logger: this.logger,
        autoRefreshInterval: 60000, // 1 minute
      }),
      pools: new PoolsStore({
        api: this.poolsAPI,
        logger: this.logger,
      }),
    };

    // Initialize actions
    this.commitmentAction = new CommitmentAction({
      api: this.allocationsAPI,
      store: this.stores.allocations,
      wallet: this.walletManager,
      logger: this.logger,
    });

    this.withdrawalAction = new WithdrawalAction({
      api: this.withdrawalsAPI,
      store: this.stores.withdrawals,
      wallet: this.walletManager,
      logger: this.logger,
    });

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient({
      url: this.config.wsUrl,
      authToken: config.authToken,
      autoReconnect: this.config.autoReconnect,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      reconnectDelay: this.config.reconnectDelay,
      logger: this.logger,
      adapter: config.wsAdapter,
    });

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();

    // Make observable
    makeObservable(this);

    this.logger.info('Enclave SDK initialized successfully');
  }

  /**
   * Connect to Enclave services
   */
  async connect(): Promise<void> {
    this.logger.info('Connecting to Enclave...');
    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      // Get user address
      this.userAddress = await this.walletManager.getAddress();
      this.logger.info(`User address: ${this.userAddress.address}`);

      // Authenticate if not already authenticated
      if (!this.authenticated) {
        await this.authenticate();
      }

      // Connect WebSocket
      await this.wsClient.connect();

      // Subscribe to channels
      await this.subscribeToChannels();

      // Load initial data
      await this.loadInitialData();

      // Mark as connected
      this.setConnectionState(ConnectionState.CONNECTED);
      this.logger.info('Connected to Enclave successfully');
    } catch (error) {
      this.logger.error('Connection failed:', error);
      this.setConnectionState(ConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * Disconnect from Enclave services
   */
  disconnect(): void {
    this.logger.info('Disconnecting from Enclave...');

    // Disconnect WebSocket
    this.wsClient.disconnect();

    // Stop auto-refresh
    this.stores.prices.stopAutoRefresh();

    // Clear authentication
    this.apiClient.clearAuthToken();
    this.authenticated = false;

    // Update state
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.logger.info('Disconnected from Enclave');
  }

  /**
   * Authenticate with backend
   */
  private async authenticate(): Promise<void> {
    this.logger.info('Authenticating...');

    try {
      // Get nonce from backend
      const address = await this.walletManager.getAddressString();
      const { nonce } = await this.authAPI.getNonce(address);
      
      // Create auth message
      const message = `Sign this message to authenticate with Enclave.\nNonce: ${nonce}`;

      // Sign message
      const signature = await this.walletManager.signAuthMessage(message);

      // Get chain ID from wallet
      const chainId = this.walletManager.getDefaultChainId();

      // Authenticate
      const authResponse = await this.authAPI.authenticate({
        address: this.userAddress!,
        signature,
        message,
        chainId,
      });

      this.authenticated = true;
      this.wsClient.setAuthToken(authResponse.token);

      this.logger.info('Authentication successful');
    } catch (error) {
      throw new AuthError(`Authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Subscribe to WebSocket channels
   */
  private async subscribeToChannels(): Promise<void> {
    const owner = await this.walletManager.getAddressString();

    // Subscribe to user-specific channels
    await this.wsClient.subscribe(WSChannel.CHECKBOOKS, { owner });
    await this.wsClient.subscribe(WSChannel.ALLOCATIONS, { owner });
    await this.wsClient.subscribe(WSChannel.WITHDRAWALS, { owner });
    await this.wsClient.subscribe(WSChannel.PRICES);

    this.logger.info('Subscribed to WebSocket channels');
  }

  /**
   * Load initial data
   */
  private async loadInitialData(): Promise<void> {
    const owner = await this.walletManager.getAddressString();

    // Load user data
    await Promise.all([
      this.stores.checkbooks.fetchByOwner(owner),
      this.stores.allocations.fetchList({ owner, limit: 100 }),
      this.stores.withdrawals.fetchList({ owner, limit: 100 }),
      this.stores.prices.fetchPrices(),
      this.stores.pools.fetchPools(),
      this.stores.pools.fetchTokens(),
    ]);

    // Start price auto-refresh
    this.stores.prices.startAutoRefresh();

    this.logger.info('Initial data loaded');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle WebSocket messages
    this.wsClient.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });

    // Handle connection state changes
    this.wsClient.on('connected', () => {
      this.logger.info('WebSocket connected');
    });

    this.wsClient.on('disconnected', () => {
      this.logger.warn('WebSocket disconnected');
    });

    this.wsClient.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(message: any): void {
    const { type, data } = message;

    switch (type) {
      case WSMessageType.CHECKBOOK_UPDATE:
        this.handleCheckbookUpdate(data);
        break;

      case WSMessageType.ALLOCATION_UPDATE:
        this.handleAllocationUpdate(data);
        break;

      case WSMessageType.WITHDRAWAL_UPDATE:
        this.handleWithdrawalUpdate(data);
        break;

      case WSMessageType.PRICE_UPDATE:
        this.handlePriceUpdate(data);
        break;

      default:
        this.logger.debug(`Unhandled WebSocket message type: ${type}`);
    }
  }

  /**
   * Handle checkbook update from WebSocket
   */
  private handleCheckbookUpdate(data: any): void {
    const { action, checkbook } = data;

    switch (action) {
      case 'created':
      case 'updated':
        this.stores.checkbooks.updateCheckbook(checkbook);
        break;
      case 'deleted':
        this.stores.checkbooks.removeCheckbook(checkbook.id);
        break;
    }
  }

  /**
   * Handle allocation update from WebSocket
   */
  private handleAllocationUpdate(data: any): void {
    const { action, allocation } = data;

    switch (action) {
      case 'created':
      case 'updated':
        this.stores.allocations.updateAllocation(allocation);
        break;
      case 'deleted':
        this.stores.allocations.removeAllocation(allocation.id);
        break;
    }
  }

  /**
   * Handle withdrawal update from WebSocket
   */
  private handleWithdrawalUpdate(data: any): void {
    const { action, withdrawal } = data;

    switch (action) {
      case 'created':
      case 'updated':
        this.stores.withdrawals.updateWithdrawal(withdrawal);
        break;
      case 'deleted':
        this.stores.withdrawals.removeWithdrawal(withdrawal.id);
        break;
    }
  }

  /**
   * Handle price update from WebSocket
   */
  private handlePriceUpdate(data: any): void {
    const { prices } = data;
    this.stores.prices.updatePrices(prices);
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: EnclaveConfig): void {
    validateRequired(config, 'config');
    validateUrl(config.apiUrl, 'apiUrl');
    validateUrl(config.wsUrl, 'wsUrl');
    validateRequired(config.signer, 'signer');

    if (!config.apiUrl || !config.wsUrl || !config.signer) {
      throw new ConfigError('Missing required configuration: apiUrl, wsUrl, or signer');
    }
  }

  /**
   * Set connection state
   */
  @action
  private setConnectionState(state: ConfigConnectionState): void {
    this.connectionState = state;
  }

  // ============ Public API Methods ============

  /**
   * Get connection info
   */
  @computed get connection(): ConnectionInfo {
    return {
      state: this.connectionState,
      authenticated: this.authenticated,
      lastConnected: this.wsClient.isConnected() ? Date.now() : undefined,
    };
  }

  /**
   * Check if connected
   */
  @computed get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get user address
   */
  @computed get address(): UniversalAddress | null {
    return this.userAddress;
  }

  /**
   * Create commitment (full flow)
   * @param params - Commitment parameters
   * @returns Created allocations
   */
  async createCommitment(params: CommitmentParams): Promise<Allocation[]> {
    return this.commitmentAction.createCommitment(params);
  }

  /**
   * Prepare commitment for signing
   * @param params - Commitment parameters
   * @returns Sign data
   */
  prepareCommitment(params: CommitmentParams) {
    return this.commitmentAction.prepareCommitment(params);
  }

  /**
   * Submit signed commitment
   * @param params - Commitment parameters
   * @param signature - Signature
   * @returns Created allocations
   */
  async submitCommitment(params: CommitmentParams, signature: string): Promise<Allocation[]> {
    return this.commitmentAction.submitCommitment(params, signature);
  }

  /**
   * Create withdrawal (full flow)
   * @param params - Withdrawal parameters
   * @returns Created withdrawal request
   */
  async withdraw(params: WithdrawalParams): Promise<WithdrawRequest> {
    return this.withdrawalAction.withdraw(params);
  }

  /**
   * Prepare withdrawal for signing
   * @param params - Withdrawal parameters
   * @returns Sign data
   */
  prepareWithdraw(params: WithdrawalParams) {
    return this.withdrawalAction.prepareWithdraw(params);
  }

  /**
   * Submit signed withdrawal
   * @param params - Withdrawal parameters
   * @param signature - Signature
   * @returns Created withdrawal request
   */
  async submitWithdraw(params: WithdrawalParams, signature: string): Promise<WithdrawRequest> {
    return this.withdrawalAction.submitWithdraw(params, signature);
  }

  /**
   * Retry failed withdrawal
   * @param withdrawalId - Withdrawal request ID
   */
  async retryWithdraw(withdrawalId: string): Promise<WithdrawRequest> {
    return this.withdrawalAction.retryWithdraw(withdrawalId);
  }

  /**
   * Cancel pending withdrawal
   * @param withdrawalId - Withdrawal request ID
   */
  async cancelWithdraw(withdrawalId: string): Promise<WithdrawRequest> {
    return this.withdrawalAction.cancelWithdraw(withdrawalId);
  }

  /**
   * Get Quote API for route and asset queries
   */
  get quote(): QuoteAPI {
    return this.quoteAPI;
  }

  /**
   * Get Metrics API for metrics queries
   */
  get metrics(): MetricsAPI {
    return this.metricsAPI;
  }

  /**
   * Get Chain Config API for querying chain configurations and contract addresses
   * Use this to get Treasury addresses, RPC endpoints, and other chain-specific configuration
   * @example
   * ```typescript
   * const treasuryAddress = await client.chainConfig.getTreasuryAddress(195); // TRON
   * const config = await client.chainConfig.getChainConfig(714); // BSC
   * ```
   */
  get chainConfig(): ChainConfigAPI {
    return this.chainConfigAPI;
  }
}

