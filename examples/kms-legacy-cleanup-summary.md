# 🗑️ KMS Legacy System Cleanup Summary

## ✅ Completed Cleanup

### 1. **Model and Struct Cleanup** (`internal/models/models.go`)

- ❌ Delete `EncryptedPrivateKey` struct
- ❌ Delete `EncryptKeyRequest/Response`
- ❌ Delete `SignRequest/Response`
- ❌ Delete `GetAddressRequest/Response`
- ✅ Keep `DualLayerEncryptedKey` and related dual-layer encryption structures

### 2. **API Route Cleanup** (`internal/router/router.go`)

- ❌ Delete `POST /api/v1/encrypt`
- ❌ Delete `POST /api/v1/sign`
- ❌ Delete `POST /api/v1/get-address`
- ❌ Delete `POST /api/v1/sign/transaction`
- ✅ Keep `GET /api/v1/health`
- ✅ Keep `POST /api/v1/generate-key`
- 📋 Pending dual-layer encryption routes

## 🚧 Needs Continued Cleanup

### 3. **Service Method Cleanup** (`internal/services/kms_service.go`)

Need to delete the following methods:

- `EncryptPrivateKey()` - Legacy encryption method
- `SignData()` - Legacy signing method
- `GetAddress()` - Legacy address retrieval method
- `GetStoredKey()` - Method to query legacy table
- `GetStoredKeysWithEncryptedData()` - Get legacy table data

### 4. **Process器Cleanup**

- `internal/handlers/encrypt_handler.go` - DeleteLegacyEncryptionProcess器
- `internal/handlers/sign_handler.go` - DeleteLegacySignatureProcess器

### 5. **Data库TableCleanup**

- Delete `encrypted_private_keys` Table的建TableStatement
- UpdateMigrationScript，RemoveToLegacyTable的Reference

### 6. **Document和TestCleanup**

- Update API Document，RemoveLegacyInterface说明
- UpdateTestScript，Change to useDual-layerEncryptionInterface
- Update Postman Collection

## 🎯 Cleanup后的 KMS Architecture

### **Keep的Function**

```
✅ HealthCheck:     GET  /api/v1/health
✅ KeyGenerate:     POST /api/v1/generate-key
✅ Dual-layerEncryption:     POST /api/v1/dual-layer/encrypt
✅ Dual-layerSignature:     POST /api/v1/dual-layer/sign
✅ BusinessKey:     POST /api/v1/business/keys/*
✅ Data加Decryption:   POST /api/v1/data/encrypt|decrypt
```

### **Delete的Function**

```
❌ LegacyEncryption:     POST /api/v1/encrypt
❌ LegacySignature:     POST /api/v1/sign
❌ LegacyAddress:     POST /api/v1/get-address
❌ Legacy交易:     POST /api/v1/sign/transaction
```

## 💡 下一步行动

1. **完成ServiceMethodCleanup** - Delete KMSService 中的LegacyMethod
2. **添加Dual-layerEncryptionRoute** - 在 router 中启用Dual-layerEncryption API
3. **CleanupProcess器File** - Delete不Need的 handler File
4. **UpdateData库Script** - RemoveLegacyTableRelated SQL
5. **Test验证** - 确保Dual-layerEncryptionFunctionNormal工作

## 🚨 注意事项

- 确保Dual-layerEncryptionFunction完整可用后再DeleteLegacyMethod
- Keep必要的审计Log和StatisticsFunction
- Update所有RelatedDocument和Test用例

---

**Cleanup进度**: 30% 完成 ✅ 模型Cleanup ✅ RouteCleanup 🚧 ServiceCleanup ⏳ DocumentUpdate
