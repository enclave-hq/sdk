# Enclave SDK - APIマッピング文書

**Languages**: [English](./SDK_API_MAPPING.md) | [中文](./SDK_API_MAPPING.zh-CN.md) | 日本語 | [한국어](./SDK_API_MAPPING.ko.md)

## 概要

この文書では、Enclave JavaScript SDK APIメソッドとバックエンドREST APIエンドポイントの詳細なマッピング、およびWebSocketサブスクリプションとメッセージのマッピングを説明します。

## 📚 目次

- [クイックリファレンス](#クイックリファレンス)
- [ステータス列挙の使用](#ステータス列挙の使用)
- [SDK設定](#sdk設定)
- [認証](#認証)
- [署名アーキテクチャ](#署名アーキテクチャ)
- [データ同期メカニズム](#データ同期メカニズム)
- [Storeメソッド分類](#storeメソッド分類)
- [Checkbook関連](#checkbook関連)
- [Allocation関連](#allocation関連)
- [コミットメント関連](#コミットメント関連)
- [出金関連](#出金関連)
- [SDK内部実装 vs バックエンドAPI](#sdk内部実装-vs-バックエンドapi)
- [ステータスシステム](#ステータスシステム)

---

## クイックリファレンス

### SDK初期化

```typescript
import { EnclaveClient } from '@enclave/sdk';

const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
  wsUrl: 'wss://api.enclave-hq.com/ws',
  signer: privateKeyOrSignerCallback,
});

await client.connect();
```

**バックエンドAPI**: なし（クライアントサイドのみ）

### 一般的な操作

| SDKメソッド | バックエンドAPI | 説明 |
|------------|-------------|-------------|
| `client.connect()` | `POST /api/auth/login` | 認証と接続確立 |
| `client.disconnect()` | `POST /api/auth/logout` | 切断とクリーンアップ |
| `client.stores.checkbooks.getByOwner()` | `GET /api/checkbooks` | ユーザーのCheckbook取得 |
| `client.stores.allocations.getList()` | `GET /api/allocations` | フィルター付きAllocation取得 |
| `client.stores.withdrawals.getList()` | `GET /api/withdrawals` | 出金リクエスト取得 |
| `client.prepareCommitment()` | なし（SDK内部） | コミットメント署名データ準備 |
| `client.submitCommitment()` | `POST /api/commitments` | 署名済みコミットメント送信 |
| `client.prepareWithdraw()` | なし（SDK内部） | 出金署名データ準備 |
| `client.submitWithdraw()` | `POST /api/withdrawals` | 署名済み出金送信 |

---

## ステータス列挙の使用

SDKは型安全なステータス処理のためにステータス列挙をエクスポートします：

```typescript
import {
  EnclaveClient,
  CheckbookStatus,
  AllocationStatus,
  WithdrawRequestStatus,
} from '@enclave/sdk';

// 1. 型安全なステータス比較
const checkbook = client.stores.checkbooks.get(checkbookId);
if (checkbook.status === CheckbookStatus.WithCheckbook) {
  console.log('✅ Checkbookがアクティブ');
}

// 2. ステータスでフィルター
const idleAllocations = client.stores.allocations.getByStatus(
  AllocationStatus.Idle
);

// 3. ステータスフロー制御
function canWithdraw(allocation: Allocation): boolean {
  return allocation.status === AllocationStatus.Idle;
}
```

### ステータス列挙定義

```typescript
// Checkbookステータス
export enum CheckbookStatus {
  Pending = 'pending',                     // 証明生成中
  ReadyForCommitment = 'ready_for_commitment', // 証明準備完了、コミットメント待ち
  WithCheckbook = 'with_checkbook',        // Checkbookアクティブ化（コミットメント完了）
  ProofFailed = 'proof_failed',            // 証明生成失敗
}

// Allocationステータス
export enum AllocationStatus {
  Idle = 'idle',       // 新しいWithdrawRequestで使用可能
  Pending = 'pending', // アクティブなWithdrawRequestに含まれる
  Used = 'used',       // 正常に出金済み
}

// WithdrawRequestステータス
export enum WithdrawRequestStatus {
  Pending = 'pending',       // 出金処理中
  Completed = 'completed',   // 出金完了（オンチェーンステージ1完了）
  Failed = 'failed',         // 出金失敗
}
```

---

## データ同期メカニズム

SDKは**デュアル同期メカニズム**を使用します：

### プライマリ: WebSocketリアルタイムプッシュ

- バックエンドデータ変更時に自動的に更新をプッシュ
- 手動更新不要
- Checkbook、Allocation、出金、価格のリアルタイム更新

### バックアップ: 明示的クエリメソッド

- 必要に応じて最新データを手動で取得
- 使用場面：
  - 初期データロード
  - WebSocket切断からの回復
  - オンデマンドデータ更新
  - 特定項目の取得

**クエリメソッド**:
```typescript
// オーナー（ユーザーアドレス）でクエリ
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();
await client.stores.withdrawals.getByOwner();

// IDでクエリ
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);
await client.stores.withdrawals.getById(withdrawalId);

// フィルター付きクエリ
await client.stores.allocations.getList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});
```

---

## Storeメソッド分類

各Storeには2種類のメソッドがあります：

### 1. ローカル（メモリ）クエリ

Store内のデータにアクセス（即座、ネットワーク呼び出しなし）：

```typescript
// Storeから単一項目を取得
const checkbook = client.stores.checkbooks.get(checkbookId);
const allocation = client.stores.allocations.get(allocationId);

// Storeからすべての項目を取得
const allCheckbooks = client.stores.checkbooks.all;
const allAllocations = client.stores.allocations.all;

// 計算プロパティ（フィルタービュー）
const idleAllocations = client.stores.allocations.idle;
const pendingWithdrawals = client.stores.withdrawals.pending;
```

### 2. アクティブ（API）クエリ

バックエンドから最新データを取得（ネットワーク呼び出し）：

```typescript
// オーナーで取得
await client.stores.checkbooks.getByOwner();
await client.stores.allocations.getByOwner();

// IDで取得
await client.stores.checkbooks.getById(checkbookId);
await client.stores.allocations.getById(allocationId);

// フィルターとページネーション付き取得
await client.stores.allocations.getList({
  token_id: 1,
  status: AllocationStatus.Idle,
  page: 1,
  page_size: 20,
});
```

---

## Checkbook関連

### `client.stores.checkbooks.getByOwner()`

**説明**: 現在のユーザーのすべてのCheckbookを取得（入金情報を含む）

**バックエンドAPI**: `GET /api/checkbooks?user_address={address}`

**使用例**:
```typescript
// Checkbookを取得
await client.stores.checkbooks.getByOwner();

// Storeからアクセス（オブザーバブル）
const checkbooks = client.stores.checkbooks.all;
console.log('Checkbooks:', checkbooks);

// 特定のCheckbookを取得
const checkbook = client.stores.checkbooks.get(checkbookId);
```

---

## Allocation関連

### `client.stores.allocations.getByTokenIdAndStatus(tokenId, status)`

**説明**: トークンIDとステータスでフィルタリングされたAllocationを取得

**バックエンドAPI**: `GET /api/allocations?token_id={tokenId}&status={status}`

**使用例**:
```typescript
// すべてのidle状態のETH Allocationを取得
const idleEth = await client.stores.allocations.getByTokenIdAndStatus(
  1, // ETH token_id
  AllocationStatus.Idle
);

console.log('利用可能なETH Allocation:', idleEth.length);
```

### `client.stores.allocations.getList(filters)`

**説明**: 高度なフィルター付きAllocationクエリ

**パラメータ**:
```typescript
{
  checkbook_id?: number;
  token_id?: number;
  status?: AllocationStatus;
  withdraw_request_id?: number;
  page?: number;
  page_size?: number;
}
```

---

## コミットメント関連

### `client.prepareCommitment(allocations, checkbookAddress)`

**説明**: コミットメント署名データを準備（SDK内部、バックエンド呼び出しなし）

**バックエンドAPI**: なし（純粋なSDK操作）

**使用例**:
```typescript
const allocations = client.stores.allocations.idle;
const checkbookAddress = '0x...';

const preparedData = await client.prepareCommitment(allocations, checkbookAddress);
console.log('署名するメッセージ:', preparedData.message);
```

### `client.createCommitment(allocations, checkbookAddress)`

**説明**: 完全なコミットメントプロセス（準備 + 署名 + 送信）

**使用例**:
```typescript
// ワンステップコミットメント
const result = await client.createCommitment(allocations, checkbookAddress);
console.log('✅ コミットメント完了');
```

---

## 出金関連

### `client.prepareWithdraw(allocations, intent)`

**説明**: 出金署名データを準備（SDK内部、バックエンド呼び出しなし）

**パラメータ**:
- `allocations: Allocation[]` - 出金するAllocation（`idle`ステータスである必要あり）
- `intent: WithdrawIntent` - 出金インテントパラメータ

**使用例**:
```typescript
const allocations = client.stores.allocations.idle.filter(a => a.token_id === 1);
const intent = {
  target_address: '0xYourAddress',
  target_chain_id: 1,
  token_id: 1,
  min_amount_out: '990000000000000000', // 0.99 ETH（1%スリッページ）
};

const preparedData = await client.prepareWithdraw(allocations, intent);
```

### `client.withdraw(allocations, intent)`

**説明**: 完全な出金プロセス（準備 + 署名 + 送信）

**使用例**:
```typescript
// ワンステップ出金
const result = await client.withdraw(allocations, intent);
console.log('✅ 出金リクエスト作成');
```

### `client.stores.withdrawals.getList(filters)`

**説明**: フィルターとページネーション付き出金リクエストクエリ

**使用例**:
```typescript
// 処理中の出金を取得
const pending = await client.stores.withdrawals.getList({
  status: WithdrawRequestStatus.Pending,
  page: 1,
  page_size: 10,
});
```

---

## SDK内部実装 vs バックエンドAPI

| 操作 | SDK内部 | バックエンドAPI | 理由 |
|-----------|-------------|-------------|--------|
| コミットメントメッセージ生成 | ✅ `prepareCommitment()` | ❌ | オフライン署名サポート |
| コミットメント署名 | ✅ `wallet.signMessage()` | ❌ | 秘密鍵はクライアントを離れない |
| コミットメント送信 | ❌ | ✅ `POST /api/commitments` | バックエンド検証とストレージ |
| 出金メッセージ生成 | ✅ `prepareWithdraw()` | ❌ | オフライン署名サポート |
| 出金署名 | ✅ `wallet.signMessage()` | ❌ | 秘密鍵はクライアントを離れない |
| 出金送信 | ❌ | ✅ `POST /api/withdrawals` | バックエンド処理とオンチェーン実行 |

---

## ステータスシステム

### CheckbookStatusフロー

```
┌─────────┐
│ Pending │ ──── 証明生成中 ────┐
└─────────┘                     │
                                ▼
┌──────────────────────┐   ┌────────────┐
│ ReadyForCommitment   │◄──│ ProofFailed│
└──────────────────────┘   └────────────┘
        │
        │ ユーザーがコミットメント作成
        ▼
┌──────────────┐
│WithCheckbook │
└──────────────┘
```

### AllocationStatusフロー

```
┌──────┐
│ Idle │ ──── 新しいWithdrawRequestで利用可能
└──────┘
   │
   │ WithdrawRequestに含まれる
   ▼
┌─────────┐
│ Pending │ ──── アクティブなWithdrawRequestの一部
└─────────┘
   │
   │ WithdrawRequest完了
   ▼
┌──────┐
│ Used │ ──── 正常に出金済み
└──────┘
```

**注意**: WithdrawRequestが失敗した場合、Allocationは`pending`から`idle`に戻ります。

---

## Pool & Token関連

### `client.stores.pools.getAll()`

**説明**: Storeからすべてのプールを取得

**バックエンドAPI**: `GET /api/pools?page=1&size=100` (初期同期時)

### `client.stores.pools.get(id)`

**説明**: ID別に特定のプールを取得

**バックエンドAPI**: `GET /api/pools/{id}`

### `client.searchTokens(keyword)`

**説明**: キーワードでトークンを検索

**バックエンドAPI**: `GET /api/tokens/search?keyword={keyword}&limit=10`

**使用例**:
```typescript
const results = await client.searchTokens('USDT');
```

---

## トークン価格

### `client.subscribePrices(assetIds)`

**説明**: WebSocket経由で価格更新を購読

**使用例**:
```typescript
await client.subscribePrices(['0x000...']);
```

**WebSocketメッセージ**:
```json
// 購読リクエスト
{
  "action": "subscribe",
  "type": "prices",
  "asset_ids": ["0x000..."],
  "timestamp": 1705500000
}

// 価格更新（毎分プッシュ）
{
  "type": "price_update",
  "asset_id": "0x000...",
  "price": "1234.56",
  "change_24h": "+5.2%",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### `client.stores.prices.get(assetId)`

**説明**: Storeから特定資産の価格を取得

**バックエンドAPI**: `GET /api/tokens/{asset_id}/price` (オプション)

### `client.stores.prices.getHistory(assetId, days)`

**説明**: 資産の価格履歴を取得

**バックエンドAPI**: `GET /api/tokens/{asset_id}/price-history?days={days}`

---

## WebSocketサブスクリプション

### 接続確立

**SDK内部**:
```typescript
const ws = new WebSocket(`wss://api.enclave-hq.com/api/ws?token=${JWT_TOKEN}`);

// 接続確認
{
  "type": "connected",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connected to WebSocket service",
  "timestamp": "2025-01-17T12:00:00Z"
}
```

### サブスクリプションタイプ

| SDKメソッド | WebSocketタイプ | メッセージタイプ |
|---------|-------------------|---------|
| `client.connect()` | `deposits` | `deposit_update` |
| `client.connect()` | `checkbooks` | `checkbook_update` |
| `client.connect()` | `withdraw_requests` | `withdrawal_update` |
| `client.subscribePrices()` | `prices` | `price_update` |

### 入金更新の購読

```json
// SDK送信
{
  "action": "subscribe",
  "type": "deposits",
  "address": "0x...",
  "timestamp": 1705500000
}

// 購読確認
{
  "type": "subscription_confirmed",
  "sub_type": "deposits",
  "message": "Subscribed to deposits",
  "timestamp": "2025-01-17T12:00:00Z"
}

// 更新プッシュ
{
  "type": "deposit_update",
  "data": {
    "id": 1,
    "chain_id": 714,
    "amount": "1000000",
    "status": "detected",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### Checkbook更新の購読

```json
// SDK送信
{
  "action": "subscribe",
  "type": "checkbooks",
  "address": "0x...",
  "timestamp": 1705500000
}

// 更新プッシュ
{
  "type": "checkbook_update",
  "data": {
    "id": "uuid",
    "status": "with_checkbook",
    "commitment": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

### 出金更新の購読

```json
// SDK送信
{
  "action": "subscribe",
  "type": "withdraw_requests",
  "address": "0x...",
  "timestamp": 1705500000
}

// 更新プッシュ
{
  "type": "withdrawal_update",
  "data": {
    "id": "uuid",
    "status": "completed",
    "execute_tx_hash": "0x...",
    "payout_tx_hash": "0x...",
    "updated_at": "2025-01-17T12:00:00Z"
  }
}
```

---

## エラーハンドリング

### HTTPステータスコードマッピング

| HTTPステータス | SDKエラータイプ | 処理方法 |
|-----------|-------------|---------|
| 200/201 | - | 正常レスポンス |
| 400 | `ValidationError` | パラメータ検証失敗 |
| 401 | `AuthenticationError` | トークン期限切れ、再ログイン必要 |
| 403 | `PermissionError` | 権限不足 |
| 404 | `NotFoundError` | リソースが見つからない |
| 500 | `ServerError` | サーバーエラー、リトライ |
| 503 | `ServiceUnavailableError` | サービス利用不可、リトライ |

### エラーハンドリング例

```typescript
try {
  await client.deposit(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // 再ログイン
    await client.connect(privateKey);
    await client.deposit(params); // リトライ
  } else if (error instanceof ValidationError) {
    // パラメータエラー、ユーザーに通知
    console.error('Invalid parameters:', error.message);
  } else {
    // その他のエラー
    console.error('Unexpected error:', error);
  }
}
```

---

## 完全なフロー例

### 入金から出金までの完全フロー

```typescript
// 1. 接続
const client = new EnclaveClient({
  apiUrl: 'https://api.enclave-hq.com',
});
await client.connect(privateKey);

// 2. 入金
const depositResult = await client.deposit({
  chainId: 714,
  tokenAddress: '0x...',
  amount: '1000000',
});

// 3. 入金検出待機（WebSocket経由で自動）
client.stores.deposits.on('added', (deposit) => {
  console.log('入金検出:', deposit);
});

// 4. Allocation作成
const allocationResult = await client.createAllocation({
  checkbookId: depositResult.checkbookId,
  allocations: [
    {
      recipient_chain_id: 714,
      recipient_address: '0x...',
      amount: '500000',
    },
  ],
});

// 5. Checkbookステータス更新待機（WebSocket経由で自動）
client.stores.checkbooks.on('updated', (checkbook) => {
  if (checkbook.status === 'with_checkbook') {
    console.log('Checkbook準備完了');
  }
});

// 6. 出金
const withdrawalResult = await client.withdraw({
  allocationIds: ['uuid1'],
  recipient: {
    chain_id: 714,
    address: '0x...',
    amount: '500000',
    token_symbol: 'USDT',
  },
});

// 7. 出金ステータス監視（WebSocket経由で自動）
client.stores.withdrawals.on('updated', (withdrawal) => {
  console.log('出金ステータス:', withdrawal.status);
  if (withdrawal.status === 'completed') {
    console.log('出金完了!', withdrawal.payout_tx_hash);
  }
});
```

---

**追加の技術詳細については、以下を参照してください**:
- **完全な中国語版**: [SDK_API_MAPPING.zh-CN.md](./SDK_API_MAPPING.zh-CN.md) - 全APIマッピングと詳細
- **技術設計**: [SDK_JS_DESIGN.md](./SDK_JS_DESIGN.md) - 内部アーキテクチャ
- **SDKオーバービュー**: [SDK_OVERVIEW.md](./SDK_OVERVIEW.md) - 高レベル紹介

---

**バージョン**: v2.0.0  
**最終更新**: 2025-01-17  
**ステータス**: 完了 ✅
