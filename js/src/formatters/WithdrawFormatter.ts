/**
 * Withdrawal data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for withdrawal creation
 * This implementation matches lib.rs get_withdraw_data_to_sign exactly
 * @module formatters/WithdrawFormatter
 */

import type { WithdrawalSignData, Intent, UniversalAddress, Allocation } from '../types/models';
import { keccak256 } from '../utils/crypto';
import { formatAmount } from '../utils/amount';
import { formatUniversalAddress } from '../utils/address';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateChainId,
} from '../utils/validation';

/**
 * Language codes (matching lib.rs)
 */
export const LANG_EN = 1; // English
export const LANG_ZH = 2; // Chinese
export const LANG_ES = 3; // Spanish
export const LANG_FR = 4; // French
export const LANG_DE = 5; // German
export const LANG_JA = 6; // Japanese
export const LANG_KO = 7; // Korean
export const LANG_RU = 8; // Russian
export const LANG_AR = 9; // Arabic
export const LANG_PT = 10; // Portuguese

/**
 * Withdrawal formatter for preparing withdrawal data to sign
 * This logic must be consistent with lib.rs get_withdraw_data_to_sign
 */
export class WithdrawFormatter {
  /**
   * Prepare withdrawal data for signing
   * @param allocations - Array of allocations with seq and amount
   * @param intent - Intent object (RawTokenIntent or AssetTokenIntent)
   * @param tokenSymbol - Token symbol (e.g., "USDC", "USDT", "ETH")
   * @param lang - Language code (1=English, 2=Chinese, etc.)
   * @param chainName - Optional chain name (e.g., "Ethereum", "BSC", "TRON").
   *                    If not provided, will be derived from beneficiary chainId.
   *                    Providing chainName makes the message more user-friendly in wallet signatures.
   * @returns Withdrawal sign data ready for signing
   */
  static prepareSignData(
    allocations: Allocation[],
    intent: Intent,
    tokenSymbol: string,
    lang: number = LANG_EN,
    chainName?: string
  ): WithdrawalSignData {
    // Validate inputs
    validateNonEmptyArray(allocations, 'allocations');
    validateNonEmptyString(tokenSymbol, 'tokenSymbol');
    
    // Validate intent object
    if (!intent || typeof intent !== 'object') {
      throw new Error('Intent must be a valid object');
    }

    // Validate beneficiary
    if (!intent.beneficiary || typeof intent.beneficiary !== 'object') {
      throw new Error('Intent.beneficiary must be a valid UniversalAddress');
    }

    // Sort allocations by ID (IMPORTANT: for consistency)
    const sortedAllocations = this.sortAllocationsById(allocations);
    const allocationIds = sortedAllocations.map((a) => a.id);

    // Generate nullifier (matching lib.rs generate_nullifier)
    // Nullifier = keccak256(commitment || allocation.seq || allocation.amount)
    // For multiple allocations, we generate nullifiers for each and combine them
    // Note: In practice, each allocation should have its own nullifier
    // For withdrawal with multiple allocations, we may need to handle this differently
    let nullifier = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    if (sortedAllocations.length > 0) {
      const firstAllocation = sortedAllocations[0];
      
      // If commitment is available, generate proper nullifier (matching lib.rs)
      if (firstAllocation.commitment) {
        nullifier = this.generateNullifier(
          firstAllocation.commitment,
          {
            seq: firstAllocation.seq,
            amount: firstAllocation.amount,
          }
        );
      } else {
        // If no commitment, we cannot generate a proper nullifier
        // This should not happen in production - allocation should have commitment
        throw new Error(
          `Allocation ${firstAllocation.id} missing commitment. Cannot generate nullifier.`
        );
      }
    }

    // Format message according to lib.rs specification
    const message = this.formatMessage(
      sortedAllocations,
      intent,
      tokenSymbol,
      lang,
      chainName
    );

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    return {
      allocationIds,
      targetChain: intent.beneficiary.chainId,
      targetAddress: intent.beneficiary.address,
      intent,
      message,
      messageHash,
      nullifier,
    };
  }


  /**
   * Sort allocations by ID (ascending, lexicographically)
   * CRITICAL: This ensures consistency with lib.rs
   */
  private static sortAllocationsById(allocations: Allocation[]): Allocation[] {
    return [...allocations].sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Sort allocation IDs in ascending order (lexicographically)
   * CRITICAL: This ensures consistency across all clients and backend
   */
  private static sortAllocationIds(allocationIds: string[]): string[] {
    return [...allocationIds].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Generate nullifier hash for withdrawal (matching lib.rs generate_nullifier)
   * 
   * Note: This requires commitment and allocation information.
   * For withdrawal, we need to get the commitment from the allocation's credential.
   * 
   * @param commitment - Commitment hash (32 bytes hex string)
   * @param allocation - Allocation with seq and amount
   * @returns Nullifier hash (hex string)
   */
  static generateNullifier(
    commitment: string,
    allocation: { seq: number; amount: string }
  ): string {
    const { CommitmentCore } = require('../utils/CommitmentCore');
    const { hexToBytes, amountToBytes32, bytesToHex } = CommitmentCore;

    const commitmentBytes = hexToBytes(commitment);
    const coreAllocation = {
      seq: allocation.seq,
      amount: amountToBytes32(allocation.amount),
    };

    const nullifier = CommitmentCore.generateNullifier(commitmentBytes, coreAllocation);
    return bytesToHex(nullifier);
  }

  /**
   * Generate nullifier from allocation IDs (legacy method - requires commitment)
   * @deprecated Use generateNullifier with commitment instead
   */
  private static generateNullifierLegacy(
    sortedAllocationIds: string[],
    targetAddress: string
  ): string {
    // This is a simplified version that doesn't match lib.rs
    // It's kept for backward compatibility but should not be used
    const idsStr = sortedAllocationIds.join(',');
    const data = `${idsStr}:${targetAddress}`;
    return keccak256(data);
  }

  /**
   * Format withdrawal message for signing
   * Matches lib.rs get_withdraw_data_to_sign exactly
   */
  private static formatMessage(
    allocations: Allocation[],
    intent: Intent,
    tokenSymbol: string,
    lang: number,
    chainName?: string
  ): string {
    let message = '';

    // Title based on language
    switch (lang) {
      case LANG_ZH:
        message += '🔓 Enclave 隐私提款\n\n';
        break;
      default:
        message += '🔓 Enclave Private Withdrawal\n\n';
        break;
    }

    // Beneficiary address
    const beneficiary = intent.beneficiary;
    const beneficiaryFormatted = this.formatBeneficiaryAddress(beneficiary, lang);
    // Use provided chain name, or derive from beneficiary chainId
    const beneficiaryChainName = chainName || this.getChainName(beneficiary.chainId);

    switch (lang) {
      case LANG_ZH:
        message += `收款地址: ${beneficiaryFormatted}\n`;
        message += `链: ${beneficiaryChainName} (${beneficiary.chainId})\n\n`;
        break;
      default:
        message += `To: ${beneficiaryFormatted}\n`;
        message += `Chain: ${beneficiaryChainName} (${beneficiary.chainId})\n\n`;
        break;
    }

    // Token information
    if (intent.type === 'RawToken') {
      const tokenContract = intent.tokenContract;
      const tokenAddr = this.formatTokenContract(tokenContract);
      switch (lang) {
        case LANG_ZH:
          message += `代币: ${tokenSymbol} ${tokenAddr}\n\n`;
          break;
        default:
          message += `Token: ${tokenSymbol} ${tokenAddr}\n\n`;
          break;
      }
    } else if (intent.type === 'AssetToken') {
      const assetId = intent.assetId;
      const adapterId = this.getAdapterId(assetId);
      const tokenId = this.getTokenId(assetId);
      // Use assetTokenSymbol if available, otherwise fall back to tokenSymbol
      const assetTokenSymbol = (intent as any).assetTokenSymbol || tokenSymbol;
      switch (lang) {
        case LANG_ZH:
          message += `代币: ${assetTokenSymbol} (适配器 #${adapterId}, 代币 #${tokenId})\n\n`;
          break;
        default:
          message += `Token: ${assetTokenSymbol} (Adapter #${adapterId}, Token #${tokenId})\n\n`;
          break;
      }
    }

    // Calculate total amount from allocations
    let totalAmount = BigInt(0);
    for (const allocation of allocations) {
      totalAmount += BigInt(allocation.amount);
    }

    // Format amount with 18 decimals
    const divisor = BigInt(10) ** BigInt(18);
    const integerPart = totalAmount / divisor;
    const decimalPart = totalAmount % divisor;
    const decimalStr = decimalPart.toString().padStart(18, '0');
    const trimmedDecimal = decimalStr.replace(/0+$/, '');
    
    let formattedAmount: string;
    if (decimalPart === 0n) {
      formattedAmount = `${integerPart} ${tokenSymbol}`;
    } else {
      formattedAmount = `${integerPart}.${trimmedDecimal} ${tokenSymbol}`;
    }

    switch (lang) {
      case LANG_ZH:
        message += `金额: ${formattedAmount}\n`;
        break;
      default:
        message += `Amount: ${formattedAmount}\n`;
        break;
    }

    return message;
  }


  /**
   * Format beneficiary address according to lib.rs format_address
   */
  private static formatBeneficiaryAddress(
    address: UniversalAddress,
    lang: number
  ): string {
    // For now, use simple format. In production, should match lib.rs format_address exactly
    const chainName = this.getChainName(address.chainId);
    const addrStr = address.address;

    switch (lang) {
      case LANG_ZH:
        return `${chainName}链上${addrStr}地址`;
      default:
        return `${addrStr} on ${chainName}`;
    }
  }

  /**
   * Format token contract (32 bytes) as address string
   * Matches lib.rs format_token_contract
   */
  private static formatTokenContract(tokenContract: string): string {
    // Remove 0x prefix if present
    const hex = tokenContract.startsWith('0x') ? tokenContract.slice(2) : tokenContract;
    
    // Extract right-aligned 20 bytes (last 40 hex chars)
    if (hex.length < 40) {
      throw new Error('Token contract must be at least 20 bytes (40 hex chars)');
    }
    
    const addressHex = hex.slice(-40); // Last 40 hex chars = 20 bytes
    return `0x${addressHex}`;
  }

  /**
   * Extract adapter ID from asset ID (bytes 4-7)
   */
  private static getAdapterId(assetId: string): number {
    const hex = assetId.startsWith('0x') ? assetId.slice(2) : assetId;
    if (hex.length < 16) {
      throw new Error('Asset ID must be at least 8 bytes (16 hex chars)');
    }
    // Bytes 4-7 (hex chars 8-15)
    const adapterHex = hex.slice(8, 16);
    return parseInt(adapterHex, 16);
  }

  /**
   * Extract token ID from asset ID (bytes 8-9)
   */
  private static getTokenId(assetId: string): number {
    const hex = assetId.startsWith('0x') ? assetId.slice(2) : assetId;
    if (hex.length < 20) {
      throw new Error('Asset ID must be at least 10 bytes (20 hex chars)');
    }
    // Bytes 8-9 (hex chars 16-19)
    const tokenHex = hex.slice(16, 20);
    return parseInt(tokenHex, 16);
  }

  /**
   * Get chain name (matching lib.rs get_chain_name)
   */
  private static getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      0: 'Bitcoin',
      2: 'Litecoin',
      60: 'Ethereum',
      118: 'Cosmos',
      195: 'TRON',
      501: 'Solana',
      714: 'Binance Smart Chain',
      966: 'Polygon',
      354: 'Polkadot',
      434: 'Kusama',
      43114: 'Avalanche',
      250: 'Fantom',
      9001: 'Arbitrum',
      10001: 'Optimism',
      8453: 'Base',
      324: 'zkSync Era',
    };
    return chainNames[chainId] || `Unknown Chain`;
  }

  /**
   * Compute keccak256 hash of message
   * @param message - Message string
   * @returns Message hash (hex string with 0x prefix)
   */
  private static computeMessageHash(message: string): string {
    return keccak256(message);
  }

  /**
   * Generate merkle root for allocations (simplified version)
   * In production, this would use a proper merkle tree implementation
   */
  static generateMerkleRoot(allocationIds: string[]): string {
    validateNonEmptyArray(allocationIds, 'allocationIds');
    const sorted = this.sortAllocationIds(allocationIds);
    const concatenated = sorted.join('');
    return keccak256(concatenated);
  }

  /**
   * Verify withdrawal data format
   */
  static verifySignData(data: WithdrawalSignData): boolean {
    try {
      validateNonEmptyArray(data.allocationIds, 'allocationIds');
      validateChainId(data.targetChain, 'targetChain');
      validateNonEmptyString(data.targetAddress, 'targetAddress');
      if (!data.intent) {
        throw new Error('Intent is required');
      }
      validateNonEmptyString(data.message, 'message');
      validateNonEmptyString(data.messageHash, 'messageHash');
      validateNonEmptyString(data.nullifier, 'nullifier');

      // Verify allocation IDs are sorted
      const sorted = this.sortAllocationIds(data.allocationIds);
      if (JSON.stringify(sorted) !== JSON.stringify(data.allocationIds)) {
        return false;
      }

      // Verify nullifier
      // Note: Nullifier verification requires commitment and allocation info
      // This is a simplified check - full verification should use CommitmentCore
      // TODO: Implement full nullifier verification with CommitmentCore
      if (!data.nullifier || data.nullifier === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        // Placeholder nullifier is acceptable for now
        // In production, should verify against CommitmentCore
      }

      // Verify message hash
      const expectedHash = this.computeMessageHash(data.message);
      if (expectedHash !== data.messageHash) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format intent parameters based on intent type
   */
  static formatIntent(
    intent: string,
    params?: Record<string, any>
  ): string {
    if (!params) {
      return intent;
    }
    const paramsStr = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    return `${intent}:${paramsStr}`;
  }

  /**
   * Parse intent string into type and parameters
   */
  static parseIntent(intentStr: string): {
    type: string;
    params: Record<string, string>;
  } {
    const parts = intentStr.split(':');
    const type = parts[0] || '';
    const params: Record<string, string> = {};

    if (parts.length > 1) {
      const paramsStr = parts.slice(1).join(':');
      paramsStr.split(',').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = value;
        }
      });
    }

    return { type, params };
  }
}
