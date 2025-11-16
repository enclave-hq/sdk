/**
 * Utility for building WithdrawInput structure matching lib.rs get_withdraw_data_to_sign
 * 
 * This module constructs the WithdrawInput structure from SDK allocations and checkbooks,
 * which can then be used to generate the withdrawal signature message.
 */

import { Allocation, Checkbook, Intent, UniversalAddress } from '../types/models';
import { CommitmentCore } from './CommitmentCore';

/**
 * Credential structure matching lib.rs Credential
 */
export interface Credential {
  left_hashes: string[];  // Array of hex strings (32 bytes each)
  right_hashes: string[]; // Array of hex strings (32 bytes each)
  deposit_id: string;      // 32 bytes hex string
  chain_id: number;       // SLIP-44 chain ID
  token_key: string;       // Token key (e.g., "USDT", "USDC")
}

/**
 * Allocation with credential matching lib.rs AllocationWithCredential
 */
export interface AllocationWithCredential {
  allocation: {
    seq: number;          // 0-255
    amount: string;        // 32 bytes hex string (U256)
  };
  credential: Credential;
}

/**
 * Allocations from commitment matching lib.rs AllocationsFromCommitment
 */
export interface AllocationsFromCommitment {
  allocations: AllocationWithCredential[];
  root_before_commitment: string;  // 32 bytes hex string
  commitments_after: string[];     // Array of 32 bytes hex strings
}

/**
 * WithdrawInput matching lib.rs WithdrawInput
 */
export interface WithdrawInput {
  commitment_groups: AllocationsFromCommitment[];
  owner_address: UniversalAddress;
  intent: Intent;
}

/**
 * Options for building WithdrawInput
 */
export interface BuildWithdrawInputOptions {
  /** Minimum output amount (32 bytes hex string, default: all zeros) */
  min_output?: string;
  /** Language code (default: 1 = English) */
  lang?: number;
  /** Source chain name (optional) */
  source_chain_name?: string;
  /** Target chain name (optional) */
  target_chain_name?: string;
}

/**
 * Build WithdrawInput from allocations and checkbooks
 * 
 * This function groups allocations by checkbook, builds credentials for each allocation,
 * and constructs the WithdrawInput structure that matches lib.rs get_withdraw_data_to_sign.
 * 
 * @param allocations - Array of allocations to withdraw
 * @param checkbooks - Map of checkbook ID to Checkbook object (must include commitment)
 * @param ownerAddress - Owner's universal address
 * @param intent - Withdrawal intent (RawToken or AssetToken)
 * @param options - Optional parameters
 * @returns WithdrawInput structure ready for signature generation
 */
export function buildWithdrawInput(
  allocations: Allocation[],
  checkbooks: Map<string, Checkbook>,
  ownerAddress: UniversalAddress,
  intent: Intent,
  _options: BuildWithdrawInputOptions = {}
): WithdrawInput {
  if (allocations.length === 0) {
    throw new Error('At least one allocation is required');
  }

  // Group allocations by checkbook
  const allocationsByCheckbook = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const checkbookId = allocation.checkbookId;
    if (!checkbookId) {
      throw new Error(`Allocation ${allocation.id} has no checkbookId`);
    }

    if (!allocationsByCheckbook.has(checkbookId)) {
      allocationsByCheckbook.set(checkbookId, []);
    }
    allocationsByCheckbook.get(checkbookId)!.push(allocation);
  }

  // Build commitment groups
  const commitmentGroups: AllocationsFromCommitment[] = [];

  for (const [checkbookId, checkbookAllocations] of allocationsByCheckbook) {
    const checkbook = checkbooks.get(checkbookId);
    if (!checkbook) {
      throw new Error(`Checkbook ${checkbookId} not found in checkbooks map`);
    }

    // Get commitment from checkbook
    const commitment = checkbook.commitment;
    if (!commitment) {
      throw new Error(
        `Checkbook ${checkbookId} has no commitment. ` +
        `Cannot build withdraw input. Checkbook status: ${checkbook.status}`
      );
    }

    // Get token key from checkbook token
    const tokenKey = checkbook.token?.symbol;
    if (!tokenKey) {
      throw new Error(`Checkbook ${checkbookId} has no token.symbol (token_key)`);
    }

    // Get deposit ID from checkbook
    const localDepositId = checkbook.localDepositId;
    if (localDepositId === undefined || localDepositId === null) {
      throw new Error(`Checkbook ${checkbookId} has no localDepositId`);
    }

    // Convert localDepositId (uint64) to 32 bytes hex string
    const depositIdHex = '0x' + BigInt(localDepositId).toString(16).padStart(64, '0');

    // Get chain ID from checkbook
    const chainId = checkbook.token?.chainId;
    if (chainId === undefined) {
      throw new Error(`Checkbook ${checkbookId} has no token.chainId`);
    }

    // Sort allocations by seq (important for credential generation)
    const sortedAllocations = [...checkbookAllocations].sort((a, b) => a.seq - b.seq);

    // Build credentials for each allocation
    const allocationsWithCredential: AllocationWithCredential[] = [];

    for (let i = 0; i < sortedAllocations.length; i++) {
      const allocation = sortedAllocations[i];
      if (!allocation) {
        continue;
      }

      // Helper function to convert amount string to Uint8Array (32 bytes)
      const amountToBytes = (amountStr: string): Uint8Array => {
        let amountHex: string;
        if (amountStr.startsWith('0x')) {
          amountHex = amountStr.slice(2).padStart(64, '0');
        } else {
          const amountBigInt = BigInt(amountStr);
          amountHex = amountBigInt.toString(16).padStart(64, '0');
        }
        if (amountHex.length > 64) {
          throw new Error(`Amount is too large: ${amountHex.length / 2} bytes, max 32 bytes`);
        }
        return Buffer.from(amountHex, 'hex');
      };

      // Build left_hashes (allocations before current)
      const leftHashes: string[] = [];
      for (let j = 0; j < i; j++) {
        const leftAlloc = sortedAllocations[j];
        if (!leftAlloc) {
          continue;
        }
        // Hash allocation: keccak256(seq || amount)
        const hash = CommitmentCore.hashAllocation({
          seq: leftAlloc.seq,
          amount: amountToBytes(leftAlloc.amount),
        });
        leftHashes.push('0x' + Buffer.from(hash).toString('hex'));
      }

      // Build right_hashes (allocations after current)
      const rightHashes: string[] = [];
      for (let j = i + 1; j < sortedAllocations.length; j++) {
        const rightAlloc = sortedAllocations[j];
        if (!rightAlloc) {
          continue;
        }
        // Hash allocation: keccak256(seq || amount)
        const hash = CommitmentCore.hashAllocation({
          seq: rightAlloc.seq,
          amount: amountToBytes(rightAlloc.amount),
        });
        rightHashes.push('0x' + Buffer.from(hash).toString('hex'));
      }

      // Build credential
      const credential: Credential = {
        left_hashes: leftHashes,
        right_hashes: rightHashes,
        deposit_id: depositIdHex,
        chain_id: chainId,
        token_key: tokenKey,
      };

      // Convert amount to 32 bytes hex string if needed
      let amountHex: string;
      if (allocation.amount.startsWith('0x')) {
        // Already hex, pad to 64 chars (32 bytes)
        amountHex = allocation.amount.slice(2).padStart(64, '0');
        if (amountHex.length > 64) {
          throw new Error(`Allocation ${allocation.id} amount is too large (${amountHex.length / 2} bytes, max 32 bytes)`);
        }
        amountHex = '0x' + amountHex;
      } else {
        // Decimal string, convert to hex
        const amountBigInt = BigInt(allocation.amount);
        amountHex = '0x' + amountBigInt.toString(16).padStart(64, '0');
        if (amountHex.length > 66) { // 0x + 64 chars
          throw new Error(`Allocation ${allocation.id} amount is too large`);
        }
      }

      allocationsWithCredential.push({
        allocation: {
          seq: allocation.seq,
          amount: amountHex,
        },
        credential,
      });
    }

    // Build commitment group
    // Note: For now, we use the commitment as root_before_commitment
    // and empty commitments_after. In a full implementation, we would need
    // to track the queue state to get the actual root_before_commitment and commitments_after.
    const commitmentGroup: AllocationsFromCommitment = {
      allocations: allocationsWithCredential,
      root_before_commitment: commitment.startsWith('0x') ? commitment : '0x' + commitment,
      commitments_after: [], // Empty for now - would need queue state
    };

    commitmentGroups.push(commitmentGroup);
  }

  // Build WithdrawInput
  const withdrawInput: WithdrawInput = {
    commitment_groups: commitmentGroups,
    owner_address: ownerAddress,
    intent,
  };

  return withdrawInput;
}

/**
 * Convert WithdrawInput to JSON format for ZKVM service
 * 
 * This function converts the TypeScript WithdrawInput structure to the JSON format
 * expected by the ZKVM service's get_withdraw_data_to_sign endpoint.
 * 
 * @param withdrawInput - WithdrawInput structure
 * @param options - Options including min_output, lang, chain names
 * @returns JSON-serializable object ready for ZKVM service
 */
export function withdrawInputToZKVMFormat(
  withdrawInput: WithdrawInput,
  options: BuildWithdrawInputOptions = {}
): any {
  const {
    min_output = '0x' + '0'.repeat(64), // Default: all zeros (32 bytes)
    lang = 1, // Default: English
    source_chain_name,
    target_chain_name,
  } = options;

  // Convert intent to ZKVM format
  let intentFormat: any;
  if (withdrawInput.intent.type === 'RawToken') {
    intentFormat = {
      RawToken: {
        beneficiary: {
          chain_id: withdrawInput.intent.beneficiary.chainId,
          address: withdrawInput.intent.beneficiary.data || withdrawInput.intent.beneficiary.address,
        },
        token_symbol: withdrawInput.intent.tokenSymbol || 'UNKNOWN',
      },
    };
  } else if (withdrawInput.intent.type === 'AssetToken') {
    // Convert assetId to 32 bytes hex string
    let assetIdBytes32: string;
    if (withdrawInput.intent.assetId.startsWith('0x')) {
      assetIdBytes32 = withdrawInput.intent.assetId.slice(2).padStart(64, '0');
      if (assetIdBytes32.length > 64) {
        throw new Error(`Invalid asset ID length: ${assetIdBytes32.length / 2} bytes, expected 32 bytes`);
      }
      assetIdBytes32 = '0x' + assetIdBytes32;
    } else {
      // Assume it's already a hex string without 0x
      assetIdBytes32 = '0x' + withdrawInput.intent.assetId.padStart(64, '0');
    }

    intentFormat = {
      AssetToken: {
        asset_id: assetIdBytes32,
        beneficiary: {
          chain_id: withdrawInput.intent.beneficiary.chainId,
          address: withdrawInput.intent.beneficiary.data || withdrawInput.intent.beneficiary.address,
        },
        asset_token_symbol: withdrawInput.intent.assetTokenSymbol || 'UNKNOWN',
      },
    };
  } else {
    throw new Error(`Unsupported intent type: ${(withdrawInput.intent as any).type}`);
  }

  // Convert commitment groups to ZKVM format
  const commitmentGroupsFormat = withdrawInput.commitment_groups.map((group) => ({
    allocations: group.allocations.map((allocWithCred) => ({
      allocation: {
        seq: allocWithCred.allocation.seq,
        amount: allocWithCred.allocation.amount,
      },
      credential: {
        left_hashes: allocWithCred.credential.left_hashes,
        right_hashes: allocWithCred.credential.right_hashes,
        deposit_id: allocWithCred.credential.deposit_id,
        chain_id: allocWithCred.credential.chain_id,
        token_key: allocWithCred.credential.token_key,
      },
    })),
    root_before_commitment: group.root_before_commitment,
    commitments_after: group.commitments_after,
  }));

  // Convert owner address to ZKVM format
  const ownerAddressFormat = {
    chain_id: withdrawInput.owner_address.chainId,
    address: withdrawInput.owner_address.data || withdrawInput.owner_address.address,
  };

  return {
    withdraw_input: {
      commitment_groups: commitmentGroupsFormat,
      owner_address: ownerAddressFormat,
      intent: intentFormat,
    },
    source_token_symbol: withdrawInput.commitment_groups[0]?.allocations[0]?.credential.token_key || 'UNKNOWN',
    min_output: min_output,
    lang: lang,
    source_chain_name: source_chain_name || null,
    target_chain_name: target_chain_name || null,
  };
}

