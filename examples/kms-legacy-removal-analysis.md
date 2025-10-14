# 🗑️ KMS Legacy System Removal Analysis Report

## 📊 Current Dependency Analysis

### **Legacy Encryption Table Dependencies** (`encrypted_private_keys`)

**KMS Internal Usage:**

1. `EncryptPrivateKey()` - Store new keys
2. `GetStoredKey()` - Query single key
3. `GetStoredKeysWithEncryptedData()` - Get key list
4. `Health check` - Count keys

**API Interface Dependencies:**

1. `POST /api/v1/encrypt` - Encrypt and store private key
2. `POST /api/v1/sign` - Signing operations
3. `POST /api/v1/get-address` - Get address

**External System Dependencies:**

- Test scripts (test-kms.sh, test-api-updated.js)
- Postman collections
- Documentation examples
- Web interface templates

## ⚠️ Deletion Risk Assessment

### 🔴 **High Risk - Not Recommended for Deletion**

**Reason Analysis:**

1. **Core Function Binding**

   - `GetStoredKey()` only queries legacy table
   - Dual-layer table has no corresponding query interface
   - Deletion would cause existing keys to be unqueryable

2. **API Interface Widely Used**

   ```bash
   # These APIs all depend on legacy table
   /api/v1/encrypt      # Used in multiple tests and documentation
   /api/v1/sign         # Core signing functionality
   /api/v1/get-address  # Address query functionality
   ```

3. **Data MigrationComplexity**
   - LegacyTable中可能已有重要 KeyData
   - Migration过程NeedDecryption再重新Encryption
   - Migration失败Risk高

## ✅ Security Delete Plan

### **Phase 1: FunctionTo等**

```go
// 修改 GetStoredKey 同时Query两个Table
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // 1. 先查Dual-layerTable
    key := queryDualLayerTable(keyAlias, chainID)
    if key != nil {
        return key
    }

    // 2. 再查LegacyTable（兼容）
    return queryTraditionalTable(keyAlias, chainID)
}
```

### **Phase 2: API Unified**

```go
// 让LegacyAPI内部调用Dual-layerEncryption
func (h *EncryptHandler) EncryptPrivateKey(req) {
    // 内部转发到Dual-layerEncryption
    return h.dualLayerService.EncryptPrivateKey(req)
}
```

### **Phase 3: Data Migration**

```sql
-- MigrationExistingData
INSERT INTO dual_layer_encrypted_keys
SELECT id, key_alias, slip44_id, encrypted_key, public_address, created_at, updated_at, status
FROM encrypted_private_keys
WHERE status = 'active';
```

### **Phase 4: CleanupDelete**

```go
// DeleteLegacyTableRelated代码
// DeleteLegacyAPIRoute
// DeleteDataTable
```

## 🎯 RecommendPlan

### **Plan A: ProgressiveUnified (Recommended)**

1. KeepLegacy API Interface，内部调用Dual-layerEncryption
2. 新 Key 只Storage到Dual-layerTable
3. Query时同时Query两个Table
4. 逐步MigrationExisting Data
5. 最后 Delete LegacyTable

### **Plan B: Immediate Delete (高Risk)**

1. ImmediateMigration所有Existing Data
2. 修改所有 API 实现
3. Update所有Test和Document
4. Delete LegacyTable和Related代码

## 📋 Delete CheckList

如果坚持要 Delete，必须完成:

- [ ] Data 完整Migration到Dual-layerTable
- [ ] 修改 GetStoredKey QueryDual-layerTable
- [ ] Legacy API 内部调用Dual-layer Service
- [ ] Update所有TestScript
- [ ] Update Postman Collection
- [ ] Update API Document
- [ ] Update Web 界面
- [ ] 充分Test验证

## 💡 FinalRecommend

**不RecommendImmediate Delete LegacySystem**，因为:

1. Risk太高，可能导致ExistingFunction失效
2. Migration工作量大，容易出错
3. Dual-layerEncryptionFunction还不够成熟

**Recommend采用Plan A**，Pass内部重构实现Unified，保持外部Interface兼容。
