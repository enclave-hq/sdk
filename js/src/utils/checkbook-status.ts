/**
 * Checkbook status utility functions
 * @module utils/checkbook-status
 */

import { CheckbookStatus } from '../types/models';

/**
 * Check if a checkbook can create commitment
 * @param status - Checkbook status
 * @returns True if commitment can be created
 */
export function canCreateCommitment(status: CheckbookStatus): boolean {
  return (
    status === CheckbookStatus.ReadyForCommitment ||
    status === CheckbookStatus.Unsigned ||
    status === CheckbookStatus.WithCheckbook ||
    status === CheckbookStatus.GeneratingProof ||
    status === CheckbookStatus.SubmittingCommitment ||
    status === CheckbookStatus.SubmissionFailed ||
    status === CheckbookStatus.ProofFailed
  );
}

/**
 * Check if a checkbook can create allocations
 * @param status - Checkbook status
 * @returns True if allocations can be created
 */
export function canCreateAllocations(status: CheckbookStatus): boolean {
  return status === CheckbookStatus.ReadyForCommitment || status === CheckbookStatus.WithCheckbook;
}

/**
 * Check if a checkbook is in a failed state that can be retried
 * @param status - Checkbook status
 * @returns True if the status indicates a retryable failure
 */
export function isRetryableFailure(status: CheckbookStatus): boolean {
  return status === CheckbookStatus.ProofFailed || status === CheckbookStatus.SubmissionFailed;
}

/**
 * Check if a checkbook is in a processing state
 * @param status - Checkbook status
 * @returns True if the checkbook is currently being processed
 */
export function isProcessing(status: CheckbookStatus): boolean {
  return (
    status === CheckbookStatus.Pending ||
    status === CheckbookStatus.Unsigned ||
    status === CheckbookStatus.GeneratingProof ||
    status === CheckbookStatus.SubmittingCommitment ||
    status === CheckbookStatus.CommitmentPending
  );
}







