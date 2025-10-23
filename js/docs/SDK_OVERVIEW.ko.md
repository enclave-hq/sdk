# Enclave SDK 개요

**Languages**: [English](./SDK_OVERVIEW.md) | [中文](./SDK_OVERVIEW.zh-CN.md) | [日本語](./SDK_OVERVIEW.ja.md) | 한국어

## 🎯 개요

Enclave SDK는 Enclave 프라이버시 보호 멀티체인 DeFi 프로토콜과 상호 작용하기 위한 다국어 클라이언트 라이브러리 모음입니다. SDK는 입금, 커밋먼트 생성, 출금을 포함한 완전한 비즈니스 프로세스를 지원하는 통합되고 사용하기 쉬운 API를 제공합니다.

## 🏗️ 아키텍처 설계

### 핵심 철학

**명령형에서 반응형으로**: Enclave SDK v2.0는 Store 패턴과 WebSocket 실시간 동기화를 기반으로 하는 완전히 새로운 반응형 아키텍처를 채택하여 개발자가 데이터 폴링과 상태 관리에 대해 걱정할 필요가 없도록 합니다.

```
기존 명령형 API              반응형 Store 기반
┌─────────────────┐          ┌─────────────────┐
│ API 호출        │          │ 한 번 연결       │
│ 응답 대기       │   ═══>   │ Store 자동 동기화│
│ 수동 UI 업데이트│          │ UI 자동 응답     │
│ 폴링 필요       │          │ WebSocket 푸시   │
└─────────────────┘          └─────────────────┘
```

### 기술 스택

| 컴포넌트 | 기술 | 이유 |
|-----------|-----------|---------|
| **상태 관리** | MobX | 반응형, 자동 의존성 추적, 프레임워크 독립적 |
| **실시간 통신** | WebSocket | 백엔드 WebSocket API 기반, 구독 지원 |
| **블록체인 상호작용** | ethers.js v6 | 성숙하고 안정적, 우수한 TypeScript 지원 |
| **HTTP 클라이언트** | axios | 인터셉터, 요청 취소, 타임아웃 제어 |
| **타입 시스템** | TypeScript | 타입 안전성, 우수한 IDE 지원 |
| **빌드 도구** | tsup | 빠름, 다중 출력 형식 지원 |

## 🌍 다국어 지원

### 언어 매트릭스

```
enclave/sdk/
├── js/          JavaScript/TypeScript SDK (v2.0) ✅ 완료
├── go/          Go SDK (계획 중)
├── python/      Python SDK (계획 중)
└── rust/        Rust SDK (계획 중)
```

### JavaScript SDK 기능

- ✅ **범용 환경**: 브라우저, Node.js, React Native, Electron 지원
- ✅ **프레임워크 통합**: React, Vue, Next.js, Svelte 등
- ✅ **TypeScript**: 완전한 타입 정의 및 추론
- ✅ **Tree-shakable**: 온디맨드 로드, 번들 크기 감소
- ✅ **반응형**: MobX 기반 자동 상태 관리

### Go SDK (향후)

- 고성능 백엔드 서비스 통합
- gRPC 지원
- 동시성 친화적
- Go 마이크로서비스 아키텍처에 적합

### Python SDK (향후)

- 데이터 분석 및 스크립팅
- Flask/Django 백엔드 통합
- Jupyter Notebook 지원
- 머신러닝 시나리오

## 📊 아키텍처 다이어그램

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                  애플리케이션 레이어                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Frontend │  │ Mobile App   │  │ Backend API  │      │
│  │ (React/Vue)  │  │ (React Native)│  │ (Next.js)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ EnclaveClient
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enclave SDK (코어 레이어)                  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    EnclaveClient                      │  │
│  │  - connect() / disconnect()                          │  │
│  │  - createCommitment() / withdraw()                   │  │
│  │  - 이벤트 이미터                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────┬──────────┴──────────┬──────────────────┐  │
│  │             │                     │                  │  │
│  ▼             ▼                     ▼                  ▼  │
│  ┌──────┐  ┌────────┐  ┌─────────┐  ┌──────────────┐     │
│  │Stores│  │  API   │  │WebSocket│  │  Blockchain  │     │
│  │(MobX)│  │ Client │  │ Manager │  │    Wallet    │     │
│  └──────┘  └────────┘  └─────────┘  └──────────────┘     │
│     │          │             │               │             │
│     │          │             │               │             │
│     ▼          ▼             ▼               ▼             │
│  [반응형]    [REST API]   [실시간]        [온체인]         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Enclave 백엔드 서비스                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │   Database   │      │
│  │  (Go Gin)    │  │  (Sub/Push)  │  │ (PostgreSQL) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    블록체인 네트워크 레이어                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   BSC    │  │ zkSync   │  │ Ethereum │  │   ...    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### JavaScript SDK 내부 아키텍처

```
EnclaveClient
    │
    ├── StoreManager (상태 관리)
    │   ├── CheckbooksStore     (체크북 상태)
    │   ├── AllocationsStore    (할당 상태)
    │   ├── WithdrawalsStore    (출금 상태)
    │   ├── PricesStore         (가격 상태)
    │   ├── PoolsStore          (풀/토큰 상태)
    │   └── UserStore           (사용자 상태)
    │
    ├── ConnectionManager (연결 관리)
    │   ├── WebSocketClient     (WebSocket 연결)
    │   ├── SubscriptionManager (구독 관리)
    │   └── MessageHandler      (메시지 처리)
    │
    ├── APIClient (REST API)
    │   ├── AuthAPI             (인증)
    │   ├── CheckbooksAPI       (체크북)
    │   ├── AllocationsAPI      (할당)
    │   ├── WithdrawalsAPI      (출금)
    │   ├── PoolsAPI            (풀/토큰)
    │   └── KMSAPI              (KMS)
    │
    ├── WalletManager (지갑 관리)
    │   ├── SignerAdapter       (서명 어댑터)
    │   └── ContractManager     (컨트랙트 상호작용)
    │
    ├── ActionManager (비즈니스 작업)
    │   ├── CommitmentAction    (커밋먼트 플로우)
    │   └── WithdrawalAction    (출금 플로우)
    │
    └── Adapters (환경 적응)
        ├── WebSocketAdapter    (WS 어댑터: Browser/Node)
        └── StorageAdapter      (스토리지 어댑터: LocalStorage/FS)
```

## 🎯 사용 사례

### 사용 사례 1: 웹 프론트엔드 애플리케이션

**기술 스택**: React + Next.js + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';

// 전역 클라이언트 인스턴스 생성
const client = new EnclaveClient({
  apiUrl: process.env.NEXT_PUBLIC_ENCLAVE_API,
  wsUrl: process.env.NEXT_PUBLIC_ENCLAVE_WS,
  signer: privateKey,
});

await client.connect();

// 컴포넌트는 Store 변경에 자동으로 응답
const CheckbooksView = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <div>
      <h1>내 체크북 ({checkbooks.count})</h1>
      <p>총 금액: {checkbooks.totalDeposited.toString()}</p>
      {checkbooks.all.map(c => (
        <CheckbookCard key={c.id} checkbook={c} />
      ))}
    </div>
  );
});
```

**장점**:
- ✅ 실시간 업데이트 (WebSocket)
- ✅ 수동 상태 관리 불필요
- ✅ TypeScript 타입 안전성
- ✅ 자동 렌더링 성능 최적화

### 사용 사례 2: Node.js 백엔드 서비스

**기술 스택**: Next.js API Routes / Express / Nest.js

```typescript
// app/api/checkbooks/route.ts
import { EnclaveClient } from '@enclave-hq/sdk';

// 서버 사이드 싱글톤 인스턴스
const serverClient = new EnclaveClient({
  apiUrl: process.env.ENCLAVE_API_URL,
  wsUrl: process.env.ENCLAVE_WS_URL,
  signer: process.env.SERVER_PRIVATE_KEY,
});

await serverClient.connect();

export async function GET(request: Request) {
  // Store에서 직접 읽기 (WebSocket 실시간 동기화)
  const checkbooks = serverClient.stores.checkbooks.all;
  
  return Response.json({
    checkbooks,
    total: serverClient.stores.checkbooks.totalDeposited.toString(),
  });
}

export async function POST(request: Request) {
  const { checkbookId, amounts, tokenId } = await request.json();
  
  // 커밋먼트 생성 실행
  const result = await serverClient.createCommitment({
    checkbookId,
    amounts,
    tokenId,
  });
  
  return Response.json(result);
}
```

**장점**:
- ✅ 서버 사이드 장기 연결 재사용
- ✅ 자동 데이터 동기화
- ✅ API 호출 빈도 감소
- ✅ 마이크로서비스 아키텍처에 적합

### 사용 사례 3: React Native 모바일 앱

**기술 스택**: React Native + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';
import { View, Text, FlatList } from 'react-native';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// 생체 인증 또는 보안 스토리지를 사용하여 개인 키 가져오기
const privateKey = await SecureStore.getItemAsync('private_key');
await client.connect();

const CheckbooksScreen = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <View>
      <Text>내 체크북 ({checkbooks.count})</Text>
      <FlatList
        data={checkbooks.all}
        renderItem={({ item }) => <CheckbookCard checkbook={item} />}
        keyExtractor={item => item.id}
      />
    </View>
  );
});
```

**장점**:
- ✅ 크로스 플랫폼 (iOS + Android)
- ✅ 오프라인 지원 (Store 영속화)
- ✅ 실시간 푸시
- ✅ 네이티브 성능

## 🔄 데이터 흐름

### 커밋먼트 생성 흐름

```
사용자 작업
    │
    ├─> client.createCommitment(params)
    │       │
    │       ├─> 1. 서명 데이터 준비
    │       ├─> 2. 지갑 서명 메시지
    │       ├─> 3. 백엔드에 제출
    │       └─> 4. 할당 생성
    │
    ▼
백엔드 처리
    │
    ├─> 서명 검증
    │       │
    │       └─> 할당 레코드 생성
    │
    ▼
WebSocket 푸시
    │
    ├─> 백엔드가 allocation_update 메시지를 푸시
    │       │
    │       └─> SDK가 메시지를 수신
    │
    ▼
Store 업데이트
    │
    ├─> AllocationsStore.updateAllocation(allocation)
    │       │
    │       └─> 'change' 이벤트 트리거
    │
    ▼
UI 자동 업데이트
    │
    └─> React/Vue 컴포넌트가 자동으로 재렌더링
```

### 가격 구독 흐름

```
초기화
    │
    ├─> client.connect()
    │       │
    │       └─> WebSocket 연결 설정
    │
    ▼
가격 구독
    │
    ├─> 가격 채널에 자동 구독
    │       │
    │       └─> 백엔드에 구독 메시지 전송
    │
    ▼
주기적 푸시
    │
    ├─> 백엔드가 매분 가격 업데이트를 푸시
    │       │
    │       └─> SDK가 price_update 메시지를 수신
    │
    ▼
Store 업데이트
    │
    ├─> PricesStore.updatePrice(...)
    │       │
    │       └─> 종속성 자동 업데이트 트리거
    │
    ▼
UI 응답
    │
    └─> 가격 차트/목록이 자동으로 새로고침
```

## 📦 패키지 구조

### npm 패키지 게시

```bash
@enclave-hq/sdk
├── dist/
│   ├── index.js         # CommonJS
│   ├── index.mjs        # ES Module
│   ├── index.d.ts       # TypeScript 정의
│   ├── react.js         # React 통합
│   ├── vue.js           # Vue 통합
│   └── nextjs.js        # Next.js 유틸리티
├── package.json
└── README.md
```

### 온디맨드 임포트

```typescript
// 코어 클라이언트
import { EnclaveClient } from '@enclave-hq/sdk';

// React Hooks
import { useEnclave, useCheckbooks } from '@enclave-hq/sdk/react';

// Next.js 유틸리티
import { createServerClient } from '@enclave-hq/sdk/nextjs';

// Vue Composables
import { useEnclave } from '@enclave-hq/sdk/vue';
```

## 🔐 보안 고려사항

### 개인 키 관리

- ✅ **브라우저**: MetaMask 등의 지갑 사용, 개인 키 저장 안 함
- ✅ **Node.js**: 환경 변수 또는 KMS 사용
- ✅ **모바일**: 기기 보안 스토리지 (SecureStore) 사용
- ❌ **절대 금지**: 코드에 개인 키 하드코딩

### WebSocket 보안

- ✅ JWT 토큰 인증
- ✅ 자동 재연결 및 토큰 갱신
- ✅ 메시지 서명 검증
- ✅ 속도 제한

### 데이터 검증

- ✅ 모든 입력 매개변수 검증
- ✅ 금액 범위 확인
- ✅ 주소 형식 검증
- ✅ ChainID 매핑 검증

## 🚀 성능 최적화

### Store 최적화

- ✅ **계산된 값**: 계산 결과 자동 캐싱
- ✅ **정밀 업데이트**: 변경된 부분만 업데이트
- ✅ **배치 작업**: 여러 업데이트 병합
- ✅ **지연 로딩**: 필요할 때 데이터 로드

### WebSocket 최적화

- ✅ **메시지 큐**: 고빈도 메시지 버퍼링
- ✅ **자동 재연결**: 연결 끊김 재연결 메커니즘
- ✅ **하트비트 감지**: 연결 활성 상태 유지
- ✅ **구독 관리**: 스마트 구독/구독 취소

### 번들 크기 최적화

- ✅ **Tree-shaking**: 사용하지 않는 코드는 번들에 포함되지 않음
- ✅ **코드 분할**: React/Vue 통합 온디맨드 로드
- ✅ **압축**: gzip + brotli
- ✅ **종속성 최적화**: 외부 종속성 최소화

| 모듈 | 크기 (gzipped) |
|--------|----------------|
| 코어 SDK | ~40KB |
| React 통합 | +5KB |
| Vue 통합 | +5KB |
| Next.js 유틸리티 | +3KB |

## 📚 관련 문서

- [JavaScript SDK 기술 설계](./SDK_JS_DESIGN.md) - 상세한 기술 설계
- [API 매핑 문서](./SDK_API_MAPPING.md) - SDK API에서 백엔드 API로의 매핑
- [백엔드 API 문서](../../backend/API_DOCUMENTATION.md) - 백엔드 REST API 참조
- [WebSocket 통합](../../backend/WEBSOCKET_INTEGRATION.md) - WebSocket 프로토콜 사양

## 🛣️ 로드맵

### 1단계: JavaScript SDK v2.0 ✅ 완료

- [x] 아키텍처 설계
- [x] 코어 구현
  - [x] Store 레이어
  - [x] API 레이어
  - [x] WebSocket 레이어
  - [x] 메인 클라이언트
- [x] 플랫폼 통합
  - [x] React
  - [x] Next.js
- [x] 문서 및 예제

### 2단계: Go SDK (계획 중)

- [ ] 아키텍처 설계
- [ ] 코어 구현
- [ ] gRPC 지원
- [ ] 예제 및 문서
- [ ] pkg.go.dev에 게시

### 3단계: Python SDK (계획 중)

- [ ] 아키텍처 설계
- [ ] 코어 구현
- [ ] Flask/Django 통합
- [ ] 예제 및 문서
- [ ] PyPI에 게시

### 4단계: Rust SDK (계획 중)

- [ ] 아키텍처 설계
- [ ] 코어 구현
- [ ] WASM 지원
- [ ] 예제 및 문서
- [ ] crates.io에 게시

## 📞 지원

- GitHub Issues: https://github.com/enclave-hq/enclave/issues
- 문서: https://docs.enclave-hq.com
- Discord: https://discord.gg/enclave

---

**버전**: v2.0.0-alpha  
**최종 업데이트**: 2025-01-17  
**유지관리자**: Enclave Team

