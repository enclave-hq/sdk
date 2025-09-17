# �� KMS两个密钥存储表的关系分析

## 📊 表结构对比

### 1. **传统加密表** (`encrypted_private_keys`)
```sql
CREATE TABLE encrypted_private_keys (
    id UUID PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    slip44_id INTEGER NOT NULL,           -- Chain ID (SLIP44标准)
    evm_chain_id INTEGER,                 -- EVM Chain ID  
    encrypted_data TEXT NOT NULL,         -- K2加密的私钥
    public_address VARCHAR(42) NOT NULL,  -- ✅ 明文存储的地址
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

### 2. **双层加密表** (`dual_layer_encrypted_keys`)
```sql
CREATE TABLE dual_layer_encrypted_keys (
    id UUID PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    slip44_id INTEGER NOT NULL,
    encrypted_key TEXT NOT NULL,          -- 双层加密的私钥 (K1+K2)
    public_address VARCHAR(42) NOT NULL,  -- ✅ 明文存储的地址
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);
```

## 🔄 两表关系

### **并行存储，不同用途**

1. **传统加密表** - 单层K2加密
   - 使用场景：标准KMS操作
   - 加密方式：`私钥 --[K2]--> encrypted_data`
   - 解密需要：仅需要K2主密钥
   - API接口：`/api/v1/encrypt`, `/api/v1/sign`

2. **双层加密表** - K1+K2双层加密
   - 使用场景：高安全性要求
   - 加密方式：`私钥 --[K1]--> EncPK --[K2]--> encrypted_key`
   - 解密需要：需要K1传输密钥 + K2存储密钥
   - API接口：`/api/v1/dual-layer/encrypt`, `/api/v1/dual-layer/sign`

## 📋 功能对比

| 特性 | 传统加密表 | 双层加密表 |
|------|-----------|-----------|
| 安全级别 | 高 (K2加密) | 极高 (K1+K2双层) |
| 查询地址 | ✅ 不需要密钥 | ✅ 不需要密钥 |
| 签名操作 | 需要K2 | 需要K1+K2 |
| 存储效率 | 高 | 中等 |
| Backend依赖 | 无 | 需要存储K1 |
| 适用场景 | 标准业务 | 高价值资产 |

## 🎯 实际使用策略

### **当前KMS实现**
```go
// 查询密钥时 - 优先查传统表
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // 从 encrypted_private_keys 查询
    SELECT public_address FROM encrypted_private_keys 
    WHERE key_alias = ? AND slip44_id = ?
}

// 获取密钥列表 - 分别查询两个表
func (k *KMSService) GetStoredKeys() {
    // 从 dual_layer_encrypted_keys 查询（不返回加密数据）
    SELECT id, key_alias, slip44_id, public_address 
    FROM dual_layer_encrypted_keys
}
```

## 💡 关键发现

### **两个表都存储明文地址**
- ✅ `encrypted_private_keys.public_address`
- ✅ `dual_layer_encrypted_keys.public_address` 

### **查询地址不需要解密密钥**
- 两个表都在存储私钥时计算并保存对应的公钥地址
- 查询时直接返回明文地址，无需K1或K2解密
- 只有签名操作才需要解密私钥

### **使用场景建议**
- **标准业务**: 使用传统加密表，简单高效
- **高安全场景**: 使用双层加密表，Backend管理K1
- **混合部署**: 两个表可以并存，根据业务需要选择

## 🔍 回答原问题

**"没有K1，能够得到地址么？"**

✅ **能够！** 因为两个表都明文存储了 `public_address` 字段，查询地址时不需要任何解密操作。
