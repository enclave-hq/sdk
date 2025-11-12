/**
 * Commitment data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for commitment creation
 * This implementation matches lib.rs get_deposit_data_to_sign exactly
 * @module formatters/CommitmentFormatter
 */

import type { CommitmentSignData, UniversalAddress } from '../types/models';
import { keccak256 } from '../utils/crypto';
import { getChainName } from '../utils/chain';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateAmount,
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
 * Allocation with sequence number
 */
export interface AllocationWithSeq {
  seq: number;
  amount: string; // U256 bytes as hex string or BigInt string
}

/**
 * Commitment formatter for preparing commitment data to sign
 * This logic must be consistent with lib.rs get_deposit_data_to_sign
 */
export class CommitmentFormatter {
  /**
   * Prepare commitment data for signing
   * @param allocations - Array of allocations with seq and amount
   * @param depositId - Deposit ID (32 bytes hex string)
   * @param tokenId - Token ID (number)
   * @param tokenSymbol - Token symbol (e.g., "USDC", "USDT", "ETH")
   * @param chainId - Chain ID (SLIP-44)
   * @param ownerAddress - Owner's universal address
   * @param lang - Language code (1=English, 2=Chinese, etc.)
   * @param chainName - Optional chain name (e.g., "Ethereum", "BSC", "TRON"). 
   *                    If not provided, will be derived from chainId.
   *                    Providing chainName makes the message more user-friendly in wallet signatures.
   * @returns Commitment sign data ready for signing
   */
  static prepareSignData(
    allocations: AllocationWithSeq[],
    depositId: string,
    tokenId: number,
    tokenSymbol: string,
    chainId: number,
    ownerAddress: UniversalAddress,
    lang: number = LANG_EN,
    chainName?: string
  ): CommitmentSignData {
    // Validate inputs
    validateNonEmptyArray(allocations, 'allocations');
    validateNonEmptyString(depositId, 'depositId');
    validateNonEmptyString(tokenSymbol, 'tokenSymbol');
    if (tokenId < 0) {
      throw new Error('tokenId must be non-negative');
    }
    if (chainId < 0) {
      throw new Error('chainId must be non-negative');
    }

    // Validate each allocation
    allocations.forEach((allocation, index) => {
      if (allocation.seq < 0 || allocation.seq > 255) {
        throw new Error(`allocation[${index}].seq must be between 0 and 255`);
      }
      validateAmount(allocation.amount, `allocation[${index}].amount`);
    });

    // Sort allocations by seq (IMPORTANT: for consistency with lib.rs)
    const sortedAllocations = this.sortAllocationsBySeq(allocations);

    // Format message according to lib.rs specification
    const message = this.formatMessage(
      sortedAllocations,
      depositId,
      tokenId,
      tokenSymbol,
      chainId,
      ownerAddress,
      lang,
      chainName
    );

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    // Extract amounts for backward compatibility
    const amounts = sortedAllocations.map((a) => a.amount);

    return {
      checkbookId: depositId, // For backward compatibility
      amounts,
      tokenId: tokenId.toString(),
      message,
      messageHash,
    };
  }

  /**
   * Sort allocations by sequence number (ascending)
   * CRITICAL: This ensures consistency with lib.rs
   */
  private static sortAllocationsBySeq(
    allocations: AllocationWithSeq[]
  ): AllocationWithSeq[] {
    return [...allocations].sort((a, b) => a.seq - b.seq);
  }

  /**
   * Format commitment message for signing
   * Matches lib.rs get_deposit_data_to_sign exactly
   */
  private static formatMessage(
    allocations: AllocationWithSeq[],
    depositId: string,
    tokenId: number,
    tokenSymbol: string,
    chainId: number,
    ownerAddress: UniversalAddress,
    lang: number,
    chainName?: string
  ): string {
    // Use provided chain name, or derive from chainId
    const networkName = chainName || getChainName(chainId);
    let message = '';

    // Title based on language
    switch (lang) {
      case LANG_ZH:
        message += '🎯 Enclave 隐私存款确认\n\n';
        break;
      default:
        message += '🎯 Enclave Privacy Deposit Confirmation\n\n';
        break;
    }

    // Token information
    switch (lang) {
      case LANG_ZH:
        message += `🪙 代币: ${tokenSymbol} (ID: ${tokenId})\n`;
        message += `📊 分配数量: ${allocations.length} 项\n`;
        break;
      default:
        message += `🪙 Token: ${tokenSymbol} (ID: ${tokenId})\n`;
        message += `📊 Allocations: ${allocations.length} item(s)\n`;
        break;
    }

    // Allocations list
    for (const allocation of allocations) {
      // Convert amount to BigInt and format with 18 decimals
      const amountBigInt = BigInt(allocation.amount);
      const divisor = BigInt(10) ** BigInt(18);
      const integerPart = amountBigInt / divisor;
      const decimalPart = amountBigInt % divisor;

      // Format decimal part (pad to 18 digits, then trim trailing zeros)
      const decimalStr = decimalPart.toString().padStart(18, '0');
      const trimmedDecimal = decimalStr.replace(/0+$/, '').replace(/\.$/, '');

      let formattedAmount: string;
      if (decimalPart === 0n) {
        formattedAmount = integerPart.toString();
      } else {
        formattedAmount = `${integerPart}.${trimmedDecimal}`;
      }

      // Use tokenSymbol instead of "units" for better user experience
      message += `  • #${allocation.seq}: ${formattedAmount} ${tokenSymbol}\n`;
    }

    // Deposit ID, Network, and Owner
    // Format deposit_id (display first 8 bytes as decimal, matching lib.rs)
    const depositIdHex = depositId.startsWith('0x') ? depositId.slice(2) : depositId;
    const depositIdBytes = Buffer.from(depositIdHex, 'hex');
    
    // Convert first 8 bytes to u64 (big-endian) and then to decimal string
    let depositIdDecimal = '0';
    if (depositIdBytes.length >= 8) {
      // Read first 8 bytes as big-endian u64
      const first8Bytes = depositIdBytes.slice(0, 8);
      // Convert to BigInt (big-endian)
      let u64Value = BigInt(0);
      for (let i = 0; i < 8; i++) {
        const byte = first8Bytes[i];
        if (byte !== undefined) {
          u64Value = (u64Value << BigInt(8)) | BigInt(byte);
        }
      }
      depositIdDecimal = u64Value.toString();
    }
    
    const ownerFormatted = this.formatOwnerAddress(ownerAddress, lang);

    switch (lang) {
      case LANG_ZH:
        message += `\n📝 存款ID: ${depositIdDecimal}\n`;
        message += `🔗 网络: ${networkName} (${chainId})\n`;
        message += `👤 所有者: ${ownerFormatted}\n`;
        break;
      default:
        message += `\n📝 Deposit ID: ${depositIdDecimal}\n`;
        message += `🔗 Network: ${networkName} (${chainId})\n`;
        message += `👤 Owner: ${ownerFormatted}\n`;
        break;
    }

    return message;
  }

  /**
   * Format owner address according to lib.rs format_address
   */
  private static formatOwnerAddress(
    address: UniversalAddress,
    lang: number
  ): string {
    // For now, use simple format. In production, should match lib.rs format_address exactly
    const chainName = getChainName(address.chainId);
    const addrStr = address.address;

    switch (lang) {
      case LANG_ZH:
        return `${chainName}链上${addrStr}地址`;
      default:
        return `${addrStr} on ${chainName}`;
    }
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
   * Sort amounts in ascending order
   * CRITICAL: This ensures consistency across all clients and backend
   * @param amounts - Array of amount strings
   * @returns Sorted array of amounts
   */
  // @ts-ignore - Legacy method kept for backward compatibility
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
   * Generate commitment hash (matching lib.rs generate_commitment_with_owner)
   * @param allocations - Array of allocations with seq and amount
   * @param ownerAddress - Owner's universal address
   * @param depositId - Deposit ID (32 bytes hex string)
   * @param chainId - Chain ID
   * @param tokenId - Token ID
   * @returns Commitment hash (hex string)
   */
  static generateCommitment(
    allocations: AllocationWithSeq[],
    ownerAddress: UniversalAddress,
    depositId: string,
    chainId: number,
    tokenId: number
  ): string {
    const { CommitmentCore } = require('../utils/CommitmentCore');
    const { hexToBytes, amountToBytes32, bytesToHex } = CommitmentCore;

    // Convert allocations to CommitmentCore format
    const coreAllocations = allocations.map((a) => ({
      seq: a.seq,
      amount: amountToBytes32(a.amount),
    }));

    // Convert depositId to bytes
    const depositIdBytes = hexToBytes(depositId);

    // Generate commitment
    const commitment = CommitmentCore.generateCommitmentWithOwner(
      coreAllocations,
      ownerAddress,
      depositIdBytes,
      chainId,
      tokenId
    );

    return bytesToHex(commitment);
  }

  /**
   * Generate commitment hashes for allocations (legacy method - deprecated)
   * @deprecated Use generateCommitment instead
   */
  static generateCommitmentHashes(
    amounts: string[],
    owner: string,
    tokenId: string
  ): string[] {
    // This is a legacy method that doesn't match lib.rs
    // It's kept for backward compatibility but should not be used
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
