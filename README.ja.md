# Enclave SDK

**Languages**: [English](./README.md) | [中文](./README.zh-CN.md) | 日本語 | [한국어](./README.ko.md)

---

## 概要

ゼロ知識証明を活用したプライバシー保護クロスチェーン決済プロトコル Enclave と統合するための公式ソフトウェア開発キット（SDK）。

## 利用可能な SDK

### JavaScript/TypeScript SDK

📦 **場所**: [`/js`](./js/)

リアクティブ状態管理を備えた包括的な JavaScript/TypeScript SDK。複数の JavaScript ランタイムをサポート：

- ✅ **ブラウザ** - React、Vue、Angular を使用した Web アプリケーション
- ✅ **Node.js** - バックエンドサービスとスクリプト
- ✅ **React Native** - モバイルアプリケーション
- ✅ **Next.js** - SSR 対応のフルスタックアプリケーション

**主な機能**:
- 🔄 MobX によるリアクティブ状態管理
- 🔌 リアルタイム WebSocket 同期
- 🔐 柔軟な署名インターフェース（秘密鍵、Web3 ウォレット、ハードウェアウォレット、リモート署名）
- 📦 完全な TypeScript 型定義
- 🌍 多言語ドキュメント（英語、中国語、日本語、韓国語）

**クイックスタート**:
```bash
cd js/
npm install
```

**ドキュメント**:
- [SDK 概要](./js/docs/SDK_OVERVIEW.ja.md)
- [技術設計](./js/docs/SDK_JS_DESIGN.ja.md)
- [API リファレンス](./js/docs/SDK_API_MAPPING.ja.md)

---

## ロードマップ

### 予定されている SDK

- 🔄 **Go SDK** - Go バックエンドサービス用
- 🔄 **Python SDK** - Python アプリケーションとデータサイエンス用
- 🔄 **Rust SDK** - 高性能アプリケーション用

*貢献したいですか？[貢献ガイドライン](../CONTRIBUTING.md)をご覧ください*

---

## SDK アーキテクチャ

すべての Enclave SDK は一貫したアーキテクチャに従います：

```
enclave/sdk/
├── js/                  # JavaScript/TypeScript SDK
│   ├── src/            # ソースコード
│   ├── docs/           # ドキュメント
│   └── examples/       # 使用例
├── go/                 # Go SDK（予定）
├── python/             # Python SDK（予定）
└── rust/               # Rust SDK（予定）
```

---

## 共通機能

すべての SDK は以下を提供します：

1. **認証**：柔軟な署名サポートを備えた署名ベースの認証
2. **状態管理**：Checkbook、Allocation、Withdrawal のリアクティブデータストア
3. **リアルタイム更新**：ライブデータ同期のための WebSocket 統合
4. **型安全性**：すべてのデータモデルの完全な型定義
5. **クロスチェーンサポート**：マルチチェーン操作のための汎用アドレス形式
6. **Commitment 操作**：プライバシー保護デポジットのための SDK 内部データフォーマット
7. **Withdrawal 操作**：署名準備を含む簡素化された出金フロー

---

## はじめに

### SDK を選択

1. **JavaScript/TypeScript** → [`/js`](./js/)
2. **Go** → 近日公開
3. **Python** → 近日公開
4. **Rust** → 近日公開

### インストール

各 SDK には独自のインストール手順があります。特定の SDK ディレクトリに移動し、README に従ってください。

### 例：JavaScript SDK

```bash
cd js/
npm install
```

```typescript
import { EnclaveClient } from '@enclave/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  signer: privateKeyOrSignerCallback,
});

await client.connect();

// リアクティブストアへのアクセス
const checkbooks = client.stores.checkbooks.all;
const allocations = client.stores.allocations.all;
```

---

## ドキュメント

### 一般ドキュメント
- [SDK 概要](./js/docs/SDK_OVERVIEW.ja.md) - 高レベル紹介
- [API ドキュメント](../backend/API_DOCUMENTATION.md) - バックエンド API リファレンス
- [WebSocket 統合](../backend/WEBSOCKET_INTEGRATION.md) - リアルタイムデータガイド

### 言語固有のドキュメント
各 SDK ディレクトリには以下が含まれます：
- `README.md` - SDK 固有のセットアップと使用方法
- `docs/` - 技術設計と API リファレンス
- `examples/` - 使用例とチュートリアル

---

## サポート

- **ドキュメント**: [docs.enclave-hq.com](https://docs.enclave-hq.com)
- **問題**: [github.com/enclave-hq/sdk/issues](https://github.com/enclave-hq/sdk/issues)
- **Discord**: [discord.gg/enclave](https://discord.gg/enclave)

---

## ライセンス

すべての Enclave SDK は [MIT License](./LICENSE) の下でリリースされています。

---

## 貢献

貢献を歓迎します！詳細については[貢献ガイドライン](../CONTRIBUTING.md)をご覧ください。

---

**バージョン**: 2.0.0  
**最終更新**: 2025-01-17  
**ステータス**: 本番環境対応（JavaScript SDK）

