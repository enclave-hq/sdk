/**
 * Withdraw Status Utilities
 * Helper functions for mapping and checking WithdrawRequest statuses
 */

import {
  WithdrawRequest,
  WithdrawRequestStatus,
  WithdrawRequestFrontendStatus,
} from '../types/models';

/**
 * Map backend status to frontend display status
 */
export function mapToFrontendStatus(
  backendStatus: WithdrawRequestStatus
): WithdrawRequestFrontendStatus {
  const mapping: Record<WithdrawRequestStatus, WithdrawRequestFrontendStatus> = {
    // Stage 1: Proof Generation
    [WithdrawRequestStatus.Created]: WithdrawRequestFrontendStatus.Proving,
    [WithdrawRequestStatus.Proving]: WithdrawRequestFrontendStatus.Proving,
    [WithdrawRequestStatus.ProofFailed]: WithdrawRequestFrontendStatus.Failed,
    [WithdrawRequestStatus.ProofGenerated]: WithdrawRequestFrontendStatus.Submitting,

    // Stage 2: On-chain Verification
    [WithdrawRequestStatus.Submitting]: WithdrawRequestFrontendStatus.Submitting,
    [WithdrawRequestStatus.SubmitFailed]: WithdrawRequestFrontendStatus.Failed,
    [WithdrawRequestStatus.VerifyFailed]: WithdrawRequestFrontendStatus.FailedPermanent,
    [WithdrawRequestStatus.Submitted]: WithdrawRequestFrontendStatus.Pending,
    [WithdrawRequestStatus.ExecuteConfirmed]: WithdrawRequestFrontendStatus.Processing,

    // Stage 3: Intent Execution
    [WithdrawRequestStatus.WaitingForPayout]: WithdrawRequestFrontendStatus.Processing,
    [WithdrawRequestStatus.PayoutProcessing]: WithdrawRequestFrontendStatus.Processing,
    [WithdrawRequestStatus.PayoutFailed]: WithdrawRequestFrontendStatus.Failed,
    [WithdrawRequestStatus.PayoutCompleted]: WithdrawRequestFrontendStatus.Processing,

    // Stage 4: Hook Purchase
    [WithdrawRequestStatus.HookProcessing]: WithdrawRequestFrontendStatus.Processing,
    [WithdrawRequestStatus.HookFailed]: WithdrawRequestFrontendStatus.Completed,

    // Terminal States
    [WithdrawRequestStatus.Completed]: WithdrawRequestFrontendStatus.Completed,
    [WithdrawRequestStatus.CompletedWithHookFailed]: WithdrawRequestFrontendStatus.Completed,
    [WithdrawRequestStatus.FailedPermanent]: WithdrawRequestFrontendStatus.FailedPermanent,
    [WithdrawRequestStatus.ManuallyResolved]: WithdrawRequestFrontendStatus.Completed, // ⭐ Manually resolved = completed
    [WithdrawRequestStatus.Cancelled]: WithdrawRequestFrontendStatus.Failed,
  };

  return mapping[backendStatus] || WithdrawRequestFrontendStatus.Failed;
}

/**
 * Get user-friendly status display text
 */
export function getStatusDisplayText(
  wr: WithdrawRequest,
  locale: 'en' | 'zh' | 'ja' | 'ko' = 'en'
): string {
  const texts: Record<WithdrawRequestFrontendStatus, Record<'en' | 'zh' | 'ja' | 'ko', string>> = {
    [WithdrawRequestFrontendStatus.Proving]: {
      en: 'Generating proof...',
      zh: '生成证明中...',
      ja: '証明を生成中...',
      ko: '증명 생성 중...',
    },
    [WithdrawRequestFrontendStatus.Submitting]: {
      en: 'Submitting to blockchain...',
      zh: '提交链上中...',
      ja: 'ブロックチェーンに提出中...',
      ko: '블록체인에 제출 중...',
    },
    [WithdrawRequestFrontendStatus.Pending]: {
      en: 'Waiting for confirmation...',
      zh: '等待链上确认...',
      ja: '確認待ち...',
      ko: '확인 대기 중...',
    },
    [WithdrawRequestFrontendStatus.Processing]: {
      en: 'Processing transfer...',
      zh: '转账中...',
      ja: '送金処理中...',
      ko: '전송 처리 중...',
    },
    [WithdrawRequestFrontendStatus.Completed]: {
      en: 'Completed',
      zh: '已完成',
      ja: '完了',
      ko: '완료',
    },
    [WithdrawRequestFrontendStatus.Failed]: {
      en: 'Failed',
      zh: '失败',
      ja: '失敗',
      ko: '실패',
    },
    [WithdrawRequestFrontendStatus.FailedPermanent]: {
      en: 'Permanently failed',
      zh: '永久失败',
      ja: '永久的に失敗',
      ko: '영구 실패',
    },
  };

  return texts[wr.frontendStatus][locale];
}

/**
 * Check if withdrawal request can be retried
 */
export function canRetry(wr: WithdrawRequest): boolean {
  // Stage 1: Proof failed - can retry
  if (wr.status === WithdrawRequestStatus.ProofFailed) {
    return true;
  }

  // Stage 2: Submit failed (RPC/network error) - can retry
  if (wr.status === WithdrawRequestStatus.SubmitFailed) {
    return true;
  }

  // Stage 2: Verify failed (proof invalid) - cannot retry
  if (wr.status === WithdrawRequestStatus.VerifyFailed) {
    return false;
  }

  // ⭐ Simplified design: Payout/Hook/Fallback failures are not retried automatically
  // They are marked as failed_permanent and require manual resolution
  // Stage 3-4: Payout or Hook failed - cannot retry (waiting for manual resolution)
  if (
    wr.status === WithdrawRequestStatus.PayoutFailed ||
    wr.status === WithdrawRequestStatus.HookFailed ||
    wr.status === WithdrawRequestStatus.FailedPermanent
  ) {
    return false; // ⭐ No automatic retry, waiting for manual resolution
  }

  return false;
}

/**
 * Check if withdrawal request can be cancelled
 */
export function canCancel(wr: WithdrawRequest): boolean {
  // Stage 1: Proof failed - can cancel
  if (wr.status === WithdrawRequestStatus.ProofFailed) {
    return true;
  }

  // Stage 2: Submit failed - can cancel
  if (wr.status === WithdrawRequestStatus.SubmitFailed) {
    return true;
  }

  // Stage 2: Verify failed - MUST cancel (only option)
  if (wr.status === WithdrawRequestStatus.VerifyFailed) {
    return true;
  }

  // After execute confirmed, cannot cancel (nullifiers consumed)
  return false;
}

/**
 * Check if withdrawal request is completed
 */
export function isCompleted(wr: WithdrawRequest): boolean {
  return (
    wr.status === WithdrawRequestStatus.Completed ||
    wr.status === WithdrawRequestStatus.CompletedWithHookFailed ||
    wr.status === WithdrawRequestStatus.ManuallyResolved // ⭐ Manually resolved = completed
  );
}

/**
 * Check if withdrawal request is failed
 */
export function isFailed(wr: WithdrawRequest): boolean {
  return (
    wr.status === WithdrawRequestStatus.ProofFailed ||
    wr.status === WithdrawRequestStatus.SubmitFailed ||
    wr.status === WithdrawRequestStatus.VerifyFailed ||
    wr.status === WithdrawRequestStatus.PayoutFailed ||
    wr.status === WithdrawRequestStatus.HookFailed ||
    wr.status === WithdrawRequestStatus.FailedPermanent
  );
}

/**
 * Check if withdrawal request is in terminal state
 */
export function isTerminal(wr: WithdrawRequest): boolean {
  return (
    wr.status === WithdrawRequestStatus.Completed ||
    wr.status === WithdrawRequestStatus.CompletedWithHookFailed ||
    wr.status === WithdrawRequestStatus.FailedPermanent ||
    wr.status === WithdrawRequestStatus.ManuallyResolved || // ⭐ Terminal state
    wr.status === WithdrawRequestStatus.Cancelled
  );
}

/**
 * Get current stage (1-4)
 */
export function getCurrentStage(wr: WithdrawRequest): 1 | 2 | 3 | 4 {
  const stageMapping: Record<WithdrawRequestStatus, 1 | 2 | 3 | 4> = {
    [WithdrawRequestStatus.Created]: 1,
    [WithdrawRequestStatus.Proving]: 1,
    [WithdrawRequestStatus.ProofFailed]: 1,
    [WithdrawRequestStatus.ProofGenerated]: 2,
    [WithdrawRequestStatus.Submitting]: 2,
    [WithdrawRequestStatus.SubmitFailed]: 2,
    [WithdrawRequestStatus.VerifyFailed]: 2,
    [WithdrawRequestStatus.Submitted]: 2,
    [WithdrawRequestStatus.ExecuteConfirmed]: 3,
    [WithdrawRequestStatus.WaitingForPayout]: 3,
    [WithdrawRequestStatus.PayoutProcessing]: 3,
    [WithdrawRequestStatus.PayoutFailed]: 3,
    [WithdrawRequestStatus.PayoutCompleted]: 3,
    [WithdrawRequestStatus.HookProcessing]: 4,
    [WithdrawRequestStatus.HookFailed]: 4,
    [WithdrawRequestStatus.Completed]: 4,
    [WithdrawRequestStatus.CompletedWithHookFailed]: 4,
    [WithdrawRequestStatus.FailedPermanent]: 3,
    [WithdrawRequestStatus.ManuallyResolved]: 4, // ⭐ Terminal state
    [WithdrawRequestStatus.Cancelled]: 1,
  };

  return stageMapping[wr.status] || 1;
}

/**
 * Get progress percentage (0-100)
 */
export function getProgressPercentage(wr: WithdrawRequest): number {
  if (wr.status === WithdrawRequestStatus.Completed) {
    return 100;
  }

  const stage = getCurrentStage(wr);

  // Stage 1: 0-25%
  if (stage === 1) {
    if (wr.status === WithdrawRequestStatus.Proving) return 15;
    if (wr.status === WithdrawRequestStatus.ProofGenerated) return 25;
    return 0;
  }

  // Stage 2: 25-50%
  if (stage === 2) {
    if (wr.status === WithdrawRequestStatus.Submitting) return 35;
    if (wr.status === WithdrawRequestStatus.Submitted) return 45;
    if (wr.status === WithdrawRequestStatus.ExecuteConfirmed) return 50;
    return 25;
  }

  // Stage 3: 50-80%
  if (stage === 3) {
    if (wr.status === WithdrawRequestStatus.WaitingForPayout) return 60;
    if (wr.status === WithdrawRequestStatus.PayoutProcessing) return 70;
    if (wr.status === WithdrawRequestStatus.PayoutCompleted) return 80;
    return 50;
  }

  // Stage 4: 80-100%
  if (wr.status === WithdrawRequestStatus.HookProcessing) return 90;

  return 80;
}

/**
 * Get user-friendly error description based on status
 */
export function getErrorDescription(
  wr: WithdrawRequest,
  locale: 'en' | 'zh' | 'ja' | 'ko' = 'en'
): string | undefined {
  const descriptions: Record<string, Record<'en' | 'zh' | 'ja' | 'ko', string>> = {
    proof_failed: {
      en: 'Proof generation failed. Please try again.',
      zh: '证明生成失败，请重试。',
      ja: '証明の生成に失敗しました。再試行してください。',
      ko: '증명 생성 실패. 다시 시도해주세요.',
    },
    submit_failed: {
      en: 'Network error. Please retry submission.',
      zh: '网络错误，请重试提交。',
      ja: 'ネットワークエラー。再送信してください。',
      ko: '네트워크 오류. 제출을 다시 시도해주세요.',
    },
    verify_failed: {
      en: 'Proof verification failed. Please cancel and create a new request.',
      zh: '证明验证失败，请取消并创建新请求。',
      ja: '証明の検証に失敗しました。キャンセルして新しいリクエストを作成してください。',
      ko: '증명 검증 실패. 취소하고 새 요청을 생성해주세요.',
    },
    payout_failed: {
      en: 'Payout failed. Waiting for manual resolution by admin.',
      zh: '转账失败，等待管理员人工处理。',
      ja: '支払いに失敗しました。管理者による手動解決を待っています。',
      ko: '지급 실패. 관리자의 수동 해결을 기다리는 중입니다.',
    },
    hook_failed: {
      en: 'Hook purchase failed. Waiting for manual resolution by admin.',
      zh: 'Hook 购买失败，等待管理员人工处理。',
      ja: 'Hook購入に失敗しました。管理者による手動解決を待っています。',
      ko: 'Hook 구매 실패. 관리자의 수동 해결을 기다리는 중입니다.',
    },
    failed_permanent: {
      en: 'Permanently failed. Waiting for manual resolution by admin.',
      zh: '永久失败，等待管理员人工处理。',
      ja: '永久的に失敗しました。管理者による手動解決を待っています。',
      ko: '영구 실패. 관리자의 수동 해결을 기다리는 중입니다.',
    },
  };

  const statusKey = wr.status as string;
  return descriptions[statusKey]?.[locale];
}

/**
 * Get recommended retry action
 */
export function getRetryAction(
  wr: WithdrawRequest
): 'retry_execute' | 'retry_payout' | 'retry_hook' | 'cancel' | null {
  if (wr.status === WithdrawRequestStatus.ProofFailed) {
    return 'cancel'; // User should recreate the request
  }
  if (wr.status === WithdrawRequestStatus.SubmitFailed) {
    return 'retry_execute';
  }
  if (wr.status === WithdrawRequestStatus.VerifyFailed) {
    return 'cancel'; // MUST cancel, cannot retry
  }
  // ⭐ Simplified design: Payout/Hook/Fallback failures are not retried automatically
  // They are marked as failed_permanent and require manual resolution
  if (
    wr.status === WithdrawRequestStatus.PayoutFailed ||
    wr.status === WithdrawRequestStatus.HookFailed ||
    wr.status === WithdrawRequestStatus.FailedPermanent
  ) {
    return null; // ⭐ No retry action, waiting for manual resolution
  }
  return null;
}
