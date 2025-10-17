# Enclave JavaScript SDK - 기술 설계 문서

**Languages**: [English](./SDK_JS_DESIGN.md) | [中文](./SDK_JS_DESIGN.zh-CN.md) | [日本語](./SDK_JS_DESIGN.ja.md) | 한국어

## 📋 목차

- [개요](#개요)
- [기술 스택](#기술-스택)
- [디렉토리 구조](#디렉토리-구조)
- [핵심 모듈 설계](#핵심-모듈-설계)
- [서명 아키텍처](#서명-아키텍처)
- [데이터 포맷터](#데이터-포맷터)
- [타입 시스템](#타입-시스템)
- [Store 아키텍처](#store-아키텍처)
- [API 클라이언트](#api-클라이언트)
- [WebSocket 레이어](#websocket-레이어)
- [환경 어댑터](#환경-어댑터)
- [비즈니스 운영 레이어](#비즈니스-운영-레이어)
- [플랫폼 통합](#플랫폼-통합)
- [오류 처리](#오류-처리)
- [성능 최적화](#성능-최적화)
- [테스트 전략](#테스트-전략)

## 개요

Enclave JavaScript SDK v2.0은 **반응형 아키텍처**와 **MobX 상태 관리**를 기반으로 한 완전히 새로운 SDK로, Enclave 백엔드 서비스와 상호작용하기 위한 통합되고 사용하기 쉬운 API를 제공합니다.

### 핵심 설계 원칙

1. **반응형 우선**: MobX 기반으로 데이터 변경이 자동으로 UI 업데이트 트리거
2. **환경 독립적**: 브라우저, Node.js, React Native 등 모든 JavaScript 실행 환경 지원
3. **TypeScript 우선**: 완전한 타입 정의로 우수한 개발자 경험 제공
4. **실시간 동기화**: WebSocket이 자동으로 업데이트 푸시, 수동 폴링 불필요
5. **간단한 사용**: 단일 `connect()`로 모든 초기화 완료

### 아키텍처 원칙

- **단일 책임**: 각 모듈은 하나의 핵심 기능만 담당
- **의존성 주입**: 모듈 간 인터페이스를 통해 통신, 테스트 및 교체 용이
- **이벤트 주도**: EventEmitter를 사용한 모듈 간 통신
- **방어적 프로그래밍**: 포괄적인 오류 처리 및 경계 검사
- **성능 우선**: 지연 로딩, 배치 업데이트, 정밀 렌더링

## 기술 스택

### 핵심 의존성

```json
{
  "dependencies": {
    "mobx": "^6.12.0",           // 반응형 상태 관리
    "ethers": "^6.10.0",         // 블록체인 상호작용
    "axios": "^1.6.0",           // HTTP 클라이언트
    "eventemitter3": "^5.0.1"    // 이벤트 시스템
  },
  "peerDependencies": {
    "ws": "^8.0.0",              // Node.js WebSocket (선택)
    "react": ">=16.8.0",         // React 통합 (선택)
    "vue": ">=3.0.0"             // Vue 통합 (선택)
  },
  "devDependencies": {
    "typescript": "^5.3.0",      // TypeScript
    "tsup": "^8.0.0",            // 빌드 도구
    "vitest": "^1.0.0",          // 테스트 프레임워크
    "eslint": "^8.56.0",         // 코드 린터
    "prettier": "^3.1.0"         // 코드 포맷터
  }
}
```

### 왜 이러한 기술을 선택했나요?

| 기술 | 이유 | 대안 비교 |
|------|------|-------------|
| **MobX** | 반응형, 자동 종속성 추적, 프레임워크 독립적 | Redux (너무 무거움), Zustand (기능 부족) |
| **ethers.js v6** | 성숙하고 안정적, 우수한 TypeScript 지원 | web3.js (API가 현대적이지 않음) |
| **axios** | 인터셉터, 요청 취소, 타임아웃 제어 | fetch (기능 부족) |
| **tsup** | 빠름, 제로 설정, 다중 출력 형식 | webpack (복잡한 설정), rollup (많은 설정) |
| **vitest** | 빠름, Jest 호환 API, 네이티브 ESM | Jest (느림) |

## SDK 내보내기 전략

SDK는 명확한 내보내기 전략을 채택하여 클라이언트 사용을 위해 핵심 클래스, 상태 열거형, 타입 정의를 내보냅니다:

```typescript
// src/index.ts - 메인 진입 파일

// ============ 핵심 클라이언트 ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ 상태 열거형 (클라이언트 사용용) ============
export { 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from './types/models';

// ============ 데이터 모델 타입 ============
export type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  WithdrawRequestDetail,
  UniversalAddress,
  TokenPrice,
  Pool,
  Token,
  User,
} from './types/models';

// ============ 설정 타입 ============
export type {
  EnclaveConfig,
  SignerInput,
  ISigner,
  SignerCallback,
} from './types';
```

### 왜 상태 열거형을 내보내나요?

1. ✅ **타입 안전성**: TypeScript가 컴파일 시 상태 값의 정확성 검사
2. ✅ **코드 힌트**: IDE가 자동 완성 및 문서 제공
3. ✅ **가독성**: `CheckbookStatus.WithCheckbook`이 `'with_checkbook'`보다 명확
4. ✅ **리팩토링 친화적**: 상태 값이 변경되어도 열거형 정의만 수정하면 모든 참조가 자동 업데이트
5. ✅ **매직 문자열 방지**: 하드코딩된 문자열 제거, 오류 감소

### 클라이언트 사용 예제

```typescript
import { 
  EnclaveClient, 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave/sdk';

// 클라이언트 생성
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 1. 상태 비교에 열거형 사용
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook 활성화됨, 할당 생성 가능');
}

// 2. 쿼리에 열거형 사용
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. 조건 로직에 열거형 사용
const withdrawal = client.stores.withdrawals.get(withdrawId);
switch (withdrawal.status) {
  case WithdrawRequestStatus.Pending:
    console.log('⏳ 출금 처리 중...');
    break;
  case WithdrawRequestStatus.Completed:
    console.log('✅ 출금 완료');
    break;
  case WithdrawRequestStatus.Failed:
    console.log('❌ 출금 실패, 재시도 가능');
    break;
}

// 4. React UI에서 열거형 사용
function CheckbookStatusBadge({ status }: { status: CheckbookStatus }) {
  const config = {
    [CheckbookStatus.Pending]: { text: '처리 중', color: 'blue' },
    [CheckbookStatus.ReadyForCommitment]: { text: '준비 완료', color: 'yellow' },
    [CheckbookStatus.WithCheckbook]: { text: '활성', color: 'green' },
    [CheckbookStatus.ProofFailed]: { text: '증명 실패', color: 'red' },
  };
  
  const { text, color } = config[status] || { text: '알 수 없음', color: 'gray' };
  return <Badge color={color}>{text}</Badge>;
}

// 5. 상태 전환 제어
function canCreateAllocation(checkbook: Checkbook): boolean {
  return checkbook.status === CheckbookStatus.WithCheckbook;
}

function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 6. TypeScript 타입 안전성
function processCheckbook(status: CheckbookStatus) {
  // TypeScript는 유효한 CheckbookStatus 값만 전달되도록 보장
}

// ❌ 오류: TypeScript가 오류 보고
processCheckbook('invalid_status'); // Type 'string' is not assignable to type 'CheckbookStatus'

// ✅ 올바름
processCheckbook(CheckbookStatus.Pending);
```

---

## 디렉토리 구조

```
sdk/js/
├── src/
│   ├── client/                      # 클라이언트 핵심
│   │   ├── EnclaveClient.ts         # 메인 클라이언트 진입점
│   │   └── ConnectionManager.ts     # 연결 관리
│   │
│   ├── stores/                      # MobX Store 레이어
│   │   ├── BaseStore.ts             # Store 기본 클래스
│   │   ├── StoreManager.ts          # Store 관리자
│   │   ├── DepositsStore.ts         # 입금 상태
│   │   ├── CheckbooksStore.ts       # Checkbook 상태
│   │   ├── WithdrawalsStore.ts      # 출금 상태
│   │   ├── PricesStore.ts           # 가격 상태
│   │   ├── PoolsStore.ts            # Pool/Token 상태
│   │   └── UserStore.ts             # 사용자 상태
│   │
│   ├── api/                         # REST API 레이어
│   │   ├── APIClient.ts             # HTTP 클라이언트 기본 클래스
│   │   ├── AuthAPI.ts               # 인증 API
│   │   ├── DepositsAPI.ts           # 입금 API
│   │   ├── CheckbooksAPI.ts         # Checkbook API
│   │   ├── WithdrawalsAPI.ts        # 출금 API
│   │   ├── PoolsAPI.ts              # Pool/Token API
│   │   └── KMSAPI.ts                # KMS API
│   │
│   ├── websocket/                   # WebSocket 레이어
│   │   ├── WebSocketClient.ts       # WS 클라이언트
│   │   ├── SubscriptionManager.ts   # 구독 관리
│   │   ├── MessageHandler.ts        # 메시지 핸들러
│   │   └── ReconnectionManager.ts   # 재연결 관리
│   │
│   ├── blockchain/                  # 블록체인 상호작용 레이어
│   │   ├── WalletManager.ts         # 지갑 관리
│   │   ├── SignerAdapter.ts         # 서명 어댑터
│   │   ├── ContractManager.ts       # 컨트랙트 상호작용
│   │   └── TransactionBuilder.ts    # 트랜잭션 빌더
│   │
│   ├── formatters/                  # 데이터 포맷터
│   │   ├── CommitmentFormatter.ts   # 커밋먼트 포맷터
│   │   └── WithdrawFormatter.ts     # 출금 포맷터
│   │
│   ├── actions/                     # 비즈니스 운영 레이어
│   │   ├── ActionManager.ts         # 운영 관리자
│   │   ├── DepositAction.ts         # 입금 운영
│   │   ├── CommitmentAction.ts      # 커밋먼트 운영
│   │   └── WithdrawalAction.ts      # 출금 운영
│   │
│   ├── adapters/                    # 환경 어댑터 레이어
│   │   ├── websocket/
│   │   │   ├── IWebSocketAdapter.ts
│   │   │   ├── BrowserWebSocketAdapter.ts
│   │   │   └── NodeWebSocketAdapter.ts
│   │   └── storage/
│   │       ├── IStorageAdapter.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── FileStorageAdapter.ts
│   │
│   ├── platforms/                   # 플랫폼 특정 통합
│   │   ├── react/
│   │   │   ├── hooks.ts             # React Hooks
│   │   │   ├── provider.tsx         # Context Provider
│   │   │   └── index.ts
│   │   ├── vue/
│   │   │   ├── composables.ts       # Vue Composables
│   │   │   ├── plugin.ts            # Vue Plugin
│   │   │   └── index.ts
│   │   └── nextjs/
│   │       ├── server.ts            # 서버 사이드 유틸리티
│   │       ├── client.ts            # 클라이언트 사이드 유틸리티
│   │       └── index.ts
│   │
│   ├── types/                       # TypeScript 타입 정의
│   │   ├── models.ts                # 데이터 모델
│   │   ├── api.ts                   # API 타입
│   │   ├── config.ts                # 설정 타입
│   │   ├── events.ts                # 이벤트 타입
│   │   ├── websocket.ts             # WebSocket 타입
│   │   └── index.ts
│   │
│   ├── utils/                       # 유틸리티 함수
│   │   ├── address.ts               # 주소 포맷
│   │   ├── amount.ts                # 금액 처리
│   │   ├── logger.ts                # 로깅 유틸리티
│   │   ├── retry.ts                 # 재시도 메커니즘
│   │   ├── validators.ts            # 데이터 검증
│   │   ├── environment.ts           # 환경 감지
│   │   └── index.ts
│   │
│   └── index.ts                     # 메인 내보내기 파일
│
├── examples/                        # 사용 예제
│   ├── basic-usage.ts               # 기본 사용
│   ├── react-app/                   # React 예제
│   ├── nextjs-app/                  # Next.js 예제
│   ├── nodejs-backend.ts            # Node.js 백엔드
│   └── kms-integration.ts           # KMS 통합
│
├── tests/                           # 테스트
│   ├── unit/                        # 단위 테스트
│   ├── integration/                 # 통합 테스트
│   └── e2e/                         # E2E 테스트
│
├── docs/                            # 추가 문서
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                   # 빌드 설정
├── vitest.config.ts                 # 테스트 설정
├── .eslintrc.js
├── .prettierrc
├── README.md
└── LICENSE
```

## 핵심 모듈 설계

### 1. EnclaveClient (메인 클라이언트)

EnclaveClient는 모든 SDK 기능에 대한 단일 진입점을 제공합니다.

**주요 설계 포인트**:

1. **단일 진입점**: 모든 SDK 기능은 `EnclaveClient`를 통해 액세스
2. **라이프사이클 관리**: 명확한 `connect()` 및 `disconnect()` 라이프사이클
3. **이벤트 발생**: 연결 상태 변경을 위한 이벤트 발생, 외부 모니터링 가능
4. **자동 동기화**: 연결 후 자동으로 초기 데이터 동기화 완료
5. **오류 격리**: 각 작업은 독립적인 오류 처리 보유

(코드 예제는 영어 버전과 동일하므로 생략)

### 2. ConnectionManager (연결 관리자)

WebSocket 연결 및 메시지 라우팅 관리를 담당합니다.

**주요 설계 포인트**:

1. **컴포넌트 분리**: WebSocket, 구독, 메시지 처리는 독립 모듈
2. **자동 구독**: 연결 후 사용자 관련 데이터 스트림 자동 구독
3. **재연결 로직**: 연결 손실 및 재구독 자동 처리
4. **타입 안전성**: 모든 메시지 및 구독은 타입 안전

---

## 서명 아키텍처

Enclave SDK는 개인 키를 노출하지 않고 여러 서명 방법을 지원합니다. 이는 `ISigner` 인터페이스와 `SignerAdapter`를 통해 달성됩니다.

### 설계 목표

1. **보안**: SDK는 개인 키를 저장하거나 로그에 기록하지 않음
2. **유연성**: 여러 서명 방법 지원 (개인 키, MetaMask, Ledger, 원격 서명 서비스)
3. **호환성**: 기존 Web3 지갑 및 하드웨어 지갑과 작동
4. **오프라인 지원**: 네트워크 연결 없이 서명 지원

### 핵심 인터페이스

(TypeScript 인터페이스 정의는 영어 버전과 동일하므로 생략)

### 사용 예제

#### 예제 1: MetaMask 서명자 사용

```typescript
import { EnclaveClient } from '@enclave/sdk';
import { BrowserProvider } from 'ethers';

async function connectWithMetaMask() {
  // MetaMask 프로바이더 가져오기
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // SDK 클라이언트 생성, ethers Signer 직접 전달
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: signer, // ethers.Signer는 ISigner 인터페이스 구현
  });
  
  await client.connect();
  console.log('✅ MetaMask로 연결 완료');
}
```

#### 예제 2: 원격 서명 서비스 사용

```typescript
import { EnclaveClient } from '@enclave/sdk';

async function connectWithRemoteSigner() {
  // 사용자 정의 서명 함수
  const remoteSigner = async (message: string | Uint8Array) => {
    // 원격 서명 서비스 API 호출
    const response = await fetch('https://my-signing-service.com/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: typeof message === 'string' ? message : Buffer.from(message).toString('hex'),
        userId: 'user123',
      }),
    });
    
    const { signature } = await response.json();
    return signature;
  };
  
  // SDK 클라이언트 생성, 서명 함수 전달
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: remoteSigner, // 서명 함수 직접 전달
  });
  
  await client.connect();
  console.log('✅ 원격 서명자로 연결 완료');
}
```

#### 예제 3: Node.js 백엔드 개인 키

```typescript
import { EnclaveClient } from '@enclave/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function connectWithPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  
  // SDK 클라이언트 생성, 개인 키 직접 전달
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: privateKey, // 개인 키 문자열 직접 전달
  });
  
  await client.connect();
  console.log('✅ 개인 키로 연결 완료');
}
```

### 보안 모범 사례

1. **개인 키 관리**:
```typescript
// ❌ 나쁨: 개인 키 하드코딩
const client = new EnclaveClient({
  signer: '0x1234567890abcdef...',
});

// ✅ 좋음: 환경 변수 사용
const client = new EnclaveClient({
  signer: process.env.PRIVATE_KEY,
});

// ✅ 더 좋음: 보안 볼트 사용
const privateKey = await getSecretFromVault('ENCLAVE_PRIVATE_KEY');
const client = new EnclaveClient({ signer: privateKey });
```

---

## 데이터 포맷터

백엔드 API 의존성을 줄이고 오프라인 작업을 지원하기 위해 SDK는 커밋먼트 및 출금의 서명 메시지와 페이로드를 생성하기 위한 데이터 포맷터를 내부 구현합니다.

### 설계 목표

1. **일관성**: 데이터 포맷 로직은 모든 언어 SDK (JS, Go, Python 등)에서 일관됨
2. **오프라인 지원**: 메시지 생성은 백엔드 API 호출 불필요
3. **투명성**: 개발자는 데이터 구조 및 서명 내용을 명확히 확인 가능
4. **보안**: 모든 해싱 및 서명 생성은 로컬, 민감한 데이터 전송 없음

### CommitmentFormatter (커밋먼트 데이터 포맷터)

커밋먼트 작업의 서명 메시지를 생성합니다.

(TypeScript 코드 구현은 영어 버전과 동일하므로 생략)

### WithdrawFormatter (출금 데이터 포맷터)

출금 작업의 서명 메시지를 생성합니다.

(TypeScript 코드 구현은 영어 버전과 동일하므로 생략)

### 언어 간 일관성 사양

**모든 언어 SDK에서 데이터 포맷 로직의 일관성을 보장하기 위해 다음 규칙을 따릅니다:**

| 단계 | 작업 | 사양 | 예제 |
|------|------|------|------|
| 1 | 할당 정렬 | `token_id` ASC, 그 다음 `value` ASC로 정렬 | `[{token:1,val:100}, {token:1,val:200}, {token:2,val:50}]` |
| 2 | 단일 할당 해시 | `keccak256(token_id ‖ value ‖ salt ‖ nullifier)` | 각 필드는 32바이트로 패딩 |
| 3 | 할당 목록 해시 | 각 할당 해시, 연결, 다시 해시 | `keccak256(hash1 ‖ hash2 ‖ ...)` |
| 4 | Merkle 트리 | 표준 이진 Merkle 트리, 좌우 해시 페어링 | 홀수인 경우 오른쪽 끝 노드 복제 |
| 5 | Intent 해시 | `keccak256(target_address ‖ target_chain_id ‖ token_id ‖ min_amount_out)` | 각 uint256은 32바이트로 패딩 |
| 6 | 서명 메시지 | `keccak256(domain ‖ chainId ‖ hash_data)` | EIP-712 스타일 따름 |

### SDK 내부 구현 vs 백엔드 API

| 작업 | SDK 내부 | 백엔드 API | 이유 |
|------|---------|---------|------|
| 커밋먼트 메시지 생성 | ✅ `prepareCommitment()` | ❌ | 오프라인 서명 지원 |
| 커밋먼트 서명 | ✅ `wallet.signMessage()` | ❌ | 개인 키가 클라이언트를 벗어나지 않음 |
| 커밋먼트 제출 | ❌ | ✅ `POST /api/commitments` | 백엔드 검증 및 저장 필요 |
| 출금 메시지 생성 | ✅ `prepareWithdraw()` | ❌ | 오프라인 서명 지원 |
| 출금 서명 | ✅ `wallet.signMessage()` | ❌ | 개인 키가 클라이언트를 벗어나지 않음 |
| 출금 제출 | ❌ | ✅ `POST /api/withdrawals` | 백엔드 처리 및 온체인 실행 필요 |
| Merkle 루트 계산 | ✅ `calculateMerkleRoot()` | ❌ | 클라이언트 검증, 백엔드는 재계산 |

**설계 트레이드오프**:

1. **오프라인 지원**: 사용자는 네트워크 없이 서명 데이터 생성 가능
2. **투명성**: 사용자는 서명 내용을 명확히 확인 가능
3. **보안**: 개인 키는 백엔드로 전송되지 않음
4. **검증**: 백엔드는 모든 해시를 재계산하여 검증
5. **일관성**: 표준화된 알고리즘으로 언어 간 SDK 일관성 보장

---

## 추가 장

다음 장은 SDK의 나머지 아키텍처 구성 요소를 포괄적으로 다룹니다:

### API 클라이언트
- **APIClient 기본 클래스**: axios 통합, 인터셉터, 인증 관리
- **오류 타입**: ValidationError, AuthenticationError, NetworkError 등

### WebSocket 계층
- **WebSocketClient**: 크로스 플랫폼 추상화, 자동 재연결, 하트비트 메커니즘
- **기능**: 지수 백오프, 연결 상태 관리, 메시지 큐잉

### 환경 어댑터
- **WebSocket 어댑터**: Browser / Node.js 구현
- **스토리지 어댑터**: LocalStorage / 커스텀 구현 지원

### 비즈니스 운영 계층
- **ActionManager**: 복잡한 워크플로 캡슐화
- **메서드**: createCommitment(), withdraw()

### 플랫폼 통합
- **React 통합**: useEnclaveClient(), useStore(), useCheckbooks()
- **Next.js 통합**: 클라이언트 측 전용 유틸리티

### 오류 처리
- **오류 계층**: EnclaveSDKError, ConnectionError, SignerError
- **구조화된 오류 코드**: 프로그래밍 방식 처리용

### 성능 최적화
1. **지연 로딩**: 대규모 종속성의 동적 임포트
2. **배치 업데이트**: MobX runInAction
3. **계산 캐싱**: 자동 파생 값 캐싱
4. **정밀 렌더링**: MobX 세밀한 반응성

### 테스트 전략
- **유닛 테스트**: Store 로직, 유틸리티 함수
- **통합 테스트**: 전체 연결 흐름, WebSocket 재연결

---

## 요약

Enclave JavaScript SDK v2.0 제공 내용:

### 핵심 기능
✅ **반응형 상태 관리**: MobX 자동 추적, 자동 UI 업데이트  
✅ **환경 독립적**: 브라우저, Node.js, React Native 지원  
✅ **타입 안전성**: 완전한 TypeScript 정의  
✅ **실시간 동기화**: WebSocket 푸시 + 명시적 쿼리 백업  
✅ **보안 우선**: 개인 키는 클라이언트를 벗어나지 않음, 여러 서명 옵션  
✅ **오프라인 지원**: SDK 내부 포맷팅, 오프라인 서명 가능  

### 아키텍처 이점
- **모듈화**: 명확한 관심사 분리, 유지보수 용이
- **테스트 가능**: 의존성 주입, 모킹 용이
- **고성능**: 지연 로딩, 배치 업데이트, 정밀 렌더링
- **크로스 플랫폼**: 다양한 환경을 위한 어댑터 패턴
- **개발자 친화적**: 완전한 문서, 예제, 타입 힌트

### 문서
- **기술 설계**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md)
- **API 매핑**: [SDK_API_MAPPING.md](./SDK_API_MAPPING.md)
- **SDK 개요**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md)

---

**완전한 코드 예제를 포함한 기술 세부 정보는 중국어 버전을 참조하세요**: [SDK_JS_DESIGN.zh-CN.md](./SDK_JS_DESIGN.zh-CN.md)

---

**버전**: v2.0.0  
**마지막 업데이트**: 2025-01-17  
**상태**: 완료 ✅

