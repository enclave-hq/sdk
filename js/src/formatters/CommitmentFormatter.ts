/**
 * Commitment data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for commitment creation
 * This implementation matches lib.rs get_deposit_data_to_sign exactly
 * @module formatters/CommitmentFormatter
 */

import type { CommitmentSignData, UniversalAddress } from '../types/models';
import { keccak256 } from '../utils/crypto';
import { getChainName } from '../utils/chain';
import { validateNonEmptyString, validateNonEmptyArray, validateAmount } from '../utils/validation';
import { CommitmentCore } from '../utils/CommitmentCore';

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
   * @param localDepositId - Optional local deposit ID (uint64) for display. If provided, will be used directly instead of converting from depositId hex.
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
    chainName?: string,
    localDepositId?: number | string
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
      chainName,
      localDepositId
    );

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    // Extract amounts for backward compatibility
    const amounts = sortedAllocations.map(a => a.amount);

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
  private static sortAllocationsBySeq(allocations: AllocationWithSeq[]): AllocationWithSeq[] {
    return [...allocations].sort((a, b) => a.seq - b.seq);
  }

  /**
   * Format commitment message for signing
   * Matches lib.rs get_deposit_data_to_sign exactly
   */
  private static formatMessage(
    allocations: AllocationWithSeq[],
    depositId: string,
    _tokenId: number, // tokenId is not displayed in message but kept for API compatibility
    tokenSymbol: string,
    chainId: number,
    ownerAddress: UniversalAddress,
    lang: number,
    chainName?: string,
    localDepositId?: number | string
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

    // Token information (matching lib.rs exactly - no tokenId in display)
    switch (lang) {
      case LANG_ZH:
        message += `🪙 代币: ${tokenSymbol}\n`;
        message += `📊 分配数量: ${allocations.length} 项\n`;
        break;
      default:
        message += `🪙 Token: ${tokenSymbol}\n`;
        message += `📊 Allocations: ${allocations.length} item(s)\n`;
        break;
    }

    // Calculate total amount (matching lib.rs)
    let totalAmountBigInt = BigInt(0);
    for (const allocation of allocations) {
      const amountBigInt = BigInt(allocation.amount);
      totalAmountBigInt += amountBigInt;
    }

    // Allocations list
    for (const allocation of allocations) {
      // Convert amount to BigInt and format with 18 decimals
      const amountBigInt = BigInt(allocation.amount);
      const divisor = BigInt(10) ** BigInt(18);
      const integerPart = amountBigInt / divisor;
      const decimalPart = amountBigInt % divisor;

      // Format amount matching lib.rs get_deposit_data_to_sign (最多6位小数)
      // lib.rs logic: format!("{:.6}", display_amount).trim_end_matches('0').trim_end_matches('.')
      let formattedAmount: string;
      if (decimalPart === 0n) {
        formattedAmount = integerPart.toString();
      } else {
        // Convert to number for formatting (matching lib.rs f64 conversion)
        const amountNumber = Number(amountBigInt) / Number(divisor);
        // Use toFixed(6) then trim trailing zeros (matching lib.rs format!("{:.6}", ...))
        formattedAmount = amountNumber.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
      }

      // Use tokenSymbol instead of "units" for better user experience
      message += `  • #${allocation.seq}: ${formattedAmount} ${tokenSymbol}\n`;
    }

    // Total Amount (matching lib.rs - must be after allocations, before Deposit ID)
    // Format matching lib.rs get_deposit_data_to_sign (最多6位小数)
    const totalDivisor = BigInt(10) ** BigInt(18);
    const totalIntegerPart = totalAmountBigInt / totalDivisor;
    const totalDecimalPart = totalAmountBigInt % totalDivisor;

    let totalFormatted: string;
    if (totalDecimalPart === 0n) {
      totalFormatted = totalIntegerPart.toString();
    } else {
      // Convert to number for formatting (matching lib.rs f64 conversion)
      const totalNumber = Number(totalAmountBigInt) / Number(totalDivisor);
      // Use toFixed(6) then trim trailing zeros (matching lib.rs format!("{:.6}", ...))
      totalFormatted = totalNumber.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    }

    switch (lang) {
      case LANG_ZH:
        message += `\n💰 总金额: ${totalFormatted} ${tokenSymbol}\n`;
        break;
      default:
        message += `\n💰 Total Amount: ${totalFormatted} ${tokenSymbol}\n`;
        break;
    }

    // Deposit ID, Network, and Owner
    // Format deposit_id (display first 8 bytes as decimal, matching lib.rs)
    // If localDepositId is provided, use it directly; otherwise convert from depositId hex
    let depositIdDecimal: string;
    if (localDepositId !== undefined && localDepositId !== null && localDepositId !== 0) {
      // Use localDepositId directly (uint64)
      depositIdDecimal = localDepositId.toString();
    } else {
      // Fallback: convert from depositId hex (32 bytes) to u64 (first 8 bytes)
      const depositIdHex = depositId.startsWith('0x') ? depositId.slice(2) : depositId;
      const depositIdBytes = Buffer.from(depositIdHex, 'hex');

      // Convert first 8 bytes to u64 (big-endian) and then to decimal string
      depositIdDecimal = '0';
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

      // Warn if localDepositId was not provided or was 0
      if (localDepositId === undefined || localDepositId === null) {
        console.warn(
          '⚠️ [CommitmentFormatter] localDepositId is missing, using fallback conversion from depositId hex'
        );
      } else if (localDepositId === 0) {
        console.warn(
          '⚠️ [CommitmentFormatter] localDepositId is 0, using fallback conversion from depositId hex'
        );
      }
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
   * Matches lib.rs UniversalAddress::format_address exactly
   */
  private static formatOwnerAddress(address: UniversalAddress, lang: number): string {
    // Extract 20-byte address from 32-byte Universal Address (right-aligned)
    // Universal Address format: [12 bytes zeros][20 bytes address]
    // Use address.address (20-byte) if available, otherwise extract from address.data (32-byte)
    let addrStr: string;
    if (address.address) {
      // Use 20-byte address directly (ensure lowercase to match lib.rs)
      addrStr = address.address.toLowerCase();
      if (!addrStr.startsWith('0x')) {
        addrStr = '0x' + addrStr;
      }
    } else if (address.data) {
      // Extract from 32-byte data (right-aligned, last 20 bytes)
      const addressBytes = Buffer.from(address.data.slice(-20), 'hex');
      addrStr = '0x' + addressBytes.toString('hex').toLowerCase();
    } else {
      // Fallback: use universalFormat if available
      if (address.universalFormat) {
        const universalHex = address.universalFormat.replace(/^0x/, '');
        // Extract last 20 bytes (40 hex chars) from 32-byte (64 hex chars) Universal Address
        const addressHex = universalHex.slice(-40);
        addrStr = '0x' + addressHex.toLowerCase();
      } else {
        throw new Error('UniversalAddress must have either address, data, or universalFormat');
      }
    }

    const chainName = getChainName(address.chainId);

    // Match lib.rs format_address exactly
    // lib.rs format: English: "{address} on {chain_name}", Chinese: "{chain_name}链上{address}地址"
    switch (lang) {
      case LANG_ZH:
        return `${chainName}链上${addrStr}地址`; // Match lib.rs Chinese format: "{chain_name}链上{address}地址"
      default:
        return `${addrStr} on ${chainName}`; // Match lib.rs English format: "{address} on {chain_name}"
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
   * @param tokenKey - Token key string (e.g., "USDT", "USDC")
   * @returns Commitment hash (hex string)
   */
  static generateCommitment(
    allocations: AllocationWithSeq[],
    ownerAddress: UniversalAddress,
    depositId: string,
    chainId: number,
    tokenKey: string
  ): string {
    const { hexToBytes, amountToBytes32, bytesToHex } = CommitmentCore;

    // Convert allocations to CommitmentCore format
    const coreAllocations = allocations.map(a => ({
      seq: a.seq,
      amount: amountToBytes32(a.amount),
    }));

    // Convert depositId to bytes
    const depositIdBytes = hexToBytes(depositId);

    // Generate commitment using tokenKey (matching ZKVM's token_key_hash)
    const commitment = CommitmentCore.generateCommitmentWithOwner(
      coreAllocations,
      ownerAddress,
      depositIdBytes,
      chainId,
      tokenKey // Use tokenKey instead of tokenId
    );

    const commitmentHex = bytesToHex(commitment);
    
    // Log commitment for debugging
    console.log('🔑 [CommitmentFormatter.generateCommitment] Generated commitment:', {
      commitment: commitmentHex,
      tokenKey,
      chainId,
      depositId,
      allocationCount: allocations.length,
      allocations: allocations.map(a => ({ seq: a.seq, amount: a.amount })),
    });

    return commitmentHex;
  }

  /**
   * Generate commitment hashes for allocations (legacy method - deprecated)
   * @deprecated Use generateCommitment instead
   */
  static generateCommitmentHashes(amounts: string[], owner: string, tokenId: string): string[] {
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
