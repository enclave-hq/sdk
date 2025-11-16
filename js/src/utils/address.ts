/**
 * Address formatting and conversion utilities
 * @module utils/address
 */

import { getAddress as ethersGetAddress } from 'ethers';
import { ValidationError } from './errors';
import { isValidAddress } from './crypto';
import { getChainName, getSlip44FromChainId } from './chain';
import type { UniversalAddress } from '../types/models';

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
    throw new ValidationError(
      `Invalid Ethereum address: ${address}`,
      'address'
    );
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
/**
 * Convert 20-byte EVM address to 32-byte Universal Address format
 * Right-aligns the address in 32 bytes (left-pads with zeros)
 * @param address - 20-byte EVM address
 * @returns 32-byte hex string (64 hex chars, no 0x prefix)
 */
function addressToUniversalFormat(address: string): string {
  // Remove 0x prefix if present
  const hex = address.startsWith('0x') ? address.slice(2) : address;
  
  // Convert to buffer (20 bytes for Ethereum address)
  const addressBuf = Buffer.from(hex, 'hex');
  
  if (addressBuf.length !== 20) {
    throw new ValidationError('Address must be 20 bytes', 'address');
  }
  
  // Right-align in 32 bytes (left-pad with zeros)
  const result = Buffer.allocUnsafe(32);
  result.fill(0);
  addressBuf.copy(result, 12); // Copy to bytes 12-31 (right-aligned)
  
  return result.toString('hex'); // Return as hex string without 0x prefix
}

export function createUniversalAddress(
  address: string,
  chainId: number = 714  // Default to BSC (SLIP-44: 714)
): UniversalAddress {
  if (!isValidAddress(address)) {
    throw new ValidationError('Invalid Ethereum address', 'address');
  }

  const checksumAddress = toChecksumAddress(address);
  const slip44 = getSlip44FromChainId(chainId);
  
  // Convert 20-byte EVM address to 32-byte Universal Address format
  const universalFormat = addressToUniversalFormat(checksumAddress);

  return {
    chainId,
    chainName: getChainName(chainId),
    address: checksumAddress, // Keep 20-byte address for backward compatibility
    universalFormat: '0x' + universalFormat, // 32-byte Universal Address format
    slip44: slip44 ?? undefined,
  };
}

/**
 * Parse universal address string (format: "slip44_chain_id:address")
 * @param addressString - Address string to parse (format: "slip44_chain_id:address")
 *                        Example: "714:0x1234..." (BSC) or "60:0x1234..." (Ethereum)
 * @returns Universal address object
 * @throws ValidationError if invalid format
 */
export function parseUniversalAddress(
  addressString: string
): UniversalAddress {
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

  if (!isValidAddress(addressPart)) {
    throw new ValidationError(
      'Invalid address in universal address',
      'address'
    );
  }

  return createUniversalAddress(addressPart, chainId);
}

/**
 * Format universal address to string (format: "slip44_chain_id:address")
 * @param universalAddress - Universal address object (chainId should be SLIP-44 chain ID)
 * @returns Formatted string (format: "slip44_chain_id:address")
 */
export function formatUniversalAddress(
  universalAddress: UniversalAddress
): string {
  return `${universalAddress.chainId}:${universalAddress.address}`;
}

/**
 * Compare two universal addresses
 * @param addr1 - First universal address
 * @param addr2 - Second universal address
 * @returns True if addresses are equal
 */
export function universalAddressEquals(
  addr1: UniversalAddress,
  addr2: UniversalAddress
): boolean {
  return (
    addr1.chainId === addr2.chainId &&
    addressEquals(addr1.address, addr2.address)
  );
}

/**
 * Validate universal address format
 * @param address - Universal address to validate
 * @returns True if valid
 */
export function isValidUniversalAddress(
  address: UniversalAddress
): boolean {
  try {
    return (
      typeof address === 'object' &&
      address !== null &&
      typeof address.chainId === 'number' &&
      address.chainId > 0 &&
      typeof address.address === 'string' &&
      isValidAddress(address.address)
    );
  } catch {
    return false;
  }
}

/**
 * Extract address from universal address
 * @param universalAddress - Universal address object
 * @returns Plain address string
 */
export function extractAddress(universalAddress: UniversalAddress): string {
  return universalAddress.address;
}

/**
 * Extract chain ID from universal address
 * @param universalAddress - Universal address object
 * @returns Chain ID
 */
export function extractChainId(universalAddress: UniversalAddress): number {
  return universalAddress.chainId;
}

