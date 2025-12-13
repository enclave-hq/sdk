/**
 * Address formatting and conversion utilities
 * @module utils/address
 */

import { getAddress as ethersGetAddress } from 'ethers';
import { ValidationError } from './errors';
import { isValidAddress } from './crypto';
import { getChainName, getSlip44FromChainId, getChainType } from './chain';
import type { UniversalAddress } from '../types/models';
import {
  evmConverter,
  tronConverter,
  type AddressConverter,
  ChainType,
} from '@enclave-hq/chain-utils';

// Re-export for backward compatibility
export { getChainName };

/**
 * Normalize Ethereum address to checksum format
 * @param address - Ethereum address
 * @returns Checksum address
 * @throws ValidationError if invalid address
 */
export function toChecksumAddress(address: string): string {
  try {
    return ethersGetAddress(address);
  } catch (error) {
    throw new ValidationError(`Invalid Ethereum address: ${address}`, 'address');
  }
}

/**
 * Check if two addresses are equal (case-insensitive)
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns True if addresses are equal
 */
export function addressEquals(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;
  return addr1.toLowerCase() === addr2.toLowerCase();
}

/**
 * Format address for display (shortened)
 * @param address - Address to format
 * @param startChars - Number of chars to show at start (default: 6)
 * @param endChars - Number of chars to show at end (default: 4)
 * @returns Formatted address (e.g., "0x1234...5678")
 */
export function formatAddressShort(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return '';

  if (address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Create universal address from Ethereum address
 * @param address - Ethereum address
 * @param chainId - SLIP-44 chain ID (default: 714 for BSC)
 *                  Note: If EVM chain ID is provided, it will be converted to SLIP-44
 * @returns Universal address object
 */
export function createUniversalAddress(
  address: string,
  chainId: number = 714 // Default to BSC (SLIP-44: 714)
): UniversalAddress {
  console.log('[createUniversalAddress] 📋 输入参数:', {
    address,
    chainId,
    addressLength: address.length,
    addressStartsWithT: address.startsWith('T'),
  });
  
  // Get chain type to determine which converter to use
  const chainType = getChainType(chainId);
  const slip44 = getSlip44FromChainId(chainId) ?? chainId;
  
  console.log('[createUniversalAddress] 🔧 链信息:', {
    chainType,
    slip44,
    originalChainId: chainId,
  });

  // Select appropriate address converter based on chain type
  let converter: AddressConverter;
  let validatedAddress: string;

  // Check if address format matches TRON (T... 34 chars) - do this first as fallback
  const isTronFormat =
    address.length === 34 &&
    address.startsWith('T') &&
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(address);

  console.log('[createUniversalAddress] 🔍 地址格式检查:', {
    isTronFormat,
    addressLength: address.length,
    startsWithT: address.startsWith('T'),
    chainType,
  });

  // If address looks like TRON format, use TRON converter regardless of chainType
  // This handles cases where getChainType might return null for chainId 195
  if (isTronFormat) {
    console.log('[createUniversalAddress] ✅ 识别为 TRON 地址格式，使用 TRON converter');
    converter = tronConverter;
    if (!tronConverter.isValid(address)) {
      throw new ValidationError('Invalid TRON address', 'address');
    }
    validatedAddress = address;
  } else if (chainType === ChainType.TRON) {
    console.log('[createUniversalAddress] ✅ chainType 为 TRON，使用 TRON converter');
    converter = tronConverter;
    // Validate TRON address format
    if (!tronConverter.isValid(address)) {
      throw new ValidationError('Invalid TRON address', 'address');
    }
    validatedAddress = address; // Keep original Base58 address for TRON
  } else if (chainType === ChainType.EVM) {
    console.log('[createUniversalAddress] ✅ chainType 为 EVM，使用 EVM converter');
    converter = evmConverter;
    // Validate EVM address format
    if (!isValidAddress(address)) {
      throw new ValidationError('Invalid EVM address', 'address');
    }
    validatedAddress = toChecksumAddress(address);
  } else {
    console.log('[createUniversalAddress] ⚠️ chainType 未知，默认使用 EVM converter');
    // For unknown chain types, default to EVM format
    converter = evmConverter;
    if (!isValidAddress(address)) {
      throw new ValidationError('Invalid address format', 'address');
    }
    validatedAddress = toChecksumAddress(address);
  }
  
  console.log('[createUniversalAddress] 🔧 转换器选择:', {
    converterType: converter === tronConverter ? 'TRON' : 'EVM',
    validatedAddress,
  });

  // Convert address to 32-byte format using chain-utils
  const addressBytes = converter.toBytes(validatedAddress);
  console.log('[createUniversalAddress] 🔧 地址转换为 bytes:', {
    addressBytesLength: addressBytes.length,
    addressBytesPreview: Array.from(addressBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ') + '...',
  });

  // Convert to universal format (32 bytes as hex string)
  const universalFormatHex =
    '0x' +
    Array.from(addressBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padStart(64, '0'); // Ensure 32 bytes (64 hex chars)

  const result = {
    chainId: slip44,
    chainName: getChainName(chainId),
    universalFormat: universalFormatHex, // 32-byte Universal Address format
    data: universalFormatHex, // 32-byte Universal Address (required by backend API)
    slip44: slip44,
  };
  
  // Extract display address for logging
  let extractedDisplayAddress = 'N/A'
  try {
    extractedDisplayAddress = extractDisplayAddress(result)
  } catch (e) {
    // Ignore extraction error for logging
  }
  
  console.log('[createUniversalAddress] ✅ 创建 UniversalAddress 结果:', {
    chainId: result.chainId,
    slip44: result.slip44,
    data: result.data,
    dataLength: result.data.length,
    extractedAddress: extractedDisplayAddress,
  });

  return result;
}

/**
 * Parse universal address string (format: "slip44_chain_id:address")
 * @param addressString - Address string to parse (format: "slip44_chain_id:address")
 *                        Example: "714:0x1234..." (BSC), "60:0x1234..." (Ethereum), or "195:TW9nWM2AAewQyLV4xtysTtKJM2En2jyiW9" (TRON)
 * @returns Universal address object
 * @throws ValidationError if invalid format
 */
export function parseUniversalAddress(addressString: string): UniversalAddress {
  const parts = addressString.split(':');

  if (parts.length !== 2) {
    throw new ValidationError(
      'Universal address must be in format "slip44_chain_id:address"',
      'addressString'
    );
  }

  const chainIdPart = parts[0];
  const addressPart = parts[1];

  if (!chainIdPart || !addressPart) {
    throw new ValidationError(
      'Universal address must be in format "slip44_chain_id:address"',
      'addressString'
    );
  }

  const chainId = parseInt(chainIdPart, 10);
  if (isNaN(chainId) || chainId <= 0) {
    throw new ValidationError('Invalid SLIP-44 chain ID in universal address', 'chainId');
  }

  // Don't validate address format here - let createUniversalAddress handle it
  // This allows TRON addresses (Base58) and EVM addresses (0x...) to both work
  // createUniversalAddress will validate the address format based on chain type
  return createUniversalAddress(addressPart, chainId);
}

/**
 * Convert Universal Address to TRON Base58 address
 * This is the unified utility function for all TRON address conversions
 * Uses chain-utils tronConverter, which prioritizes TronWeb when available
 * 
 * @param universalAddress - Universal address object (must have chainId=195 and data field)
 * @returns TRON Base58 address (starts with T)
 * @throws Error if conversion fails
 */
export function convertUniversalAddressToTronAddress(universalAddress: UniversalAddress): string {
  if (universalAddress.chainId !== 195) {
    throw new Error(`Invalid chain ID for TRON conversion: expected 195, got ${universalAddress.chainId}`);
  }

  if (!universalAddress.data) {
    throw new Error('UniversalAddress.data is required for TRON address conversion');
  }

  const dataHex = universalAddress.data.replace(/^0x/, '');
  if (dataHex.length !== 64) {
    throw new Error(`Invalid data length: expected 64 (32-byte) hex chars, got ${dataHex.length}`);
  }

  const universalBytes = new Uint8Array(
    dataHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  
  // Use chain-utils tronConverter (prioritizes TronWeb when available)
  try {
    const tronAddress = tronConverter.fromBytes(universalBytes, true); // useTronWeb = true
    console.log('[convertUniversalAddressToTronAddress] ✅ 转换 TRON 地址成功:', {
      tronAddress,
      universalData: dataHex,
    });
    return tronAddress;
  } catch (error) {
    console.error('[convertUniversalAddressToTronAddress] ❌ TRON 地址转换失败:', error);
    throw new Error(`TRON address conversion failed: ${error instanceof Error ? error.message : String(error)}. Please ensure TronWeb is loaded in browser environment.`);
  }
}

/**
 * Extract display address from UniversalAddress data field
 * @param universalAddress - Universal address object
 * @returns Display address string (EVM hex or TRON Base58)
 */
function extractDisplayAddress(universalAddress: UniversalAddress): string {
  if (!universalAddress.data) {
    throw new Error('UniversalAddress.data is required');
  }

  const dataHex = universalAddress.data.replace(/^0x/, '');
  if (dataHex.length !== 64) {
    throw new Error(`Invalid data length: expected 64 (32-byte) hex chars, got ${dataHex.length}`);
  }

  // For TRON (chainId=195), use unified conversion function
  if (universalAddress.chainId === 195) {
    return convertUniversalAddressToTronAddress(universalAddress);
  } else {
    // For EVM chains, extract last 20 bytes (40 hex chars)
    const addressHex = dataHex.slice(-40);
    return '0x' + addressHex.toLowerCase();
  }
}

/**
 * Format universal address to string (format: "slip44_chain_id:address")
 * @param universalAddress - Universal address object (chainId should be SLIP-44 chain ID)
 * @returns Formatted string (format: "slip44_chain_id:address")
 */
export function formatUniversalAddress(universalAddress: UniversalAddress): string {
  const displayAddr = extractDisplayAddress(universalAddress);
  return `${universalAddress.chainId}:${displayAddr}`;
}

/**
 * Compare two universal addresses
 * @param addr1 - First universal address
 * @param addr2 - Second universal address
 * @returns True if addresses are equal
 */
export function universalAddressEquals(addr1: UniversalAddress, addr2: UniversalAddress): boolean {
  return addr1.chainId === addr2.chainId && addr1.data === addr2.data;
}

/**
 * Validate universal address format
 * @param address - Universal address to validate
 * @returns True if valid
 */
export function isValidUniversalAddress(address: UniversalAddress): boolean {
  try {
    return (
      typeof address === 'object' &&
      address !== null &&
      typeof address.chainId === 'number' &&
      address.chainId > 0 &&
      typeof address.data === 'string' &&
      address.data.startsWith('0x') &&
      address.data.length === 66 // 0x + 64 hex chars (32 bytes)
    );
  } catch {
    return false;
  }
}

/**
 * Extract address from universal address
 * @param universalAddress - Universal address object
 * @returns Plain address string (display format)
 */
export function extractAddress(universalAddress: UniversalAddress): string {
  return extractDisplayAddress(universalAddress);
}

/**
 * Extract chain ID from universal address
 * @param universalAddress - Universal address object
 * @returns Chain ID
 */
export function extractChainId(universalAddress: UniversalAddress): number {
  return universalAddress.chainId;
}
