# 🔗 KMS Two Key Storage Tables Relationship Analysis

## 📊 Table Structure Comparison

### 1. **Legacy Encryption Table** (`encrypted_private_keys`)

```sql
CREATE TABLE encrypted_private_keys (
    id UUID PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    slip44_id INTEGER NOT NULL,           -- Chain ID (SLIP44标准)
    evm_chain_id INTEGER,                 -- EVM Chain ID
    encrypted_data TEXT NOT NULL,         -- K2Encryption的Private Key
    public_address VARCHAR(42) NOT NULL,  -- ✅ 明文Storage的Address
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

### 2. **Dual-layerEncryptionTable** (`dual_layer_encrypted_keys`)

```sql
CREATE TABLE dual_layer_encrypted_keys (
    id UUID PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    slip44_id INTEGER NOT NULL,
    encrypted_key TEXT NOT NULL,          -- Dual-layerEncryption的Private Key (K1+K2)
    public_address VARCHAR(42) NOT NULL,  -- ✅ 明文Storage的Address
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

## 🔄 两Table关系

### **并行Storage，不同用途**

1. **LegacyEncryptionTable** - 单层 K2 Encryption

   - Use 场景：标准 KMS Operation
   - Encryption方式：`Private Key --[K2]--> encrypted_data`
   - DecryptionNeed：仅Need K2 主 Key
   - API Interface：`/api/v1/encrypt`, `/api/v1/sign`

2. **Dual-layerEncryptionTable** - K1+K2 Dual-layerEncryption
   - Use 场景：高Security性要求
   - Encryption方式：`Private Key --[K1]--> EncPK --[K2]--> encrypted_key`
   - DecryptionNeed：Need K1 传输 Key + K2 Storage Key
   - API Interface：`/api/v1/dual-layer/encrypt`, `/api/v1/dual-layer/sign`

## 📋 FunctionCompare

| 特性           | LegacyEncryptionTable    | Dual-layerEncryptionTable        |
| -------------- | ------------- | ----------------- |
| Security级别       | 高 (K2 Encryption)  | 极高 (K1+K2 Dual-layer) |
| Query Address   | ✅ 不Need Key | ✅ 不Need Key     |
| Signature Operation | Need K2       | Need K1+K2        |
| Storage效率       | 高            | 中等              |
| Backend Dependencies   | 无            | NeedStorage K1       |
| 适用场景       | 标准Business      | 高价值资产        |

## 🎯 实际 Use 策略

### **当前 KMS 实现**

```go
// QueryKey时 - 优先查LegacyTable
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // 从 encrypted_private_keys Query
    SELECT public_address FROM encrypted_private_keys
    WHERE key_alias = ? AND slip44_id = ?
}

// GetKeyList - 分别Query两个Table
func (k *KMSService) GetStoredKeys() {
    // 从 dual_layer_encrypted_keys Query（不返回EncryptionData）
    SELECT id, key_alias, slip44_id, public_address
    FROM dual_layer_encrypted_keys
}
```

## 💡 关键发现

### **两个Table都Storage明文 Address**

- ✅ `encrypted_private_keys.public_address`
- ✅ `dual_layer_encrypted_keys.public_address`

### **Query Address 不NeedDecryption Key**

- 两个Table都在StoragePrivate Key时Calculate并SaveTo应的公钥 Address
- Query时直接返回明文 Address，无需 K1 或 K2 Decryption
- 只有 Signature Operation才NeedDecryptionPrivate Key

### **Use 场景Recommend**

- **标准Business**: Use LegacyEncryptionTable，简单高效
- **高Security场景**: Use Dual-layerEncryptionTable，Backend Management K1
- **混合部署**: 两个Table可以并存，根据BusinessNeedSelect

## 🔍 回答原Issue

**"没有 K1，能够得到 Address 么？"**

✅ **能够！** 因为两个Table都明文Storage了 `public_address` 字段，Query Address 时不Need任何DecryptionOperation。
