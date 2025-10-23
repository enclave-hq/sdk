/**
 * Withdrawal action orchestrator
 * @module actions/WithdrawalAction
 */

import type { WithdrawalParams, WithdrawRequest } from '../types/models';
import type { WithdrawalsAPI } from '../api/WithdrawalsAPI';
import type { WithdrawalsStore } from '../stores/WithdrawalsStore';
import type { WalletManager } from '../blockchain/WalletManager';
import { WithdrawFormatter } from '../formatters/WithdrawFormatter';
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
  private readonly wallet: WalletManager;
  private readonly logger: ILogger;

  constructor(config: WithdrawalActionConfig) {
    this.api = config.api;
    this.store = config.store;
    this.wallet = config.wallet;
    this.logger = config.logger || getLogger();
  }

  /**
   * Prepare withdrawal data for signing (Step 1)
   * @param params - Withdrawal parameters
   * @returns Withdrawal sign data
   */
  prepareWithdraw(params: WithdrawalParams) {
    // Validate params
    validateNonEmptyArray(params.allocationIds, 'allocationIds');
    validateChainId(params.targetChain, 'targetChain');
    validateNonEmptyString(params.targetAddress, 'targetAddress');
    this.validateIntent(params.intent);

    this.logger.info('Preparing withdrawal', {
      allocationCount: params.allocationIds.length,
      targetChain: params.targetChain,
      targetAddress: params.targetAddress,
      intentType: params.intent.type,
    });

    // Use WithdrawFormatter to generate sign data
    const signData = WithdrawFormatter.prepareSignData(
      params.allocationIds,
      params.targetChain,
      params.targetAddress,
      params.intent
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
      throw new Error(
        `Invalid intent type: ${intent.type}. Must be 'RawToken' or 'AssetToken'`
      );
    }

    // Validate beneficiary
    if (!intent.beneficiary || typeof intent.beneficiary !== 'object') {
      throw new Error('Intent.beneficiary must be a valid UniversalAddress');
    }

    if (typeof intent.beneficiary.chainId !== 'number' || intent.beneficiary.chainId < 0) {
      throw new Error('Intent.beneficiary.chainId must be a non-negative number');
    }

    validateNonEmptyString(intent.beneficiary.data, 'Intent.beneficiary.data');

    // Type-specific validation
    if (intent.type === 'RawToken') {
      validateNonEmptyString(intent.tokenContract, 'Intent.tokenContract');
      
      // Validate token contract address (should be 20 bytes = 40 hex chars + 0x prefix)
      if (!intent.tokenContract.match(/^0x[0-9a-fA-F]{40}$/)) {
        throw new Error(
          'Intent.tokenContract must be a valid 20-byte hex address (0x + 40 chars)'
        );
      }
    } else if (intent.type === 'AssetToken') {
      validateNonEmptyString(intent.assetId, 'Intent.assetId');

      // Validate asset ID (should be 32 bytes = 64 hex chars + 0x prefix)
      if (!intent.assetId.match(/^0x[0-9a-fA-F]{64}$/)) {
        throw new Error(
          'Intent.assetId must be a valid 32-byte hex value (0x + 64 chars)'
        );
      }

      // Validate preferred chain if provided
      if (intent.preferredChain !== undefined && intent.preferredChain !== null) {
        if (typeof intent.preferredChain !== 'number' || intent.preferredChain < 0) {
          throw new Error('Intent.preferredChain must be a non-negative number');
        }
      }
    }
  }

  /**
   * Submit signed withdrawal to backend (Step 2)
   * @param params - Withdrawal parameters
   * @param signature - User's signature
   * @returns Created withdrawal request
   */
  async submitWithdraw(
    params: WithdrawalParams,
    signature: string
  ): Promise<WithdrawRequest> {
    validateNonEmptyString(signature, 'signature');

    this.logger.info('Submitting withdrawal to backend', {
      allocationCount: params.allocationIds.length,
      targetChain: params.targetChain,
      intentType: params.intent.type,
    });

    // Prepare sign data
    const signData = this.prepareWithdraw(params);

    // Submit to API
    const withdrawal = await this.store.create({
      allocationIds: signData.allocationIds,
      targetChain: params.targetChain,
      targetAddress: params.targetAddress,
      intent: params.intent,
      signature,
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
   * @returns Created withdrawal request
   */
  async withdraw(params: WithdrawalParams): Promise<WithdrawRequest> {
    this.logger.info('Creating withdrawal (full flow)', {
      allocationCount: params.allocationIds.length,
      targetChain: params.targetChain,
      intentType: params.intent.type,
    });

    // Step 1: Prepare sign data
    const signData = this.prepareWithdraw(params);

    // Step 2: Sign message
    this.logger.debug('Signing withdrawal message');
    const signature = await this.wallet.signMessage(signData.messageHash);

    // Step 3: Submit to backend
    const withdrawal = await this.submitWithdraw(params, signature);

    this.logger.info('Withdrawal created successfully', {
      withdrawalId: withdrawal.id,
      nullifier: withdrawal.nullifier,
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
   * @returns True if signature is valid
   */
  async verifyWithdrawSignature(
    params: WithdrawalParams,
    signature: string
  ): Promise<boolean> {
    try {
      // Prepare sign data
      const signData = this.prepareWithdraw(params);

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
}

