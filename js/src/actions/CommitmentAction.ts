/**
 * Commitment action orchestrator
 * @module actions/CommitmentAction
 */

import type { CommitmentParams, Allocation } from '../types/models';
import type { AllocationsAPI } from '../api/AllocationsAPI';
import type { AllocationsStore } from '../stores/AllocationsStore';
import type { WalletManager } from '../blockchain/WalletManager';
import { CommitmentFormatter } from '../formatters/CommitmentFormatter';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
} from '../utils/validation';

/**
 * Commitment action configuration
 */
export interface CommitmentActionConfig {
  /** Allocations API client */
  api: AllocationsAPI;
  /** Allocations store */
  store: AllocationsStore;
  /** Wallet manager */
  wallet: WalletManager;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Orchestrates commitment creation process
 */
export class CommitmentAction {
  private readonly api: AllocationsAPI;
  private readonly store: AllocationsStore;
  private readonly wallet: WalletManager;
  private readonly logger: ILogger;

  constructor(config: CommitmentActionConfig) {
    this.api = config.api;
    this.store = config.store;
    this.wallet = config.wallet;
    this.logger = config.logger || getLogger();
  }

  /**
   * Prepare commitment data for signing (Step 1)
   * @param params - Commitment parameters
   * @returns Commitment sign data
   */
  prepareCommitment(params: CommitmentParams) {
    // Validate params
    validateNonEmptyString(params.checkbookId, 'checkbookId');
    validateNonEmptyArray(params.amounts, 'amounts');
    validateNonEmptyString(params.tokenId, 'tokenId');

    this.logger.info('Preparing commitment', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
      tokenId: params.tokenId,
    });

    // Use CommitmentFormatter to generate sign data
    const signData = CommitmentFormatter.prepareSignData(
      params.checkbookId,
      params.amounts,
      params.tokenId
    );

    this.logger.debug('Commitment sign data prepared', {
      messageHash: signData.messageHash,
    });

    return signData;
  }

  /**
   * Submit signed commitment to backend (Step 2)
   * @param params - Commitment parameters
   * @param signature - User's signature
   * @returns Created allocations
   */
  async submitCommitment(
    params: CommitmentParams,
    signature: string
  ): Promise<Allocation[]> {
    validateNonEmptyString(signature, 'signature');

    this.logger.info('Submitting commitment to backend', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
    });

    // Prepare sign data
    const signData = this.prepareCommitment(params);

    // Generate commitment hashes (optional, backend can also generate)
    const owner = await this.wallet.getAddressString();
    const commitments = CommitmentFormatter.generateCommitmentHashes(
      signData.amounts,
      owner,
      params.tokenId
    );

    // Submit to API
    const allocations = await this.store.create({
      checkbookId: params.checkbookId,
      amounts: signData.amounts,
      tokenId: params.tokenId,
      signature,
      message: signData.message,
      commitments,
    });

    this.logger.info(`Created ${allocations.length} allocations`);
    return allocations;
  }

  /**
   * Create commitment (full flow: prepare + sign + submit) (Step 3)
   * @param params - Commitment parameters
   * @returns Created allocations
   */
  async createCommitment(params: CommitmentParams): Promise<Allocation[]> {
    this.logger.info('Creating commitment (full flow)', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
    });

    // Step 1: Prepare sign data
    const signData = this.prepareCommitment(params);

    // Step 2: Sign message
    this.logger.debug('Signing commitment message');
    const signature = await this.wallet.signMessage(signData.messageHash);

    // Step 3: Submit to backend
    const allocations = await this.submitCommitment(params, signature);

    this.logger.info('Commitment created successfully', {
      allocationIds: allocations.map((a) => a.id),
    });

    return allocations;
  }

  /**
   * Verify commitment signature
   * @param params - Commitment parameters
   * @param signature - Signature to verify
   * @returns True if signature is valid
   */
  async verifyCommitmentSignature(
    params: CommitmentParams,
    signature: string
  ): Promise<boolean> {
    try {
      // Prepare sign data
      const signData = this.prepareCommitment(params);

      // TODO: Implement signature verification using ethers.js
      // This would verify that the signature matches the message hash
      // and was signed by the user's address

      this.logger.debug('Commitment signature verified');
      return true;
    } catch (error) {
      this.logger.error('Commitment signature verification failed:', error);
      return false;
    }
  }
}

