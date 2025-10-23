/**
 * Withdrawal data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for withdrawal creation
 * @module formatters/WithdrawFormatter
 */

import type { WithdrawalSignData, Intent } from '../types/models';
import { keccak256 } from '../utils/crypto';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateChainId,
} from '../utils/validation';

/**
 * Withdrawal formatter for preparing withdrawal data to sign
 * This logic must be consistent across all language SDKs
 */
export class WithdrawFormatter {
  /**
   * Prepare withdrawal data for signing
   * @param allocationIds - Array of allocation IDs to withdraw
   * @param targetChain - Target chain ID
   * @param targetAddress - Target address for receiving funds
   * @param intent - Intent object (RawTokenIntent or AssetTokenIntent)
   * @returns Withdrawal sign data ready for signing
   */
  static prepareSignData(
    allocationIds: string[],
    targetChain: number,
    targetAddress: string,
    intent: Intent
  ): WithdrawalSignData {
    // Validate inputs
    validateNonEmptyArray(allocationIds, 'allocationIds');
    validateChainId(targetChain, 'targetChain');
    validateNonEmptyString(targetAddress, 'targetAddress');
    
    // Validate intent object
    if (!intent || typeof intent !== 'object') {
      throw new Error('Intent must be a valid object');
    }

    // Validate each allocation ID
    allocationIds.forEach((id, index) => {
      validateNonEmptyString(id, `allocationIds[${index}]`);
    });

    // Sort allocation IDs (IMPORTANT: for consistency)
    const sortedAllocationIds = this.sortAllocationIds(allocationIds);

    // Generate nullifier
    const nullifier = this.generateNullifier(sortedAllocationIds, targetAddress);

    // Format message according to specification
    const message = this.formatMessage(
      sortedAllocationIds,
      targetChain,
      targetAddress,
      intent
    );

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    return {
      allocationIds: sortedAllocationIds,
      targetChain,
      targetAddress,
      intent,
      message,
      messageHash,
      nullifier,
    };
  }

  /**
   * Sort allocation IDs in ascending order (lexicographically)
   * CRITICAL: This ensures consistency across all clients and backend
   * @param allocationIds - Array of allocation IDs
   * @returns Sorted array of allocation IDs
   */
  private static sortAllocationIds(allocationIds: string[]): string[] {
    return [...allocationIds].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Generate nullifier hash for withdrawal
   * Nullifier = keccak256(sorted_allocation_ids + target_address)
   * @param sortedAllocationIds - Sorted allocation IDs
   * @param targetAddress - Target address
   * @returns Nullifier hash (hex string with 0x prefix)
   */
  private static generateNullifier(
    sortedAllocationIds: string[],
    targetAddress: string
  ): string {
    const idsStr = sortedAllocationIds.join(',');
    const data = `${idsStr}:${targetAddress}`;
    return keccak256(data);
  }

  /**
   * Format withdrawal message for signing
   * Format: "withdraw:{allocation_ids}:{target_chain}:{target_address}:{intent}"
   * @param allocationIds - Sorted array of allocation IDs
   * @param targetChain - Target chain ID
   * @param targetAddress - Target address
   * @param intent - Intent object or string
   * @returns Formatted message string
   */
  private static formatMessage(
    allocationIds: string[],
    targetChain: number,
    targetAddress: string,
    intent: Intent | string
  ): string {
    const idsStr = allocationIds.join(',');
    const intentStr = typeof intent === 'string' ? intent : JSON.stringify(intent);
    return `withdraw:${idsStr}:${targetChain}:${targetAddress}:${intentStr}`;
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
   * @param allocationIds - Array of allocation IDs
   * @returns Merkle root hash
   */
  static generateMerkleRoot(allocationIds: string[]): string {
    validateNonEmptyArray(allocationIds, 'allocationIds');

    // Sort allocation IDs
    const sorted = this.sortAllocationIds(allocationIds);

    // Simple implementation: hash all IDs together
    // In production, this would build a proper merkle tree
    const concatenated = sorted.join('');
    return keccak256(concatenated);
  }

  /**
   * Verify withdrawal data format
   * @param data - Withdrawal sign data to verify
   * @returns True if valid
   */
  static verifySignData(data: WithdrawalSignData): boolean {
    try {
      // Validate all fields are present
      validateNonEmptyArray(data.allocationIds, 'allocationIds');
      validateChainId(data.targetChain, 'targetChain');
      validateNonEmptyString(data.targetAddress, 'targetAddress');
      // Intent can be an object, validate it exists
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
      const expectedNullifier = this.generateNullifier(
        data.allocationIds,
        data.targetAddress
      );
      if (expectedNullifier !== data.nullifier) {
        return false;
      }

      // Verify message format
      const expectedMessage = this.formatMessage(
        data.allocationIds,
        data.targetChain,
        data.targetAddress,
        data.intent
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

  /**
   * Format intent parameters based on intent type
   * @param intent - Intent type
   * @param params - Intent-specific parameters
   * @returns Formatted intent string
   */
  static formatIntent(
    intent: string,
    params?: Record<string, any>
  ): string {
    if (!params) {
      return intent;
    }

    // Format intent with parameters
    // Example: "transfer:bridge=layerzero"
    const paramsStr = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    return `${intent}:${paramsStr}`;
  }

  /**
   * Parse intent string into type and parameters
   * @param intentStr - Intent string
   * @returns Intent type and parameters
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

