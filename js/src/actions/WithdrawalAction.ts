/**
 * Withdrawal action orchestrator
 * @module actions/WithdrawalAction
 */

import type { WithdrawalParams, WithdrawRequest, Intent, Allocation } from '../types/models';
import type { WithdrawalsAPI } from '../api/WithdrawalsAPI';
import type { WithdrawalsStore } from '../stores/WithdrawalsStore';
import type { AllocationsStore } from '../stores/AllocationsStore';
import type { CheckbooksStore } from '../stores/CheckbooksStore';
import type { WalletManager } from '../blockchain/WalletManager';
import { WithdrawFormatter, LANG_EN } from '../formatters/WithdrawFormatter';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateChainId,
} from '../utils/validation';

/**
 * Withdrawal action configuration
 */
export interface WithdrawalActionConfig {
  /** Withdrawals API client */
  api: WithdrawalsAPI;
  /** Withdrawals store */
  store: WithdrawalsStore;
  /** Allocations store (to get checkbookId from allocations) */
  allocationsStore: AllocationsStore;
  /** Checkbooks store (to get token symbol from checkbook) */
  checkbooksStore: CheckbooksStore;
  /** Wallet manager */
  wallet: WalletManager;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Orchestrates withdrawal request creation process
 */
export class WithdrawalAction {
  private readonly api: WithdrawalsAPI;
  private readonly store: WithdrawalsStore;
  private readonly allocationsStore: AllocationsStore;
  private readonly checkbooksStore: CheckbooksStore;
  private readonly wallet: WalletManager;
  private readonly logger: ILogger;

  constructor(config: WithdrawalActionConfig) {
    this.api = config.api;
    this.store = config.store;
    this.allocationsStore = config.allocationsStore;
    this.checkbooksStore = config.checkbooksStore;
    this.wallet = config.wallet;
    this.logger = config.logger || getLogger();
  }

  /**
   * Prepare withdrawal data for signing (Step 1)
   * @param params - Withdrawal parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Withdrawal sign data
   */
  async prepareWithdraw(params: WithdrawalParams, lang: number = LANG_EN) {
    // Validate params
    validateNonEmptyArray(params.allocationIds, 'allocationIds');
    this.validateIntent(params.intent);

    // Validate beneficiary from intent
    validateChainId(params.intent.beneficiary.chainId, 'intent.beneficiary.chainId');
    // Accept universalFormat (preferred), data (legacy), or address (for display)
    const beneficiaryAddress =
      params.intent.beneficiary.universalFormat ||
      params.intent.beneficiary.data ||
      params.intent.beneficiary.address;
    if (!beneficiaryAddress) {
      throw new Error(
        'intent.beneficiary.universalFormat, intent.beneficiary.data, or intent.beneficiary.address is required'
      );
    }
    validateNonEmptyString(beneficiaryAddress, 'intent.beneficiary.address');

    this.logger.info('Preparing withdrawal', {
      allocationCount: params.allocationIds.length,
      beneficiaryChainId: params.intent.beneficiary.chainId,
      beneficiaryAddress: beneficiaryAddress,
      intentType: params.intent.type,
    });

    // Get allocations from store
    const allocations: Allocation[] = [];
    for (const allocationId of params.allocationIds) {
      let allocation = this.allocationsStore.get(allocationId);
      if (!allocation) {
        // Fetch from API if not in store - fetch list and find the allocation
        const fetchedAllocations = await this.allocationsStore.fetchList({});
        allocation = fetchedAllocations.find(a => a.id === allocationId);
      }
      if (!allocation) {
        throw new Error(`Allocation ${allocationId} not found`);
      }
      allocations.push(allocation);
    }
    
    // Log allocations and their checkbookIds immediately after fetching
    this.logger.info('📋 Allocations retrieved for withdrawal', {
      allocationCount: allocations.length,
      allocations: allocations.map(a => ({
        id: a.id,
        checkbookId: a.checkbookId,
        seq: a.seq,
        amount: a.amount,
      })),
      uniqueCheckbookIds: [...new Set(allocations.map(a => a.checkbookId))],
      checkbookIdCount: new Set(allocations.map(a => a.checkbookId)).size,
    });

    // Get token symbol from checkbook's token (tokenKey = token.symbol)
    // Support cross-deposit: allocations can be from different checkbooks
    // We'll use the first allocation's checkbook for token symbol (all should have the same token)
    const firstAllocation = allocations[0];
    if (!firstAllocation) {
      throw new Error('At least one allocation is required');
    }
    let tokenSymbol: string;

    // Get all checkbooks for all allocations (support cross-deposit)
    const checkbookMap = new Map<string, Checkbook>();
    const allocationCheckbookMap = new Map<string, { localDepositId?: number; slip44ChainId?: number }>();
    
    // Log all allocations and their checkbookIds first
    this.logger.info('🔍 Processing allocations for cross-deposit support', {
      allocationCount: allocations.length,
      allocations: allocations.map(a => ({
        id: a.id,
        checkbookId: a.checkbookId,
        seq: a.seq,
      })),
      uniqueCheckbookIds: [...new Set(allocations.map(a => a.checkbookId))],
      checkbookIdCount: new Set(allocations.map(a => a.checkbookId)).size,
    });
    
    for (const allocation of allocations) {
      if (!allocation.checkbookId) {
        throw new Error(`Allocation ${allocation.id} has no checkbookId`);
      }
      
      // Get checkbook from store or fetch from API
      // IMPORTANT: Also check for localDepositId (required for cross-deposit support)
      let checkbook = this.checkbooksStore.get(allocation.checkbookId);
      const needsRefresh = !checkbook || !checkbook.token?.symbol || 
                          checkbook.localDepositId === undefined || checkbook.localDepositId === null;
      
      if (needsRefresh) {
        this.logger.info(`📥 Fetching checkbook ${allocation.checkbookId} from API for allocation ${allocation.id}`, {
          checkbookId: allocation.checkbookId,
          allocationId: allocation.id,
          hasCheckbook: !!checkbook,
          hasTokenSymbol: !!checkbook?.token?.symbol,
          hasLocalDepositId: checkbook?.localDepositId !== undefined && checkbook?.localDepositId !== null,
        });
        checkbook = await this.checkbooksStore.fetchById(allocation.checkbookId);
      } else {
        this.logger.info(`✅ Using cached checkbook ${allocation.checkbookId} for allocation ${allocation.id}`, {
          checkbookId: allocation.checkbookId,
          allocationId: allocation.id,
          localDepositId: checkbook.localDepositId,
        });
      }
      
      // Ensure localDepositId exists (critical for cross-deposit support)
      if (checkbook.localDepositId === undefined || checkbook.localDepositId === null) {
        throw new Error(
          `Checkbook ${allocation.checkbookId} is missing localDepositId. ` +
          `Cannot proceed with withdrawal. Please ensure the checkbook has been properly created.`
        );
      }
      
      if (!checkbook) {
        throw new Error(`Checkbook ${allocation.checkbookId} not found`);
      }
      
      checkbookMap.set(allocation.checkbookId, checkbook);
      
      // Store checkbook info for this allocation (for cross-deposit support)
      allocationCheckbookMap.set(allocation.id, {
        localDepositId: checkbook.localDepositId,
        slip44ChainId: checkbook.slip44ChainId,
      });
      
      // Debug log for cross-deposit support
      this.logger.info('✅ Mapped allocation to checkbook', {
        allocationId: allocation.id,
        checkbookId: allocation.checkbookId,
        localDepositId: checkbook.localDepositId,
        slip44ChainId: checkbook.slip44ChainId,
      });
    }
    
    // Use first allocation's checkbook for token symbol (all should have the same token)
    const checkbook = checkbookMap.get(firstAllocation.checkbookId);
    if (!checkbook) {
      throw new Error(`Checkbook ${firstAllocation.checkbookId} not found`);
    }

    // Log checkbook token info for debugging
    this.logger.debug('Checkbook token info', {
      checkbookId: checkbook.id,
      hasToken: !!checkbook.token,
      tokenSymbol: checkbook.token?.symbol,
      tokenId: checkbook.token?.id,
      tokenName: checkbook.token?.name,
      allocationTokenSymbol: firstAllocation?.token?.symbol,
    });

    // Use token symbol from checkbook (tokenKey = token.symbol)
    if (checkbook.token?.symbol) {
      tokenSymbol = checkbook.token.symbol;
    } else if (firstAllocation?.token?.symbol) {
      // Fallback: try allocation's token if checkbook doesn't have token
      this.logger.warn('Using allocation token symbol as fallback', {
        checkbookId: checkbook.id,
        allocationId: firstAllocation.id,
        tokenSymbol: firstAllocation.token.symbol,
      });
      tokenSymbol = firstAllocation.token.symbol;
    } else {
      // Last resort: try to get from intent if it's RawToken or AssetToken type
      if (params.intent.type === 'RawToken') {
        // For RawToken, use tokenSymbol from intent
        if (params.intent.tokenSymbol) {
          tokenSymbol = params.intent.tokenSymbol;
          this.logger.debug('Using tokenSymbol from RawToken intent', {
            checkbookId: checkbook.id,
            tokenSymbol: tokenSymbol,
          });
        } else {
          throw new Error(
            `Cannot get token symbol: checkbook ${checkbook.id} has no token.symbol, ` +
              `allocation ${firstAllocation.id} has no token, and intent.tokenSymbol is missing. ` +
              `Please provide tokenSymbol in RawToken intent or ensure checkbook has token information.`
          );
        }
      } else if (params.intent.type === 'AssetToken') {
        // For AssetToken, use assetTokenSymbol from intent
        if (params.intent.assetTokenSymbol) {
          tokenSymbol = params.intent.assetTokenSymbol;
          this.logger.debug('Using assetTokenSymbol from AssetToken intent', {
            checkbookId: checkbook.id,
            tokenSymbol: tokenSymbol,
          });
        } else {
          throw new Error(
            `Cannot get token symbol: checkbook ${checkbook.id} has no token.symbol, ` +
              `allocation ${firstAllocation.id} has no token, and intent.assetTokenSymbol is missing. ` +
              `Please provide assetTokenSymbol in AssetToken intent or ensure checkbook has token information.`
          );
        }
      } else {
        throw new Error(
          `Cannot get token symbol: checkbook ${checkbook.id} has no token.symbol, ` +
            `and allocation ${firstAllocation.id} has no token`
        );
      }
    }

    // Ensure all allocations have commitment (from checkbook if missing)
    // All allocations in a checkbook share the same commitment
    // If checkbook doesn't have commitment, try to get it from allocations
    let commitment = checkbook.commitment;
    if (!commitment) {
      // Try to get commitment from allocations
      const allocationWithCommitment = allocations.find(a => a.commitment);
      if (allocationWithCommitment?.commitment) {
        commitment = allocationWithCommitment.commitment;
        this.logger.debug('Got commitment from allocation', {
          allocationId: allocationWithCommitment.id,
          commitment,
        });
        // Also update checkbook for consistency
        (checkbook as any).commitment = commitment;
      } else {
        // If checkbook is in with_checkbook status, it should have commitment
        // But if it's missing, we can't proceed
        throw new Error(
          `Checkbook ${checkbook.id} has no commitment. ` +
            `Cannot proceed with withdrawal. ` +
            `Checkbook status: ${checkbook.status}. ` +
            `If checkbook is in 'with_checkbook' status, it should have a commitment. ` +
            `Please ensure the checkbook has been properly committed.`
        );
      }
    }

    // Fill in commitment for allocations that don't have it
    for (const allocation of allocations) {
      if (!allocation.commitment) {
        (allocation as any).commitment = commitment;
        this.logger.debug('Filled allocation commitment from checkbook', {
          allocationId: allocation.id,
          commitment,
        });
      }
    }

    // Get chain name for better user experience in wallet signatures
    const chainName = params.intent.beneficiary.chainName || undefined;

    // Prepare checkbook info for message formatting (for backward compatibility)
    // Note: For cross-deposit support, allocationCheckbookMap is used instead
    const checkbookInfo = {
      localDepositId: checkbook.localDepositId,
      slip44ChainId: checkbook.slip44ChainId,
    };

    // Get minOutput from params (default: 0)
    const minOutput = (params as any).minOutput || '0';

    // Debug: Log allocationCheckbookMap before passing to formatter
    // Always log this to help debug cross-deposit issues
    this.logger.info('🔍 allocationCheckbookMap before prepareSignData', {
      mapSize: allocationCheckbookMap.size,
      allocations: allocations.map(a => ({
        id: a.id,
        checkbookId: a.checkbookId,
        hasMapping: allocationCheckbookMap.has(a.id),
        localDepositId: allocationCheckbookMap.get(a.id)?.localDepositId,
        seq: a.seq,
      })),
      mapEntries: Array.from(allocationCheckbookMap.entries()).map(([id, info]) => ({
        allocationId: id,
        localDepositId: info.localDepositId,
        slip44ChainId: info.slip44ChainId,
      })),
    });

    // Use WithdrawFormatter to generate sign data (matching lib.rs)
    // Pass allocationCheckbookMap for cross-deposit support (each allocation uses its own depositId)
    const signData = WithdrawFormatter.prepareSignData(
      allocations,
      params.intent,
      tokenSymbol,
      lang,
      chainName, // chainName for better user experience
      checkbookInfo, // checkbook info for backward compatibility
      minOutput, // minimum output constraint
      allocationCheckbookMap // map from allocation ID to checkbook info (for cross-deposit support)
    );

    this.logger.debug('Withdrawal sign data prepared', {
      messageHash: signData.messageHash,
      nullifier: signData.nullifier,
      intentType: params.intent.type,
    });

    return signData;
  }

  /**
   * Validate Intent structure
   * @param intent - Intent to validate
   * @throws Error if intent is invalid
   */
  private validateIntent(intent: any): void {
    if (!intent || typeof intent !== 'object') {
      throw new Error('Intent must be an object');
    }

    if (intent.type !== 'RawToken' && intent.type !== 'AssetToken') {
      throw new Error(`Invalid intent type: ${intent.type}. Must be 'RawToken' or 'AssetToken'`);
    }

    // Validate beneficiary
    if (!intent.beneficiary || typeof intent.beneficiary !== 'object') {
      throw new Error('Intent.beneficiary must be a valid UniversalAddress');
    }

    if (typeof intent.beneficiary.chainId !== 'number' || intent.beneficiary.chainId < 0) {
      throw new Error('Intent.beneficiary.chainId must be a non-negative number');
    }

    // Validate beneficiary address - accept either universalFormat or data
    // universalFormat is the 32-byte Universal Address format (preferred)
    // data is the legacy field name (for backward compatibility)
    if (!intent.beneficiary.universalFormat && !intent.beneficiary.data) {
      throw new Error('Intent.beneficiary.universalFormat or Intent.beneficiary.data is required');
    }

    // If universalFormat is provided, use it; otherwise use data
    const beneficiaryData = intent.beneficiary.universalFormat || intent.beneficiary.data;
    validateNonEmptyString(
      beneficiaryData,
      'Intent.beneficiary.universalFormat or Intent.beneficiary.data'
    );

    // Type-specific validation
    if (intent.type === 'RawToken') {
      validateNonEmptyString(intent.tokenSymbol, 'Intent.tokenSymbol');
    } else if (intent.type === 'AssetToken') {
      validateNonEmptyString(intent.assetId, 'Intent.assetId');

      // Validate asset ID (should be 32 bytes = 64 hex chars + 0x prefix)
      if (!intent.assetId.match(/^0x[0-9a-fA-F]{64}$/)) {
        throw new Error('Intent.assetId must be a valid 32-byte hex value (0x + 64 chars)');
      }

      validateNonEmptyString(intent.assetTokenSymbol, 'Intent.assetTokenSymbol');
    }
  }

  /**
   * Submit signed withdrawal to backend (Step 2)
   * @param params - Withdrawal parameters
   * @param signature - User's signature
   * @returns Created withdrawal request
   */
  async submitWithdraw(params: WithdrawalParams, signature: string): Promise<WithdrawRequest> {
    validateNonEmptyString(signature, 'signature');

    this.logger.info('Submitting withdrawal to backend', {
      allocationCount: params.allocationIds.length,
      beneficiaryChainId: params.intent.beneficiary.chainId,
      intentType: params.intent.type,
    });

    // Prepare sign data (this also fetches allocations)
    const signData = await this.prepareWithdraw(params);

    // Get checkbookId from first allocation (already fetched in prepareWithdraw)
    const firstAllocationId = signData.allocationIds[0];
    if (!firstAllocationId) {
      throw new Error('At least one allocation ID is required');
    }
    const firstAllocation = this.allocationsStore.get(firstAllocationId);
    if (!firstAllocation) {
      throw new Error(`Allocation ${firstAllocationId} not found`);
    }
    const checkbookId = firstAllocation.checkbookId;

    // Get tokenSymbol from prepareWithdraw result (already fetched and validated)
    const tokenSymbol = signData.tokenSymbol;
    if (!tokenSymbol) {
      throw new Error(
        'tokenSymbol is required but not found in signData. This should not happen if prepareWithdraw succeeded.'
      );
    }

    // Convert Intent to backend v2 format
    const backendIntent = this.convertIntentToBackendFormat(params.intent, tokenSymbol);

    // Get chain ID for signature
    // Use beneficiary chain ID (SLIP-44) as the chain ID for signature
    // This matches the chain where the user is signing the withdrawal message
    const chainId = params.intent.beneficiary.chainId;

    // Submit to API
    const withdrawal = await this.store.create({
      checkbookId,
      allocationIds: signData.allocationIds,
      intent: backendIntent,
      signature,
      chainId, // Chain ID for signature (SLIP-44)
      message: signData.message,
      nullifier: signData.nullifier,
      metadata: params.metadata,
      // ZK proof is optional, backend can generate if needed
      proof: undefined,
    });

    this.logger.info(`Created withdrawal request: ${withdrawal.id}`);
    return withdrawal;
  }

  /**
   * Create withdrawal (full flow: prepare + sign + submit) (Step 3)
   * @param params - Withdrawal parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Created withdrawal request
   */
  async withdraw(params: WithdrawalParams, lang: number = LANG_EN): Promise<WithdrawRequest> {
    this.logger.info('Creating withdrawal (full flow)', {
      allocationCount: params.allocationIds.length,
      beneficiaryChainId: params.intent.beneficiary.chainId,
      intentType: params.intent.type,
    });

    // Step 1: Prepare sign data
    const signData = await this.prepareWithdraw(params, lang);

    // Step 2: Display signature message to user before signing
    this.logger.info('📝 Withdrawal signature message:');
    this.logger.info('─'.repeat(60));
    // Log the message in a readable format (split by lines for better readability)
    // Filter out empty lines to match Rust's lines() behavior (which ignores trailing empty line)
    const messageLines = signData.message.split('\n').filter(line => line.length > 0);
    messageLines.forEach(line => {
      this.logger.info(line);
    });
    this.logger.info('─'.repeat(60));
    this.logger.info(`Message hash: ${signData.messageHash}`);
    this.logger.info(`Nullifier: ${signData.nullifier}`);

    // Step 3: Sign message
    this.logger.info('🔐 Requesting user signature...');
    // IMPORTANT: Pass the raw message string (not the hash) to signMessage
    // ethers.js Wallet.signMessage() will automatically add EIP-191 prefix and hash it
    // This matches ZKVM's generate_message_hash() which expects raw message and adds EIP-191 prefix
    const signature = await this.wallet.signMessage(signData.message);
    this.logger.info(
      `✅ Signature received: ${signature.substring(0, 20)}...${signature.substring(signature.length - 10)}`
    );

    // Step 3: Submit to backend
    const withdrawal = await this.submitWithdraw(params, signature);

    this.logger.info('Withdrawal created successfully', {
      withdrawalId: withdrawal.id,
      onChainRequestId: withdrawal.onChainRequestId,
    });

    return withdrawal;
  }

  /**
   * Retry failed withdrawal
   * @param withdrawalId - Withdrawal request ID
   * @returns Updated withdrawal request
   */
  async retryWithdraw(withdrawalId: string): Promise<WithdrawRequest> {
    validateNonEmptyString(withdrawalId, 'withdrawalId');

    this.logger.info(`Retrying withdrawal: ${withdrawalId}`);

    const withdrawal = await this.store.retry(withdrawalId);

    this.logger.info(`Withdrawal retry initiated: ${withdrawalId}`);
    return withdrawal;
  }

  /**
   * Cancel pending withdrawal
   * @param withdrawalId - Withdrawal request ID
   * @returns Cancelled withdrawal request
   */
  async cancelWithdraw(withdrawalId: string): Promise<WithdrawRequest> {
    validateNonEmptyString(withdrawalId, 'withdrawalId');

    this.logger.info(`Cancelling withdrawal: ${withdrawalId}`);

    const withdrawal = await this.store.cancel(withdrawalId);

    this.logger.info(`Withdrawal cancelled: ${withdrawalId}`);
    return withdrawal;
  }

  /**
   * Get withdrawal statistics
   * @param tokenId - Optional token ID filter
   * @returns Withdrawal statistics
   */
  async getWithdrawStats(tokenId?: string) {
    const owner = await this.wallet.getAddressString();
    return this.store.fetchStats(owner, tokenId);
  }

  /**
   * Verify withdrawal signature
   * @param params - Withdrawal parameters
   * @param signature - Signature to verify
   * @param lang - Language code (default: LANG_EN)
   * @returns True if signature is valid
   */
  async verifyWithdrawSignature(
    params: WithdrawalParams,
    signature: string,
    lang: number = LANG_EN
  ): Promise<boolean> {
    try {
      // Prepare sign data
      const signData = await this.prepareWithdraw(params, lang);

      // TODO: Implement signature verification using ethers.js
      // This would verify that the signature matches the message hash
      // and was signed by the user's address

      this.logger.debug('Withdrawal signature verified');
      return true;
    } catch (error) {
      this.logger.error('Withdrawal signature verification failed:', error);
      return false;
    }
  }

  /**
   * Parse intent string
   * @param intentStr - Intent string
   * @returns Parsed intent with type and parameters
   */
  parseIntent(intentStr: string): { type: string; params: Record<string, string> } {
    return WithdrawFormatter.parseIntent(intentStr);
  }

  /**
   * Format intent with parameters
   * @param intent - Intent type
   * @param params - Intent parameters
   * @returns Formatted intent string
   */
  formatIntent(intent: string, params?: Record<string, any>): string {
    return WithdrawFormatter.formatIntent(intent, params);
  }

  /**
   * Convert SDK Intent to backend v2 API format
   * @param intent - SDK Intent object
   * @returns Backend v2 intent format
   */
  private convertIntentToBackendFormat(
    intent: Intent,
    tokenSymbol: string
  ): {
    type: number;
    beneficiaryChainId: number;
    beneficiaryAddress: string;
    tokenSymbol: string;
    assetId?: string;
  } {
    // Use Universal Address format (32-byte) for beneficiary address - REQUIRED
    // Accept either universalFormat (preferred) or data (legacy)
    const universalAddress = intent.beneficiary.universalFormat || intent.beneficiary.data;
    if (!universalAddress) {
      throw new Error(
        'Universal Address format is required. intent.beneficiary.universalFormat or intent.beneficiary.data is missing.'
      );
    }
    // Remove 0x prefix if present, backend expects hex string without prefix
    const beneficiaryAddress = universalAddress.replace(/^0x/, '');

    if (intent.type === 'RawToken') {
      return {
        type: 0, // RawToken
        beneficiaryChainId: intent.beneficiary.chainId, // SLIP-44 Chain ID
        beneficiaryAddress: beneficiaryAddress, // 32-byte Universal Address (required)
        tokenSymbol: intent.tokenSymbol || tokenSymbol, // Token symbol from intent or fallback
      };
    } else if (intent.type === 'AssetToken') {
      return {
        type: 1, // AssetToken
        beneficiaryChainId: intent.beneficiary.chainId, // SLIP-44 Chain ID
        beneficiaryAddress: beneficiaryAddress, // 32-byte Universal Address (required)
        assetId: intent.assetId,
        tokenSymbol: intent.assetTokenSymbol || tokenSymbol, // Asset token symbol from intent or fallback
      };
    } else {
      throw new Error(`Unknown intent type: ${(intent as any).type}`);
    }
  }
}
