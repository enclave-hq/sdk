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
   - Legacy table may already have important key data
   - Migration process requires decryption and re-encryption
   - High risk of migration failure

## ✅ Security Delete Plan

### **Phase 1: Function Equivalence**

```go
// Modify GetStoredKey to query both tables
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // 1. First query dual-layer table
    key := queryDualLayerTable(keyAlias, chainID)
    if key != nil {
        return key
    }

    // 2. Then query legacy table (compatibility)
    return queryTraditionalTable(keyAlias, chainID)
}
```

### **Phase 2: API Unified**

```go
// Let legacy API internally call dual-layer encryption
func (h *EncryptHandler) EncryptPrivateKey(req) {
    // Internally forward to dual-layer encryption
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
// Delete legacy table related code
// Delete legacy API routes
// Delete data table
```

## 🎯 Recommend Plan

### **Plan A: Progressive Unified (Recommended)**

1. Keep legacy API interface, internally call dual-layer encryption
2. New keys only stored to dual-layer table
3. Query both tables simultaneously
4. Gradually migrate existing data
5. Finally delete legacy table

### **Plan B: Immediate Delete (High Risk)**

1. Immediately migrate all existing data
2. Modify all API implementations
3. Update all tests and documentation
4. Delete legacy table and related code

## 📋 Delete Checklist

If insisting on deletion, must complete:

- [ ] Complete data migration to dual-layer table
- [ ] Modify GetStoredKey to query dual-layer table
- [ ] Legacy API internally calls dual-layer service
- [ ] Update all test scripts
- [ ] Update Postman Collection
- [ ] Update API documentation
- [ ] Update web interface
- [ ] Thorough testing and verification

## 💡 Final Recommendation

**Do Not Recommend Immediate Delete of Legacy System**, because:

1. Risk is too high, may cause existing functionality to fail
2. Migration workload is large, error-prone
3. Dual-layer encryption functionality not yet mature enough

**Recommend adopting Plan A**, achieve unification through internal refactoring while maintaining external interface compatibility.
