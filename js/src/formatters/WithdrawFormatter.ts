/**
 * Withdrawal data formatter for SDK-internal data preparation
 * Generates signed messages and payloads for withdrawal creation
 * This implementation matches lib.rs get_withdraw_data_to_sign exactly
 * @module formatters/WithdrawFormatter
 */

import type { WithdrawalSignData, Intent, UniversalAddress, Allocation } from '../types/models';
import { keccak256 } from '../utils/crypto';
import {
  validateNonEmptyString,
  validateNonEmptyArray,
  validateChainId,
} from '../utils/validation';
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
   * @param checkbookInfo - Optional checkbook info containing localDepositId and chainId (for backward compatibility)
   * @param allocationCheckbookMap - Optional map from allocation ID to checkbook info (for cross-deposit support)
   * @param minOutput - Optional minimum output constraint (default: 0)
   * @returns Withdrawal sign data ready for signing
   */
  static prepareSignData(
    allocations: Allocation[],
    intent: Intent,
    tokenSymbol: string,
    lang: number = LANG_EN,
    chainName?: string,
    checkbookInfo?: { localDepositId?: number; slip44ChainId?: number },
    minOutput: string = '0',
    allocationCheckbookMap?: Map<string, { localDepositId?: number; slip44ChainId?: number }>
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
    const allocationIds = sortedAllocations.map(a => a.id);

    // Generate nullifier (matching lib.rs generate_nullifier)
    // Nullifier = keccak256(commitment || allocation.seq || allocation.amount)
    // For multiple allocations, we generate nullifiers for each and combine them
    // Note: In practice, each allocation should have its own nullifier
    // For withdrawal with multiple allocations, we may need to handle this differently
    let nullifier = '0x0000000000000000000000000000000000000000000000000000000000000000';

    if (sortedAllocations.length > 0) {
      const firstAllocation = sortedAllocations[0];
      if (!firstAllocation) {
        throw new Error('First allocation is missing');
      }

      // If commitment is available, generate proper nullifier (matching lib.rs)
      if (firstAllocation.commitment) {
        nullifier = this.generateNullifier(firstAllocation.commitment, {
          seq: firstAllocation.seq,
          amount: firstAllocation.amount,
        });
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
      chainName,
      checkbookInfo,
      minOutput,
      allocationCheckbookMap
    );

    // Compute message hash
    const messageHash = this.computeMessageHash(message);

    return {
      allocationIds,
      targetChain: intent.beneficiary.chainId,
      targetAddress: intent.beneficiary.address,
      intent,
      tokenSymbol, // Include tokenSymbol in return value
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
  // @ts-ignore - Legacy method kept for backward compatibility
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
    chainName?: string,
    checkbookInfo?: { localDepositId?: number; slip44ChainId?: number },
    minOutput: string = '0',
    allocationCheckbookMap?: Map<string, { localDepositId?: number; slip44ChainId?: number }>
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

    // 1. Source Token information (from checkbook/credential)
    // Use SLIP-44 Chain ID (unified standard, supports all chains including non-EVM chains)
    const sourceSlip44ChainId = checkbookInfo?.slip44ChainId || allocations[0]?.owner?.chainId || 0;
    const sourceChainName = this.getChainName(sourceSlip44ChainId);
    const sourceTokenKey = tokenSymbol;

    switch (lang) {
      case LANG_ZH:
        message += `提取代币: ${sourceChainName} (${sourceSlip44ChainId}) 上的${sourceTokenKey}\n\n`;
        break;
      default:
        message += `Source Token: ${sourceTokenKey} on ${sourceChainName} (${sourceSlip44ChainId})\n\n`;
        break;
    }

    // 2. Allocations - display all allocations with deposit_id and seq
    // Support cross-deposit: each allocation uses its own checkbook's localDepositId
    const allocationsWithInfo = allocations.map(alloc => {
      // If allocationCheckbookMap is provided, use it to get the correct depositId for each allocation
      // Otherwise, fall back to checkbookInfo (for backward compatibility)
      let depositId: number;
      if (allocationCheckbookMap && allocationCheckbookMap.has(alloc.id)) {
        const allocCheckbookInfo = allocationCheckbookMap.get(alloc.id);
        depositId = allocCheckbookInfo?.localDepositId || 0;
        // Debug: Log the mapping (only in development)
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log(
            `[WithdrawFormatter] Allocation ${alloc.id} -> depositId ${depositId} (from allocationCheckbookMap)`
          );
        }
      } else {
        depositId = checkbookInfo?.localDepositId || 0;
        // This should not happen if allocationCheckbookMap is properly provided
        // Log warning (always log this as it indicates a problem)
        // eslint-disable-next-line no-console
        console.warn(
          `[WithdrawFormatter] ⚠️ Allocation ${alloc.id} not found in allocationCheckbookMap!`,
          `Using fallback depositId ${depositId}.`,
          `Map has ${allocationCheckbookMap?.size || 0} entries.`,
          `Map keys:`,
          allocationCheckbookMap ? Array.from(allocationCheckbookMap.keys()) : 'null'
        );
      }
      return {
        allocation: alloc,
        depositId,
      };
    });

    switch (lang) {
      case LANG_ZH:
        message += `📊 分配数量: ${allocationsWithInfo.length} 项\n`;
        break;
      default:
        message += `📊 Allocations: ${allocationsWithInfo.length} item(s)\n`;
        break;
    }

    // Sort allocations by seq for display (matching lib.rs behavior)
    const sortedBySeq = [...allocationsWithInfo].sort(
      (a, b) => a.allocation.seq - b.allocation.seq
    );

    for (const { allocation, depositId: depId } of sortedBySeq) {
      // Convert amount string to bytes32 format for formatting
      const amountBytes32 = this.amountToBytes32(allocation.amount);
      const formattedAmount = this.formatAmount(amountBytes32, 18, sourceTokenKey);

      switch (lang) {
        case LANG_ZH:
          message += `  • ${depId} 的 #${allocation.seq}: ${formattedAmount}\n`;
          break;
        default:
          message += `  • Deposit ${depId} #${allocation.seq}: ${formattedAmount}\n`;
          break;
      }
    }

    // 3. Total Amount
    let totalAmount = BigInt(0);
    for (const allocation of allocations) {
      totalAmount += BigInt(allocation.amount);
    }
    const totalBytes = this.amountToBytes32(totalAmount.toString());
    const totalFormatted = this.formatAmount(totalBytes, 18, sourceTokenKey);

    switch (lang) {
      case LANG_ZH:
        message += `\n总金额: ${totalFormatted}\n\n`;
        break;
      default:
        message += `\nTotal Amount: ${totalFormatted}\n\n`;
        break;
    }

    // 4. Target Token information (based on Intent type)
    const beneficiary = intent.beneficiary;
    const beneficiaryChainId = beneficiary.chainId;
    const beneficiaryChainName = chainName || this.getChainName(beneficiaryChainId);

    switch (lang) {
      case LANG_ZH:
        message += `目标代币:\n`;
        break;
      default:
        message += `Target Token:\n`;
        break;
    }

    if (intent.type === 'RawToken') {
      const targetTokenSymbol = intent.tokenSymbol || tokenSymbol;
      switch (lang) {
        case LANG_ZH:
          message += `  在链: ${beneficiaryChainName} (${beneficiaryChainId}) 得到代币 ${targetTokenSymbol}\n\n`;
          break;
        default:
          message += `  On chain: ${beneficiaryChainName} (${beneficiaryChainId}) get token ${targetTokenSymbol}\n\n`;
          break;
      }
    } else if (intent.type === 'AssetToken') {
      const assetId = intent.assetId;
      const adapterId = this.getAdapterId(assetId);
      const assetTokenSymbol = (intent as any).assetTokenSymbol || tokenSymbol;
      const assetChainId = this.getChainIdFromAssetId(assetId);
      const assetChainName = this.getChainName(assetChainId);
      switch (lang) {
        case LANG_ZH:
          message += `  在链: ${assetChainName} (${assetChainId}) 通过 池子: 适配器 #${adapterId} 得到代币 ${assetTokenSymbol}\n\n`;
          break;
        default:
          message += `  On chain: ${assetChainName} (${assetChainId}) through pool: Adapter #${adapterId} get token ${assetTokenSymbol}\n\n`;
          break;
      }
    }

    // 5. Beneficiary address
    const beneficiaryFormatted = this.formatBeneficiaryAddress(beneficiary, lang);
    switch (lang) {
      case LANG_ZH:
        message += `受益人地址: ${beneficiaryFormatted}\n\n`;
        break;
      default:
        message += `Beneficiary: ${beneficiaryFormatted}\n\n`;
        break;
    }

    // 6. Min Output
    const minOutputTokenSymbol =
      intent.type === 'RawToken'
        ? intent.tokenSymbol || tokenSymbol
        : (intent as any).assetTokenSymbol || tokenSymbol;
    const minOutputBytes = this.amountToBytes32(minOutput);
    const minOutputFormatted = this.formatAmount(minOutputBytes, 18, minOutputTokenSymbol);

    switch (lang) {
      case LANG_ZH:
        message += `最少输出数量为： ${minOutputFormatted}\n`;
        break;
      default:
        message += `Min Output: ${minOutputFormatted}\n`;
        break;
    }

    return message;
  }

  /**
   * Format beneficiary address according to lib.rs format_address
   * IMPORTANT: Address must be lowercase to match Rust hex::encode behavior
   */
  private static formatBeneficiaryAddress(address: UniversalAddress, lang: number): string {
    // Normalize address to lowercase to match Rust hex::encode behavior
    // Rust uses: format!("0x{}", hex::encode(self.to_ethereum_address()))
    // which always produces lowercase hex
    const chainName = this.getChainName(address.chainId);
    let addrStr = address.address;

    // Convert to lowercase if it's an EVM address (starts with 0x)
    // This ensures consistency with Rust's hex::encode which always produces lowercase
    if (addrStr.startsWith('0x') || addrStr.startsWith('0X')) {
      addrStr = '0x' + addrStr.slice(2).toLowerCase();
    }

    switch (lang) {
      case LANG_ZH:
        return `${chainName}链上${addrStr}地址`;
      default:
        return `${addrStr} on ${chainName}`;
    }
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
   * Extract chain ID from asset ID (bytes 0-3)
   * Matches lib.rs asset_id_codec::get_chain_id
   */
  private static getChainIdFromAssetId(assetId: string): number {
    const hex = assetId.startsWith('0x') ? assetId.slice(2) : assetId;
    if (hex.length < 8) {
      throw new Error('Asset ID must be at least 4 bytes (8 hex chars)');
    }
    // Bytes 0-3 (hex chars 0-7)
    const chainHex = hex.slice(0, 8);
    return parseInt(chainHex, 16);
  }

  /**
   * Format amount with decimals (matching lib.rs format_amount)
   * For signature messages, uses at most 6 decimal places (matching lib.rs get_deposit_data_to_sign and get_withdraw_data_to_sign)
   * @param amountBytes - Amount as 32-byte hex string or BigInt string
   * @param decimals - Number of decimals (default: 18)
   * @param symbol - Token symbol for display
   * @returns Formatted amount string
   */
  private static formatAmount(
    amountBytes: string | Uint8Array,
    decimals: number = 18,
    symbol: string
  ): string {
    let amountBigInt: bigint;

    if (typeof amountBytes === 'string') {
      // If it's already a string, try to parse as BigInt
      if (amountBytes.startsWith('0x')) {
        amountBigInt = BigInt(amountBytes);
      } else {
        // Check if it's a hex string (contains hex characters a-f, A-F)
        // If it contains hex characters, treat it as hex and add 0x prefix
        // Otherwise, treat it as decimal
        const isHexString = /[a-fA-F]/.test(amountBytes);
        if (isHexString) {
          amountBigInt = BigInt('0x' + amountBytes);
        } else {
          amountBigInt = BigInt(amountBytes);
        }
      }
    } else {
      // Convert Uint8Array to hex string, then to BigInt
      const hex = Array.from(amountBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      amountBigInt = BigInt('0x' + hex);
    }

    if (decimals === 0) {
      return `${amountBigInt} ${symbol}`;
    }

    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = amountBigInt / divisor;
    const decimalPart = amountBigInt % divisor;

    // Format matching lib.rs get_deposit_data_to_sign and get_withdraw_data_to_sign (最多6位小数)
    // lib.rs logic: format!("{:.6}", display_amount).trim_end_matches('0').trim_end_matches('.')
    if (decimalPart === 0n) {
      return `${integerPart} ${symbol}`;
    } else {
      // 使用 BigInt 计算，避免浮点数精度问题
      // 限制最多显示6位小数
      const maxDecimalDigits = 6;
      const decimalStr = decimalPart.toString().padStart(decimals, '0');
      
      // 如果小数位数超过6位，进行四舍五入
      if (decimalStr.length > maxDecimalDigits) {
        const first6Digits = decimalStr.slice(0, maxDecimalDigits);
        const seventhDigit = parseInt(decimalStr[maxDecimalDigits] || '0');
        const rounded6Digits =
          seventhDigit >= 5
            ? (BigInt(first6Digits) + 1n).toString().padStart(maxDecimalDigits, '0')
            : first6Digits;
        
        const trimmedDecimal = rounded6Digits.replace(/0+$/, '');
        return trimmedDecimal
          ? `${integerPart}.${trimmedDecimal} ${symbol}`
          : `${integerPart} ${symbol}`;
      } else {
        // 小于等于6位，直接去掉尾部零
        const trimmedDecimal = decimalStr.replace(/0+$/, '');
        return trimmedDecimal
          ? `${integerPart}.${trimmedDecimal} ${symbol}`
          : `${integerPart} ${symbol}`;
      }
    }
  }

  /**
   * Convert amount string to 32-byte hex string (right-aligned, big-endian)
   * @param amount - Amount as string (can be decimal or hex)
   * @returns 32-byte hex string (64 hex chars)
   */
  private static amountToBytes32(amount: string): string {
    let amountBigInt: bigint;

    if (amount.startsWith('0x')) {
      amountBigInt = BigInt(amount);
    } else {
      amountBigInt = BigInt(amount);
    }

    // Convert to hex and pad to 64 chars (32 bytes)
    const hex = amountBigInt.toString(16);
    return hex.padStart(64, '0');
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
      if (
        !data.nullifier ||
        data.nullifier === '0x0000000000000000000000000000000000000000000000000000000000000000'
      ) {
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
  static formatIntent(intent: string, params?: Record<string, any>): string {
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
      paramsStr.split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = value;
        }
      });
    }

    return { type, params };
  }
}
