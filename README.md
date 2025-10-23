# Enclave SDK

**Languages**: English | [中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

---

## Overview

Official Software Development Kits (SDKs) for integrating with Enclave, a privacy-preserving cross-chain payment protocol powered by zero-knowledge proofs.

## Available SDKs

### JavaScript/TypeScript SDK

📦 **Location**: [`/js`](./js/)

A comprehensive JavaScript/TypeScript SDK with reactive state management, supporting multiple JavaScript runtimes:

- ✅ **Browser** - Web applications with React, Vue, Angular
- ✅ **Node.js** - Backend services and scripts
- ✅ **React Native** - Mobile applications
- ✅ **Next.js** - Full-stack applications with SSR

**Key Features**:
- 🔄 Reactive state management with MobX
- 🔌 Real-time WebSocket synchronization
- 🔐 Flexible signer interface (private key, Web3 wallet, hardware wallet, remote signing)
- 📦 Complete TypeScript types
- 🌍 Multi-language documentation (English, Chinese, Japanese, Korean)

**Quick Start**:
```bash
cd js/
npm install
```

**Documentation**:
- [SDK Overview](./js/docs/SDK_OVERVIEW.md)
- [Technical Design](./js/docs/SDK_JS_DESIGN.md)
- [API Reference](./js/docs/SDK_API_MAPPING.md)

---

## Roadmap

### Planned SDKs

- 🔄 **Go SDK** - For Go backend services
- 🔄 **Python SDK** - For Python applications and data science
- 🔄 **Rust SDK** - For high-performance applications

*Want to contribute? Check out our [contribution guidelines](../CONTRIBUTING.md)*

---

## SDK Architecture

All Enclave SDKs follow a consistent architecture:

```
enclave/sdk/
├── js/                  # JavaScript/TypeScript SDK
│   ├── src/            # Source code
│   ├── docs/           # Documentation
│   └── examples/       # Usage examples
├── go/                 # Go SDK (planned)
├── python/             # Python SDK (planned)
└── rust/               # Rust SDK (planned)
```

---

## Common Features

All SDKs provide:

1. **Authentication**: Signature-based authentication with flexible signer support
2. **State Management**: Reactive data stores for Checkbooks, Allocations, and Withdrawals
3. **Real-time Updates**: WebSocket integration for live data synchronization
4. **Type Safety**: Complete type definitions for all data models
5. **Cross-chain Support**: Universal address format for multi-chain operations
6. **Commitment Operations**: SDK-internal data formatting for privacy-preserving deposits
7. **Withdrawal Operations**: Simplified withdrawal flow with signature preparation

---

## Getting Started

### Choose Your SDK

1. **JavaScript/TypeScript** → [`/js`](./js/)
2. **Go** → Coming soon
3. **Python** → Coming soon
4. **Rust** → Coming soon

### Installation

Each SDK has its own installation instructions. Navigate to the specific SDK directory and follow the README.

### Example: JavaScript SDK

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

// Access reactive stores
const checkbooks = client.stores.checkbooks.all;
const allocations = client.stores.allocations.all;
```

---

## Documentation

### General Documentation
- [SDK Overview](./js/docs/SDK_OVERVIEW.md) - High-level introduction
- [API Documentation](../backend/API_DOCUMENTATION.md) - Backend API reference
- [WebSocket Integration](../backend/WEBSOCKET_INTEGRATION.md) - Real-time data guide

### Language-Specific Documentation
Each SDK directory contains:
- `README.md` - SDK-specific setup and usage
- `docs/` - Technical design and API reference
- `examples/` - Usage examples and tutorials

---

## Support

- **Documentation**: [docs.enclave-hq.com](https://docs.enclave-hq.com)
- **Issues**: [github.com/enclave-hq/sdk/issues](https://github.com/enclave-hq/sdk/issues)
- **Discord**: [discord.gg/enclave](https://discord.gg/enclave)

---

## License

All Enclave SDKs are released under the [MIT License](./LICENSE).

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](../CONTRIBUTING.md) for details.

---

**Version**: 2.0.0  
**Last Updated**: 2025-01-21  
**Status**: Updated for Backend v2.0 (JavaScript SDK)

