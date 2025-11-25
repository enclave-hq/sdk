/**
 * Commitment Core utilities - matching lib.rs CommitmentCore exactly
 * Core cryptographic operations for commitment, nullifier, and credential generation
 * @module utils/CommitmentCore
 */

import {
  keccak256,
  hexToBytes as cryptoHexToBytes,
  bytesToHex as cryptoBytesToHex,
} from './crypto';
import type { UniversalAddress } from '../types/models';

/**
 * Allocation with sequence and amount (matching lib.rs Allocation)
 */
export interface Allocation {
  seq: number; // 0-255
  amount: Uint8Array; // 32 bytes (U256)
}

/**
 * Credential structure (matching lib.rs Credential)
 */
export interface Credential {
  left_hashes: Uint8Array[]; // Array of 32-byte hashes
  right_hashes: Uint8Array[]; // Array of 32-byte hashes
  deposit_id: Uint8Array; // 32 bytes
  chain_id: number; // u32
  token_id: number; // u16
}

/**
 * Commitment Core - matching lib.rs CommitmentCore exactly
 * Core cryptographic operations using native byte arrays
 */
export class CommitmentCore {
  /**
   * Validate allocation sequence (must be different, consecutive, starting from 0)
   * Matching lib.rs validate_allocation_sequence
   */
  static validateAllocationSequence(allocations: Allocation[]): boolean {
    if (allocations.length === 0) {
      return false;
    }

    // Create a copy and sort by seq
    const sorted = [...allocations].sort((a, b) => a.seq - b.seq);

    // Check that seq must start from 0 and be consecutive
    for (let i = 0; i < sorted.length; i++) {
      const allocation = sorted[i];
      if (!allocation || allocation.seq !== i) {
        return false;
      }
    }

    return true;
  }

  /**
   * Hash a single allocation
   * Matching lib.rs hash_allocation
   * Hash = keccak256(seq (1 byte) || amount (32 bytes))
   */
  static hashAllocation(allocation: Allocation): Uint8Array {
    const seqBuf = Buffer.from([allocation.seq]);
    const amountBuf = Buffer.from(allocation.amount);
    const data = Buffer.concat([seqBuf, amountBuf]);
    const hash = keccak256(data);
    return cryptoHexToBytes(hash);
  }

  /**
   * Generate commitment with owner (matching lib.rs generate_commitment_with_owner)
   *
   * Format:
   * 1. Hash deposit_id (32 bytes)
   * 2. Hash chain_id (4 bytes, big-endian)
   * 3. Hash token_key_hash (32 bytes, keccak256(token_key))
   * 4. Hash owner_address.chain_id (4 bytes, big-endian)
   * 5. Hash owner_address.data (32 bytes)
   * 6. Hash each allocation (after sorting by seq)
   *    - For each allocation: hash_allocation(allocation)
   *    - Then hash all allocation hashes
   *
   * @param allocations - Array of allocations
   * @param ownerAddress - Owner's universal address
   * @param depositId - Deposit ID (32 bytes)
   * @param chainId - Chain ID (u32)
   * @param tokenKey - Token key string (e.g., "USDT", "USDC")
   * @returns Commitment hash (32 bytes)
   */
  static generateCommitmentWithOwner(
    allocations: Allocation[],
    ownerAddress: UniversalAddress,
    depositId: Uint8Array,
    chainId: number,
    tokenKey: string
  ): Uint8Array {
    // Validate sequence
    if (!this.validateAllocationSequence(allocations)) {
      throw new Error('❌ 分配序号必须不同、连续且从0开始');
    }

    // Convert to buffers for hashing
    const depositIdBuf = Buffer.from(depositId);
    const chainIdBuf = Buffer.allocUnsafe(4);
    chainIdBuf.writeUInt32BE(chainId, 0);

    // Calculate token_key_hash: keccak256(token_key.as_bytes())
    // Matching lib.rs: let token_key_hash: [u8; 32] = Keccak256::digest(input_token_key.as_bytes()).into();
    const tokenKeyHash = keccak256(Buffer.from(tokenKey, 'utf-8'));
    const tokenKeyHashBuf = Buffer.from(tokenKeyHash);

    const ownerChainIdBuf = Buffer.allocUnsafe(4);
    ownerChainIdBuf.writeUInt32BE(ownerAddress.chainId, 0);

    // Convert owner address to 32 bytes (right-aligned, left-padded with zeros)
    const ownerDataBuf = this.addressToBytes32(ownerAddress.address);

    // Sort allocations by seq
    const sortedAllocations = [...allocations].sort((a, b) => a.seq - b.seq);

    // Hash each allocation first
    const allocationHashes: Uint8Array[] = [];
    for (const allocation of sortedAllocations) {
      allocationHashes.push(this.hashAllocation(allocation));
    }

    // Build the final hash
    const data = Buffer.concat([
      depositIdBuf, // 32 bytes
      chainIdBuf, // 4 bytes
      tokenKeyHashBuf, // 32 bytes (keccak256(token_key))
      ownerChainIdBuf, // 4 bytes
      ownerDataBuf, // 32 bytes
      ...allocationHashes.map(h => Buffer.from(h)), // All allocation hashes
    ]);

    const hash = keccak256(data);
    return cryptoHexToBytes(hash);
  }

  /**
   * Generate nullifier (matching lib.rs generate_nullifier)
   *
   * Format: keccak256(commitment (32 bytes) || allocation.seq (1 byte) || allocation.amount (32 bytes))
   *
   * @param commitment - Commitment hash (32 bytes)
   * @param allocation - Allocation
   * @returns Nullifier hash (32 bytes)
   */
  static generateNullifier(commitment: Uint8Array, allocation: Allocation): Uint8Array {
    const commitmentBuf = Buffer.from(commitment);
    const seqBuf = Buffer.from([allocation.seq]);
    const amountBuf = Buffer.from(allocation.amount);

    const data = Buffer.concat([
      commitmentBuf, // 32 bytes
      seqBuf, // 1 byte
      amountBuf, // 32 bytes
    ]);

    const hash = keccak256(data);
    return cryptoHexToBytes(hash);
  }

  /**
   * Generate commitment from credential (matching lib.rs generate_commitment_from_credential)
   *
   * Rebuilds the full commitment from a single allocation + credential
   *
   * @param allocation - Current allocation
   * @param ownerAddress - Owner address
   * @param credential - Credential with left_hashes, right_hashes, deposit_id, chain_id, token_id
   * @returns Commitment hash (32 bytes)
   */
  static generateCommitmentFromCredential(
    allocation: Allocation,
    ownerAddress: UniversalAddress,
    credential: Credential
  ): Uint8Array {
    const depositIdBuf = Buffer.from(credential.deposit_id);
    const chainIdBuf = Buffer.allocUnsafe(4);
    chainIdBuf.writeUInt32BE(credential.chain_id, 0);
    const tokenIdBuf = Buffer.allocUnsafe(2);
    tokenIdBuf.writeUInt16BE(credential.token_id, 0);
    const ownerChainIdBuf = Buffer.allocUnsafe(4);
    ownerChainIdBuf.writeUInt32BE(ownerAddress.chainId, 0);
    const ownerDataBuf = this.addressToBytes32(ownerAddress.address);

    // Hash all allocations in order: left_hashes + current + right_hashes
    const allocationHashes: Uint8Array[] = [];

    // Left hashes (before current allocation)
    for (const leftHash of credential.left_hashes) {
      allocationHashes.push(new Uint8Array(leftHash));
    }

    // Current allocation hash
    allocationHashes.push(this.hashAllocation(allocation));

    // Right hashes (after current allocation)
    for (const rightHash of credential.right_hashes) {
      allocationHashes.push(new Uint8Array(rightHash));
    }

    const data = Buffer.concat([
      depositIdBuf,
      chainIdBuf,
      tokenIdBuf,
      ownerChainIdBuf,
      ownerDataBuf,
      ...allocationHashes.map(h => Buffer.from(h)),
    ]);

    const hash = keccak256(data);
    return cryptoHexToBytes(hash);
  }

  /**
   * Generate nullifier from credential (matching lib.rs generate_nullifier_from_credential)
   *
   * Convenience function: rebuild commitment from credential, then generate nullifier
   *
   * @param allocation - Current allocation
   * @param ownerAddress - Owner address
   * @param credential - Credential
   * @returns Nullifier hash (32 bytes)
   */
  static generateNullifierFromCredential(
    allocation: Allocation,
    ownerAddress: UniversalAddress,
    credential: Credential
  ): Uint8Array {
    // Step 1: Rebuild commitment from credential
    const commitment = this.generateCommitmentFromCredential(allocation, ownerAddress, credential);

    // Step 2: Generate nullifier
    return this.generateNullifier(commitment, allocation);
  }

  /**
   * Generate nullifier from allocations (matching lib.rs generate_nullifier_from_allocations)
   *
   * Convenience function: generate commitment from all allocations, then generate nullifier for target
   *
   * @param allAllocations - All allocations
   * @param ownerAddress - Owner address
   * @param depositId - Deposit ID (32 bytes)
   * @param chainId - Chain ID
   * @param tokenKey - Token key string (e.g., "USDT", "USDC")
   * @param targetAllocation - Target allocation to generate nullifier for
   * @returns Nullifier hash (32 bytes)
   */
  static generateNullifierFromAllocations(
    allAllocations: Allocation[],
    ownerAddress: UniversalAddress,
    depositId: Uint8Array,
    chainId: number,
    tokenKey: string,
    targetAllocation: Allocation
  ): Uint8Array {
    // Step 1: Generate commitment
    const commitment = this.generateCommitmentWithOwner(
      allAllocations,
      ownerAddress,
      depositId,
      chainId,
      tokenKey
    );

    // Step 2: Generate nullifier
    return this.generateNullifier(commitment, targetAllocation);
  }

  /**
   * Generate nullifiers batch (matching lib.rs generate_nullifiers_batch)
   *
   * Generate all nullifiers for all allocations (performance optimized - only compute commitment once)
   *
   * @param allocations - All allocations
   * @param ownerAddress - Owner address
   * @param depositId - Deposit ID (32 bytes)
   * @param chainId - Chain ID
   * @param tokenKey - Token key string (e.g., "USDT", "USDC")
   * @returns Array of nullifier hashes (32 bytes each)
   */
  static generateNullifiersBatch(
    allocations: Allocation[],
    ownerAddress: UniversalAddress,
    depositId: Uint8Array,
    chainId: number,
    tokenKey: string
  ): Uint8Array[] {
    // Step 1: Generate commitment once (performance optimization)
    const commitment = this.generateCommitmentWithOwner(
      allocations,
      ownerAddress,
      depositId,
      chainId,
      tokenKey
    );

    // Step 2: Generate nullifier for each allocation
    return allocations.map(allocation => this.generateNullifier(commitment, allocation));
  }

  /**
   * Convert address string to 32 bytes (right-aligned, left-padded with zeros)
   * Matching lib.rs UniversalAddress.data format
   */
  private static addressToBytes32(address: string): Buffer {
    // Remove 0x prefix if present
    const hex = address.startsWith('0x') ? address.slice(2) : address;

    // Convert to buffer (20 bytes for Ethereum address)
    const addressBuf = Buffer.from(hex, 'hex');

    // Right-align in 32 bytes (left-pad with zeros)
    const result = Buffer.allocUnsafe(32);
    result.fill(0);
    addressBuf.copy(result, 12); // Copy to bytes 12-31 (right-aligned)

    return result;
  }

  /**
   * Convert hex string to Uint8Array (re-export from crypto utils)
   */
  static hexToBytes(hex: string): Uint8Array {
    return cryptoHexToBytes(hex);
  }

  /**
   * Convert Uint8Array to hex string (re-export from crypto utils)
   */
  static bytesToHex(bytes: Uint8Array): string {
    return cryptoBytesToHex(bytes);
  }

  /**
   * Convert string amount to Uint8Array (32 bytes, big-endian)
   */
  static amountToBytes32(amount: string | bigint): Uint8Array {
    const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
    const buf = Buffer.allocUnsafe(32);
    buf.fill(0);

    // Convert to hex and pad to 64 hex chars (32 bytes)
    const hex = amountBigInt.toString(16).padStart(64, '0');
    const hexBuf = Buffer.from(hex, 'hex');
    hexBuf.copy(buf, 32 - hexBuf.length); // Right-align (big-endian)

    return new Uint8Array(buf);
  }

  /**
   * Convert Uint8Array (32 bytes) to bigint
   */
  static bytes32ToBigInt(bytes: Uint8Array): bigint {
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
  }
}
