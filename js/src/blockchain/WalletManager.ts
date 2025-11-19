/**
 * Wallet manager for blockchain interactions
 * @module blockchain/WalletManager
 */

import type { UniversalAddress } from '../types/models';
import type { SignerInput } from '../types/config';
import { SignerAdapter } from './SignerAdapter';
import { createUniversalAddress } from '../utils/address';
import { SignerError } from '../utils/errors';
import type { ILogger } from '../types/config';
import { getLogger } from '../utils/logger';
import { getSlip44FromChainId } from '../utils/chain';

/**
 * Wallet manager configuration
 */
export interface WalletManagerConfig {
  /** Signer input */
  signer: SignerInput;
  /** User's universal address (optional, will be derived if not provided) */
  address?: UniversalAddress;
  /** Default chain ID (SLIP-44 chain ID, e.g., 714 for BSC, 60 for Ethereum)
   *  If EVM chain ID is provided, it will be automatically converted to SLIP-44
   */
  chainId?: number;
  /** Logger instance */
  logger?: ILogger;
}

/**
 * Manages wallet and signing operations
 */
export class WalletManager {
  private readonly signerAdapter: SignerAdapter;
  private readonly logger: ILogger;
  private address: UniversalAddress | null = null;
  private defaultChainId: number;

  constructor(config: WalletManagerConfig) {
    this.logger = config.logger || getLogger();
    // Default to BSC (SLIP-44: 714) if not provided
    // If provided chainId is EVM chain ID, convert to SLIP-44
    if (config.chainId) {
      const slip44 = getSlip44FromChainId(config.chainId);
      this.defaultChainId = slip44 ?? config.chainId; // Use SLIP-44 if conversion available, otherwise use as-is
    } else {
      this.defaultChainId = 714; // Default to BSC (SLIP-44: 714)
    }

    // Initialize signer adapter
    this.signerAdapter = new SignerAdapter(config.signer);

    // Set address if provided
    if (config.address) {
      this.address = config.address;
      this.signerAdapter.setAddress(config.address.address);
    }

    this.logger.debug('WalletManager initialized');
  }

  /**
   * Get user's universal address
   * @returns Universal address
   */
  async getAddress(): Promise<UniversalAddress> {
    // Return cached address if available
    if (this.address) {
      return this.address;
    }

    try {
      // Get address from signer
      const address = await this.signerAdapter.getAddress();

      // Create universal address
      this.address = createUniversalAddress(address, this.defaultChainId);

      this.logger.info(`Derived address: ${address}`);
      return this.address;
    } catch (error) {
      throw new SignerError(`Failed to get address: ${(error as Error).message}`);
    }
  }

  /**
   * Get raw address string
   * @returns Address string
   */
  async getAddressString(): Promise<string> {
    const universalAddress = await this.getAddress();
    return universalAddress.address;
  }

  /**
   * Sign a message (raw message string, not hash)
   * @param message - Raw message string to sign (ethers.js will add EIP-191 prefix and hash it)
   * @returns Signature
   */
  async signMessage(message: string): Promise<string> {
    try {
      // Pass raw message string to signer adapter
      // ethers.js will automatically add EIP-191 prefix and hash it
      const signature = await this.signerAdapter.signMessage(message);
      this.logger.debug('Message signed successfully');
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);
      throw new SignerError(`Failed to sign message: ${(error as Error).message}`);
    }
  }

  /**
   * Sign authentication message (raw message string)
   * @param message - Authentication message (plain text)
   * @returns Signature
   */
  async signAuthMessage(message: string): Promise<string> {
    // For authentication, we sign the raw message string
    // ethers.js Wallet.signMessage() will hash it internally using EIP-191
    // The backend will verify the signature
    try {
      const signature = await this.signerAdapter.signMessage(message);
      this.logger.debug('Auth message signed successfully');
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign auth message:', error);
      throw new SignerError(`Failed to sign auth message: ${(error as Error).message}`);
    }
  }

  /**
   * Set default chain ID (should be SLIP-44 chain ID)
   * @param chainId - SLIP-44 chain ID (e.g., 714 for BSC, 60 for Ethereum)
   *                  If EVM chain ID is provided, it will be converted to SLIP-44
   */
  setDefaultChainId(chainId: number): void {
    // Convert to SLIP-44 if needed
    const slip44 = getSlip44FromChainId(chainId);
    const finalChainId = slip44 ?? chainId; // Use SLIP-44 if conversion available, otherwise use as-is

    this.defaultChainId = finalChainId;

    // Update address if already cached
    if (this.address) {
      this.address = {
        ...this.address,
        chainId: finalChainId,
      };
    }
  }

  /**
   * Get default chain ID (returns SLIP-44 chain ID)
   * @returns SLIP-44 chain ID (e.g., 714 for BSC, 60 for Ethereum)
   */
  getDefaultChainId(): number {
    return this.defaultChainId;
  }

  /**
   * Check if wallet has address cached
   */
  hasAddress(): boolean {
    return this.address !== null;
  }

  /**
   * Check if wallet is ready
   */
  isReady(): boolean {
    return this.signerAdapter.isReady();
  }

  /**
   * Get signer type
   */
  getSignerType(): 'privateKey' | 'callback' | 'signerObject' {
    return this.signerAdapter.getSignerType();
  }

  /**
   * Update signer
   * @param signer - New signer input
   */
  updateSigner(signer: SignerInput): void {
    // Create new signer adapter
    const newAdapter = new SignerAdapter(signer);

    // Reset address cache
    this.address = null;

    // Replace signer adapter
    Object.assign(this.signerAdapter, newAdapter);

    this.logger.info('Signer updated');
  }

  /**
   * Clear cached address
   */
  clearAddress(): void {
    this.address = null;
    this.logger.debug('Address cache cleared');
  }
}
