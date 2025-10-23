# Enclave SDK

**Languages**: [English](./README.md) | 中文 | [日本語](./README.ja.md) | [한국어](./README.ko.md)

---

## 概述

Enclave 官方软件开发工具包（SDK），用于集成基于零知识证明的隐私保护跨链支付协议。

## 可用的 SDK

### JavaScript/TypeScript SDK

📦 **位置**: [`/js`](./js/)

功能完整的 JavaScript/TypeScript SDK，具有响应式状态管理，支持多种 JavaScript 运行环境：

- ✅ **浏览器** - 支持 React、Vue、Angular 的 Web 应用
- ✅ **Node.js** - 后端服务和脚本
- ✅ **React Native** - 移动应用
- ✅ **Next.js** - 支持 SSR 的全栈应用

**核心特性**:

- 🔄 基于 MobX 的响应式状态管理
- 🔌 实时 WebSocket 数据同步
- 🔐 灵活的签名接口（私钥、Web3 钱包、硬件钱包、远程签名）
- 📦 完整的 TypeScript 类型定义
- 🌍 多语言文档（英语、中文、日语、韩语）

**快速开始**:

```bash
cd js/
npm install
```

**文档**:

- [SDK 概览](./js/docs/SDK_OVERVIEW.zh-CN.md)
- [技术设计](./js/docs/SDK_JS_DESIGN.zh-CN.md)
- [API 参考](./js/docs/SDK_API_MAPPING.zh-CN.md)

---

## 路线图

### 计划中的 SDK

- 🔄 **Go SDK** - 用于 Go 后端服务
- 🔄 **Python SDK** - 用于 Python 应用和数据科学
- 🔄 **Rust SDK** - 用于高性能应用

*想要贡献？查看我们的[贡献指南](../CONTRIBUTING.md)*

---

## SDK 架构

所有 Enclave SDK 遵循统一的架构：

```
enclave/sdk/
├── js/                  # JavaScript/TypeScript SDK
│   ├── src/            # 源代码
│   ├── docs/           # 文档
│   └── examples/       # 使用示例
├── go/                 # Go SDK（计划中）
├── python/             # Python SDK（计划中）
└── rust/               # Rust SDK（计划中）
```

---

## 通用特性

所有 SDK 都提供：

1. **身份认证**：基于签名的认证，支持灵活的签名方式
2. **状态管理**：Checkbook、Allocation、Withdrawal 的响应式数据存储
3. **实时更新**：WebSocket 集成，实时数据同步
4. **类型安全**：所有数据模型的完整类型定义
5. **跨链支持**：通用地址格式，支持多链操作
6. **Commitment 操作**：SDK 内部数据格式化，保护隐私的充值操作
7. **Withdrawal 操作**：简化的提现流程，包含签名数据准备

---

## 开始使用

### 选择您的 SDK

1. **JavaScript/TypeScript** → [`/js`](./js/)
2. **Go** → 即将推出
3. **Python** → 即将推出
4. **Rust** → 即将推出

### 安装

每个 SDK 都有自己的安装说明。导航到特定的 SDK 目录并按照 README 操作。

### 示例：JavaScript SDK

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

// 访问响应式存储
const checkbooks = client.stores.checkbooks.all;
const allocations = client.stores.allocations.all;
```

---

## 文档

### 通用文档

- [SDK 概览](./js/docs/SDK_OVERVIEW.zh-CN.md) - 高层次介绍
- [API 文档](../backend/API_DOCUMENTATION.md) - 后端 API 参考
- [WebSocket 集成](../backend/WEBSOCKET_INTEGRATION.md) - 实时数据指南

### 特定语言文档

每个 SDK 目录包含：

- `README.md` - SDK 特定的设置和使用说明
- `docs/` - 技术设计和 API 参考
- `examples/` - 使用示例和教程

---

## 支持

- **文档**: [docs.enclave-hq.com](https://docs.enclave-hq.com)
- **问题**: [github.com/enclave-hq/sdk/issues](https://github.com/enclave-hq/sdk/issues)
- **Discord**: [discord.gg/enclave](https://discord.gg/enclave)

---

## 许可证

所有 Enclave SDK 都基于 [MIT License](./LICENSE) 发布。

---

## 贡献

我们欢迎贡献！请查看我们的[贡献指南](../CONTRIBUTING.md)了解详情。

---

**版本**: 2.0.0
**最后更新**: 2025-01-17
**状态**: 生产就绪（JavaScript SDK）
