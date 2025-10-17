/**
 * Signer adapter for flexible signature handling
 * @module blockchain/SignerAdapter
 */

import { Wallet } from 'ethers';
import type { ISigner, SignerInput, SignerCallback } from '../types/config';
import { SignerError } from '../utils/errors';
import {
  validateNonEmptyString,
  validateHex,
} from '../utils/validation';
import { ensureHexPrefix } from '../utils/crypto';

/**
 * Signer adapter that unifies different signing methods
 * Supports: private key, callback function, and Signer objects
 */
export class SignerAdapter implements ISigner {
  private signer: ISigner | null = null;
  private callback: SignerCallback | null = null;
  private address: string | null = null;

  constructor(input: SignerInput) {
    this.initializeSigner(input);
  }

  /**
   * Initialize signer from input
   */
  private initializeSigner(input: SignerInput): void {
    // Case 1: Private key string
    if (typeof input === 'string') {
      this.initializeFromPrivateKey(input);
    }
    // Case 2: Callback function
    else if (typeof input === 'function') {
      this.callback = input;
    }
    // Case 3: Signer object (ethers.js Signer or compatible)
    else if (typeof input === 'object' && input !== null) {
      this.signer = input;
    }
    else {
      throw new SignerError('Invalid signer input: must be private key, callback, or Signer object');
    }
  }

  /**
   * Initialize signer from private key
   */
  private initializeFromPrivateKey(privateKey: string): void {
    try {
      validateNonEmptyString(privateKey, 'privateKey');
      
      // Ensure 0x prefix
      const formattedKey = ensureHexPrefix(privateKey);
      
      // Create ethers Wallet instance
      this.signer = new Wallet(formattedKey);
    } catch (error) {
      throw new SignerError(
        `Failed to initialize signer from private key: ${(error as Error).message}`
      );
    }
  }

  /**
   * Sign a message hash
   * @param messageHash - Hash to sign (hex string with 0x prefix)
   * @returns Signature (hex string with 0x prefix)
   */
  async signMessage(messageHash: string): Promise<string> {
    validateNonEmptyString(messageHash, 'messageHash');
    validateHex(messageHash, 'messageHash');

    const formattedHash = ensureHexPrefix(messageHash);

    try {
      // Use callback if available
      if (this.callback) {
        const signature = await this.callback(formattedHash);
        return ensureHexPrefix(signature);
      }

      // Use Signer object
      if (this.signer) {
        const signature = await this.signer.signMessage(formattedHash);
        return ensureHexPrefix(signature);
      }

      throw new SignerError('No signing method available');
    } catch (error) {
      throw new SignerError(
        `Failed to sign message: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get the signer's address
   * @returns Address (hex string with 0x prefix)
   */
  async getAddress(): Promise<string> {
    // Return cached address if available
    if (this.address) {
      return this.address;
    }

    try {
      // Get address from Signer object
      if (this.signer) {
        this.address = await this.signer.getAddress();
        return this.address;
      }

      // For callback-based signers, address must be provided separately
      throw new SignerError(
        'Cannot derive address from callback signer. Please provide address in config.'
      );
    } catch (error) {
      throw new SignerError(
        `Failed to get address: ${(error as Error).message}`
      );
    }
  }

  /**
   * Set address manually (for callback-based signers)
   * @param address - Signer address
   */
  setAddress(address: string): void {
    validateNonEmptyString(address, 'address');
    this.address = ensureHexPrefix(address);
  }

  /**
   * Check if signer has address cached
   */
  hasAddress(): boolean {
    return this.address !== null;
  }

  /**
   * Get signer type
   */
  getSignerType(): 'privateKey' | 'callback' | 'signerObject' {
    if (this.callback) return 'callback';
    if (this.signer) return 'signerObject';
    return 'privateKey';
  }

  /**
   * Check if signer is ready
   */
  isReady(): boolean {
    return this.signer !== null || this.callback !== null;
  }

  /**
   * Create signer adapter from private key
   * @param privateKey - Private key (hex string)
   * @returns SignerAdapter instance
   */
  static fromPrivateKey(privateKey: string): SignerAdapter {
    return new SignerAdapter(privateKey);
  }

  /**
   * Create signer adapter from callback
   * @param callback - Signing callback function
   * @param address - Optional signer address
   * @returns SignerAdapter instance
   */
  static fromCallback(callback: SignerCallback, address?: string): SignerAdapter {
    const adapter = new SignerAdapter(callback);
    if (address) {
      adapter.setAddress(address);
    }
    return adapter;
  }

  /**
   * Create signer adapter from Signer object
   * @param signer - Signer object (ethers.js Signer or compatible)
   * @returns SignerAdapter instance
   */
  static fromSigner(signer: ISigner): SignerAdapter {
    return new SignerAdapter(signer);
  }
}

