# Enclave SDK 完全ガイド

> **最終更新**: 2025-01-XX  
> **SDK バージョン**: v2.0.2

**Languages**: [English](./SDK_COMPLETE_GUIDE.en.md) | [中文](./SDK_COMPLETE_GUIDE.md) | 日本語 | [한국어](./SDK_COMPLETE_GUIDE.ko.md)

---

## 📋 目次

1. [概要](#概要)
2. [SDK API インターフェース一覧](#sdk-api-インターフェース一覧)
3. [WebFront 統合ガイド](#webfront-統合ガイド)
4. [使用例](#使用例)
5. [更新履歴](#更新履歴)

---

## 概要

Enclave SDK は、Enclave プライバシー保護マルチチェーン DeFi プロトコルと対話するための完全な JavaScript/TypeScript クライアントライブラリを提供します。

### コア機能

- 🔄 **リアクティブ状態管理** - MobX ベース、自動データ同期
- 🔌 **リアルタイムプッシュ** - WebSocket 自動プッシュ更新、ポーリング不要
- 🌐 **ユニバーサル環境** - Browser、Node.js、React Native、Electron をサポート
- ⚡ **TypeScript First** - 完全な型定義と推論
- 🎯 **フレームワーク統合** - React、Vue、Next.js すぐに使用可能

### アーキテクチャ概要

```
WebFront ページ層
  ↓ useHooks
ビジネス Hooks 層
  ↓ 呼び出し
Store 層 (MobX)
  ↓ 呼び出し
SDK 層 (@enclave-hq/sdk)
  ↓ 呼び出し
バックエンド API / オンチェーンコントラクト
```

---

## SDK API インターフェース一覧

### 概要

SDK には **13 の API クライアントクラス** が含まれ、**68 の API メソッド** を提供します。

### API クライアントカテゴリ

#### 1. 🔐 認証関連 (AuthAPI) - 5個

- **`authenticate(request: AuthRequest)`** - ウォレット署名ログイン
  ```typescript
  await client.auth.authenticate({
    address: { universalFormat: '0x...' },
    message: 'Sign this message...',
    signature: '0x...',
    chainId: 1
  });
  ```
- **`refreshToken(request: RefreshTokenRequest)`** - JWT Token の更新
  ```typescript
  await client.auth.refreshToken({ token: 'old-token' });
  ```
- **`logout()`** - ログアウト
  ```typescript
  await client.auth.logout();
  ```
- **`verifyToken()`** - Token の有効性を検証
  ```typescript
  const isValid = await client.auth.verifyToken();
  ```
- **`getNonce(address?: string)`** - 署名チャレンジ Nonce を取得
  ```typescript
  const { nonce, message } = await client.auth.getNonce('0x...');
  ```

#### 2. 📝 Checkbook 関連 (CheckbooksAPI) - 5個

- **`listCheckbooks(request?: ListCheckbooksRequest)`** - ユーザーの Checkbooks を一覧表示
  ```typescript
  const checkbooks = await client.checkbooks.listCheckbooks({
    page: 1,
    limit: 10,
    status: 'active'
  });
  ```
- **`getCheckbookById(request: GetCheckbookRequest)`** - 単一の Checkbook を取得
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookById({ id: 'cb-123' });
  ```
- **`getCheckbookByDeposit(request: GetCheckbookByDepositRequest)`** - Deposit で Checkbook を取得
  ```typescript
  const checkbook = await client.checkbooks.getCheckbookByDeposit({
    chainId: 1,
    txHash: '0x...'
  });
  ```
- **`getCheckbooksByOwner(owner: string, ...)`** - (非推奨) 所有者で Checkbooks をクエリ
  ```typescript
  // listCheckbooks() を使用してください
  ```
- **`deleteCheckbook(id: string)`** - Checkbook を削除
  ```typescript
  await client.checkbooks.deleteCheckbook('cb-123');
  ```

#### 3. 💰 Allocation 関連 (AllocationsAPI) - 5個

- **`listAllocations(request?: ListAllocationsRequest)`** - 割り当てレコードを一覧表示
  ```typescript
  const allocations = await client.allocations.listAllocations({
    checkbookId: 'cb-123',
    status: 'active'
  });
  ```
- **`searchAllocations(request: SearchAllocationsRequest)`** - 割り当てを一括検索
  ```typescript
  const results = await client.allocations.searchAllocations({
    chain_slip44_id: 60,
    addresses: ['0x...']
  });
  ```
- **`createAllocations(request: CreateAllocationsRequest)`** - 割り当てを作成（Commitment）
  ```typescript
  await client.allocations.createAllocations({
    checkbookId: 'cb-123',
    amounts: ['1000'],
    tokenKey: 'USDT',
    signature: '0x...',
    message: '...'
  });
  ```
- **`getAllocationsByCheckbookId(checkbookId: string, status?: string)`** - Checkbook で割り当てをクエリ
  ```typescript
  const list = await client.allocations.getAllocationsByCheckbookId('cb-123');
  ```
- **`getAllocationsByTokenIdAndStatus(tokenId: string, status: string)`** - Token とステータスで割り当てをクエリ
  ```typescript
  const list = await client.allocations.getAllocationsByTokenIdAndStatus('token-1', 'active');
  ```

#### 4. 📤 Withdrawal 関連 (WithdrawalsAPI) - 7個

- **`listWithdrawRequests(request?: ListWithdrawRequestsRequest)`** - 出金リクエストを一覧表示
  ```typescript
  const requests = await client.withdrawals.listWithdrawRequests({
    page: 1,
    limit: 20,
    status: 'pending'
  });
  ```
- **`getWithdrawRequestById(request: GetWithdrawRequestRequest)`** - 単一の出金リクエストを取得
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestById({ id: 'req-123' });
  ```
- **`getWithdrawRequestByNullifier(request: GetWithdrawRequestByNullifierRequest)`** - nullifier でクエリ
  ```typescript
  const req = await client.withdrawals.getWithdrawRequestByNullifier({ nullifier: '0x...' });
  ```
- **`createWithdrawRequest(request: CreateWithdrawRequestRequest)`** - 出金リクエストを作成
  ```typescript
  await client.withdrawals.createWithdrawRequest({
    checkbookId: 'cb-123',
    allocationIds: ['alloc-1'],
    intent: { ... },
    signature: '0x...',
    chainId: 1
  });
  ```
- **`retryWithdrawRequest(request: RetryWithdrawRequestRequest)`** - 失敗した出金を再試行
  ```typescript
  await client.withdrawals.retryWithdrawRequest({ id: 'req-123' });
  ```
- **`cancelWithdrawRequest(request: CancelWithdrawRequestRequest)`** - 出金リクエストをキャンセル
  ```typescript
  await client.withdrawals.cancelWithdrawRequest({ id: 'req-123' });
  ```
- **`getWithdrawStats(request?: GetWithdrawStatsRequest)`** - 出金統計を取得
  ```typescript
  const stats = await client.withdrawals.getWithdrawStats();
  ```

#### 5. 👥 Beneficiary 関連 (BeneficiaryAPI) - 3個 ⭐

- **`listBeneficiaryWithdrawRequests(request?: ListBeneficiaryWithdrawRequestsRequest)`** - 受益者としての出金リクエストを一覧表示
  ```typescript
  const requests = await client.beneficiary.listBeneficiaryWithdrawRequests({
    status: 'waiting_for_payout'
  });
  ```
- **`requestPayoutExecution(request: RequestPayoutExecutionRequest)`** - ペイアウト実行をリクエスト
  ```typescript
  await client.beneficiary.requestPayoutExecution({ id: 'req-123' });
  ```
- **`claimTimeout(request: ClaimTimeoutRequest)`** - タイムアウトを請求
  ```typescript
  await client.beneficiary.claimTimeout({ id: 'req-123' });
  ```

#### 6. 🏊 Pool & Token 関連 (PoolsAPI) - 5個

- **`listPools(request?: ListPoolsRequest)`** - すべてのプールを一覧表示
  ```typescript
  const pools = await client.pools.listPools({ isActive: true });
  ```
- **`getPoolById(request: GetPoolRequest)`** - プールの詳細を取得
  ```typescript
  const pool = await client.pools.getPoolById({ id: 'pool-1' });
  ```
- **`listTokens(request?: ListTokensRequest)`** - トークンを一覧表示
  ```typescript
  const tokens = await client.pools.listTokens({ chainId: 1 });
  ```
- **`getTokenById(request: GetTokenRequest)`** - トークンの詳細を取得
  ```typescript
  const token = await client.pools.getTokenById({ id: 'token-1' });
  ```
- **`getActiveTokens(chainId?: number)`** - アクティブなトークンを取得
  ```typescript
  const tokens = await client.pools.getActiveTokens(1);
  ```

#### 7. 💹 価格関連 (PricesAPI) - 3個

- **`getTokenPrices(request?: GetTokenPricesRequest)`** - トークン価格を一括取得
  ```typescript
  const prices = await client.prices.getTokenPrices({ symbols: ['ETH', 'USDT'] });
  ```
- **`getTokenPrice(symbol: string)`** - 単一のトークン価格を取得
  ```typescript
  const price = await client.prices.getTokenPrice('ETH');
  ```
- **`getAllPrices()`** - すべての価格を取得
  ```typescript
  const allPrices = await client.prices.getAllPrices();
  ```

#### 8. 📊 指標関連 (MetricsAPI) - 6個

- **`getPoolMetrics(poolId: number)`** - プール指標を取得
  ```typescript
  const metrics = await client.metrics.getPoolMetrics(1);
  ```
- **`getTokenMetrics(assetId: string)`** - トークン指標を取得
  ```typescript
  const metrics = await client.metrics.getTokenMetrics('0x...');
  ```
- **`getPoolMetricsHistory(poolId: number, metricType: string, days?: number)`** - プール指標履歴を取得
  ```typescript
  const history = await client.metrics.getPoolMetricsHistory(1, 'apy', 30);
  ```
- **`getTokenMetricsHistory(assetId: string, metricType: string, days?: number)`** - トークン指標履歴を取得
  ```typescript
  const history = await client.metrics.getTokenMetricsHistory('0x...', 'price', 7);
  ```
- **`getBatchPoolMetrics(poolIds: number[])`** - プール指標を一括取得
  ```typescript
  const batch = await client.metrics.getBatchPoolMetrics([1, 2]);
  ```
- **`getBatchTokenMetrics(assetIds: string[])`** - トークン指標を一括取得
  ```typescript
  const batch = await client.metrics.getBatchTokenMetrics(['0x...', '0x...']);
  ```

#### 9. 🛣️ 見積もり関連 (QuoteAPI) - 2個

- **`getRouteAndFees(request: RouteAndFeesRequest)`** - ルートと手数料をクエリ
  ```typescript
  const quote = await client.quote.getRouteAndFees({
    amount: '1000',
    deposit_token: '0x...',
    owner_data: { ... },
    intent: { ... }
  });
  ```
- **`getHookAsset(request: HookAssetRequest)`** - Hook 資産情報をクエリ
  ```typescript
  const info = await client.quote.getHookAsset({
    asset_id: '0x...',
    chain_id: 1,
    amount: '1000'
  });
  ```

#### 10. 🔗 チェーン設定関連 (ChainConfigAPI) - 6個

- **`getChainConfig(chainId: number)`** - チェーン設定を取得
  ```typescript
  const config = await client.chainConfig.getChainConfig(1);
  ```
- **`getTreasuryAddress(chainId: number)`** - Treasury アドレスを取得
  ```typescript
  const address = await client.chainConfig.getTreasuryAddress(1);
  ```
- **`getIntentManagerAddress(chainId: number)`** - IntentManager アドレスを取得
  ```typescript
  const address = await client.chainConfig.getIntentManagerAddress(1);
  ```
- **`getRpcEndpoint(chainId: number)`** - RPC エンドポイントを取得
  ```typescript
  const rpc = await client.chainConfig.getRpcEndpoint(1);
  ```
- **`listChains()`** - すべてのアクティブなチェーンを一覧表示
  ```typescript
  const chains = await client.chainConfig.listChains();
  ```
- **`getAllTreasuryAddresses()`** - すべての Treasury アドレスを取得
  ```typescript
  const addresses = await client.chainConfig.getAllTreasuryAddresses();
  ```

#### 11. 🔀 Token ルーティング規則関連 (TokenRoutingAPI) - 3個 ⭐

- **`getAllowedTargets(request?: GetAllowedTargetsRequest)`** - 許可されたターゲットチェーンとトークンをクエリ（パラメータなしで全件クエリをサポート）
  ```typescript
  const targets = await client.tokenRouting.getAllowedTargets({
    source_chain_id: 1,
    source_token_key: 'USDT'
  });
  ```
- **`getAllPoolsAndTokens()`** - すべてのプールとトークンを取得（便利メソッド）
  ```typescript
  const all = await client.tokenRouting.getAllPoolsAndTokens();
  ```
- **`getTargetsForSource(sourceChainId: number, sourceTokenId: string)`** - 特定のソースのターゲットを取得（便利メソッド）
  ```typescript
  const targets = await client.tokenRouting.getTargetsForSource(1, 'USDT');
  ```

#### 12. 🔑 KMS 関連 (KMSAPI) - 2個

- **`sign(request: KMSSignRequest)`** - KMS を使用してデータに署名
  ```typescript
  const sig = await client.kms.sign({ data: '0x...', keyId: '...' });
  ```
- **`getPublicKey(request?: KMSPublicKeyRequest)`** - KMS 管理の公開鍵を取得
  ```typescript
  const pk = await client.kms.getPublicKey({ keyId: '...' });
  ```

#### 13. 🎯 EnclaveClient 高レベルメソッド - 16個

**接続管理 (5個)**:
- `connect()` - Enclave サービスに接続
- `disconnect()` - 切断
- `connection` (getter) - 接続情報を取得
- `isConnected` (getter) - 接続状態を確認
- `address` (getter) - 現在のユーザーアドレスを取得

**Commitment 操作 (3個)**:
- `createCommitment(params)` - Commitment を作成（完全フロー）
- `prepareCommitment(params)` - Commitment 署名データを準備
- `submitCommitment(params, signature)` - 署名済み Commitment を送信

**Withdrawal 操作 (5個)**:
- `withdraw(params)` - 出金を作成（完全フロー）
- `prepareWithdraw(params)` - 出金署名データを準備
- `submitWithdraw(params, signature)` - 署名済み出金を送信
- `retryWithdraw(withdrawalId)` - 失敗した出金リクエストを再試行
- `cancelWithdraw(withdrawalId)` - 保留中の出金リクエストをキャンセル

**API アクセサー (5個)**:
- `quote` (getter) - QuoteAPI にアクセス
- `metrics` (getter) - MetricsAPI にアクセス
- `chainConfig` (getter) - ChainConfigAPI にアクセス
- `beneficiary` (getter) - BeneficiaryAPI にアクセス
- `tokenRouting` (getter) - TokenRoutingAPI にアクセス

### インターフェース統計サマリー

| API カテゴリ | メソッド数 | ステータス |
|-------------|-----------|----------|
| 認証 | 5 | ✅ |
| Checkbook | 5 | ✅ |
| Allocation | 5 | ✅ |
| Withdrawal | 7 | ✅ |
| Beneficiary | 3 | ⭐ 新規 |
| Pool & Token | 5 | ✅ |
| 価格 | 3 | ✅ |
| 指標 | 6 | ✅ |
| 見積もり | 2 | ✅ |
| チェーン設定 | 6 | ✅ |
| Token ルーティング | 3 | ⭐ 新規 |
| KMS | 2 | ✅ |
| EnclaveClient 高レベル | 16 | ✅ |
| **合計** | **68** | ✅ |

---

## WebFront 統合ガイド

### 統合アーキテクチャ

```
WebFront ページ層 (React Components, Pages, Hooks)
  ↓ useHooks
SDKStore (MobX Store)
  ↓ 呼び出し
EnclaveClient (SDK メインクライアント)
  ↓ 呼び出し
13 の API クライアントクラス
  ↓ 呼び出し
バックエンド REST API
```

### コアインターフェース（必須）

1. **EnclaveClient 高レベルメソッド** - 16 メソッド
   - 接続管理：5
   - Commitment 操作：3
   - Withdrawal 操作：5
   - API アクセサー：5

2. **リアクティブ Stores** - 5 ストア
   - `stores.checkbooks` - Checkbook データ
   - `stores.allocations` - Allocation データ
   - `stores.withdrawals` - Withdrawal データ
   - `stores.prices` - 価格データ
   - `stores.pools` - Pool データ

3. **API アクセサー** - 3個
   - `quote` - ルートと手数料クエリ
   - `chainConfig` - チェーン設定クエリ
   - `tokenRouting` - Token ルーティング規則クエリ

### ページと SDK のマッピング

| ページ | ページ内容 | Store 読み取り | Hook 使用 | SDK メソッド呼び出し |
|--------|----------|--------------|-----------|---------------------|
| `/home` | おすすめ商品、総ロック額 | `stores.pools`<br>`stores.prices` | `useFeaturedPools()`<br>`useUserAssets()` | - |
| `/deposit` | 預金記録、バウチャー割り当て | `stores.checkbooks`<br>`stores.allocations` | `useCheckbooksData()`<br>`useDepositActions()` | `sdk.createCommitment()` |
| `/defi` | レンディングプール、RWA 資産、出金 | `stores.pools`<br>`stores.allocations` | `useFeaturedPools()`<br>`useAllocationsData()`<br>`useQuoteRoute()` | `sdk.quote.getRouteAndFees()`<br>`sdk.withdraw()` |
| `/records` | 取引履歴 | `stores.withdrawals` | - | - |

### 使用方法

#### 1. SDKStore 経由（推奨）

```typescript
const sdkStore = useSDKStore()

// データを取得
await sdkStore.fetchCheckbooks()
await sdkStore.fetchAllocations()

// ビジネス操作
await sdkStore.createCommitment({ ... })
await sdkStore.withdraw({ ... })
```

#### 2. SDK 直接使用（上級）

```typescript
const sdk = sdkStore.sdk
if (sdk) {
  // リアクティブ Stores を使用
  const checkbooks = sdk.stores.checkbooks.all
  const allocations = sdk.stores.allocations.all
  
  // API クライアントを使用
  const quote = await sdk.quote.getRouteAndFees({ ... })
  const chainConfig = await sdk.chainConfig.getChainConfig(714)
  
  // 新しい API を使用
  const pools = await sdk.tokenRouting.getAllPoolsAndTokens()
}
```

---

## 使用例

### 例 1: 預金して Commitment を作成

```typescript
// 1. SDK に接続
await client.connect()

// 2. 預金記録を取得
const checkbooks = await client.stores.checkbooks.fetchList()

// 3. Commitment を作成
const allocations = await client.createCommitment({
  checkbookId: 'checkbook-id',
  amounts: ['1000000'],
  tokenId: 'token-id'
})

// 4. リアクティブ更新
// stores.allocations が自動的に更新されます
```

### 例 2: チェーンに出金

```typescript
// 1. ルートと手数料をクエリ
const quote = await client.quote.getRouteAndFees({
  owner_data: { chain_id: 60, data: userAddress },
  deposit_token: tokenAddress,
  intent: { type: 'RawToken', ... },
  amount: amountInWei
})

// 2. 出金を作成
const withdrawRequest = await client.withdraw({
  allocationIds: ['alloc-1', 'alloc-2'],
  targetChain: 1,
  targetAddress: '0x...',
  intent: { type: 'RawToken', ... }
})

// 3. リアクティブ更新
// stores.withdrawals が自動的に更新されます
```

### 例 3: Token ルーティング規則をクエリ

```typescript
// すべてのプールとトークンをクエリ
const allPools = await client.tokenRouting.getAllPoolsAndTokens()

// 特定のソースのターゲットをクエリ
const targets = await client.tokenRouting.getTargetsForSource(
  714, 
  '0x55d398326f99059fF775485246999027B3197955'
)
```

---

## 更新履歴

### v2.0.2 (最新)

- ✅ `BeneficiaryAPI` を追加 - 受益者操作
- ✅ `TokenRoutingAPI` を追加 - Token ルーティング規則クエリ
- ✅ すべての API エンドポイントを `/api/` 形式に統一
- ✅ `WithdrawalsAPI` を新しい Intent 形式に更新
- ✅ QuoteAPI パスを `/api/v2/quote/...` に修正
- ✅ TokenRoutingAPI 型定義を完全な Pool 情報を含むように更新

### v2.0.1

- ✅ 初回リリース
- ✅ 完全な TypeScript 型定義
- ✅ MobX リアクティブ状態管理
- ✅ WebSocket リアルタイム同期

---

## 関連ドキュメント

- [SDK API マッピング](./js/docs/SDK_API_MAPPING.ja.md) - SDK API からバックエンド API へのマッピング
- [技術設計](./js/docs/SDK_JS_DESIGN.ja.md) - 詳細な技術設計
- [バックエンド API ドキュメント](../backend/API_DOCUMENTATION.md) - 完全なバックエンド API ドキュメント

---

**ドキュメント保守**: SDK チーム  
**問題報告**: [GitHub Issues](https://github.com/enclave-hq/sdk/issues)

