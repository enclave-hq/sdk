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
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Universal address object
 */
export function createUniversalAddress(
  address: string,
  chainId: number = 1
): UniversalAddress {
  if (!isValidAddress(address)) {
    throw new ValidationError('Invalid Ethereum address', 'address');
  }

  const checksumAddress = toChecksumAddress(address);
  const slip44 = getSlip44FromChainId(chainId);

  return {
    chainId,
    chainName: getChainName(chainId),
    address: checksumAddress,
    universalFormat: checksumAddress,
    slip44: slip44 ?? undefined,
  };
}

/**
 * Parse universal address string (format: "chainId:address")
 * @param addressString - Address string to parse
 * @returns Universal address object
 * @throws ValidationError if invalid format
 */
export function parseUniversalAddress(
  addressString: string
): UniversalAddress {
  const parts = addressString.split(':');

  if (parts.length !== 2) {
    throw new ValidationError(
      'Universal address must be in format "chainId:address"',
      'addressString'
    );
  }

  const chainIdPart = parts[0];
  const addressPart = parts[1];

  if (!chainIdPart || !addressPart) {
    throw new ValidationError(
      'Universal address must be in format "chainId:address"',
      'addressString'
    );
  }

  const chainId = parseInt(chainIdPart, 10);
  if (isNaN(chainId) || chainId <= 0) {
    throw new ValidationError('Invalid chain ID in universal address', 'chainId');
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
 * Format universal address to string (format: "chainId:address")
 * @param universalAddress - Universal address object
 * @returns Formatted string
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

