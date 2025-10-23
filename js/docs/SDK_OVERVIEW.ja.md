# Enclave SDK 概要

**Languages**: [English](./SDK_OVERVIEW.md) | [中文](./SDK_OVERVIEW.zh-CN.md) | 日本語 | [한국어](./SDK_OVERVIEW.ko.md)

## 🎯 概要

Enclave SDK は、Enclave プライバシー保護マルチチェーン DeFi プロトコルと対話するための多言語クライアントライブラリスイートです。SDK は、入金、コミットメント作成、出金を含む完全なビジネスプロセスをサポートする統一された使いやすい API を提供します。

## 🏗️ アーキテクチャ設計

### コアフィロソフィー

**命令型からリアクティブへ**：Enclave SDK v2.0 は、Store パターンと WebSocket リアルタイム同期に基づく全く新しいリアクティブアーキテクチャを採用し、開発者がデータポーリングと状態管理について心配する必要をなくします。

```
従来の命令型 API              リアクティブ Store 駆動
┌─────────────────┐          ┌─────────────────┐
│ API を呼び出す   │          │ 一度接続        │
│ 応答を待つ      │   ═══>   │ Store 自動同期  │
│ 手動 UI 更新    │          │ UI 自動応答     │
│ ポーリング必要  │          │ WebSocket プッシュ│
└─────────────────┘          └─────────────────┘
```

### 技術スタック

| コンポーネント | 技術 | 理由 |
|-----------|-----------|---------|
| **状態管理** | MobX | リアクティブ、自動依存追跡、フレームワーク非依存 |
| **リアルタイム通信** | WebSocket | バックエンド WebSocket API ベース、サブスクリプションサポート |
| **ブロックチェーン連携** | ethers.js v6 | 成熟、安定、優れた TypeScript サポート |
| **HTTP クライアント** | axios | インターセプター、リクエストキャンセル、タイムアウト制御 |
| **型システム** | TypeScript | 型安全性、優れた IDE サポート |
| **ビルドツール** | tsup | 高速、複数の出力形式サポート |

## 🌍 多言語サポート

### 言語マトリックス

```
enclave/sdk/
├── js/          JavaScript/TypeScript SDK (v2.0) ✅ 完了
├── go/          Go SDK (計画中)
├── python/      Python SDK (計画中)
└── rust/        Rust SDK (計画中)
```

### JavaScript SDK 機能

- ✅ **ユニバーサル環境**：ブラウザ、Node.js、React Native、Electron サポート
- ✅ **フレームワーク統合**：React、Vue、Next.js、Svelte など
- ✅ **TypeScript**：完全な型定義と推論
- ✅ **Tree-shakable**：オンデマンドロード、バンドルサイズ削減
- ✅ **リアクティブ**：MobX ベースの自動状態管理

### Go SDK (将来)

- 高性能バックエンドサービス統合
- gRPC サポート
- 並行処理フレンドリー
- Go マイクロサービスアーキテクチャに適合

### Python SDK (将来)

- データ分析とスクリプティング
- Flask/Django バックエンド統合
- Jupyter Notebook サポート
- 機械学習シナリオ

## 📊 アーキテクチャ図

### 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                  アプリケーション層                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Frontend │  │ Mobile App   │  │ Backend API  │      │
│  │ (React/Vue)  │  │ (React Native)│  │ (Next.js)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ EnclaveClient
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enclave SDK (コア層)                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    EnclaveClient                      │  │
│  │  - connect() / disconnect()                          │  │
│  │  - createCommitment() / withdraw()                   │  │
│  │  - イベントエミッター                                   │  │
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
│  [リアクティブ] [REST API]  [リアルタイム]   [オンチェーン]  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Enclave バックエンドサービス                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │   Database   │      │
│  │  (Go Gin)    │  │  (Sub/Push)  │  │ (PostgreSQL) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ブロックチェーンネットワーク層               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   BSC    │  │ zkSync   │  │ Ethereum │  │   ...    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### JavaScript SDK 内部アーキテクチャ

```
EnclaveClient
    │
    ├── StoreManager (状態管理)
    │   ├── CheckbooksStore     (チェックブック状態)
    │   ├── AllocationsStore    (アロケーション状態)
    │   ├── WithdrawalsStore    (出金状態)
    │   ├── PricesStore         (価格状態)
    │   ├── PoolsStore          (プール/トークン状態)
    │   └── UserStore           (ユーザー状態)
    │
    ├── ConnectionManager (接続管理)
    │   ├── WebSocketClient     (WebSocket 接続)
    │   ├── SubscriptionManager (サブスクリプション管理)
    │   └── MessageHandler      (メッセージ処理)
    │
    ├── APIClient (REST API)
    │   ├── AuthAPI             (認証)
    │   ├── CheckbooksAPI       (チェックブック)
    │   ├── AllocationsAPI      (アロケーション)
    │   ├── WithdrawalsAPI      (出金)
    │   ├── PoolsAPI            (プール/トークン)
    │   └── KMSAPI              (KMS)
    │
    ├── WalletManager (ウォレット管理)
    │   ├── SignerAdapter       (署名アダプター)
    │   └── ContractManager     (コントラクト連携)
    │
    ├── ActionManager (ビジネスオペレーション)
    │   ├── CommitmentAction    (コミットメントフロー)
    │   └── WithdrawalAction    (出金フロー)
    │
    └── Adapters (環境適応)
        ├── WebSocketAdapter    (WS アダプター: Browser/Node)
        └── StorageAdapter      (ストレージアダプター: LocalStorage/FS)
```

## 🎯 ユースケース

### ユースケース 1: Web フロントエンドアプリケーション

**技術スタック**: React + Next.js + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';

// グローバルクライアントインスタンスを作成
const client = new EnclaveClient({
  apiUrl: process.env.NEXT_PUBLIC_ENCLAVE_API,
  wsUrl: process.env.NEXT_PUBLIC_ENCLAVE_WS,
  signer: privateKey,
});

await client.connect();

// コンポーネントは Store の変更に自動応答
const CheckbooksView = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <div>
      <h1>マイチェックブック ({checkbooks.count})</h1>
      <p>合計金額: {checkbooks.totalDeposited.toString()}</p>
      {checkbooks.all.map(c => (
        <CheckbookCard key={c.id} checkbook={c} />
      ))}
    </div>
  );
});
```

**利点**:
- ✅ リアルタイム更新 (WebSocket)
- ✅ 手動状態管理不要
- ✅ TypeScript 型安全性
- ✅ 自動レンダリングパフォーマンス最適化

### ユースケース 2: Node.js バックエンドサービス

**技術スタック**: Next.js API Routes / Express / Nest.js

```typescript
// app/api/checkbooks/route.ts
import { EnclaveClient } from '@enclave-hq/sdk';

// サーバーサイドシングルトンインスタンス
const serverClient = new EnclaveClient({
  apiUrl: process.env.ENCLAVE_API_URL,
  wsUrl: process.env.ENCLAVE_WS_URL,
  signer: process.env.SERVER_PRIVATE_KEY,
});

await serverClient.connect();

export async function GET(request: Request) {
  // Store から直接読み取り (WebSocket リアルタイム同期)
  const checkbooks = serverClient.stores.checkbooks.all;
  
  return Response.json({
    checkbooks,
    total: serverClient.stores.checkbooks.totalDeposited.toString(),
  });
}

export async function POST(request: Request) {
  const { checkbookId, amounts, tokenId } = await request.json();
  
  // コミットメント作成を実行
  const result = await serverClient.createCommitment({
    checkbookId,
    amounts,
    tokenId,
  });
  
  return Response.json(result);
}
```

**利点**:
- ✅ サーバーサイド長期接続再利用
- ✅ 自動データ同期
- ✅ API 呼び出し頻度削減
- ✅ マイクロサービスアーキテクチャに適合

### ユースケース 3: React Native モバイルアプリ

**技術スタック**: React Native + TypeScript

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { observer } from 'mobx-react-lite';
import { View, Text, FlatList } from 'react-native';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKey,
});

// 生体認証またはセキュアストレージで秘密鍵を取得
const privateKey = await SecureStore.getItemAsync('private_key');
await client.connect();

const CheckbooksScreen = observer(() => {
  const { checkbooks } = client.stores;
  
  return (
    <View>
      <Text>マイチェックブック ({checkbooks.count})</Text>
      <FlatList
        data={checkbooks.all}
        renderItem={({ item }) => <CheckbookCard checkbook={item} />}
        keyExtractor={item => item.id}
      />
    </View>
  );
});
```

**利点**:
- ✅ クロスプラットフォーム (iOS + Android)
- ✅ オフラインサポート (Store 永続化)
- ✅ リアルタイムプッシュ
- ✅ ネイティブパフォーマンス

## 🔄 データフロー

### コミットメント作成フロー

```
ユーザーアクション
    │
    ├─> client.createCommitment(params)
    │       │
    │       ├─> 1. 署名データの準備
    │       ├─> 2. ウォレット署名メッセージ
    │       ├─> 3. バックエンドに送信
    │       └─> 4. アロケーションの作成
    │
    ▼
バックエンド処理
    │
    ├─> 署名検証
    │       │
    │       └─> アロケーションレコード作成
    │
    ▼
WebSocket プッシュ
    │
    ├─> バックエンドが allocation_update メッセージをプッシュ
    │       │
    │       └─> SDK がメッセージを受信
    │
    ▼
Store 更新
    │
    ├─> AllocationsStore.updateAllocation(allocation)
    │       │
    │       └─> 'change' イベントをトリガー
    │
    ▼
UI 自動更新
    │
    └─> React/Vue コンポーネントが自動的に再レンダリング
```

### 価格サブスクリプションフロー

```
初期化
    │
    ├─> client.connect()
    │       │
    │       └─> WebSocket 接続確立
    │
    ▼
価格のサブスクライブ
    │
    ├─> 価格チャネルへの自動サブスクライブ
    │       │
    │       └─> バックエンドにサブスクリプションメッセージを送信
    │
    ▼
定期プッシュ
    │
    ├─> バックエンドが毎分価格更新をプッシュ
    │       │
    │       └─> SDK が price_update メッセージを受信
    │
    ▼
Store 更新
    │
    ├─> PricesStore.updatePrice(...)
    │       │
    │       └─> 依存関係の自動更新をトリガー
    │
    ▼
UI 応答
    │
    └─> 価格チャート/リストが自動的にリフレッシュ
```

## 📦 パッケージ構造

### npm パッケージ公開

```bash
@enclave-hq/sdk
├── dist/
│   ├── index.js         # CommonJS
│   ├── index.mjs        # ES Module
│   ├── index.d.ts       # TypeScript 定義
│   ├── react.js         # React 統合
│   ├── vue.js           # Vue 統合
│   └── nextjs.js        # Next.js ユーティリティ
├── package.json
└── README.md
```

### オンデマンドインポート

```typescript
// コアクライアント
import { EnclaveClient } from '@enclave-hq/sdk';

// React Hooks
import { useEnclave, useCheckbooks } from '@enclave-hq/sdk/react';

// Next.js ユーティリティ
import { createServerClient } from '@enclave-hq/sdk/nextjs';

// Vue Composables
import { useEnclave } from '@enclave-hq/sdk/vue';
```

## 🔐 セキュリティの考慮事項

### 秘密鍵管理

- ✅ **ブラウザ**: MetaMask などのウォレットを使用、秘密鍵を保存しない
- ✅ **Node.js**: 環境変数または KMS を使用
- ✅ **モバイル**: デバイスセキュアストレージ (SecureStore) を使用
- ❌ **絶対に避ける**: コードに秘密鍵をハードコード

### WebSocket セキュリティ

- ✅ JWT トークン認証
- ✅ 自動再接続とトークンリフレッシュ
- ✅ メッセージ署名検証
- ✅ レート制限

### データ検証

- ✅ すべての入力パラメータ検証
- ✅ 金額範囲チェック
- ✅ アドレス形式検証
- ✅ ChainID マッピング検証

## 🚀 パフォーマンス最適化

### Store 最適化

- ✅ **算出値**: 計算結果の自動キャッシュ
- ✅ **精密更新**: 変更された部分のみ更新
- ✅ **バッチ操作**: 複数の更新をマージ
- ✅ **遅延読み込み**: オンデマンドでデータをロード

### WebSocket 最適化

- ✅ **メッセージキュー**: 高頻度メッセージのバッファリング
- ✅ **自動再接続**: 切断再接続メカニズム
- ✅ **ハートビート検出**: 接続をアクティブに保つ
- ✅ **サブスクリプション管理**: スマートサブスクライブ/アンサブスクライブ

### バンドルサイズ最適化

- ✅ **Tree-shaking**: 未使用コードはバンドルされない
- ✅ **コード分割**: React/Vue 統合をオンデマンドロード
- ✅ **圧縮**: gzip + brotli
- ✅ **依存関係最適化**: 外部依存関係を最小化

| モジュール | サイズ (gzipped) |
|--------|----------------|
| コア SDK | ~40KB |
| React 統合 | +5KB |
| Vue 統合 | +5KB |
| Next.js ユーティリティ | +3KB |

## 📚 関連ドキュメント

- [JavaScript SDK 技術設計](./SDK_JS_DESIGN.md) - 詳細な技術設計
- [API マッピングドキュメント](./SDK_API_MAPPING.md) - SDK API からバックエンド API へのマッピング
- [バックエンド API ドキュメント](../../backend/API_DOCUMENTATION.md) - バックエンド REST API リファレンス
- [WebSocket 統合](../../backend/WEBSOCKET_INTEGRATION.md) - WebSocket プロトコル仕様

## 🛣️ ロードマップ

### フェーズ 1: JavaScript SDK v2.0 ✅ 完了

- [x] アーキテクチャ設計
- [x] コア実装
  - [x] Store 層
  - [x] API 層
  - [x] WebSocket 層
  - [x] メインクライアント
- [x] プラットフォーム統合
  - [x] React
  - [x] Next.js
- [x] ドキュメントと例

### フェーズ 2: Go SDK (計画中)

- [ ] アーキテクチャ設計
- [ ] コア実装
- [ ] gRPC サポート
- [ ] 例とドキュメント
- [ ] pkg.go.dev に公開

### フェーズ 3: Python SDK (計画中)

- [ ] アーキテクチャ設計
- [ ] コア実装
- [ ] Flask/Django 統合
- [ ] 例とドキュメント
- [ ] PyPI に公開

### フェーズ 4: Rust SDK (計画中)

- [ ] アーキテクチャ設計
- [ ] コア実装
- [ ] WASM サポート
- [ ] 例とドキュメント
- [ ] crates.io に公開

## 📞 サポート

- GitHub Issues: https://github.com/enclave-hq/enclave/issues
- ドキュメント: https://docs.enclave-hq.com
- Discord: https://discord.gg/enclave

---

**バージョン**: v2.0.0-alpha  
**最終更新**: 2025-01-17  
**メンテナー**: Enclave Team

