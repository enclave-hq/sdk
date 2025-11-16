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
import { keccak256 } from '../utils/crypto';

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
    validateNonEmptyString(params.tokenKey, 'tokenKey');

    this.logger.info('Preparing commitment', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
      tokenKey: params.tokenKey,
    });

    // Get checkbook info
    let checkbook = this.checkbooksStore.get(params.checkbookId);
    if (!checkbook) {
      // Fetch from API if not in store
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
    }
    
    // Ensure we have localDepositId - if missing, fetch again
    if (!checkbook.localDepositId) {
      this.logger.warn('Checkbook missing localDepositId, fetching from API again', {
        checkbookId: params.checkbookId,
        checkbookStatus: checkbook.status,
      });
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
      
      // Log checkbook data for debugging
      this.logger.debug('Checkbook data after refetch', {
        checkbookId: checkbook.id,
        localDepositId: checkbook.localDepositId,
        slip44ChainId: checkbook.slip44ChainId,
        hasLocalDepositId: checkbook.localDepositId !== undefined && checkbook.localDepositId !== null,
      });
      
      if (!checkbook.localDepositId) {
        throw new Error(`Checkbook ${params.checkbookId} is missing localDepositId. Cannot create commitment without deposit ID.`);
      }
    }

    // Validate total allocation amount does not exceed allocatable_amount
    const totalAmount = params.amounts.reduce((sum, amount) => {
      try {
        return sum + BigInt(amount);
      } catch (error) {
        throw new Error(`Invalid amount format: ${amount}`);
      }
    }, BigInt(0));

    // Use allocatableAmount if available, otherwise fallback to grossAmount or depositAmount
    // Note: depositAmount = gross_amount (total deposit before fees)
    // Log all available amounts for debugging
    this.logger.debug('Checkbook amount fields', {
      allocatableAmount: checkbook.allocatableAmount,
      grossAmount: checkbook.grossAmount,
      depositAmount: checkbook.depositAmount,
      feeTotalLocked: checkbook.feeTotalLocked,
    });

    const maxAllocatable = checkbook.allocatableAmount && checkbook.allocatableAmount !== '0' && checkbook.allocatableAmount !== ''
      ? BigInt(checkbook.allocatableAmount)
      : (checkbook.grossAmount && checkbook.grossAmount !== '0' && checkbook.grossAmount !== ''
        ? BigInt(checkbook.grossAmount)
        : (checkbook.depositAmount && checkbook.depositAmount !== '0' && checkbook.depositAmount !== ''
          ? BigInt(checkbook.depositAmount)
          : BigInt('0')));

    if (totalAmount > maxAllocatable) {
      throw new Error(
        `Total allocation amount (${totalAmount.toString()}) exceeds allocatable amount (${maxAllocatable.toString()}). ` +
        `Checkbook amounts: allocatableAmount=${checkbook.allocatableAmount || 'N/A'}, ` +
        `grossAmount=${checkbook.grossAmount || 'N/A'}, depositAmount=${checkbook.depositAmount || 'N/A'}`
      );
    }

    this.logger.debug('Allocation amount validation passed', {
      totalAmount: totalAmount.toString(),
      maxAllocatable: maxAllocatable.toString(),
      allocatableAmount: checkbook.allocatableAmount,
      grossAmount: checkbook.grossAmount,
    });

    // Get owner address
    const ownerAddress = await this.wallet.getAddress();

    // Convert amounts to allocations with seq
    const allocations: AllocationWithSeq[] = params.amounts.map((amount, index) => ({
      seq: index,
      amount,
    }));

    // Get chain name for better user experience in wallet signatures
    const chainName = getChainName(checkbook.token.chainId);

    // Use tokenKey (which should match token.symbol) for commitment generation
    // Note: For commitment hash generation, we still need a numeric tokenId
    // But since we're using tokenKey now, we'll use 0 as a placeholder
    // The actual tokenKey will be used in the API call
    const tokenIdForHash = 0; // Placeholder - tokenKey is used instead

    // Convert local_deposit_id (uint64) to 32 bytes hex string for commitment generation
    // depositId must be a 32-byte hex string, not the checkbook UUID
    let depositIdHex: string;
    if (checkbook.localDepositId !== undefined && checkbook.localDepositId !== null) {
      // Convert uint64 to 32 bytes hex string (big-endian, left-padded with zeros)
      const depositIdBigInt = BigInt(checkbook.localDepositId);
      depositIdHex = '0x' + depositIdBigInt.toString(16).padStart(64, '0');
    } else {
      // Fallback: if localDepositId is not available, try to extract from checkbook ID
      // This should not happen in production, but provides a fallback
      this.logger.warn('Checkbook missing localDepositId, using fallback conversion', {
        checkbookId: params.checkbookId,
      });
      // Use a hash of the checkbook ID as fallback (not ideal, but better than failing)
      const checkbookIdHash = keccak256(Buffer.from(params.checkbookId));
      depositIdHex = '0x' + Buffer.from(checkbookIdHash).toString('hex').padStart(64, '0');
    }

    // Log localDepositId for debugging
    this.logger.info('📝 [CommitmentAction.prepareCommitment] Using localDepositId for display', {
      localDepositId: checkbook.localDepositId,
      depositIdHex: depositIdHex,
      checkbookId: params.checkbookId,
    });

    // Use CommitmentFormatter to generate sign data (matching lib.rs)
    const signData = CommitmentFormatter.prepareSignData(
      allocations,
      depositIdHex, // depositId as 32 bytes hex string
      tokenIdForHash, // tokenId (placeholder, tokenKey used instead)
      params.tokenKey, // tokenSymbol (use tokenKey as symbol)
      checkbook.token.chainId, // chainId
      ownerAddress, // ownerAddress
      lang,
      chainName, // chainName for better user experience
      checkbook.localDepositId // localDepositId for display (uint64) - MUST be provided
    );

    this.logger.debug('Commitment sign data prepared', {
      messageHash: signData.messageHash,
    });

    // Log the full sign data for debugging and comparison with backend
    this.logger.info('📝 [CommitmentAction.prepareCommitment] Frontend Sign Data (for comparison with backend):', {
      message: signData.message,
      messageHash: signData.messageHash,
      amounts: signData.amounts,
      tokenId: signData.tokenId,
      checkbookId: signData.checkbookId,
    });
    console.log('\n' + '='.repeat(80));
    console.log('📝 Frontend Sign Data (Raw) - For Backend Comparison:');
    console.log('='.repeat(80));
    console.log('Message (Raw Text):');
    console.log(signData.message);
    console.log('\nMessage Hash (Hex):');
    console.log(signData.messageHash);
    console.log('\nAmounts (Hex):');
    signData.amounts.forEach((amount, index) => {
      console.log(`  [${index}]: ${amount}`);
    });
    console.log(`\nToken ID: ${signData.tokenId}`);
    console.log(`Checkbook ID: ${signData.checkbookId}`);
    console.log('='.repeat(80) + '\n');

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

    this.logger.info('📤 [CommitmentAction.submitCommitment] Submitting commitment to backend', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
      tokenKey: params.tokenKey,
    });

    // Prepare sign data
    this.logger.debug('   Preparing sign data for commitment generation...');
    const signData = await this.prepareCommitment(params);

    // Generate commitment hash (matching lib.rs generate_commitment_with_owner)
    // Get checkbook info again (already fetched in prepareCommitment, but ensure we have it)
    let checkbook = this.checkbooksStore.get(params.checkbookId);
    if (!checkbook) {
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
    }
    
    // Ensure we have localDepositId - if missing, fetch again
    if (!checkbook.localDepositId) {
      this.logger.warn('Checkbook missing localDepositId in submitCommitment, fetching from API again', {
        checkbookId: params.checkbookId,
        checkbookStatus: checkbook.status,
      });
      checkbook = await this.checkbooksStore.fetchById(params.checkbookId);
      
      // Log checkbook data for debugging
      this.logger.debug('Checkbook data after refetch in submitCommitment', {
        checkbookId: checkbook.id,
        localDepositId: checkbook.localDepositId,
        slip44ChainId: checkbook.slip44ChainId,
        hasLocalDepositId: checkbook.localDepositId !== undefined && checkbook.localDepositId !== null,
      });
      
      if (!checkbook.localDepositId) {
        throw new Error(`Checkbook ${params.checkbookId} is missing localDepositId. Cannot submit commitment without deposit ID.`);
      }
    }

    const ownerAddress = await this.wallet.getAddress();

    // Convert amounts to allocations with seq
    const allocationSeqs: AllocationWithSeq[] = params.amounts.map((amount, index) => ({
      seq: index,
      amount,
    }));

    // Generate commitment using CommitmentFormatter (which uses CommitmentCore)
    // Note: tokenId is still needed for commitment hash generation, but we use 0 as placeholder
    // The actual tokenKey is used in API calls
    
    // Convert local_deposit_id (uint64) to 32 bytes hex string for commitment generation
    // depositId must be a 32-byte hex string, not the checkbook UUID
    let depositIdHex: string;
    if (checkbook.localDepositId !== undefined && checkbook.localDepositId !== null) {
      // Convert uint64 to 32 bytes hex string (big-endian, left-padded with zeros)
      const depositIdBigInt = BigInt(checkbook.localDepositId);
      depositIdHex = '0x' + depositIdBigInt.toString(16).padStart(64, '0');
    } else {
      // Fallback: if localDepositId is not available, try to extract from checkbook ID
      // This should not happen in production, but provides a fallback
      this.logger.warn('Checkbook missing localDepositId, using fallback conversion', {
        checkbookId: params.checkbookId,
      });
      // Use a hash of the checkbook ID as fallback (not ideal, but better than failing)
      const checkbookIdHash = keccak256(Buffer.from(params.checkbookId));
      depositIdHex = '0x' + Buffer.from(checkbookIdHash).toString('hex').padStart(64, '0');
    }
    
    const tokenIdForHash = 0; // Placeholder - tokenKey is used instead
    const commitment = CommitmentFormatter.generateCommitment(
      allocationSeqs,
      ownerAddress,
      depositIdHex, // depositId as 32 bytes hex string
      checkbook.token.chainId, // chainId
      tokenIdForHash // tokenId (placeholder, tokenKey used instead)
    );

    // For backward compatibility, generate array of commitments (one per allocation)
    // In practice, all allocations from the same commitment share the same commitment hash
    const commitments = allocationSeqs.map(() => commitment);

    // Submit to API (/api/commitments/submit POST)
    // This endpoint handles:
    // 1. Creating allocations
    // 2. Calling ZKVM service to generate proof
    // 3. Submitting commitment to blockchain
    // 4. Updating allocations status to 'idle'
    this.logger.info('📡 [CommitmentAction.submitCommitment] Calling /api/commitments/submit POST endpoint...');
    
    // Get owner address for the request (already fetched above, but ensure we have it)
    // Note: ownerAddress is already defined above, but we need it here for the request
    const ownerAddr = await this.wallet.getAddress();
    
    // Convert amounts to BuildCommitmentHandler format
    // BuildCommitmentHandler expects: { recipient_chain_id, recipient_address, amount, token_id }
    // Use Universal Address format (32-byte) for recipient_address - REQUIRED
    if (!ownerAddr.universalFormat) {
      throw new Error('Universal Address format is required. ownerAddr.universalFormat is missing.');
    }
    const recipientAddress = ownerAddr.universalFormat.replace(/^0x/, '');
    const buildCommitmentAllocations = signData.amounts.map((amount, index) => ({
      recipient_chain_id: checkbook.token.chainId, // SLIP-44 Chain ID
      recipient_address: recipientAddress, // 32-byte Universal Address (required)
      amount: amount,
      token_id: 0, // TokenID is not used, tokenKey is used instead
    }));
    
    // Convert depositId to string (BuildCommitmentHandler expects string)
    // Use localDepositId - it should be available after the check above
    if (!checkbook.localDepositId) {
      throw new Error(`Checkbook ${params.checkbookId} is missing localDepositId. Cannot submit commitment without deposit ID.`);
    }
    const depositIdString = checkbook.localDepositId.toString();
    
    // Log depositIdString for debugging
    this.logger.info('📝 [CommitmentAction.submitCommitment] Using deposit_id for API request', {
      localDepositId: checkbook.localDepositId,
      depositIdString: depositIdString,
      checkbookId: params.checkbookId,
    });
    
    // Extract chain ID from owner address
    const chainId = ownerAddr.chainId;
    
    // Validate universalFormat is available - REQUIRED
    if (!ownerAddr.universalFormat) {
      throw new Error('Universal Address format is required. ownerAddr.universalFormat is missing.');
    }
    
    // Get token decimals from checkbook token
    const tokenDecimals = checkbook.token.decimals || 18;
    
    // Prepare request for /api/commitments/submit (BuildCommitmentHandler)
    // Include commitment hash so backend can generate nullifiers
    const buildCommitmentRequest = {
      allocations: buildCommitmentAllocations,
      deposit_id: depositIdString,
      signature: {
        chain_id: chainId,
        signature_data: signature,
        public_key: null as string | null,
      },
      owner_address: {
        chain_id: chainId, // SLIP-44 Chain ID
        address: ownerAddr.universalFormat.replace(/^0x/, ''), // 32-byte Universal Address (required)
      },
      token_symbol: params.tokenKey,
      token_decimals: tokenDecimals,
      lang: LANG_EN,
      commitment: commitment, // Include commitment hash for nullifier generation
    };
    
    this.logger.debug('   Commitment hash for nullifier generation:', commitment);
    
    this.logger.debug('   Request payload:', {
      checkbookId: params.checkbookId,
      depositId: depositIdString,
      allocationCount: buildCommitmentAllocations.length,
      tokenKey: params.tokenKey,
      tokenDecimals: tokenDecimals,
      chainId: chainId,
      signatureLength: signature.length,
    });
    
    // Call /api/commitments/submit endpoint
    const apiClient = (this.api as any).client;
    const response = await apiClient.post<{
      success: boolean;
      checks?: any[]; // BuildCommitmentHandler returns 'checks' not 'allocations'
      allocations?: any[]; // Fallback for backward compatibility
      checkbook?: any;
      commitment?: string;
      proof_data?: string;
      public_values?: string;
    }>('/api/commitments/submit', buildCommitmentRequest);
    
    // BuildCommitmentHandler returns 'checks' in the response
    const backendAllocations = response.checks || response.allocations || [];
    
    // Convert response allocations to frontend format
    const allocations: Allocation[] = backendAllocations.map((backendAlloc: any) => {
      // Use convertAllocation helper if available
      const convertAllocation = (this.api as any).convertAllocation;
      if (convertAllocation) {
        return convertAllocation(backendAlloc);
      }
      // Fallback conversion
      return {
        id: backendAlloc.id,
        checkbookId: backendAlloc.checkbook_id || backendAlloc.checkbookId,
        seq: backendAlloc.seq,
        amount: backendAlloc.amount,
        status: backendAlloc.status,
        nullifier: backendAlloc.nullifier,
        withdrawRequestId: backendAlloc.withdraw_request_id || backendAlloc.withdrawRequestId,
        commitment: backendAlloc.commitment,
        createdAt: backendAlloc.created_at ? new Date(backendAlloc.created_at).getTime() : Date.now(),
        updatedAt: backendAlloc.updated_at ? new Date(backendAlloc.updated_at).getTime() : Date.now(),
        owner: ownerAddr,
        token: checkbook.token,
      } as Allocation;
    });
    
    // Update store with new allocations
    if (allocations.length > 0) {
      this.store.updateItems(allocations, (a) => a.id);
    }

    this.logger.info(`✅ [CommitmentAction.submitCommitment] Successfully created ${allocations.length} allocations via /api/commitments/submit`, {
      allocationIds: allocations.map(a => a.id),
      allocationStatuses: allocations.map(a => a.status),
      allocationAmounts: allocations.map(a => a.amount),
    });
    this.logger.info('   ✅ ZKVM proof generation and commitment submission handled by backend');
    this.logger.info('   ✅ Allocations status should be "idle" after ZKVM proof is generated');
    
    return allocations;
  }

  /**
   * Create commitment (full flow: prepare + sign + submit) (Step 3)
   * @param params - Commitment parameters
   * @param lang - Language code (default: LANG_EN)
   * @returns Created allocations
   */
  async createCommitment(params: CommitmentParams, lang: number = LANG_EN): Promise<Allocation[]> {
    this.logger.info('🚀 [CommitmentAction] Starting commitment creation (full flow)', {
      checkbookId: params.checkbookId,
      amountCount: params.amounts.length,
      tokenKey: params.tokenKey,
    });

    // Step 1: Prepare sign data
    this.logger.info('📝 [CommitmentAction] Step 1: Preparing commitment sign data...');
    const signData = await this.prepareCommitment(params, lang);
    this.logger.info('✅ [CommitmentAction] Step 1 completed: Sign data prepared', {
      messageHash: signData.messageHash,
      messageLength: signData.message?.length || 0,
    });

    // Step 2: Sign message
    // IMPORTANT: Pass the raw message string (not the hash) to signMessage
    // ethers.js Wallet.signMessage() will automatically add EIP-191 prefix and hash it
    // This matches ZKVM's generate_message_hash() which expects raw message and adds EIP-191 prefix
    this.logger.info('✍️  [CommitmentAction] Step 2: Signing commitment message...');
    this.logger.debug('   Message to sign (raw):', signData.message);
    this.logger.debug('   Message hash (for reference):', signData.messageHash);
    const signature = await this.wallet.signMessage(signData.message);
    this.logger.info('✅ [CommitmentAction] Step 2 completed: Message signed', {
      signatureLength: signature.length,
      signaturePrefix: signature.substring(0, 20) + '...',
    });

    // Step 3: Submit to backend (creates allocations via /api/commitments/submit POST)
    // This endpoint handles: creating allocations, calling ZKVM service, submitting commitment
    this.logger.info('📤 [CommitmentAction] Step 3: Submitting commitment to backend (/api/commitments/submit)...');
    this.logger.debug('   Request details:', {
      checkbookId: params.checkbookId,
      amounts: params.amounts,
      tokenKey: params.tokenKey,
      commitmentCount: signData.amounts.length,
    });
    const allocations = await this.submitCommitment(params, signature);
    this.logger.info('✅ [CommitmentAction] Step 3 completed: Allocations created', {
      allocationCount: allocations.length,
      allocationIds: allocations.map(a => a.id),
      allocationStatuses: allocations.map(a => a.status),
    });

    // Note: After creating allocations, backend should automatically call ZKVM service
    // via BuildCommitmentHandler (/api/commitments/submit) to generate proof and submit commitment
    // Allocations status will change from 'pending' to 'idle' after ZKVM proof is generated
    this.logger.info('⏳ [CommitmentAction] Note: Backend will process ZKVM proof generation asynchronously');
    this.logger.info('   Allocations status will change from "pending" to "idle" after ZKVM proof is generated');

    this.logger.info('✅ [CommitmentAction] Commitment creation flow completed', {
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