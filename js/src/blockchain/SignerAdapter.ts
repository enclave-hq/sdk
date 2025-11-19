/**
 * Signer adapter for flexible signature handling
 * @module blockchain/SignerAdapter
 */

import type { ISigner, SignerInput, SignerCallback } from '../types/config';
import { SignerError } from '../utils/errors';
import { validateNonEmptyString } from '../utils/validation';
import { ensureHexPrefix } from '../utils/crypto';
import { EVMPrivateKeyAdapter } from '@enclave-hq/wallet-sdk';

/**
 * Signer adapter that unifies different signing methods
 * Supports:
 * - Private key (string): For EVM chains, delegates to Wallet SDK's EVMPrivateKeyAdapter
 * - Callback function: For custom signing logic (e.g., Wallet SDK's signMessage callback)
 * - Signer objects: Any object implementing ISigner interface
 *   - Wallet SDK adapters (e.g., EVMPrivateKeyAdapter, MetaMaskAdapter, TronLinkAdapter)
 *   - Custom ISigner implementations
 *   - ethers.js Signer (if compatible)
 *
 * Note: Wallet SDK adapters now implement ISigner interface, so they can be used directly.
 * Example: new SignerAdapter(walletManager.getAdapter(WalletType.METAMASK))
 */
export class SignerAdapter implements ISigner {
  private signer: ISigner | null = null;
  private callback: SignerCallback | null = null;
  private address: string | null = null;
  private privateKeyInput: string | null = null;
  private privateKeyInitialized: boolean = false;

  constructor(input: SignerInput) {
    // Note: Private key initialization is now async, but constructor cannot be async
    // We'll handle it lazily when signMessage/getAddress is called
    this.initializeSigner(input);
  }

  /**
   * Initialize signer from input
   */
  private initializeSigner(input: SignerInput): void {
    // Case 1: Private key string
    // Note: This will be initialized lazily (async) when first used
    if (typeof input === 'string') {
      // Store the private key for lazy initialization
      this.privateKeyInput = input;
      // We'll initialize it when signMessage or getAddress is called
    }
    // Case 2: Callback function
    else if (typeof input === 'function') {
      this.callback = input;
    }
    // Case 3: Signer object (ISigner compatible)
    else if (typeof input === 'object' && input !== null) {
      this.signer = input;
    } else {
      throw new SignerError(
        'Invalid signer input: must be private key, callback, or Signer object'
      );
    }
  }

  /**
   * Initialize signer from private key (lazy initialization)
   *
   * Note: This delegates to Wallet SDK's EVMPrivateKeyAdapter.
   * For TRON or other chains, users should use Wallet SDK's callback instead.
   *
   * @deprecated Private key string support is limited to EVM chains.
   *             For multi-chain support, use Wallet SDK's callback or connectWithPrivateKey.
   */
  private async ensurePrivateKeyInitialized(): Promise<void> {
    if (this.privateKeyInitialized || !this.privateKeyInput) {
      return;
    }

    try {
      validateNonEmptyString(this.privateKeyInput, 'privateKey');

      // Ensure 0x prefix
      const formattedKey = ensureHexPrefix(this.privateKeyInput);

      // Delegate to Wallet SDK's EVMPrivateKeyAdapter
      // This removes the direct dependency on ethers.js
      const adapter = new EVMPrivateKeyAdapter();
      adapter.setPrivateKey(formattedKey);

      // Connect to default EVM chain (Ethereum mainnet)
      // Note: This assumes EVM private key. For TRON, users should use Wallet SDK callback.
      const account = await adapter.connect(1); // Default to Ethereum mainnet

      // Wallet SDK adapters now implement ISigner interface directly
      // So we can use the adapter as-is
      this.signer = adapter;

      // Cache the address
      this.address = account.nativeAddress;
      this.privateKeyInitialized = true;
    } catch (error) {
      throw new SignerError(
        `Failed to initialize signer from private key: ${(error as Error).message}. ` +
          `Note: Private key string support is limited to EVM chains. ` +
          `For TRON or other chains, use Wallet SDK's callback or connectWithPrivateKey.`
      );
    }
  }

  /**
   * Sign a message (raw message string, not hash)
   * @param message - Raw message string to sign
   * @returns Signature (hex string with 0x prefix)
   *
   * Note: This method delegates signature standard handling to the signer:
   * - If signer is a callback (e.g., from Wallet SDK), it should handle the signature standard (EIP-191/TIP-191) itself
   * - If signer is ethers.js Wallet, it will automatically add EIP-191 prefix and hash
   * - We pass the raw message as-is to let the signer handle the appropriate standard
   */
  async signMessage(message: string): Promise<string> {
    validateNonEmptyString(message, 'message');

    try {
      // Initialize private key signer if needed (lazy initialization)
      if (this.privateKeyInput && !this.privateKeyInitialized) {
        await this.ensurePrivateKeyInitialized();
      }

      // Use callback if available
      // For callback signers (e.g., Wallet SDK), we pass the raw message
      // The callback should handle the appropriate signature standard (EIP-191 for EVM, TIP-191 for TRON, etc.)
      if (this.callback) {
        // Pass raw message to callback - let the signer (e.g., Wallet SDK) handle signature standard
        // Wallet SDK will automatically choose the correct standard based on chain type
        const signature = await this.callback(message);
        return ensureHexPrefix(signature);
      }

      // Use Signer object (delegates to Wallet SDK's adapter or compatible ISigner)
      if (this.signer) {
        // The signer (from Wallet SDK or compatible) should handle the appropriate signature standard
        // - Wallet SDK's EVMPrivateKeyAdapter uses viem, which handles EIP-191
        // - Other signers should also handle their respective standards
        const signature = await this.signer.signMessage(message);
        return ensureHexPrefix(signature);
      }

      throw new SignerError('No signing method available');
    } catch (error) {
      throw new SignerError(`Failed to sign message: ${(error as Error).message}`);
    }
  }

  /**
   * Get the signer's address
   * @returns Address (hex string with 0x prefix)
   */
  async getAddress(): Promise<string> {
    // Initialize private key signer if needed (lazy initialization)
    if (this.privateKeyInput && !this.privateKeyInitialized) {
      await this.ensurePrivateKeyInitialized();
    }

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
      throw new SignerError(`Failed to get address: ${(error as Error).message}`);
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
   * @param signer - Signer object implementing ISigner interface
   *                 - Wallet SDK adapters (e.g., EVMPrivateKeyAdapter, MetaMaskAdapter, TronLinkAdapter)
   *                 - Custom ISigner implementations
   *                 - ethers.js Signer (if compatible)
   * @returns SignerAdapter instance
   *
   * @example
   * // Using Wallet SDK adapter directly
   * const adapter = walletManager.getAdapter(WalletType.METAMASK);
   * const signer = SignerAdapter.fromSigner(adapter);
   *
   * @example
   * // Using Wallet SDK adapter directly in EnclaveClient
   * const client = new EnclaveClient({
   *   apiUrl: 'https://api.enclave-hq.com',
   *   signer: walletManager.getAdapter(WalletType.METAMASK), // Direct usage
   * });
   */
  static fromSigner(signer: ISigner): SignerAdapter {
    return new SignerAdapter(signer);
  }
}
