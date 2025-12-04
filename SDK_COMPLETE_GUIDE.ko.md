# Enclave SDK 완전 가이드

> **최종 업데이트**: 2025-01-21  
> **SDK 버전**: v2.3.6

**Languages**: [English](./SDK_COMPLETE_GUIDE.en.md) | [中文](./SDK_COMPLETE_GUIDE.md) | [日本語](./SDK_COMPLETE_GUIDE.ja.md) | 한국어

---

## 📋 목차

1. [개요](#개요)
2. [SDK API 인터페이스 목록](#sdk-api-인터페이스-목록)
3. [WebFront 통합 가이드](#webfront-통합-가이드)
4. [사용 예제](#사용-예제)
5. [업데이트 로그](#업데이트-로그)

---

## 개요

Enclave SDK는 Enclave 프라이버시 보호 멀티체인 DeFi 프로토콜과 상호 작용하기 위한 완전한 JavaScript/TypeScript 클라이언트 라이브러리를 제공합니다.

### 핵심 기능

- 🔄 **반응형 상태 관리** - MobX 기반, 자동 데이터 동기화
- 🔌 **실시간 푸시** - WebSocket 자동 푸시 업데이트, 폴링 불필요
- 🌐 **범용 환경** - Browser, Node.js, React Native, Electron 지원
- ⚡ **TypeScript First** - 완전한 타입 정의 및 추론
- 🎯 **프레임워크 통합** - React, Vue, Next.js 즉시 사용 가능

### 아키텍처 개요

```
WebFront 페이지 레이어
  ↓ useHooks
비즈니스 Hooks 레이어
  ↓ 호출
Store 레이어 (MobX)
  ↓ 호출
SDK 레이어 (@enclave-hq/sdk)
  ↓ 호출
백엔드 API / 온체인 컨트랙트
```

---

## SDK API 인터페이스 목록

### 개요

SDK는 **13개의 API 클라이언트 클래스**를 포함하며 **68개의 API 메서드**를 제공합니다.

### API 클라이언트 카테고리

#### 1. 🔐 인증 관련 (AuthAPI) - 5개

- **`authenticate(request: AuthRequest)`** - 지갑 서명 로그인
  ```typescript
  await client.auth.authenticate({
    address: { universalFormat: '0x...' },
    message: 'Sign this message...',
    signature: '0x...',
    chainId: 1
  });
  ```
- **`refreshToken(request: RefreshTokenRequest)`** - JWT Token 새로고침
  ```typescript
  await client.auth.refreshToken({ token: 'old-token' });
  ```
- **`logout()`** - 로그아웃
  ```typescript
  await client.auth.logout();
  ```
- **`verifyToken()`** - Token 유효성 검증
  ```typescript
  const isValid = await client.auth.verifyToken();
  ```
- **`getNonce(address?: string)`** - 서명 챌린지 Nonce 가져오기
  ```typescript
  const { nonce, message } = await client.auth.getNonce('0x...');
  ```

#### 2. 📝 Checkbook 관련 (CheckbooksAPI) - 5개

- **`listCheckbooks(request?: ListCheckbooksRequest)`** - 사용자의 Checkbooks 목록
  ```typescript
  const checkbooks = await client.checkbooks.listCheckbooks({
    page: 1,
    limit: 10,
    status: 'with_checkbook' // Checkbook 상태 (예: 'pending', 'with_checkbook' 등)
  });
  ```
- **`getCheckbookById(request: GetCheckbookRequest)`** - 단일 Checkbook 조회
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookById({ id: 'cb-123' });
  ```
- **`getCheckbookByDeposit(request: GetCheckbookByDepositRequest)`** - Deposit으로 Checkbook 조회
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookByDeposit({
    chainId: 1,
    txHash: '0x...'
  });
  ```
- **`getCheckbooksByOwner(owner: string, ...)`** - (사용 중단됨) 소유자별 Checkbooks 조회
  ```typescript
  // listCheckbooks()를 사용하십시오
  ```
- **`deleteCheckbook(id: string)`** - Checkbook 삭제
  ```typescript
  await client.checkbooks.deleteCheckbook('cb-123');
  ```

#### 3. 💰 Allocation 관련 (AllocationsAPI) - 5개

- **`listAllocations(request?: ListAllocationsRequest)`** - 할당 레코드 목록
  ```typescript
  const allocations = await client.allocations.listAllocations({
    checkbookId: 'cb-123',
    status: 'idle', // 'idle', 'pending', 또는 'used'
    tokenKeys: ['USDT', 'USDC'] // 여러 토큰 키로 필터링
  });
  ```
- **`searchAllocations(request: SearchAllocationsRequest)`** - 할당 일괄 검색
  ```typescript
  const results = await client.allocations.searchAllocations({
    chain_slip44_id: 60,
    addresses: ['0x...'],
    token_keys: ['USDT', 'USDC'] // 여러 토큰 키로 필터링
  });
  ```
- **`createAllocations(request: CreateAllocationsRequest)`** - 할당 생성 (Commitment)
  ```typescript
  await client.allocations.createAllocations({
    checkbookId: 'cb-123',
    amounts: ['1000'],
    tokenKey: 'USDT',
    signature: '0x...',
    message: '...'
  });
  ```
- **`getAllocationsByCheckbookId(checkbookId: string, status?: string)`** - Checkbook별 할당 조회
  ```typescript
  const list = await client.allocations.getAllocationsByCheckbookId('cb-123');
  ```
- **`getAllocationsByTokenIdAndStatus(tokenId: string, status: string)`** - Token 및 상태별 할당 조회
  ```typescript
  const list = await client.allocations.getAllocationsByTokenIdAndStatus('token-1', 'idle'); // 'idle', 'pending', 또는 'used'
  ```

#### 4. 📤 Withdrawal 관련 (WithdrawalsAPI) - 7개

- **`listWithdrawRequests(request?: ListWithdrawRequestsRequest)`** - 출금 요청 목록
  ```typescript
  const requests = await client.withdrawals.listWithdrawRequests({
    page: 1,
    limit: 20,
    status: 'pending'
  });
  ```
- **`getWithdrawRequestById(request: GetWithdrawRequestRequest)`** - 단일 출금 요청 조회
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestById({ id: 'req-123' });
  ```
- **`getWithdrawRequestByNullifier(request: GetWithdrawRequestByNullifierRequest)`** - nullifier로 조회
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestByNullifier({ nullifier: '0x...' });
  ```
- **`createWithdrawRequest(request: CreateWithdrawRequestRequest)`** - 출금 요청 생성
  ```typescript
  await client.withdrawals.createWithdrawRequest({
    checkbookId: 'cb-123',
    allocationIds: ['alloc-1'],
    intent: { ... },
    signature: '0x...',
    chainId: 1
  });
  ```
- **`retryWithdrawRequest(request: RetryWithdrawRequestRequest)`** - 실패한 출금 재시도
  ```typescript
  await client.withdrawals.retryWithdrawRequest({ id: 'req-123' });
  ```
- **`cancelWithdrawRequest(request: CancelWithdrawRequestRequest)`** - 출금 요청 취소
  ```typescript
  await client.withdrawals.cancelWithdrawRequest({ id: 'req-123' });
  ```
- **`getWithdrawStats(request?: GetWithdrawStatsRequest)`** - 출금 통계 가져오기
  ```typescript
  const stats = await client.withdrawals.getWithdrawStats();
  ```

#### 5. 👥 Beneficiary 관련 (BeneficiaryAPI) - 3개 ⭐

- **`listBeneficiaryWithdrawRequests(request?: ListBeneficiaryWithdrawRequestsRequest)`** - 수혜자로서의 출금 요청 목록
  ```typescript
  const requests = await client.beneficiary.listBeneficiaryWithdrawRequests({
    status: 'waiting_for_payout'
  });
  ```
- **`requestPayoutExecution(request: RequestPayoutExecutionRequest)`** - 페이아웃 실행 요청
  ```typescript
  await client.beneficiary.requestPayoutExecution({ id: 'req-123' });
  ```
- **`claimTimeout(request: ClaimTimeoutRequest)`** - 타임아웃 청구
  ```typescript
  await client.beneficiary.claimTimeout({ id: 'req-123' });
  ```

#### 6. 🏊 Pool & Token 관련 (PoolsAPI) - 5개

- **`listPools(request?: ListPoolsRequest)`** - 모든 풀 목록
  ```typescript
  const pools = await client.pools.listPools({ isActive: true });
  ```
- **`getPoolById(request: GetPoolRequest)`** - 풀 세부 정보 가져오기
  ```typescript
  const pool = await client.pools.getPoolById({ id: 'pool-1' });
  ```
- **`listTokens(request?: ListTokensRequest)`** - 토큰 목록
  ```typescript
  const tokens = await client.pools.listTokens({ chainId: 1 });
  ```
- **`getTokenById(request: GetTokenRequest)`** - 토큰 세부 정보 가져오기
  ```typescript
  const token = await client.pools.getTokenById({ id: 'token-1' });
  ```
- **`getActiveTokens(chainId?: number)`** - 활성 토큰 가져오기
  ```typescript
  const tokens = await client.pools.getActiveTokens(1);
  ```

#### 7. 💹 가격 관련 (PricesAPI) - 3개

- **`getTokenPrices(request?: GetTokenPricesRequest)`** - 토큰 가격 일괄 가져오기
  ```typescript
  const prices = await client.prices.getTokenPrices({ symbols: ['ETH', 'USDT'] });
  ```
- **`getTokenPrice(symbol: string)`** - 단일 토큰 가격 가져오기
  ```typescript
  const price = await client.prices.getTokenPrice('ETH');
  ```
- **`getAllPrices()`** - 모든 가격 가져오기
  ```typescript
  const allPrices = await client.prices.getAllPrices();
  ```

#### 8. 📊 지표 관련 (MetricsAPI) - 6개

- **`getPoolMetrics(poolId: number)`** - 풀 지표 가져오기
  ```typescript
  const metrics = await client.metrics.getPoolMetrics(1);
  ```
- **`getTokenMetrics(assetId: string)`** - 토큰 지표 가져오기
  ```typescript
  const metrics = await client.metrics.getTokenMetrics('0x...');
  ```
- **`getPoolMetricsHistory(poolId: number, metricType: string, days?: number)`** - 풀 지표 이력 가져오기
  ```typescript
  const history = await client.metrics.getPoolMetricsHistory(1, 'apy', 30);
  ```
- **`getTokenMetricsHistory(assetId: string, metricType: string, days?: number)`** - 토큰 지표 이력 가져오기
  ```typescript
  const history = await client.metrics.getTokenMetricsHistory('0x...', 'price', 7);
  ```
- **`getBatchPoolMetrics(poolIds: number[])`** - 풀 지표 일괄 가져오기
  ```typescript
  const batch = await client.metrics.getBatchPoolMetrics([1, 2]);
  ```
- **`getBatchTokenMetrics(assetIds: string[])`** - 토큰 지표 일괄 가져오기
  ```typescript
  const batch = await client.metrics.getBatchTokenMetrics(['0x...', '0x...']);
  ```

#### 9. 🛣️ 견적 관련 (QuoteAPI) - 2개

- **`getRouteAndFees(request: RouteAndFeesRequest)`** - 경로 및 수수료 조회
  ```typescript
  const quote = await client.quote.getRouteAndFees({
    amount: '1000',
    deposit_token: '0x...',
    owner_data: { ... },
    intent: { ... }
  });
  ```
- **`getHookAsset(request: HookAssetRequest)`** - Hook 자산 정보 조회
  ```typescript
  const info = await client.quote.getHookAsset({
    asset_id: '0x...',
    chain_id: 1,
    amount: '1000'
  });
  ```

#### 10. 🔗 체인 설정 관련 (ChainConfigAPI) - 6개

- **`getChainConfig(chainId: number)`** - 체인 설정 가져오기
  ```typescript
  const config = await client.chainConfig.getChainConfig(1);
  ```
- **`getTreasuryAddress(chainId: number)`** - Treasury 주소 가져오기
  ```typescript
  const address = await client.chainConfig.getTreasuryAddress(1);
  ```
- **`getIntentManagerAddress(chainId: number)`** - IntentManager 주소 가져오기
  ```typescript
  const address = await client.chainConfig.getIntentManagerAddress(1);
  ```
- **`getRpcEndpoint(chainId: number)`** - RPC 엔드포인트 가져오기
  ```typescript
  const rpc = await client.chainConfig.getRpcEndpoint(1);
  ```
- **`listChains()`** - 모든 활성 체인 목록
  ```typescript
  const chains = await client.chainConfig.listChains();
  ```
- **`getAllTreasuryAddresses()`** - 모든 Treasury 주소 가져오기
  ```typescript
  const addresses = await client.chainConfig.getAllTreasuryAddresses();
  ```

#### 11. 🔀 Token 라우팅 규칙 관련 (TokenRoutingAPI) - 3개 ⭐

- **`getAllowedTargets(request?: GetAllowedTargetsRequest)`** - 허용된 대상 체인 및 토큰 조회 (매개변수 없이 전체 조회 지원)
  ```typescript
  const targets = await client.tokenRouting.getAllowedTargets({
    source_chain_id: 1,
    source_token_key: 'USDT'
  });
  ```
- **`getAllPoolsAndTokens()`** - 모든 풀 및 토큰 가져오기 (편의 메서드)
  ```typescript
  const all = await client.tokenRouting.getAllPoolsAndTokens();
  ```
- **`getTargetsForSource(sourceChainId: number, sourceTokenId: string)`** - 특정 소스의 대상 가져오기 (편의 메서드)
  ```typescript
  const targets = await client.tokenRouting.getTargetsForSource(1, 'USDT');
  ```

#### 12. 🔑 KMS 관련 (KMSAPI) - 2개

- **`sign(request: KMSSignRequest)`** - KMS를 사용하여 데이터 서명
  ```typescript
  const sig = await client.kms.sign({ data: '0x...', keyId: '...' });
  ```
- **`getPublicKey(request?: KMSPublicKeyRequest)`** - KMS 관리 공개 키 가져오기
  ```typescript
  const pk = await client.kms.getPublicKey({ keyId: '...' });
  ```

#### 13. 🎯 EnclaveClient 고급 메서드 - 16개

**연결 관리 (5개)**:
- `connect()` - Enclave 서비스에 연결
- `disconnect()` - 연결 해제
- `connection` (getter) - 연결 정보 가져오기
- `isConnected` (getter) - 연결 상태 확인
- `address` (getter) - 현재 사용자 주소 가져오기

**Commitment 작업 (3개)**:
- `createCommitment(params)` - Commitment 생성 (전체 흐름)
- `prepareCommitment(params)` - Commitment 서명 데이터 준비
- `submitCommitment(params, signature)` - 서명된 Commitment 제출

**Withdrawal 작업 (5개)**:
- `withdraw(params)` - 출금 생성 (전체 흐름)
- `prepareWithdraw(params)` - 출금 서명 데이터 준비
- `submitWithdraw(params, signature)` - 서명된 출금 제출
- `retryWithdraw(withdrawalId)` - 실패한 출금 요청 재시도
- `cancelWithdraw(withdrawalId)` - 대기 중인 출금 요청 취소

**API 접근자 (5개)**:
- `quote` (getter) - QuoteAPI 액세스
- `metrics` (getter) - MetricsAPI 액세스
- `chainConfig` (getter) - ChainConfigAPI 액세스
- `beneficiary` (getter) - BeneficiaryAPI 액세스
- `tokenRouting` (getter) - TokenRoutingAPI 액세스

### 인터페이스 통계 요약

| API 카테고리 | 메서드 수 | 상태 |
|-------------|----------|------|
| 인증 | 5 | ✅ |
| Checkbook | 5 | ✅ |
| Allocation | 5 | ✅ |
| Withdrawal | 7 | ✅ |
| Beneficiary | 3 | ⭐ 신규 |
| Pool & Token | 5 | ✅ |
| 가격 | 3 | ✅ |
| 지표 | 6 | ✅ |
| 견적 | 2 | ✅ |
| 체인 설정 | 6 | ✅ |
| Token 라우팅 | 3 | ⭐ 신규 |
| KMS | 2 | ✅ |
| EnclaveClient 고급 | 16 | ✅ |
| **합계** | **68** | ✅ |

---

## WebFront 통합 가이드

### 통합 아키텍처

```
WebFront 페이지 레이어 (React Components, Pages, Hooks)
  ↓ useHooks
SDKStore (MobX Store)
  ↓ 호출
EnclaveClient (SDK 메인 클라이언트)
  ↓ 호출
13개의 API 클라이언트 클래스
  ↓ 호출
백엔드 REST API
```

### 핵심 인터페이스 (필수)

1. **EnclaveClient 고급 메서드** - 16개 메서드
   - 연결 관리: 5개
   - Commitment 작업: 3개
   - Withdrawal 작업: 5개
   - API 접근자: 5개

2. **반응형 Stores** - 5개 Store
   - `stores.checkbooks` - Checkbook 데이터
   - `stores.allocations` - Allocation 데이터
   - `stores.withdrawals` - Withdrawal 데이터
   - `stores.prices` - 가격 데이터
   - `stores.pools` - Pool 데이터

3. **API 접근자** - 3개
   - `quote` - 경로 및 수수료 조회
   - `chainConfig` - 체인 설정 조회
   - `tokenRouting` - Token 라우팅 규칙 조회

### 페이지와 SDK 매핑

| 페이지 | 페이지 내용 | Store 읽기 | Hook 사용 | SDK 메서드 호출 |
|--------|-----------|-----------|-----------|----------------|
| `/home` | 추천 상품, 총 잠금량 | `stores.pools`<br>`stores.prices` | `useFeaturedPools()`<br>`useUserAssets()` | - |
| `/deposit` | 예금 기록, 바우처 할당 | `stores.checkbooks`<br>`stores.allocations` | `useCheckbooksData()`<br>`useDepositActions()` | `sdk.createCommitment()` |
| `/defi` | 대출 풀, RWA 자산, 출금 | `stores.pools`<br>`stores.allocations` | `useFeaturedPools()`<br>`useAllocationsData()`<br>`useQuoteRoute()` | `sdk.quote.getRouteAndFees()`<br>`sdk.withdraw()` |
| `/records` | 거래 이력 | `stores.withdrawals` | - | - |

### 사용 방법

#### 1. SDKStore를 통한 사용 (권장)

```typescript
const sdkStore = useSDKStore()

// 데이터 가져오기
await sdkStore.fetchCheckbooks()
await sdkStore.fetchAllocations()

// 비즈니스 작업
await sdkStore.createCommitment({ ... })
await sdkStore.withdraw({ ... })
```

#### 2. SDK 직접 사용 (고급)

```typescript
const sdk = sdkStore.sdk
if (sdk) {
  // 반응형 Stores 사용
  const checkbooks = sdk.stores.checkbooks.all
  const allocations = sdk.stores.allocations.all
  
  // API 클라이언트 사용
  const quote = await sdk.quote.getRouteAndFees({ ... })
  const chainConfig = await sdk.chainConfig.getChainConfig(714)
  
  // 새로운 API 사용
  const pools = await sdk.tokenRouting.getAllPoolsAndTokens()
}
```

---

## 사용 예제

### 예제 1: 예금하고 Commitment 생성

```typescript
// 1. SDK 연결
await client.connect()

// 2. 예금 기록 가져오기
const checkbooks = await client.stores.checkbooks.fetchList()

// 3. Commitment 생성
const allocations = await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000'],
  tokenId: 'token-id'
})

// 4. 반응형 업데이트
// stores.allocations가 자동으로 업데이트됩니다
```

### 예제 2: 체인으로 출금

```typescript
// 1. 경로 및 수수료 조회
const quote = await client.quote.getRouteAndFees({
  owner_data: { chain_id: 60, data: userAddress },
  deposit_token: tokenAddress,
  intent: { type: 'RawToken', ... },
  amount: amountInWei
})

// 2. 출금 생성
const withdrawRequest = await client.withdraw({
  allocationIds: ['alloc-1', 'alloc-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: { type: 'RawToken', ... }
})

// 3. 반응형 업데이트
// stores.withdrawals가 자동으로 업데이트됩니다
```

### 예제 3: Token 라우팅 규칙 조회

```typescript
// 모든 풀 및 토큰 조회
const allPools = await client.tokenRouting.getAllPoolsAndTokens()

// 특정 소스의 대상 조회
const targets = await client.tokenRouting.getTargetsForSource(
  714, 
  '0x55d398326f99059fF775485246999027B3197955'
)
```

---

## 업데이트 로그

### v2.3.6 (최신)

- ✅ `listAllocations()`에 `tokenKeys` 필터 지원 추가 - 여러 토큰 키(예: ["USDT", "USDC"])로 할당 필터링
- ✅ `searchAllocations()`에 `token_keys` 필터 지원 추가 - 여러 토큰 키로 할당 필터링
- ✅ 할당 응답의 checkbook 정보에 `user_address` 필드 추가 - 예금자의 유니버설 주소 포함
- ✅ `AllocationsStore.fetchList()` 업데이트하여 `tokenKeys` 매개변수 지원
- ✅ 예제에서 할당 응답 표시 개선, checkbook별로 그룹화하여 표시

### v2.0.2

- ✅ `BeneficiaryAPI` 추가 - 수혜자 작업
- ✅ `TokenRoutingAPI` 추가 - Token 라우팅 규칙 조회
- ✅ 모든 API 엔드포인트를 `/api/` 형식으로 통일
- ✅ `WithdrawalsAPI`를 새로운 Intent 형식으로 업데이트
- ✅ QuoteAPI 경로를 `/api/v2/quote/...`로 수정
- ✅ TokenRoutingAPI 타입 정의를 완전한 Pool 정보를 포함하도록 업데이트

### v2.0.1

- ✅ 초기 릴리스
- ✅ 완전한 TypeScript 타입 정의
- ✅ MobX 반응형 상태 관리
- ✅ WebSocket 실시간 동기화

---

## 관련 문서

- [SDK API 매핑](./js/docs/SDK_API_MAPPING.ko.md) - SDK API에서 백엔드 API로의 매핑
- [기술 설계](./js/docs/SDK_JS_DESIGN.ko.md) - 상세 기술 설계
- [백엔드 API 문서](../backend/API_DOCUMENTATION.md) - 완전한 백엔드 API 문서

---

**문서 유지보수**: SDK 팀  
**이슈 보고**: [GitHub Issues](https://github.com/enclave-hq/sdk/issues)

