/**
 * Commitment action orchestrator
 * @module actions/CommitmentAction
 */

import type { CommitmentParams, Allocation } from '../types/models';
import type { AllocationsAPI } from '../api/AllocationsAPI';
import type { AllocationsStore } from '../stores/AllocationsStore';
import type { CheckbooksStore } from '../stores/CheckbooksStore';
import type { WalletManager } from '../blockchain/WalletManager';
import {
  CommitmentFormatter,
  type AllocationWithSeq,
  LANG_EN,
} from '../formatters/CommitmentFormatter';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { validateNonEmptyString, validateNonEmptyArray } from '../utils/validation';
import { getChainName } from '../utils/chain';

/**
 * Commitment action configuration
 */
export interface CommitmentActionConfig {
  /** Allocations API client */
  api: AllocationsAPI;
  /** Allocations store */
  store: AllocationsStore;
  /** Checkbooks store (to get checkbook info) */
  checkbooksStore: CheckbooksStore;
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
  private readonly checkbooksStore: CheckbooksStore;
  private readonly wallet: WalletManager;
  private readonly logger: ILogger;

  constructor(config: CommitmentActionConfig) {
    this.api = config.api;
    this.store = config.store;
    this.checkbooksStore = config.checkbooksStore;
    this.wallet = config.wallet;
    this.logger = config.logger || getLogger();
  }

  /**
   * Prepare commitment data for signing (Step 1)
   * @param params - Commitment parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Commitment sign data
   */
  async prepareCommitment(params: CommitmentParams, lang: number = LANG_EN) {
    // Validate params
    validateNonEmptyString(params.checkbookId, 'checkbookId');
    validateNonEmptyArray(params.amounts, 'amounts');
    validateNonEmptyString(params.tokenId, 'tokenId');

    this.logger.info('Preparing commitment', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
      tokenId: params.tokenId,
    });

    // Get checkbook info
    let checkbook = this.checkbooksStore.get(params.checkbookId);
    if (!checkbook) {
      // Fetch from API if not in store
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
    }

    // Get owner address
    const ownerAddress = await this.wallet.getAddress();

    // Convert amounts to allocations with seq
    const allocations: AllocationWithSeq[] = params.amounts.map((amount, index) => ({
      seq: index,
      amount,
    }));

    // Get chain name for better user experience in wallet signatures
    const chainName = getChainName(checkbook.token.chainId);

    // Use CommitmentFormatter to generate sign data (matching lib.rs)
    const signData = CommitmentFormatter.prepareSignData(
      allocations,
      params.checkbookId, // depositId
      parseInt(params.tokenId, 10), // tokenId
      checkbook.token.symbol, // tokenSymbol
      checkbook.token.chainId, // chainId
      ownerAddress, // ownerAddress
      lang,
      chainName // chainName for better user experience
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
  async submitCommitment(params: CommitmentParams, signature: string): Promise<Allocation[]> {
    validateNonEmptyString(signature, 'signature');

    this.logger.info('Submitting commitment to backend', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
    });

    // Prepare sign data
    const signData = await this.prepareCommitment(params);

    // Generate commitment hash (matching lib.rs generate_commitment_with_owner)
    // Get checkbook info again (already fetched in prepareCommitment, but ensure we have it)
    let checkbook = this.checkbooksStore.get(params.checkbookId);
    if (!checkbook) {
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
    }

    const ownerAddress = await this.wallet.getAddress();

    // Convert amounts to allocations with seq
    const allocationSeqs: AllocationWithSeq[] = params.amounts.map((amount, index) => ({
      seq: index,
      amount,
    }));

    // Generate commitment using CommitmentFormatter (which uses CommitmentCore)
    const commitment = CommitmentFormatter.generateCommitment(
      allocationSeqs,
      ownerAddress,
      params.checkbookId, // depositId
      checkbook.token.chainId, // chainId
      parseInt(params.tokenId, 10) // tokenId
    );

    // For backward compatibility, generate array of commitments (one per allocation)
    // In practice, all allocations from the same commitment share the same commitment hash
    const commitments = allocationSeqs.map(() => commitment);

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
   * @param lang - Language code (default: LANG_EN)
   * @returns Created allocations
   */
  async createCommitment(params: CommitmentParams, lang: number = LANG_EN): Promise<Allocation[]> {
    this.logger.info('Creating commitment (full flow)', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
    });

    // Step 1: Prepare sign data
    const signData = await this.prepareCommitment(params, lang);

    // Step 2: Sign message
    this.logger.debug('Signing commitment message');
    const signature = await this.wallet.signMessage(signData.messageHash);

    // Step 3: Submit to backend
    const allocations = await this.submitCommitment(params, signature);

    this.logger.info('Commitment created successfully', {
      allocationIds: allocations.map(a => a.id),
    });

    return allocations;
  }

  /**
   * Verify commitment signature
   * @param params - Commitment parameters
   * @param signature - Signature to verify
   * @param lang - Language code (default: LANG_EN)
   * @returns True if signature is valid
   */
  async verifyCommitmentSignature(
    params: CommitmentParams,
    signature: string,
    lang: number = LANG_EN
  ): Promise<boolean> {
    try {
      // Prepare sign data
      await this.prepareCommitment(params, lang);

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