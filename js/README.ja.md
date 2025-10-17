# Enclave SDK (JavaScript/TypeScript)

**Languages**: [English](./README.md) | [中文](./README.zh.md) | 日本語 | [한국어](./README.ko.md)

> 🚧 **開発中** - v2.0.0-alpha

Enclave SDK は、Enclave プライバシー保護マルチチェーン DeFi プロトコルと対話するための最新の JavaScript/TypeScript クライアントライブラリです。

## ✨ 特徴

- 🔄 **リアクティブ状態管理** - MobX ベース、データ自動同期
- 🔌 **リアルタイムプッシュ** - WebSocket 自動プッシュ更新、ポーリング不要
- 🌐 **ユニバーサル環境** - ブラウザ、Node.js、React Native、Electron をサポート
- ⚡ **TypeScript ファースト** - 完全な型定義と推論
- 🎯 **フレームワーク統合** - React、Vue、Next.js などをすぐに使用可能
- 📦 **Tree-shakable** - オンデマンド読み込み、バンドルサイズの削減

## 📦 インストール

```bash
npm install @enclave/sdk

# または
yarn add @enclave/sdk
pnpm add @enclave/sdk
```

## 🚀 クイックスタート

```typescript
import { EnclaveClient } from '@enclave/sdk';

// クライアントを作成
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// 接続（ログイン、WebSocket、データ同期を一度に実行）
await client.connect();

// リアクティブ Store にアクセス
const checkbooks = client.stores.checkbooks.all;
const totalAmount = client.stores.checkbooks.totalDeposited;

// コミットメントを作成
await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000', '2000000'],
  tokenId: 'token-id',
});

// 出金を作成
await client.withdraw({
  allocationIds: ['allocation-1', 'allocation-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: 'withdraw',
});
```

## 📚 ドキュメント

完全なドキュメント：

- [SDK 概要](./docs/SDK_OVERVIEW.ja.md) - アーキテクチャ設計と使用例
- [技術設計](./docs/SDK_JS_DESIGN.ja.md) - 詳細な技術設計
- [API マッピング](./docs/SDK_API_MAPPING.ja.md) - SDK API とバックエンド API のマッピング

## 🛠️ 開発状況

現在のバージョン：`v2.0.0-alpha.1`

**進捗状況**：
- [x] ドキュメント作成
- [x] プロジェクト初期化
- [x] コア実装
  - [x] 型定義
  - [x] Store 層
  - [x] API 層
  - [x] WebSocket 層
  - [x] メインクライアント
- [x] プラットフォーム統合
- [x] サンプル

## 📄 ライセンス

MIT © Enclave Team

