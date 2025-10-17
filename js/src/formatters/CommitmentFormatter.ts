/**
 * Commitment data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for commitment creation
 * @module formatters/CommitmentFormatter
 */

import type { CommitmentSignData } from '../types/models';
import { keccak256 } from '../utils/crypto';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateAmount,
} from '../utils/validation';

/**
 * Commitment formatter for preparing commitment data to sign
 * This logic must be consistent across all language SDKs
 */
export class CommitmentFormatter {
  /**
   * Prepare commitment data for signing
   * @param checkbookId - Checkbook ID
   * @param amounts - Array of allocation amounts
   * @param tokenId - Token ID
   * @returns Commitment sign data ready for signing
   */
  static prepareSignData(
    checkbookId: string,
    amounts: string[],
    tokenId: string
  ): CommitmentSignData {
    // Validate inputs
    validateNonEmptyString(checkbookId, 'checkbookId');
    validateNonEmptyArray(amounts, 'amounts');
    validateNonEmptyString(tokenId, 'tokenId');

    // Validate each amount
    amounts.forEach((amount, index) => {
      validateAmount(amount, `amounts[${index}]`);
    });

    // Sort amounts in ascending order (IMPORTANT: for consistency)
    const sortedAmounts = this.sortAmounts(amounts);

    // Format message according to specification
    const message = this.formatMessage(checkbookId, sortedAmounts, tokenId);

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    return {
      checkbookId,
      amounts: sortedAmounts,
      tokenId,
      message,
      messageHash,
    };
  }

  /**
   * Sort amounts in ascending order
   * CRITICAL: This ensures consistency across all clients and backend
   * @param amounts - Array of amount strings
   * @returns Sorted array of amounts
   */
  private static sortAmounts(amounts: string[]): string[] {
    return [...amounts].sort((a, b) => {
      const aBig = BigInt(a);
      const bBig = BigInt(b);
      if (aBig < bBig) return -1;
      if (aBig > bBig) return 1;
      return 0;
    });
  }

  /**
   * Format commitment message for signing
   * Format: "commitment:{checkbookId}:{amount1},{amount2},...:{tokenId}"
   * @param checkbookId - Checkbook ID
   * @param amounts - Sorted array of amounts
   * @param tokenId - Token ID
   * @returns Formatted message string
   */
  private static formatMessage(
    checkbookId: string,
    amounts: string[],
    tokenId: string
  ): string {
    const amountsStr = amounts.join(',');
    return `commitment:${checkbookId}:${amountsStr}:${tokenId}`;
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
   * Generate commitment hashes for allocations
   * @param amounts - Array of amounts
   * @param owner - Owner address
   * @param tokenId - Token ID
   * @returns Array of commitment hashes
   */
  static generateCommitmentHashes(
    amounts: string[],
    owner: string,
    tokenId: string
  ): string[] {
    validateNonEmptyArray(amounts, 'amounts');
    validateNonEmptyString(owner, 'owner');
    validateNonEmptyString(tokenId, 'tokenId');

    return amounts.map((amount, index) => {
      // Format: hash(owner + amount + tokenId + index)
      const data = `${owner}:${amount}:${tokenId}:${index}`;
      return keccak256(data);
    });
  }

  /**
   * Verify commitment data format
   * @param data - Commitment sign data to verify
   * @returns True if valid
   */
  static verifySignData(data: CommitmentSignData): boolean {
    try {
      // Validate all fields are present
      validateNonEmptyString(data.checkbookId, 'checkbookId');
      validateNonEmptyArray(data.amounts, 'amounts');
      validateNonEmptyString(data.tokenId, 'tokenId');
      validateNonEmptyString(data.message, 'message');
      validateNonEmptyString(data.messageHash, 'messageHash');

      // Verify amounts are sorted
      const sorted = this.sortAmounts(data.amounts);
      if (JSON.stringify(sorted) !== JSON.stringify(data.amounts)) {
        return false;
      }

      // Verify message format
      const expectedMessage = this.formatMessage(
        data.checkbookId,
        data.amounts,
        data.tokenId
      );
      if (expectedMessage !== data.message) {
        return false;
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
}

