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
  WithdrawRequest,
  UniversalAddress,
  CommitmentResponse,
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
import { BeneficiaryAPI } from '../api/BeneficiaryAPI';
import { TokenRoutingAPI } from '../api/TokenRoutingAPI';
import { StatisticsAPI } from '../api/StatisticsAPI';
import { KYTOracleAPI } from '../api/KYTOracleAPI';

// Stores
import { CheckbooksStore } from '../stores/CheckbooksStore';
import { AllocationsStore } from '../stores/AllocationsStore';
import { WithdrawalsStore } from '../stores/WithdrawalsStore';
import { PricesStore } from '../stores/PricesStore';
import { PoolsStore } from '../stores/PoolsStore';
import { ChainConfigStore } from '../stores/ChainConfigStore';
import { StatisticsStore } from '../stores/StatisticsStore';

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
import { ConfigError, AuthError, NetworkError, APIError } from '../utils/errors';
import { validateRequired, validateUrl } from '../utils/validation';
import { createUniversalAddress, extractAddress } from '../utils/address';
import { getSlip44FromChainId } from '../utils/chain';

/**
 * Main Enclave SDK client
 * Provides unified interface for all Enclave operations
 */
export class EnclaveClient {
  // Configuration
  private readonly config: Required<
    Omit<EnclaveConfig, 'address' | 'authToken' | 'headers' | 'storageAdapter' | 'wsAdapter'>
  >;
  private readonly originalConfig: EnclaveConfig; // Save original config for accessing address
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
  private readonly beneficiaryAPI: BeneficiaryAPI;
  private readonly tokenRoutingAPI: TokenRoutingAPI;
  private readonly statisticsAPI: StatisticsAPI;
  private readonly kytOracleAPI: KYTOracleAPI;

  // Stores
  public readonly stores: {
    checkbooks: CheckbooksStore;
    allocations: AllocationsStore;
    withdrawals: WithdrawalsStore;
    prices: PricesStore;
    pools: PoolsStore;
    chainConfig: ChainConfigStore;
    statistics: StatisticsStore;
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

    // Save original config for logging (address is excluded from this.config)
    this.originalConfig = config;

    // Set default config
    this.config = {
      apiUrl: config.apiUrl,
      wsUrl: config.wsUrl,
      signer: config.signer,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      timeout: config.timeout ?? 300000, // 5 minutes (300 seconds) default timeout
      logLevel: config.logLevel || ('info' as any),
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
      enableRetry: false, // Disable retry as requested
      maxRetries: 3,
      // Set up automatic re-authentication on 401 errors
      onAuthError: async () => {
        this.logger.info('Re-authenticating after 401 error...');
        // Reset authenticated flag to force re-authentication
        this.authenticated = false;
        await this.authenticate();
      },
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
    this.beneficiaryAPI = new BeneficiaryAPI(this.apiClient);
    this.tokenRoutingAPI = new TokenRoutingAPI(this.apiClient);
    this.statisticsAPI = new StatisticsAPI(this.apiClient);
    this.kytOracleAPI = new KYTOracleAPI(this.apiClient);

    // Initialize wallet manager
    // If config.chainId is provided but config.address is not, create UniversalAddress from signer
    let finalAddress = config.address;
    let walletChainId = config.address?.chainId;
    
    if (config.chainId !== undefined && !config.address) {
      // Convert to SLIP-44 if needed (e.g., EVM chain ID 56 -> SLIP-44 714)
      const slip44ChainId = getSlip44FromChainId(config.chainId) ?? config.chainId;
      
      // Get address from signer (will be derived during connect, but we need chainId now)
      // For now, we'll let WalletManager derive it, but set the chainId
      walletChainId = slip44ChainId;
      
      this.logger.info(`🔧 [EnclaveClient] chainId provided (${config.chainId}), will create UniversalAddress during connect`, {
        providedChainId: config.chainId,
        slip44ChainId,
      });
    } else if (config.address) {
      walletChainId = config.address.chainId;
    }
    
    this.logger.info(`🔧 [EnclaveClient] Initializing WalletManager`, {
      hasAddress: !!config.address,
      hasChainId: config.chainId !== undefined,
      addressChainId: config.address?.chainId,
      addressChainName: config.address?.chainName,
      addressSlip44: config.address?.slip44,
      walletChainId,
    });
    this.walletManager = new WalletManager({
      signer: config.signer,
      address: finalAddress,
      chainId: walletChainId ?? config.chainId, // Use chainId from address if available, otherwise use config.chainId
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
      chainConfig: new ChainConfigStore({
        api: this.chainConfigAPI,
        logger: this.logger,
      }),
      statistics: new StatisticsStore({
        api: this.statisticsAPI,
        logger: this.logger,
        autoRefreshInterval: 60000, // 1 minute
      }),
    };

    // Initialize actions
    this.commitmentAction = new CommitmentAction({
      api: this.allocationsAPI,
      store: this.stores.allocations,
      checkbooksStore: this.stores.checkbooks,
      wallet: this.walletManager,
      logger: this.logger,
    });

    this.withdrawalAction = new WithdrawalAction({
      checkbooksStore: this.stores.checkbooks,
      api: this.withdrawalsAPI,
      store: this.stores.withdrawals,
      allocationsStore: this.stores.allocations,
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
      this.logger.info('[EnclaveClient] 🔍 从 walletManager 获取地址...');
      this.userAddress = await this.walletManager.getAddress();
      const { extractAddress } = await import('../utils/address');
      const displayAddress = extractAddress(this.userAddress);
      // 使用 originalConfig 访问 address，因为它在 Required 中被排除了
      const configAddress = this.originalConfig.address;
      
      // If chainId was provided but address was not, ensure the address has the correct chainId
      if (this.originalConfig.chainId !== undefined && !configAddress) {
        const slip44ChainId = getSlip44FromChainId(this.originalConfig.chainId) ?? this.originalConfig.chainId;
        // Update the address with the correct chainId
        this.userAddress = {
          ...this.userAddress,
          chainId: slip44ChainId,
        };
        this.logger.info(`[EnclaveClient] ✅ 使用 chainId ${this.originalConfig.chainId} (SLIP-44: ${slip44ChainId}) 更新地址`);
      }
      
      this.logger.info('[EnclaveClient] 📋 地址验证前:', {
        walletManagerAddress: displayAddress,
        hasConfigAddress: !!configAddress,
        configAddress: configAddress ? extractAddress(configAddress) : null,
      });
      
      // 验证地址是否一致：如果传入了 config.address，确保 WalletManager 返回的地址与之匹配
      if (configAddress) {
        const configDisplayAddress = extractAddress(configAddress);
        this.logger.info('[EnclaveClient] 🔍 比较地址:', {
          walletManagerAddress: displayAddress,
          configAddress: configDisplayAddress,
          match: displayAddress.toLowerCase() === configDisplayAddress.toLowerCase(),
        });
        
        if (displayAddress.toLowerCase() !== configDisplayAddress.toLowerCase()) {
          this.logger.warn(`[EnclaveClient] ⚠️ WalletManager 返回的地址与配置地址不一致，清除缓存并重新设置:`, {
            walletManagerAddress: displayAddress,
            configAddress: configDisplayAddress,
          });
          // 清除 WalletManager 的地址缓存
          this.walletManager.clearAddress();
          // 强制设置正确的地址
          this.walletManager.setAddress(configAddress);
          // 重新获取地址
          this.userAddress = await this.walletManager.getAddress();
          const correctedDisplayAddress = extractAddress(this.userAddress);
          this.logger.info(`[EnclaveClient] ✅ 地址已更正:`, {
            correctedAddress: correctedDisplayAddress,
            originalAddress: displayAddress,
          });
        } else {
          this.logger.info('[EnclaveClient] ✅ 地址匹配，无需修复');
        }
      } else {
        this.logger.warn('[EnclaveClient] ⚠️ 没有传入 config.address，无法验证地址一致性');
      }
      
      this.logger.info(`[EnclaveClient] 用户地址:`, {
        displayAddress: extractAddress(this.userAddress),
        universalAddress: {
          chainId: this.userAddress.chainId,
          data: this.userAddress.data,
        },
        configAddress: configAddress ? {
          chainId: configAddress.chainId,
          data: configAddress.data,
          extractedAddress: extractAddress(configAddress),
        } : null,
      });

      // Authenticate if not already authenticated
      if (!this.authenticated) {
        await this.authenticate();
      }

      // Set auth token for WebSocket (if authenticated)
      if (this.authenticated && this.apiClient.getAuthToken()) {
        this.wsClient.setAuthToken(this.apiClient.getAuthToken()!);
      }

      // Connect WebSocket (optional - continue if it fails)
      try {
        await this.wsClient.connect();
        // Subscribe to channels
        await this.subscribeToChannels();
        this.logger.info('WebSocket connected and subscribed');
      } catch (wsError) {
        this.logger.warn(
          'WebSocket connection failed, continuing without real-time updates:',
          wsError
        );
        // Continue without WebSocket - API calls will still work
      }

      // Load initial data
      // Verify token is still available before loading data
      const tokenBeforeLoad = this.apiClient.getAuthToken();
      this.logger.debug(
        `Token before loadInitialData: ${tokenBeforeLoad ? tokenBeforeLoad.substring(0, 20) + '...' : 'MISSING'}`
      );
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
      // Step 1: Get nonce from backend
      let address: string;
      try {
        address = await this.walletManager.getAddressString();
        this.logger.debug(`Got address for nonce request: ${address}`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to get wallet address: ${err.message}`);
        throw new AuthError(
          `Failed to get wallet address: ${err.message}. Please ensure your wallet is connected.`,
          { step: 'get_address', originalError: err.message }
        );
      }

      let nonceResponse: { nonce: string; timestamp: string; message?: string };
      try {
        nonceResponse = await this.authAPI.getNonce(address);
        this.logger.debug(`Got nonce from backend: ${nonceResponse.nonce.substring(0, 10)}...`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to get nonce from backend: ${err.message}`);

        // Preserve original error type and details
        if (err instanceof NetworkError) {
          throw new NetworkError(
            `Failed to connect to authentication server: ${err.message}. Please check your network connection and API URL.`,
            err.statusCode,
            { step: 'get_nonce', endpoint: '/api/auth/nonce', originalError: err.message }
          );
        } else if (err instanceof APIError) {
          throw new APIError(
            `Authentication server error: ${err.message}`,
            err.statusCode,
            err.code,
            err.endpoint,
            { step: 'get_nonce', originalError: err.message }
          );
        } else {
          throw new AuthError(
            `Failed to get authentication nonce: ${err.message}. Please check your API connection.`,
            { step: 'get_nonce', originalError: err.message }
          );
        }
      }

      const { nonce } = nonceResponse;

      // Use message from backend if available, otherwise create one
      // Backend returns message in format: "Enclave Authentication\nNonce: {nonce}\nTimestamp: {timestamp}"
      let message: string;
      if (nonceResponse.message) {
        message = nonceResponse.message;
      } else {
        // Fallback: create message if backend doesn't provide it
        message = `Sign this message to authenticate with Enclave.\nNonce: ${nonce}`;
      }

      this.logger.debug(`Auth message to sign: ${message}`);

      // Step 2: Sign message (this will trigger MetaMask popup)
      let signature: string;
      try {
        signature = await this.walletManager.signAuthMessage(message);
        this.logger.debug(`Signature generated: ${signature.substring(0, 20)}...`);
      } catch (error) {
        const err = error as Error;
        const errorMessage = err.message.toLowerCase();

        // Check if user rejected the signature request
        const isUserRejection =
          errorMessage.includes('rejected') ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('4001') || // MetaMask rejection code
          errorMessage.includes('user cancelled') ||
          errorMessage.includes('user canceled');

        if (isUserRejection) {
          this.logger.warn('User rejected signature request');
          throw new AuthError(
            'Authentication cancelled: You rejected the signature request. Please approve the signature in MetaMask to continue.',
            { step: 'sign_message', userRejected: true, originalError: err.message }
          );
        }

        this.logger.error(`Failed to sign auth message: ${err.message}`);
        throw new AuthError(
          `Failed to sign authentication message: ${err.message}. Please ensure your wallet is unlocked and try again.`,
          { step: 'sign_message', originalError: err.message }
        );
      }

      // Get SLIP-44 chain ID from user address (used for authentication)
      // Prefer userAddress.chainId over defaultChainId to ensure correct chain is used
      const chainId = this.userAddress?.chainId ?? this.walletManager.getDefaultChainId();
      this.logger.info(`🔐 [Authenticate] Using SLIP-44 chain ID: ${chainId}`, {
        userAddressChainId: this.userAddress?.chainId,
        defaultChainId: this.walletManager.getDefaultChainId(),
        userAddress: this.userAddress
          ? {
              chainId: this.userAddress.chainId,
              chainName: this.userAddress.chainName,
              data: this.userAddress.data,
              slip44: this.userAddress.slip44,
            }
          : null,
      });

      // Step 3: Authenticate with backend
      let authResponse: { token: string; user_address: any };
      try {
        const { extractAddress } = await import('../utils/address');
        const displayAddress = this.userAddress ? extractAddress(this.userAddress) : 'N/A';
        this.logger.debug(`Calling authenticate API with address: ${displayAddress}`);
        authResponse = await this.authAPI.authenticate({
          address: this.userAddress!,
          signature,
          message,
          chainId,
        });
        this.logger.debug(`Authenticate API response received`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Authentication API call failed: ${err.message}`);

        // Preserve original error type
        if (err instanceof NetworkError) {
          throw new NetworkError(
            `Failed to connect to authentication server: ${err.message}`,
            err.statusCode,
            { step: 'authenticate', endpoint: '/api/auth/login', originalError: err.message }
          );
        } else if (err instanceof APIError) {
          throw new APIError(
            `Authentication failed: ${err.message}`,
            err.statusCode,
            err.code,
            err.endpoint,
            { step: 'authenticate', originalError: err.message }
          );
        } else {
          throw new AuthError(`Authentication failed: ${err.message}`, {
            step: 'authenticate',
            originalError: err.message,
          });
        }
      }

      // Verify token is set in API client BEFORE marking as authenticated
      const tokenInClient = this.apiClient.getAuthToken();
      if (!tokenInClient) {
        throw new AuthError('Token was not set in API client after authentication', {
          step: 'verify_token',
        });
      }

      this.logger.info(
        `Authentication successful. Token in API client: ${tokenInClient.substring(0, 20)}...`
      );
      this.authenticated = true;
      this.wsClient.setAuthToken(authResponse.token);
    } catch (error) {
      // If error is already an EnclaveError, re-throw it with details
      if (
        error instanceof AuthError ||
        error instanceof NetworkError ||
        error instanceof APIError
      ) {
        throw error;
      }

      // Otherwise, wrap it as AuthError with context
      const err = error as Error;
      this.logger.error(`Authentication failed: ${err.message}`, err);
      throw new AuthError(`Authentication failed: ${err.message}`, {
        originalError: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * Subscribe to WebSocket channels
   */
  private async subscribeToChannels(): Promise<void> {
    // Get owner address for WebSocket subscription (server will filter by JWT)
    const owner = await this.walletManager.getAddressString();
    this.logger.info(`📡 [EnclaveClient] Subscribing to WebSocket channels for owner: ${owner}`);

    // Subscribe to user-specific channels
    // Note: owner parameter is used for WebSocket filtering, but API calls use JWT
    await this.wsClient.subscribe(WSChannel.CHECKBOOKS, { owner });
    this.logger.info('✅ [EnclaveClient] Subscribed to CHECKBOOKS channel');

    await this.wsClient.subscribe(WSChannel.ALLOCATIONS, { owner });
    this.logger.info('✅ [EnclaveClient] Subscribed to ALLOCATIONS channel');

    await this.wsClient.subscribe(WSChannel.WITHDRAWALS, { owner });
    this.logger.info('✅ [EnclaveClient] Subscribed to WITHDRAWALS channel');

    await this.wsClient.subscribe(WSChannel.PRICES);
    this.logger.info('✅ [EnclaveClient] Subscribed to PRICES channel');

    this.logger.info('✅ [EnclaveClient] All WebSocket channels subscribed successfully');
  }

  /**
   * Load initial data
   */
  private async loadInitialData(): Promise<void> {
    // Load user data (address is automatically determined from JWT token)
    // Continue even if some endpoints fail with 404
    const loadPromises = [
      this.stores.checkbooks.fetchList({ limit: 100 }).catch(err => {
        this.logger.warn('Failed to load checkbooks:', err);
      }),
      this.stores.allocations.fetchList({ limit: 100 }).catch(err => {
        this.logger.warn('Failed to load allocations:', err);
      }),
      this.stores.withdrawals.fetchList({ limit: 100 }).catch(err => {
        this.logger.warn('Failed to load withdrawals:', err);
      }),
      this.stores.prices.fetchPrices().catch(err => {
        this.logger.warn('Failed to load prices (endpoint may not exist):', err);
      }),
      this.stores.pools.fetchPools().catch(err => {
        this.logger.warn('Failed to load pools:', err);
      }),
      this.stores.pools.fetchTokens().catch(err => {
        this.logger.warn('Failed to load tokens (endpoint may not exist):', err);
      }),
      this.stores.chainConfig.fetchChains().catch(err => {
        this.logger.warn('Failed to load chain configurations:', err);
      }),
    ];

    await Promise.all(loadPromises);

    // Start price auto-refresh (only if prices store is available)
    try {
      this.stores.prices.startAutoRefresh();
    } catch (err) {
      this.logger.warn('Failed to start price auto-refresh:', err);
    }

    this.logger.info('Initial data loaded');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle WebSocket messages
    this.wsClient.on('message', message => {
      this.handleWebSocketMessage(message);
    });

    // Handle connection state changes
    this.wsClient.on('connected', () => {
      this.logger.info('✅ [EnclaveClient] WebSocket connected successfully');
    });

    this.wsClient.on('disconnected', () => {
      this.logger.warn('❌ [EnclaveClient] WebSocket disconnected');
    });

    this.wsClient.on('error', error => {
      this.logger.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(message: any): void {
    this.logger.debug('📨 [EnclaveClient] Received WebSocket message:', message);
    const { type, data } = message;

    switch (type) {
      case WSMessageType.CHECKBOOK_UPDATE:
        this.logger.info('📨 [EnclaveClient] Processing checkbook_update message');
        this.handleCheckbookUpdate(data);
        break;

      case WSMessageType.ALLOCATION_UPDATE:
        this.logger.info('📨 [EnclaveClient] Processing allocation_update message');
        this.handleAllocationUpdate(data);
        break;

      case WSMessageType.WITHDRAWAL_UPDATE:
        this.logger.info('📨 [EnclaveClient] Processing withdrawal_update message');
        this.handleWithdrawalUpdate(data);
        break;

      case WSMessageType.PRICE_UPDATE:
        this.logger.info('📨 [EnclaveClient] Processing price_update message');
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
    this.logger.debug('📨 [EnclaveClient] handleCheckbookUpdate called with data:', data);
    const { action, checkbook } = data;

    if (!checkbook) {
      this.logger.warn('📨 [EnclaveClient] checkbook_update message missing checkbook data');
      return;
    }

    switch (action) {
      case 'created':
      case 'updated':
        this.logger.info(
          `📨 [EnclaveClient] Updating checkbook: ${checkbook.id}, action: ${action}`
        );
        this.stores.checkbooks.updateCheckbook(checkbook);
        break;
      case 'deleted':
        this.logger.info(`📨 [EnclaveClient] Removing checkbook: ${checkbook.id}`);
        this.stores.checkbooks.removeCheckbook(checkbook.id);
        break;
      default:
        this.logger.warn(`📨 [EnclaveClient] Unknown checkbook action: ${action}`);
    }
  }

  /**
   * Handle allocation update from WebSocket
   */
  private handleAllocationUpdate(data: any): void {
    this.logger.debug('📨 [EnclaveClient] handleAllocationUpdate called with data:', data);
    const { action, allocation } = data;

    if (!allocation) {
      this.logger.warn('📨 [EnclaveClient] allocation_update message missing allocation data');
      return;
    }

    switch (action) {
      case 'created':
      case 'updated':
        this.logger.info(
          `📨 [EnclaveClient] Updating allocation: ${allocation.id}, action: ${action}`
        );
        // Convert backend Check model to frontend Allocation format
        // WebSocket messages contain backend format (snake_case), need to normalize
        const normalized = this.allocationsAPI.convertAllocation(allocation);
        this.stores.allocations.updateAllocation(normalized);
        break;
      case 'deleted':
        this.logger.info(`📨 [EnclaveClient] Removing allocation: ${allocation.id}`);
        this.stores.allocations.removeAllocation(allocation.id);
        break;
      default:
        this.logger.warn(`📨 [EnclaveClient] Unknown allocation action: ${action}`);
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
        // Convert backend Check model to frontend WithdrawRequest format
        // WebSocket messages contain backend format (snake_case), need to normalize
        const normalized = this.withdrawalsAPI.normalizeWithdrawRequest(withdrawal);
        this.stores.withdrawals.updateWithdrawal(normalized);
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
   * @param lang - Language code (default: LANG_EN)
   * @returns Commitment response with checkbook, checks, and token info
   */
  async createCommitment(
    params: CommitmentParams,
    lang: number = 1 // LANG_EN
  ): Promise<CommitmentResponse> {
    return this.commitmentAction.createCommitment(params, lang);
  }

  /**
   * Prepare commitment for signing
   * @param params - Commitment parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Sign data
   */
  async prepareCommitment(
    params: CommitmentParams,
    lang: number = 1 // LANG_EN
  ) {
    return this.commitmentAction.prepareCommitment(params, lang);
  }

  /**
   * Submit signed commitment
   * @param params - Commitment parameters
   * @param signature - Signature
   * @returns Commitment response with checkbook, checks, and token info
   */
  async submitCommitment(params: CommitmentParams, signature: string): Promise<CommitmentResponse> {
    return this.commitmentAction.submitCommitment(params, signature);
  }

  /**
   * Create withdrawal (full flow)
   * @param params - Withdrawal parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Created withdrawal request
   */
  async withdraw(
    params: WithdrawalParams,
    lang: number = 1 // LANG_EN
  ): Promise<WithdrawRequest> {
    return this.withdrawalAction.withdraw(params, lang);
  }

  /**
   * Prepare withdrawal for signing
   * @param params - Withdrawal parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Sign data
   */
  async prepareWithdraw(
    params: WithdrawalParams,
    lang: number = 1 // LANG_EN
  ) {
    return this.withdrawalAction.prepareWithdraw(params, lang);
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

  /**
   * Get Beneficiary API for managing withdraw requests where the user is the beneficiary
   * Use this to view and manage withdraw requests where you are the recipient
   * @example
   * ```typescript
   * const requests = await client.beneficiary.listBeneficiaryWithdrawRequests();
   * await client.beneficiary.requestPayoutExecution({ id: 'request-id' });
   * ```
   */
  get beneficiary(): BeneficiaryAPI {
    return this.beneficiaryAPI;
  }

  /**
   * Get Token Routing API for querying token routing rules and allowed targets
   * Use this to query which chains and tokens are available for cross-chain operations
   * @example
   * ```typescript
   * // Get all pools and tokens
   * const allPools = await client.tokenRouting.getAllPoolsAndTokens();
   *
   * // Get allowed targets for specific source
   * const targets = await client.tokenRouting.getTargetsForSource(714, '0x...');
   * ```
   */
  get tokenRouting(): TokenRoutingAPI {
    return this.tokenRoutingAPI;
  }

  /**
   * Get KYT Oracle API for fee and risk assessment queries
   * Use this to query invitation codes, fee information, and associate addresses with invitation codes
   * @example
   * ```typescript
   * // Get invitation code for an address
   * const codeInfo = await client.kytOracle.getInvitationCodeByAddress({
   *   address: '0x...',
   *   chain: 'bsc'
   * });
   *
   * // Get fee information with rate limiting
   * const feeInfo = await client.kytOracle.getFeeInfoByAddress({
   *   address: '0x...',
   *   chain: 'bsc',
   *   tokenKey: 'USDT'
   * });
   *
   * // Associate address with invitation code
   * await client.kytOracle.associateAddressWithCode({
   *   address: '0x...',
   *   code: 'INVATE3',
   *   chain: 'bsc'
   * });
   * ```
   */
  get kytOracle(): KYTOracleAPI {
    return this.kytOracleAPI;
  }
}
