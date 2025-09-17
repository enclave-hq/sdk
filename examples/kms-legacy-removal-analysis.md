# 🗑️ KMS老系统删除分析报告

## 📊 当前依赖分析

### **传统加密表依赖** (`encrypted_private_keys`)

**KMS内部使用:**
1. `EncryptPrivateKey()` - 存储新密钥
2. `GetStoredKey()` - 查询单个密钥  
3. `GetStoredKeysWithEncryptedData()` - 获取密钥列表
4. `Health检查` - 统计密钥数量

**API接口依赖:**
1. `POST /api/v1/encrypt` - 加密存储私钥
2. `POST /api/v1/sign` - 签名操作
3. `POST /api/v1/get-address` - 获取地址

**外部系统依赖:**
- 测试脚本 (test-kms.sh, test-api-updated.js)
- Postman集合
- 文档示例
- Web界面模板

## ⚠️ 删除风险评估

### 🔴 **高风险 - 不建议删除**

**原因分析:**

1. **核心功能绑定**
   - `GetStoredKey()` 只查询传统表
   - 双层表没有对应的查询接口
   - 删除后会导致现有密钥无法查询

2. **API接口广泛使用**
   ```bash
   # 这些API都依赖传统表
   /api/v1/encrypt      # 在多个测试和文档中使用
   /api/v1/sign         # 核心签名功能
   /api/v1/get-address  # 地址查询功能
   ```

3. **数据迁移复杂性**
   - 传统表中可能已有重要密钥数据
   - 迁移过程需要解密再重新加密
   - 迁移失败风险高

## ✅ 安全删除方案

### **阶段1: 功能对等**
```go
// 修改 GetStoredKey 同时查询两个表
func (k *KMSService) GetStoredKey(keyAlias string, chainID int) {
    // 1. 先查双层表
    key := queryDualLayerTable(keyAlias, chainID)
    if key != nil {
        return key
    }
    
    // 2. 再查传统表（兼容）
    return queryTraditionalTable(keyAlias, chainID)
}
```

### **阶段2: API统一**
```go
// 让传统API内部调用双层加密
func (h *EncryptHandler) EncryptPrivateKey(req) {
    // 内部转发到双层加密
    return h.dualLayerService.EncryptPrivateKey(req)
}
```

### **阶段3: 数据迁移**
```sql
-- 迁移现有数据
INSERT INTO dual_layer_encrypted_keys 
SELECT id, key_alias, slip44_id, encrypted_key, public_address, created_at, updated_at, status
FROM encrypted_private_keys 
WHERE status = 'active';
```

### **阶段4: 清理删除**
```go
// 删除传统表相关代码
// 删除传统API路由
// 删除数据表
```

## 🎯 建议方案

### **方案A: 渐进式统一 (推荐)**
1. 保留传统API接口，内部调用双层加密
2. 新密钥只存储到双层表
3. 查询时同时查询两个表
4. 逐步迁移现有数据
5. 最后删除传统表

### **方案B: 立即删除 (高风险)**
1. 立即迁移所有现有数据
2. 修改所有API实现
3. 更新所有测试和文档
4. 删除传统表和相关代码

## 📋 删除检查清单

如果坚持要删除，必须完成:

- [ ] 数据完整迁移到双层表
- [ ] 修改GetStoredKey查询双层表  
- [ ] 传统API内部调用双层服务
- [ ] 更新所有测试脚本
- [ ] 更新Postman集合
- [ ] 更新API文档
- [ ] 更新Web界面
- [ ] 充分测试验证

## 💡 最终建议

**不建议立即删除传统系统**，因为:
1. 风险太高，可能导致现有功能失效
2. 迁移工作量大，容易出错
3. 双层加密功能还不够成熟

**建议采用方案A**，通过内部重构实现统一，保持外部接口兼容。
