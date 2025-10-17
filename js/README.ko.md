# Enclave SDK (JavaScript/TypeScript)

**Languages**: [English](./README.md) | [中文](./README.zh.md) | [日本語](./README.ja.md) | 한국어

> 🚧 **개발 중** - v2.0.0-alpha

Enclave SDK는 Enclave 프라이버시 보호 멀티체인 DeFi 프로토콜과 상호 작용하기 위한 최신 JavaScript/TypeScript 클라이언트 라이브러리입니다.

## ✨ 기능

- 🔄 **반응형 상태 관리** - MobX 기반, 데이터 자동 동기화
- 🔌 **실시간 푸시** - WebSocket 자동 푸시 업데이트, 폴링 불필요
- 🌐 **범용 환경** - 브라우저, Node.js, React Native, Electron 지원
- ⚡ **TypeScript 우선** - 완전한 타입 정의 및 추론
- 🎯 **프레임워크 통합** - React, Vue, Next.js 등 즉시 사용 가능
- 📦 **Tree-shakable** - 필요한 것만 로드, 번들 크기 감소

## 📦 설치

```bash
npm install @enclave/sdk

# 또는
yarn add @enclave/sdk
pnpm add @enclave/sdk
```

## 🚀 빠른 시작

```typescript
import { EnclaveClient } from '@enclave/sdk';

// 클라이언트 생성
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// 연결 (로그인, WebSocket, 데이터 동기화를 한 번에)
await client.connect();

// 반응형 Store 접근
const checkbooks = client.stores.checkbooks.all;
const totalAmount = client.stores.checkbooks.totalDeposited;

// 커밋먼트 생성
await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000', '2000000'],
  tokenId: 'token-id',
});

// 출금 생성
await client.withdraw({
  allocationIds: ['allocation-1', 'allocation-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: 'withdraw',
});
```

## 📚 문서

전체 문서:

- [SDK 개요](./docs/SDK_OVERVIEW.ko.md) - 아키텍처 설계 및 사용 사례
- [기술 설계](./docs/SDK_JS_DESIGN.ko.md) - 상세한 기술 설계
- [API 매핑](./docs/SDK_API_MAPPING.ko.md) - SDK API와 백엔드 API 매핑

## 🛠️ 개발 상태

현재 버전: `v2.0.0-alpha.1`

**진행 상황**:
- [x] 문서 작성
- [x] 프로젝트 초기화
- [x] 핵심 구현
  - [x] 타입 정의
  - [x] Store 계층
  - [x] API 계층
  - [x] WebSocket 계층
  - [x] 메인 클라이언트
- [x] 플랫폼 통합
- [x] 예제

## 📄 라이선스

MIT © Enclave Team

