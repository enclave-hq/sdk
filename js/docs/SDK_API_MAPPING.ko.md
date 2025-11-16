# Enclave SDK - API 매핑 문서

**Languages**: [English](./SDK_API_MAPPING.md) | [中文](./SDK_API_MAPPING.zh-CN.md) | [日本語](./SDK_API_MAPPING.ja.md) | 한국어

## 개요

이 문서는 Enclave JavaScript SDK API 메서드와 백엔드 REST API 엔드포인트의 상세한 매핑, 그리고 WebSocket 구독 및 메시지 매핑을 설명합니다.

## 📚 목차

- [빠른 참조](#빠른-참조)
- [상태 열거형 사용](#상태-열거형-사용)
- [SDK 구성](#sdk-구성)
- [인증](#인증)
- [서명 아키텍처](#서명-아키텍처)
- [데이터 동기화 메커니즘](#데이터-동기화-메커니즘)
- [Store 메서드 분류](#store-메서드-분류)
- [Checkbook 관련](#checkbook-관련)
- [Allocation 관련](#allocation-관련)
- [커밋먼트 관련](#커밋먼트-관련)
- [출금 관련](#출금-관련)
- [SDK 내부 구현 vs 백엔드 API](#sdk-내부-구현-vs-백엔드-api)
- [상태 시스템](#상태-시스템)

---

## 빠른 참조

### SDK 초기화

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKeyOrSignerCallback,
});

await client.connect();
```

**백엔드 API**: 없음 (클라이언트 측만)

### 일반적인 작업

| SDK 메서드 | 백엔드 API | 설명 |
|------------|-------------|-------------|
| `client.connect()` | `POST /api/auth/login` | 인증 및 연결 수립 |
| `client.disconnect()` | `POST /api/auth/logout` | 연결 해제 및 정리 |
| `client.stores.checkbooks.getByOwner()` | `GET /api/checkbooks` | 사용자 Checkbook 가져오기 |
| `client.stores.allocations.fetchList()` | `GET /api/allocations` | 필터링된 Allocation 가져오기 |
| `client.stores.withdrawals.fetchList()` | `GET /api/withdrawals` | 출금 요청 가져오기 |
| `client.prepareCommitment()` | 없음 (SDK 내부) | 커밋먼트 서명 데이터 준비 |
| `client.submitCommitment()` | `POST /api/commitments` | 서명된 커밋먼트 제출 |
| `client.prepareWithdraw()` | 없음 (SDK 내부) | 출금 서명 데이터 준비 |
| `client.submitWithdraw()` | `POST /api/withdrawals` | 서명된 출금 제출 |

---

## 상태 열거형 사용

SDK는 타입 안전한 상태 처리를 위해 상태 열거형을 내보냅니다:

```typescript
import {
  EnclaveClient,
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave-hq/sdk';

// 1. 타입 안전한 상태 비교
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook이 활성 상태');
}

// 2. 상태로 필터링
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. 상태 흐름 제어
function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}
```

### 상태 열거형 정의

```typescript
// Checkbook 상태
export enum CheckbookStatus {
  Pending = 'pending',                     // 증명 생성 중
  ReadyForCommitment = 'ready_for_commitment', // 증명 준비 완료, 커밋먼트 대기
  WithCheckbook = 'with_checkbook',        // Checkbook 활성화 (커밋먼트 완료)
  ProofFailed = 'proof_failed',            // 증명 생성 실패
}

// Allocation 상태
export enum AllocationStatus {
  Idle = 'idle',       // 새 WithdrawRequest에서 사용 가능
  Pending = 'pending', // 활성 WithdrawRequest에 포함됨
  Used = 'used',       // 성공적으로 출금됨
}

// WithdrawRequest 상태
export enum WithdrawRequestStatus {
  Pending = 'pending',       // 출금 처리 중
  Completed = 'completed',   // 출금 완료 (온체인 스테이지 1 완료)
  Failed = 'failed',         // 출금 실패
}
```

---

## 데이터 동기화 메커니즘

SDK는 **이중 동기화 메커니즘**을 사용합니다:

### 주요: WebSocket 실시간 푸시

- 백엔드 데이터 변경 시 자동으로 업데이트 푸시
- 수동 새로고침 불필요
- Checkbook, Allocation, 출금, 가격의 실시간 업데이트

### 백업: 명시적 쿼리 메서드

- 필요할 때 최신 데이터를 수동으로 가져오기
- 사용 사례:
  - 초기 데이터 로딩
  - WebSocket 연결 끊김 복구
  - 온디맨드 데이터 새로고침
  - 특정 항목 가져오기

**쿼리 메서드**:
```typescript
// 소유자(사용자 주소)로 쿼리
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();
await client.stores.withdrawals.getByOwner();

// ID로 쿼리
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);
await client.stores.withdrawals.getById(withdrawalId);

// 필터가 있는 쿼리
await client.stores.allocations.fetchList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});
```

---

## Store 메서드 분류

각 Store에는 두 가지 유형의 메서드가 있습니다:

### 1. 로컬 (메모리) 쿼리

Store에 이미 있는 데이터에 액세스 (즉시, 네트워크 호출 없음):

```typescript
// Store에서 단일 항목 가져오기
const checkbook = client.stores.checkbooks.get(checkbookId);
const allocation = client.stores.allocations.get(allocationId);

// Store에서 모든 항목 가져오기
const allCheckbooks = client.stores.checkbooks.all;
const allAllocations = client.stores.allocations.all;

// 계산된 속성 (필터링된 뷰)
const idleAllocations = client.stores.allocations.idle;
const pendingWithdrawals = client.stores.withdrawals.pending;
```

### 2. 활성 (API) 쿼리

백엔드에서 최신 데이터 가져오기 (네트워크 호출):

```typescript
// 소유자로 가져오기
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();

// ID로 가져오기
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);

// 필터 및 페이지네이션으로 가져오기
await client.stores.allocations.fetchList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});
```

---

## Checkbook 관련

### `client.stores.checkbooks.getByOwner()`

**설명**: 현재 사용자의 모든 Checkbook 가져오기 (입금 정보 포함)

**백엔드 API**: `GET /api/checkbooks?user_address={address}`

**사용 예제**:
```typescript
// Checkbook 가져오기
await client.stores.checkbooks.getByOwner();

// Store에서 액세스 (옵저버블)
const checkbooks = client.stores.checkbooks.all;
console.log('Checkbooks:', checkbooks);

// 특정 Checkbook 가져오기
const checkbook = client.stores.checkbooks.get(checkbookId);
```

---

## Allocation 관련

### `client.stores.allocations.getByTokenIdAndStatus(tokenId, status)`

**설명**: 토큰 ID와 상태로 필터링된 Allocation 가져오기

**백엔드 API**: `GET /api/allocations?token_id={tokenId}&status={status}`

**사용 예제**:
```typescript
// 모든 idle 상태의 ETH Allocation 가져오기
const idleEth = await client.stores.allocations.getByTokenIdAndStatus(
  1, // ETH token_id
  AllocationStatus.Idle
);

console.log('사용 가능한 ETH Allocation:', idleEth.length);
```

### `client.stores.allocations.fetchList(filters)`

**설명**: 고급 필터가 있는 Allocation 쿼리

**매개변수**:
```typescript
{
  checkbook_id?: number;
  token_id?: number;
  status?: AllocationStatus;
  withdraw_request_id?: number;
  page?: number;
  page_size?: number;
}
```

---

## 커밋먼트 관련

### `client.prepareCommitment(allocations, checkbookAddress)`

**설명**: 커밋먼트 서명 데이터 준비 (SDK 내부, 백엔드 호출 없음)

**백엔드 API**: 없음 (순수 SDK 작업)

**사용 예제**:
```typescript
const allocations = client.stores.allocations.idle;
const checkbookAddress = '0x...';

const preparedData = await client.prepareCommitment(allocations, checkbookAddress);
console.log('서명할 메시지:', preparedData.message);
```

### `client.createCommitment(allocations, checkbookAddress)`

**설명**: 완전한 커밋먼트 프로세스 (준비 + 서명 + 제출)

**사용 예제**:
```typescript
// 원스텝 커밋먼트
const result = await client.createCommitment(allocations, checkbookAddress);
console.log('✅ 커밋먼트 완료');
```

---

## 출금 관련

### `client.prepareWithdraw(allocations, intent)`

**설명**: 출금 서명 데이터 준비 (SDK 내부, 백엔드 호출 없음)

**매개변수**:
- `allocations: Allocation[]` - 출금할 Allocation (`idle` 상태여야 함)
- `intent: WithdrawIntent` - 출금 인텐트 매개변수

**사용 예제**:
```typescript
const allocations = client.stores.allocations.idle.filter(a => a.token_id === 1);
const intent = {
  target_address: '0xYourAddress',
  target_chain_id: 1,
  token_id: 1,
  min_amount_out: '990000000000000000', // 0.99 ETH (1% 슬리피지)
};

const preparedData = await client.prepareWithdraw(allocations, intent);
```

### `client.withdraw(allocations, intent)`

**설명**: 완전한 출금 프로세스 (준비 + 서명 + 제출)

**사용 예제**:
```typescript
// 원스텝 출금
const result = await client.withdraw(allocations, intent);
console.log('✅ 출금 요청 생성');
```

### `client.stores.withdrawals.fetchList(filters)`

**설명**: 필터 및 페이지네이션이 있는 출금 요청 쿼리

**사용 예제**:
```typescript
// 처리 중인 출금 가져오기
const pending = await client.stores.withdrawals.fetchList({
  status: WithdrawRequestStatus.Pending,
  page: 1,
  page_size: 10,
});
```

---

## SDK 내부 구현 vs 백엔드 API

| 작업 | SDK 내부 | 백엔드 API | 이유 |
|-----------|-------------|-------------|--------|
| 커밋먼트 메시지 생성 | ✅ `prepareCommitment()` | ❌ | 오프라인 서명 지원 |
| 커밋먼트 서명 | ✅ `wallet.signMessage()` | ❌ | 개인 키가 클라이언트를 벗어나지 않음 |
| 커밋먼트 제출 | ❌ | ✅ `POST /api/commitments` | 백엔드 검증 및 저장 |
| 출금 메시지 생성 | ✅ `prepareWithdraw()` | ❌ | 오프라인 서명 지원 |
| 출금 서명 | ✅ `wallet.signMessage()` | ❌ | 개인 키가 클라이언트를 벗어나지 않음 |
| 출금 제출 | ❌ | ✅ `POST /api/withdrawals` | 백엔드 처리 및 온체인 실행 |

---

## 상태 시스템

### CheckbookStatus 흐름

```
┌─────────┐
│ Pending │ ──── 증명 생성 중 ────┐
└─────────┘                       │
                                  ▼
┌──────────────────────┐     ┌────────────┐
│ ReadyForCommitment   │◄────│ ProofFailed│
└──────────────────────┘     └────────────┘
        │
        │ 사용자가 커밋먼트 생성
        ▼
┌──────────────┐
│WithCheckbook │
└──────────────┘
```

### AllocationStatus 흐름

```
┌──────┐
│ Idle │ ──── 새 WithdrawRequest에서 사용 가능
└──────┘
   │
   │ WithdrawRequest에 포함됨
   ▼
┌─────────┐
│ Pending │ ──── 활성 WithdrawRequest의 일부
└─────────┘
   │
   │ WithdrawRequest 완료
   ▼
┌──────┐
│ Used │ ──── 성공적으로 출금됨
└──────┘
```

**참고**: WithdrawRequest가 실패하면 Allocation은 `pending`에서 `idle`로 되돌아갑니다.

---

## Pool & Token 관련

### `client.stores.pools.getAll()`

**설명**: Store에서 모든 풀 가져오기

**백엔드 API**: `GET /api/pools?page=1&size=100` (초기 동기화 시)

### `client.stores.pools.get(id)`

**설명**: ID로 특정 풀 가져오기

**백엔드 API**: `GET /api/pools/{id}`

### `client.searchTokens(keyword)`

**설명**: 키워드로 토큰 검색

**백엔드 API**: `GET /api/tokens/search?keyword={keyword}&limit=10`

**사용 예제**:
```typescript
const results = await client.searchTokens('USDT');
```

---

## 토큰 가격

### `client.subscribePrices(assetIds)`

**설명**: WebSocket을 통해 가격 업데이트 구독

**사용 예제**:
```typescript
await client.subscribePrices(['0x000...']);
```

**WebSocket 메시지**:
```json
// 구독 요청
{
  "action": "subscribe",
  "type": "prices",
  "asset_ids": ["0x000..."],
  "timestamp": 1705500000
}

// 가격 업데이트 (매분 푸시)
{
  "type": "price_update",
  "asset_id": "0x000...",
  "price": "1234.56",
  "change_24h": "+5.2%",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### `client.stores.prices.get(assetId)`

**설명**: Store에서 특정 자산의 가격 가져오기

**백엔드 API**: `GET /api/tokens/{asset_id}/price` (선택사항)

### `client.stores.prices.getHistory(assetId, days)`

**설명**: 자산의 가격 이력 가져오기

**백엔드 API**: `GET /api/tokens/{asset_id}/price-history?days={days}`

---

## WebSocket 구독

### 연결 수립

**SDK 내부**:
```typescript
const ws = new WebSocket(`wss://api.enclave-hq.com/api/ws?token=${JWT_TOKEN}`);

// 연결 확인
{
  "type": "connected",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connected to WebSocket service",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### 구독 타입

| SDK 메서드 | WebSocket 타입 | 메시지 타입 |
|---------|-------------------|---------|
| `client.connect()` | `deposits` | `deposit_update` |
| `client.connect()` | `checkbooks` | `checkbook_update` |
| `client.connect()` | `withdraw_requests` | `withdrawal_update` |
| `client.subscribePrices()` | `prices` | `price_update` |

### 입금 업데이트 구독

```json
// SDK 전송
{
  "action": "subscribe",
  "type": "deposits",
  "address": "0x...",
  "timestamp": 1705500000
}

// 구독 확인
{
  "type": "subscription_confirmed",
  "sub_type": "deposits",
  "message": "Subscribed to deposits",
  "timestamp": "2025-01-17T12:00:00Z"
}

// 업데이트 푸시
{
  "type": "deposit_update",
  "data": {
    "id": 1,
    "chain_id": 714,
    "amount": "1000000",
    "status": "detected",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### Checkbook 업데이트 구독

```json
// SDK 전송
{
  "action": "subscribe",
  "type": "checkbooks",
  "address": "0x...",
  "timestamp": 1705500000
}

// 업데이트 푸시
{
  "type": "checkbook_update",
  "data": {
    "id": "uuid",
    "status": "with_checkbook",
    "commitment": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### 출금 업데이트 구독

```json
// SDK 전송
{
  "action": "subscribe",
  "type": "withdraw_requests",
  "address": "0x...",
  "timestamp": 1705500000
}

// 업데이트 푸시
{
  "type": "withdrawal_update",
  "data": {
    "id": "uuid",
    "status": "completed",
    "execute_tx_hash": "0x...",
    "payout_tx_hash": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

---

## 오류 처리

### HTTP 상태 코드 매핑

| HTTP 상태 | SDK 오류 타입 | 처리 방법 |
|-----------|-------------|---------|
| 200/201 | - | 정상 응답 |
| 400 | `ValidationError` | 매개변수 검증 실패 |
| 401 | `AuthenticationError` | 토큰 만료, 재로그인 필요 |
| 403 | `PermissionError` | 권한 부족 |
| 404 | `NotFoundError` | 리소스를 찾을 수 없음 |
| 500 | `ServerError` | 서버 오류, 재시도 |
| 503 | `ServiceUnavailableError` | 서비스 사용 불가, 재시도 |

### 오류 처리 예제

```typescript
try {
  await client.deposit(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // 재로그인
    await client.connect(privateKey);
    await client.deposit(params); // 재시도
  } else if (error instanceof ValidationError) {
    // 매개변수 오류, 사용자에게 알림
    console.error('Invalid parameters:', error.message);
  } else {
    // 기타 오류
    console.error('Unexpected error:', error);
  }
}
```

---

## 완전한 흐름 예제

### 입금부터 출금까지 완전한 흐름

```typescript
// 1. 연결
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});
await client.connect(privateKey);

// 2. 입금
const depositResult = await client.deposit({
  chainId: 714,
  tokenAddress: '0x...',
  amount: '1000000',
});

// 3. 입금 감지 대기 (WebSocket을 통해 자동)
client.stores.deposits.on('added', (deposit) => {
  console.log('입금 감지됨:', deposit);
});

// 4. Allocation 생성
const allocationResult = await client.createAllocation({
  checkbookId: depositResult.checkbookId,
  allocations: [
    {
      recipient_chain_id: 714,
      recipient_address: '0x...',
      amount: '500000',
    },
  ],
});

// 5. Checkbook 상태 업데이트 대기 (WebSocket을 통해 자동)
client.stores.checkbooks.on('updated', (checkbook) => {
  if (checkbook.status === 'with_checkbook') {
    console.log('Checkbook 준비 완료');
  }
});

// 6. 출금
const withdrawalResult = await client.withdraw({
  allocationIds: ['uuid1'],
  recipient: {
    chain_id: 714,
    address: '0x...',
    amount: '500000',
    token_symbol: 'USDT',
  },
});

// 7. 출금 상태 모니터링 (WebSocket을 통해 자동)
client.stores.withdrawals.on('updated', (withdrawal) => {
  console.log('출금 상태:', withdrawal.status);
  if (withdrawal.status === 'completed') {
    console.log('출금 완료!', withdrawal.payout_tx_hash);
  }
});
```

---

**추가 기술 세부 정보는 다음을 참조하세요**:
- **완전한 중국어 버전**: [SDK_API_MAPPING.zh-CN.md](./SDK_API_MAPPING.zh-CN.md) - 모든 API 매핑 및 세부 사항
- **기술 설계**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md) - 내부 아키텍처
- **SDK 개요**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md) - 고수준 소개

---

**버전**: v2.0.0  
**마지막 업데이트**: 2025-01-17  
**상태**: 완료 ✅
