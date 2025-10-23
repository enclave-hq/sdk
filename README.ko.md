# Enclave SDK

**Languages**: [English](./README.md) | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | 한국어

---

## 개요

영지식 증명 기반 프라이버시 보호 크로스체인 결제 프로토콜 Enclave와 통합하기 위한 공식 소프트웨어 개발 키트(SDK).

## 사용 가능한 SDK

### JavaScript/TypeScript SDK

📦 **위치**: [`/js`](./js/)

반응형 상태 관리 기능을 갖춘 포괄적인 JavaScript/TypeScript SDK. 여러 JavaScript 런타임 지원:

- ✅ **브라우저** - React, Vue, Angular를 사용한 웹 애플리케이션
- ✅ **Node.js** - 백엔드 서비스 및 스크립트
- ✅ **React Native** - 모바일 애플리케이션
- ✅ **Next.js** - SSR 지원 풀스택 애플리케이션

**주요 기능**:
- 🔄 MobX 기반 반응형 상태 관리
- 🔌 실시간 WebSocket 동기화
- 🔐 유연한 서명 인터페이스 (개인 키, Web3 지갑, 하드웨어 지갑, 원격 서명)
- 📦 완전한 TypeScript 타입 정의
- 🌍 다국어 문서 (영어, 중국어, 일본어, 한국어)

**빠른 시작**:
```bash
cd js/
npm install
```

**문서**:
- [SDK 개요](./js/docs/SDK_OVERVIEW.ko.md)
- [기술 설계](./js/docs/SDK_JS_DESIGN.ko.md)
- [API 참조](./js/docs/SDK_API_MAPPING.ko.md)

---

## 로드맵

### 계획된 SDK

- 🔄 **Go SDK** - Go 백엔드 서비스용
- 🔄 **Python SDK** - Python 애플리케이션 및 데이터 사이언스용
- 🔄 **Rust SDK** - 고성능 애플리케이션용

*기여하고 싶으신가요? [기여 가이드라인](../CONTRIBUTING.md)을 확인하세요*

---

## SDK 아키텍처

모든 Enclave SDK는 일관된 아키텍처를 따릅니다:

```
enclave/sdk/
├── js/                  # JavaScript/TypeScript SDK
│   ├── src/            # 소스 코드
│   ├── docs/           # 문서
│   └── examples/       # 사용 예제
├── go/                 # Go SDK (계획 중)
├── python/             # Python SDK (계획 중)
└── rust/               # Rust SDK (계획 중)
```

---

## 공통 기능

모든 SDK는 다음을 제공합니다:

1. **인증**: 유연한 서명 지원을 갖춘 서명 기반 인증
2. **상태 관리**: Checkbook, Allocation, Withdrawal을 위한 반응형 데이터 스토어
3. **실시간 업데이트**: 실시간 데이터 동기화를 위한 WebSocket 통합
4. **타입 안전성**: 모든 데이터 모델에 대한 완전한 타입 정의
5. **크로스체인 지원**: 멀티체인 작업을 위한 범용 주소 형식
6. **Commitment 작업**: 프라이버시 보호 예치를 위한 SDK 내부 데이터 포맷팅
7. **Withdrawal 작업**: 서명 준비를 포함한 간소화된 출금 흐름

---

## 시작하기

### SDK 선택

1. **JavaScript/TypeScript** → [`/js`](./js/)
2. **Go** → 곧 출시
3. **Python** → 곧 출시
4. **Rust** → 곧 출시

### 설치

각 SDK에는 고유한 설치 지침이 있습니다. 특정 SDK 디렉토리로 이동하여 README를 따르세요.

### 예제: JavaScript SDK

```bash
cd js/
npm install
```

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: privateKeyOrSignerCallback,
});

await client.connect();

// 반응형 스토어 액세스
const checkbooks = client.stores.checkbooks.all;
const allocations = client.stores.allocations.all;
```

---

## 문서

### 일반 문서
- [SDK 개요](./js/docs/SDK_OVERVIEW.ko.md) - 고수준 소개
- [API 문서](../backend/API_DOCUMENTATION.md) - 백엔드 API 참조
- [WebSocket 통합](../backend/WEBSOCKET_INTEGRATION.md) - 실시간 데이터 가이드

### 언어별 문서
각 SDK 디렉토리에는 다음이 포함됩니다:
- `README.md` - SDK 전용 설정 및 사용법
- `docs/` - 기술 설계 및 API 참조
- `examples/` - 사용 예제 및 튜토리얼

---

## 지원

- **문서**: [docs.enclave-hq.com](https://docs.enclave-hq.com)
- **이슈**: [github.com/enclave-hq/sdk/issues](https://github.com/enclave-hq/sdk/issues)
- **Discord**: [discord.gg/enclave](https://discord.gg/enclave)

---

## 라이선스

모든 Enclave SDK는 [MIT License](./LICENSE)로 릴리스됩니다.

---

## 기여

기여를 환영합니다! 자세한 내용은 [기여 가이드라인](../CONTRIBUTING.md)을 참조하세요.

---

**버전**: 2.0.0  
**최종 업데이트**: 2025-01-17  
**상태**: 프로덕션 준비 완료 (JavaScript SDK)

