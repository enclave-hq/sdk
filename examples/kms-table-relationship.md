# 🔗 KMS Two Key Storage Tables Relationship Analysis

## 📊 Table Structure Comparison

### 1. **Legacy Encryption Table** (`encrypted_private_keys`)

```sql
CREATE TABLE encrypted_private_keys (
    id UUID PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    slip44_id INTEGER NOT NULL,           -- Chain ID (SLIP44 standard)
    evm_chain_id INTEGER,                 -- EVM Chain ID
    encrypted_data TEXT NOT NULL,         -- Private key encrypted with K2
    public_address VARCHAR(42) NOT NULL,  -- ✅ Plaintext stored address
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
    encrypted_key TEXT NOT NULL,          -- Private key with dual-layer encryption (K1+K2)
    public_address VARCHAR(42) NOT NULL,  -- ✅ Plaintext stored address
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

## 🔄 Table Relationship

### **Parallel Storage, Different Purposes**

1. **Legacy Encryption Table** - Single-layer K2 Encryption

   - Use case: Standard KMS operations
   - Encryption method: `Private Key --[K2]--> encrypted_data`
   - Decryption requirement: Only need K2 master key
   - API Interface: `/api/v1/encrypt`, `/api/v1/sign`

2. **Dual-layer Encryption Table** - K1+K2 Dual-layer Encryption
   - Use case: High security requirements
   - Encryption method: `Private Key --[K1]--> EncPK --[K2]--> encrypted_key`
   - Decryption requirement: Need K1 transport key + K2 storage key
   - API Interface: `/api/v1/dual-layer/encrypt`, `/api/v1/dual-layer/sign`

## 📋 Function Comparison

| Feature           | Legacy Encryption Table    | Dual-layer Encryption Table        |
| -------------- | ------------- | ----------------- |
| Security Level       | High (K2 encryption)  | Very High (K1+K2 dual-layer) |
| Query Address   | ✅ No key needed | ✅ No key needed     |
| Signature Operation | Need K2       | Need K1+K2        |
| Storage Efficiency       | High            | Medium              |
| Backend Dependencies   | None            | Need to store K1       |
| Suitable Scenario       | Standard business      | High-value assets        |

## 🎯 Practical Usage Strategy

### **Current KMS Implementation**

```go
// When querying key - prioritize legacy table
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // Query from encrypted_private_keys
    SELECT public_address FROM encrypted_private_keys
    WHERE key_alias = ? AND slip44_id = ?
}

// Get key list - query both tables separately
func (k *KMSService) GetStoredKeys() {
    // Query from dual_layer_encrypted_keys (don't return encryption data)
    SELECT id, key_alias, slip44_id, public_address
    FROM dual_layer_encrypted_keys
}
```

## 💡 Key Findings

### **Both Tables Store Plaintext Addresses**

- ✅ `encrypted_private_keys.public_address`
- ✅ `dual_layer_encrypted_keys.public_address`

### **Querying Address Does Not Require Decryption Keys**

- Both tables calculate and save corresponding public key addresses when storing private keys
- When querying, plaintext addresses are returned directly without K1 or K2 decryption
- Only signature operations require decrypting private keys

### **Usage Scenario Recommendations**

- **Standard Business**: Use legacy encryption table, simple and efficient
- **High Security Scenarios**: Use dual-layer encryption table, backend manages K1
- **Hybrid Deployment**: Both tables can coexist, select based on business needs

## 🔍 Answering the Original Question

**"Can I get the address without K1?"**

✅ **Yes!** Because both tables store the `public_address` field in plaintext, querying addresses does not require any decryption operations.
