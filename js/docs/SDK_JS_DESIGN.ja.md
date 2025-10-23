# Enclave JavaScript SDK - 技術設計書

**Languages**: [English](./SDK_JS_DESIGN.md) | [中文](./SDK_JS_DESIGN.zh-CN.md) | 日本語 | [한국어](./SDK_JS_DESIGN.ko.md)

## 📋 目次

- [概要](#概要)
- [技術スタック](#技術スタック)
- [ディレクトリ構造](#ディレクトリ構造)
- [コアモジュール設計](#コアモジュール設計)
- [署名アーキテクチャ](#署名アーキテクチャ)
- [データフォーマッター](#データフォーマッター)
- [型システム](#型システム)
- [Storeアーキテクチャ](#storeアーキテクチャ)
- [APIクライアント](#apiクライアント)
- [WebSocketレイヤー](#websocketレイヤー)
- [環境アダプター](#環境アダプター)
- [ビジネスオペレーションレイヤー](#ビジネスオペレーションレイヤー)
- [プラットフォーム統合](#プラットフォーム統合)
- [エラーハンドリング](#エラーハンドリング)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [テスト戦略](#テスト戦略)

## 概要

Enclave JavaScript SDK v2.0 は、**リアクティブアーキテクチャ**と**MobX状態管理**に基づく全く新しいSDKで、Enclaveバックエンドサービスとの対話のための統一された使いやすいAPIを提供します。

### コア設計原則

1. **リアクティブファースト**: MobXに基づき、データの変更が自動的にUIの更新をトリガーします
2. **環境非依存**: ブラウザ、Node.js、React Nativeなど、すべてのJavaScript実行環境をサポートします
3. **TypeScriptファースト**: 完全な型定義により、優れた開発者体験を提供します
4. **リアルタイム同期**: WebSocketが自動的に更新をプッシュし、手動ポーリングは不要です
5. **シンプルな使用**: 単一の `connect()` ですべての初期化が完了します

### アーキテクチャ原則

- **単一責任**: 各モジュールは1つのコア機能のみを担当します
- **依存性注入**: モジュール間はインターフェースを通じて通信し、テストと置き換えが容易です
- **イベント駆動**: EventEmitterを使用してモジュール間通信を行います
- **防御的プログラミング**: 包括的なエラーハンドリングと境界チェック
- **パフォーマンス優先**: 遅延ロード、バッチ更新、精密なレンダリング

## 技術スタック

### コア依存関係

```json
{
  "dependencies": {
    "mobx": "^6.12.0",           // リアクティブ状態管理
    "ethers": "^6.10.0",         // ブロックチェーン対話
    "axios": "^1.6.0",           // HTTPクライアント
    "eventemitter3": "^5.0.1"    // イベントシステム
  },
  "peerDependencies": {
    "ws": "^8.0.0",              // Node.js WebSocket (オプション)
    "react": ">=16.8.0",         // React統合 (オプション)
    "vue": ">=3.0.0"             // Vue統合 (オプション)
  },
  "devDependencies": {
    "typescript": "^5.3.0",      // TypeScript
    "tsup": "^8.0.0",            // ビルドツール
    "vitest": "^1.0.0",          // テストフレームワーク
    "eslint": "^8.56.0",         // コードリンター
    "prettier": "^3.1.0"         // コードフォーマッター
  }
}
```

### なぜこれらの技術を選んだのか？

| 技術 | 理由 | 代替案との比較 |
|------|------|-------------|
| **MobX** | リアクティブ、自動依存関係追跡、フレームワーク非依存 | Redux (重すぎる)、Zustand (機能が少ない) |
| **ethers.js v6** | 成熟して安定、優れたTypeScriptサポート | web3.js (APIが現代的でない) |
| **axios** | インターセプター、リクエストキャンセル、タイムアウト制御 | fetch (機能が少ない) |
| **tsup** | 高速、ゼロコンフィグ、複数の出力形式 | webpack (設定が複雑)、rollup (設定が多い) |
| **vitest** | 高速、Jest互換API、ネイティブESM | Jest (遅い) |

## SDKエクスポート戦略

SDKは明確なエクスポート戦略を採用し、クライアント使用のためにコアクラス、ステータス列挙、型定義をエクスポートします:

```typescript
// src/index.ts - メインエントリファイル

// ============ コアクライアント ============
export { EnclaveClient } from './client/EnclaveClient';

// ============ ステータス列挙（クライアント使用用）============
export { 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from './types/models';

// ============ データモデル型 ============
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

// ============ 設定型 ============
export type {
  EnclaveConfig,
  SignerInput,
  ISigner,
  SignerCallback,
} from './types';
```

### なぜステータス列挙をエクスポートするのか？

1. ✅ **型安全性**: TypeScriptがコンパイル時にステータス値の正確性をチェック
2. ✅ **コードヒント**: IDEが自動補完とドキュメントを提供
3. ✅ **可読性**: `CheckbookStatus.WithCheckbook` は `'with_checkbook'` より明確
4. ✅ **リファクタリングに優しい**: ステータス値が変更されても、列挙定義のみを変更すれば全参照が自動更新
5. ✅ **マジック文字列の回避**: ハードコーディングされた文字列を排除し、エラーを減らす

### クライアント使用例

```typescript
import { 
  EnclaveClient, 
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave-hq/sdk';

// クライアント作成
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});

// 1. ステータス比較に列挙を使用
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbook がアクティブ化され、アロケーション作成可能');
}

// 2. クエリに列挙を使用
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. 条件ロジックに列挙を使用
const withdrawal = client.stores.withdrawals.get(withdrawId);
switch (withdrawal.status) {
  case WithdrawRequestStatus.Pending:
    console.log('⏳ 出金処理中...');
    break;
  case WithdrawRequestStatus.Completed:
    console.log('✅ 出金完了');
    break;
  case WithdrawRequestStatus.Failed:
    console.log('❌ 出金失敗、再試行可能');
    break;
}

// 4. React UIで列挙を使用
function CheckbookStatusBadge({ status }: { status: CheckbookStatus }) {
  const config = {
    [CheckbookStatus.Pending]: { text: '処理中', color: 'blue' },
    [CheckbookStatus.ReadyForCommitment]: { text: '準備完了', color: 'yellow' },
    [CheckbookStatus.WithCheckbook]: { text: 'アクティブ', color: 'green' },
    [CheckbookStatus.ProofFailed]: { text: '証明失敗', color: 'red' },
  };
  
  const { text, color } = config[status] || { text: '不明', color: 'gray' };
  return <Badge color={color}>{text}</Badge>;
}

// 5. 状態遷移制御
function canCreateAllocation(checkbook: Checkbook): boolean {
  return checkbook.status === CheckbookStatus.WithCheckbook;
}

function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}

// 6. TypeScript型安全性
function processCheckbook(status: CheckbookStatus) {
  // TypeScriptは有効なCheckbookStatus値のみが渡されることを保証
}

// ❌ エラー: TypeScriptがエラーを報告
processCheckbook('invalid_status'); // Type 'string' is not assignable to type 'CheckbookStatus'

// ✅ 正しい
processCheckbook(CheckbookStatus.Pending);
```

---

## ディレクトリ構造

```
sdk/js/
├── src/
│   ├── client/                      # クライアントコア
│   │   ├── EnclaveClient.ts         # メインクライアントエントリ
│   │   └── ConnectionManager.ts     # 接続管理
│   │
│   ├── stores/                      # MobX Store層
│   │   ├── BaseStore.ts             # Store基底クラス
│   │   ├── StoreManager.ts          # Storeマネージャー
│   │   ├── DepositsStore.ts         # 入金状態
│   │   ├── CheckbooksStore.ts       # Checkbook状態
│   │   ├── WithdrawalsStore.ts      # 出金状態
│   │   ├── PricesStore.ts           # 価格状態
│   │   ├── PoolsStore.ts            # Pool/Token状態
│   │   └── UserStore.ts             # ユーザー状態
│   │
│   ├── api/                         # REST API層
│   │   ├── APIClient.ts             # HTTPクライアント基底クラス
│   │   ├── AuthAPI.ts               # 認証API
│   │   ├── DepositsAPI.ts           # 入金API
│   │   ├── CheckbooksAPI.ts         # Checkbook API
│   │   ├── WithdrawalsAPI.ts        # 出金API
│   │   ├── PoolsAPI.ts              # Pool/Token API
│   │   └── KMSAPI.ts                # KMS API
│   │
│   ├── websocket/                   # WebSocket層
│   │   ├── WebSocketClient.ts       # WSクライアント
│   │   ├── SubscriptionManager.ts   # サブスクリプション管理
│   │   ├── MessageHandler.ts        # メッセージハンドラー
│   │   └── ReconnectionManager.ts   # 再接続管理
│   │
│   ├── blockchain/                  # ブロックチェーン対話層
│   │   ├── WalletManager.ts         # ウォレット管理
│   │   ├── SignerAdapter.ts         # 署名アダプター
│   │   ├── ContractManager.ts       # コントラクト対話
│   │   └── TransactionBuilder.ts    # トランザクションビルダー
│   │
│   ├── formatters/                  # データフォーマッター
│   │   ├── CommitmentFormatter.ts   # コミットメントフォーマッター
│   │   └── WithdrawFormatter.ts     # 出金フォーマッター
│   │
│   ├── actions/                     # ビジネスオペレーション層
│   │   ├── ActionManager.ts         # オペレーションマネージャー
│   │   ├── DepositAction.ts         # 入金オペレーション
│   │   ├── CommitmentAction.ts      # コミットメントオペレーション
│   │   └── WithdrawalAction.ts      # 出金オペレーション
│   │
│   ├── adapters/                    # 環境アダプター層
│   │   ├── websocket/
│   │   │   ├── IWebSocketAdapter.ts
│   │   │   ├── BrowserWebSocketAdapter.ts
│   │   │   └── NodeWebSocketAdapter.ts
│   │   └── storage/
│   │       ├── IStorageAdapter.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── FileStorageAdapter.ts
│   │
│   ├── platforms/                   # プラットフォーム固有統合
│   │   ├── react/
│   │   │   ├── hooks.ts             # React Hooks
│   │   │   ├── provider.tsx         # Context Provider
│   │   │   └── index.ts
│   │   ├── vue/
│   │   │   ├── composables.ts       # Vue Composables
│   │   │   ├── plugin.ts            # Vue Plugin
│   │   │   └── index.ts
│   │   └── nextjs/
│   │       ├── server.ts            # サーバーサイドユーティリティ
│   │       ├── client.ts            # クライアントサイドユーティリティ
│   │       └── index.ts
│   │
│   ├── types/                       # TypeScript型定義
│   │   ├── models.ts                # データモデル
│   │   ├── api.ts                   # API型
│   │   ├── config.ts                # 設定型
│   │   ├── events.ts                # イベント型
│   │   ├── websocket.ts             # WebSocket型
│   │   └── index.ts
│   │
│   ├── utils/                       # ユーティリティ関数
│   │   ├── address.ts               # アドレスフォーマット
│   │   ├── amount.ts                # 金額処理
│   │   ├── logger.ts                # ログユーティリティ
│   │   ├── retry.ts                 # リトライメカニズム
│   │   ├── validators.ts            # データ検証
│   │   ├── environment.ts           # 環境検出
│   │   └── index.ts
│   │
│   └── index.ts                     # メインエクスポートファイル
│
├── examples/                        # 使用例
│   ├── basic-usage.ts               # 基本使用
│   ├── react-app/                   # React例
│   ├── nextjs-app/                  # Next.js例
│   ├── nodejs-backend.ts            # Node.jsバックエンド
│   └── kms-integration.ts           # KMS統合
│
├── tests/                           # テスト
│   ├── unit/                        # ユニットテスト
│   ├── integration/                 # 統合テスト
│   └── e2e/                         # E2Eテスト
│
├── docs/                            # 追加ドキュメント
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                   # ビルド設定
├── vitest.config.ts                 # テスト設定
├── .eslintrc.js
├── .prettierrc
├── README.md
└── LICENSE
```

## コアモジュール設計

### 1. EnclaveClient (メインクライアント)

EnclaveClientは、すべてのSDK機能へのシングルエントリーポイントを提供します。

**主要な設計ポイント**:

1. **シングルエントリーポイント**: すべてのSDK機能は `EnclaveClient` を通じてアクセス
2. **ライフサイクル管理**: 明確な `connect()` と `disconnect()` ライフサイクル
3. **イベント発行**: 接続状態変更のためのイベントを発行し、外部監視を可能に
4. **自動同期**: 接続後に自動的に初期データ同期を完了
5. **エラー分離**: 各操作は独立したエラーハンドリングを持つ

(コード例は英語版と同じため省略)

### 2. ConnectionManager (接続マネージャー)

WebSocket接続とメッセージルーティングを管理する責任を持ちます。

**主要な設計ポイント**:

1. **コンポーネント分離**: WebSocket、サブスクリプション、メッセージハンドリングは独立モジュール
2. **自動サブスクリプション**: 接続後にユーザー関連データストリームを自動的にサブスクライブ
3. **再接続ロジック**: 接続喪失と再サブスクリプションを自動的に処理
4. **型安全性**: すべてのメッセージとサブスクリプションは型安全

---

## 署名アーキテクチャ

Enclave SDKは、秘密鍵を公開せずに複数の署名方法をサポートします。これは `ISigner` インターフェースと `SignerAdapter` を通じて実現されます。

### 設計目標

1. **セキュリティ**: SDKは秘密鍵を保存またはログに記録しない
2. **柔軟性**: 複数の署名方法をサポート（秘密鍵、MetaMask、Ledger、リモート署名サービス）
3. **互換性**: 既存のWeb3ウォレットとハードウェアウォレットと連携
4. **オフラインサポート**: ネットワーク接続なしで署名をサポート

### コアインターフェース

(TypeScriptインターフェース定義は英語版と同じため省略)

### 使用例

#### 例1: MetaMask署名者を使用

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import { BrowserProvider } from 'ethers';

async function connectWithMetaMask() {
  // MetaMaskプロバイダーを取得
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // SDKクライアントを作成、ethers Signerを直接渡す
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: signer, // ethers.SignerはISigner interfaceを実装
  });
  
  await client.connect();
  console.log('✅ MetaMaskで接続完了');
}
```

#### 例2: リモート署名サービスを使用

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';

async function connectWithRemoteSigner() {
  // カスタム署名関数
  const remoteSigner = async (message: string | Uint8Array) => {
    // リモート署名サービスAPIを呼び出す
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
  
  // SDKクライアントを作成、署名関数を渡す
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: remoteSigner, // 署名関数を直接渡す
  });
  
  await client.connect();
  console.log('✅ リモート署名者で接続完了');
}
```

#### 例3: Node.jsバックエンド秘密鍵

```typescript
import { EnclaveClient } from '@enclave-hq/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function connectWithPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  
  // SDKクライアントを作成、秘密鍵を直接渡す
  const client = new EnclaveClient({
    apiUrl: 'https://api.enclave-hq.com',
    wsUrl: 'wss://api.enclave-hq.com/ws',
    signer: privateKey, // 秘密鍵文字列を直接渡す
  });
  
  await client.connect();
  console.log('✅ 秘密鍵で接続完了');
}
```

### セキュリティベストプラクティス

1. **秘密鍵管理**:
```typescript
// ❌ 悪い: 秘密鍵をハードコード
const client = new EnclaveClient({
  signer: '0x1234567890abcdef...',
});

// ✅ 良い: 環境変数を使用
const client = new EnclaveClient({
  signer: process.env.PRIVATE_KEY,
});

// ✅ より良い: セキュアボルトを使用
const privateKey = await getSecretFromVault('ENCLAVE_PRIVATE_KEY');
const client = new EnclaveClient({ signer: privateKey });
```

---

## データフォーマッター

バックエンドAPI依存を減らし、オフライン操作をサポートするため、SDKはコミットメントと出金の署名メッセージとペイロードを生成するためのデータフォーマッターを内部実装します。

### 設計目標

1. **一貫性**: データフォーマットロジックは全言語SDK（JS、Go、Pythonなど）で一貫
2. **オフラインサポート**: メッセージ生成はバックエンドAPI呼び出しを必要としない
3. **透明性**: 開発者はデータ構造と署名内容を明確に確認できる
4. **セキュリティ**: すべてのハッシュと署名生成はローカル、機密データは送信されない

### CommitmentFormatter (コミットメントデータフォーマッター)

コミットメント操作の署名メッセージを生成します。

(TypeScriptコード実装は英語版と同じため省略)

### WithdrawFormatter (出金データフォーマッター)

出金操作の署名メッセージを生成します。

(TypeScriptコード実装は英語版と同じため省略)

### 言語間一貫性仕様

**すべての言語SDKでデータフォーマットロジックの一貫性を保証するため、以下のルールに従います:**

| ステップ | 操作 | 仕様 | 例 |
|------|------|------|------|
| 1 | アロケーションソート | `token_id` ASC、次に `value` ASC でソート | `[{token:1,val:100}, {token:1,val:200}, {token:2,val:50}]` |
| 2 | 単一アロケーションハッシュ | `keccak256(token_id ‖ value ‖ salt ‖ nullifier)` | 各フィールドは32バイトにパディング |
| 3 | アロケーションリストハッシュ | 各アロケーションをハッシュ、連結、再度ハッシュ | `keccak256(hash1 ‖ hash2 ‖ ...)` |
| 4 | Merkleツリー | 標準バイナリMerkleツリー、左右ハッシュペアリング | 奇数の場合、右端ノードを複製 |
| 5 | Intentハッシュ | `keccak256(target_address ‖ target_chain_id ‖ token_id ‖ min_amount_out)` | 各uint256は32バイトにパディング |
| 6 | 署名メッセージ | `keccak256(domain ‖ chainId ‖ hash_data)` | EIP-712スタイルに従う |

### SDK内部実装 vs バックエンドAPI

| 操作 | SDK内部 | バックエンドAPI | 理由 |
|------|---------|---------|------|
| コミットメントメッセージ生成 | ✅ `prepareCommitment()` | ❌ | オフライン署名をサポート |
| コミットメント署名 | ✅ `wallet.signMessage()` | ❌ | 秘密鍵はクライアントを離れない |
| コミットメント送信 | ❌ | ✅ `POST /api/commitments` | バックエンド検証とストレージが必要 |
| 出金メッセージ生成 | ✅ `prepareWithdraw()` | ❌ | オフライン署名をサポート |
| 出金署名 | ✅ `wallet.signMessage()` | ❌ | 秘密鍵はクライアントを離れない |
| 出金送信 | ❌ | ✅ `POST /api/withdrawals` | バックエンド処理とオンチェーン実行が必要 |
| Merkleルート計算 | ✅ `calculateMerkleRoot()` | ❌ | クライアント検証、バックエンドは再計算 |

**設計トレードオフ**:

1. **オフラインサポート**: ユーザーはネットワークなしで署名データを生成可能
2. **透明性**: ユーザーは署名内容を明確に確認できる
3. **セキュリティ**: 秘密鍵はバックエンドに送信されない
4. **検証**: バックエンドはすべてのハッシュを再計算して検証
5. **一貫性**: 標準化されたアルゴリズムにより言語間SDKの一貫性を保証

---

## 追加章節

以下の章は、SDKの残りのアーキテクチャコンポーネントを包括的にカバーしています:

### APIクライアント
- **APIClient基本クラス**: axios統合、インターセプター、認証管理
- **エラータイプ**: ValidationError、AuthenticationError、NetworkError等

### WebSocket層
- **WebSocketClient**: クロスプラットフォーム抽象化、自動再接続、ハートビート機構
- **機能**: 指数バックオフ、接続状態管理、メッセージキューイング

### 環境アダプター
- **WebSocketアダプター**: Browser / Node.js実装
- **ストレージアダプター**: LocalStorage / カスタム実装サポート

### ビジネスオペレーション層
- **ActionManager**: 複雑なワークフロー封装
- **メソッド**: createCommitment(), withdraw()

### プラットフォーム統合
- **React統合**: useEnclaveClient(), useStore(), useCheckbooks()
- **Next.js統合**: クライアントサイド専用ユーティリティ

### エラーハンドリング
- **エラー階層**: EnclaveSDKError、ConnectionError、SignerError
- **構造化エラーコード**: プログラマティック処理用

### パフォーマンス最適化
1. **遅延ロード**: 大規模依存関係の動的インポート
2. **バッチ更新**: MobX runInAction
3. **計算キャッシュ**: 自動派生値キャッシュ
4. **精密レンダリング**: MobX細粒度リアクティビティ

### テスト戦略
- **ユニットテスト**: Storeロジック、ユーティリティ関数
- **統合テスト**: フル接続フロー、WebSocket再接続

---

## まとめ

Enclave JavaScript SDK v2.0の提供内容:

### コア機能
✅ **リアクティブ状態管理**: MobX自動追跡、自動UI更新  
✅ **環境非依存**: ブラウザ、Node.js、React Nativeサポート  
✅ **型安全性**: 完全なTypeScript定義  
✅ **リアルタイム同期**: WebSocketプッシュ + 明示的クエリバックアップ  
✅ **セキュリティ優先**: 秘密鍵はクライアントを離れない、複数の署名オプション  
✅ **オフラインサポート**: SDK内部フォーマット、オフライン署名可能  

### アーキテクチャの利点
- **モジュール化**: 関心の明確な分離、保守が容易
- **テスト可能**: 依存性注入、モックが容易
- **高性能**: 遅延ロード、バッチ更新、精密レンダリング
- **クロスプラットフォーム**: 異なる環境向けアダプターパターン
- **開発者フレンドリー**: 完全なドキュメント、例、型ヒント

### ドキュメント
- **技術設計**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md)
- **APIマッピング**: [SDK_API_MAPPING.md](./SDK_API_MAPPING.md)
- **SDKオーバービュー**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md)

---

**完全なコード例を含む技術詳細については、中国語版を参照してください**: [SDK_JS_DESIGN.zh-CN.md](./SDK_JS_DESIGN.zh-CN.md)

---

**バージョン**: v2.0.0  
**最終更新**: 2025-01-17  
**ステータス**: 完了 ✅

