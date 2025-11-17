/**
 * Example usage of WithdrawInputBuilder
 * 
 * This file demonstrates how to use buildWithdrawInput to create
 * the WithdrawInput structure that matches lib.rs get_withdraw_data_to_sign.
 */

import { buildWithdrawInput, withdrawInputToZKVMFormat } from './WithdrawInputBuilder';
import type { Allocation, Checkbook, Intent, UniversalAddress } from '../types/models';

/**
 * Example: Build WithdrawInput from allocations and checkbooks
 */
export async function exampleBuildWithdrawInput(
  allocations: Allocation[],
  checkbooks: Map<string, Checkbook>,
  ownerAddress: UniversalAddress,
  intent: Intent
) {
  // Build WithdrawInput structure
  const withdrawInput = buildWithdrawInput(
    allocations,
    checkbooks,
    ownerAddress,
    intent,
    {
      min_output: '0x' + '0'.repeat(64), // Default: all zeros
      lang: 1, // English
      source_chain_name: 'Binance Smart Chain',
      target_chain_name: 'Ethereum',
    }
  );

  // Convert to ZKVM service format
  const zkvmFormat = withdrawInputToZKVMFormat(withdrawInput, {
    min_output: '0x' + '0'.repeat(64),
    lang: 1,
    source_chain_name: 'Binance Smart Chain',
    target_chain_name: 'Ethereum',
  });

  // Now you can send zkvmFormat to ZKVM service's get_withdraw_data_to_sign endpoint
  // The response will be the signature message string

  return {
    withdrawInput,
    zkvmFormat,
  };
}

/**
 * Example: Build WithdrawInput from a single checkbook's allocations
 */
export async function exampleBuildFromSingleCheckbook(
  allocations: Allocation[],
  checkbook: Checkbook,
  ownerAddress: UniversalAddress,
  intent: Intent
) {
  // Create checkbooks map
  const checkbooks = new Map<string, Checkbook>();
  checkbooks.set(checkbook.id, checkbook);

  // Build WithdrawInput
  const withdrawInput = buildWithdrawInput(
    allocations,
    checkbooks,
    ownerAddress,
    intent
  );

  return withdrawInput;
}

/**
 * Example: Build WithdrawInput from multiple checkbooks
 * (when allocations span multiple checkbooks)
 */
export async function exampleBuildFromMultipleCheckbooks(
  allocations: Allocation[],
  checkbookList: Checkbook[],
  ownerAddress: UniversalAddress,
  intent: Intent
) {
  // Create checkbooks map
  const checkbooks = new Map<string, Checkbook>();
  for (const checkbook of checkbookList) {
    checkbooks.set(checkbook.id, checkbook);
  }

  // Build WithdrawInput (will group allocations by checkbook automatically)
  const withdrawInput = buildWithdrawInput(
    allocations,
    checkbooks,
    ownerAddress,
    intent
  );

  return withdrawInput;
}


