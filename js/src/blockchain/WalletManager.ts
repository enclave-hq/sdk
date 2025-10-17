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

/**
 * Wallet manager configuration
 */
export interface WalletManagerConfig {
  /** Signer input */
  signer: SignerInput;
  /** User's universal address (optional, will be derived if not provided) */
  address?: UniversalAddress;
  /** Default chain ID */
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
    this.defaultChainId = config.chainId || 1; // Default to Ethereum mainnet

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
      throw new SignerError(
        `Failed to get address: ${(error as Error).message}`
      );
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
   * Sign message hash
   * @param messageHash - Message hash to sign
   * @returns Signature
   */
  async signMessage(messageHash: string): Promise<string> {
    try {
      const signature = await this.signerAdapter.signMessage(messageHash);
      this.logger.debug('Message signed successfully');
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);
      throw new SignerError(
        `Failed to sign message: ${(error as Error).message}`
      );
    }
  }

  /**
   * Sign authentication message
   * @param message - Authentication message
   * @returns Signature
   */
  async signAuthMessage(message: string): Promise<string> {
    // For authentication, we sign the raw message
    // The backend will verify the signature
    return this.signMessage(message);
  }

  /**
   * Set default chain ID
   * @param chainId - Chain ID
   */
  setDefaultChainId(chainId: number): void {
    this.defaultChainId = chainId;
    
    // Update address if already cached
    if (this.address) {
      this.address = {
        ...this.address,
        chainId,
      };
    }
  }

  /**
   * Get default chain ID
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

