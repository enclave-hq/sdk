/**
 * Cryptographic utility functions
 * @module utils/crypto
 */

import { keccak256 as ethersKeccak256 } from 'ethers';
import { ValidationError } from './errors';

/**
 * Compute Keccak256 hash of data
 * @param data - Data to hash (can be string or Uint8Array)
 * @returns Hash as hex string with 0x prefix
 */
export function keccak256(data: string | Uint8Array): string {
  try {
    if (typeof data === 'string') {
      // If it's already a hex string, use it directly
      if (data.startsWith('0x')) {
        return ethersKeccak256(data);
      }
      // Otherwise, convert to bytes first
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      return ethersKeccak256(bytes);
    }
    return ethersKeccak256(data);
  } catch (error) {
    throw new ValidationError(
      `Failed to compute keccak256 hash: ${(error as Error).message}`,
      'data'
    );
  }
}

/**
 * Ensure hex string has 0x prefix
 * @param hex - Hex string
 * @returns Hex string with 0x prefix
 */
export function ensureHexPrefix(hex: string): string {
  if (!hex) return '0x';
  return hex.startsWith('0x') ? hex : `0x${hex}`;
}

/**
 * Remove 0x prefix from hex string
 * @param hex - Hex string
 * @returns Hex string without 0x prefix
 */
export function removeHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/**
 * Validate hex string format
 * @param hex - String to validate
 * @param length - Expected length (optional, in bytes)
 * @returns True if valid hex string
 */
export function isValidHex(hex: string, length?: number): boolean {
  if (!hex || typeof hex !== 'string') return false;

  const cleaned = removeHexPrefix(hex);
  const hexRegex = /^[0-9a-fA-F]*$/;

  if (!hexRegex.test(cleaned)) return false;

  if (length !== undefined) {
    return cleaned.length === length * 2; // 2 hex chars per byte
  }

  return cleaned.length % 2 === 0; // Must be even length
}

/**
 * Validate Ethereum address format
 * @param address - Address to validate
 * @returns True if valid address
 */
export function isValidAddress(address: string): boolean {
  return isValidHex(address, 20); // Ethereum address is 20 bytes
}

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = removeHexPrefix(hex);

  if (!isValidHex(cleaned)) {
    throw new ValidationError('Invalid hex string', 'hex');
  }

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  }

  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Byte array
 * @param prefix - Whether to include 0x prefix (default: true)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix: boolean = true): string {
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return prefix ? `0x${hex}` : hex;
}

/**
 * Generate a random hex string
 * @param length - Length in bytes (default: 32)
 * @returns Random hex string with 0x prefix
 */
export function randomHex(length: number = 32): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    window.crypto.getRandomValues(bytes);
  } else if (typeof global !== 'undefined' && global.crypto) {
    // Node.js 19+ with webcrypto
    global.crypto.getRandomValues(bytes);
  } else {
    // Fallback: generate pseudo-random values
    // This is not cryptographically secure, but ensures the function works
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * Pad hex string to specified length
 * @param hex - Hex string
 * @param length - Target length in bytes
 * @returns Padded hex string
 */
export function padHex(hex: string, length: number): string {
  const cleaned = removeHexPrefix(hex);
  const targetLength = length * 2;

  if (cleaned.length > targetLength) {
    throw new ValidationError(`Hex string too long: ${cleaned.length} > ${targetLength}`, 'hex');
  }

  return ensureHexPrefix(cleaned.padStart(targetLength, '0'));
}

/**
 * Concatenate multiple hex strings
 * @param hexStrings - Array of hex strings
 * @returns Concatenated hex string with 0x prefix
 */
export function concatHex(...hexStrings: string[]): string {
  const cleaned = hexStrings.map(h => removeHexPrefix(h)).join('');
  return ensureHexPrefix(cleaned);
}

/**
 * XOR two hex strings of equal length
 * @param hex1 - First hex string
 * @param hex2 - Second hex string
 * @returns XOR result as hex string
 */
export function xorHex(hex1: string, hex2: string): string {
  const bytes1 = hexToBytes(hex1);
  const bytes2 = hexToBytes(hex2);

  if (bytes1.length !== bytes2.length) {
    throw new ValidationError('Hex strings must be of equal length for XOR', 'hex');
  }

  const result = new Uint8Array(bytes1.length);
  for (let i = 0; i < bytes1.length; i++) {
    const b1 = bytes1[i];
    const b2 = bytes2[i];
    if (b1 !== undefined && b2 !== undefined) {
      result[i] = b1 ^ b2;
    }
  }

  return bytesToHex(result);
}
