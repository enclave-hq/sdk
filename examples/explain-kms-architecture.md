# 🔐 KMS双层加密架构解析

## 架构概述
```
私钥 --[K1加密]--> EncPK --[K2加密]--> EncPK2 (存储在数据库)
     (Backend持有)        (KMS内存)      (数据库持久化)
```

## 三层防护机制

### 1. **原始私钥 (PrvK)**
- 用户的实际私钥
- 只在签名时短暂存在于内存
- 签名完成后立即清零

### 2. **K1传输密钥 (encrypted_key)**
- Backend持有的传输加密密钥
- 用于第一层加密：`PrvK --[K1]--> EncPK`
- 这就是API中的 `encrypted_key` 参数！

### 3. **K2存储密钥**
- KMS内存中的存储加密密钥
- 用于第二层加密：`EncPK --[K2]--> EncPK2`
- 由Local/AWS KMS进一步保护

## API调用流程

### 存储私钥时：
1. Backend调用：`POST /api/v1/dual-layer/encrypt`
2. KMS生成K1，返回给Backend
3. KMS用K2加密存储到数据库
4. Backend保存K1作为 `encrypted_key`

### 签名时：
1. Backend发送：`encrypted_key` (K1) + 待签名数据
2. KMS用K1解密得到EncPK
3. KMS用K2解密得到原始私钥
4. 执行签名，立即清零私钥

## 关键理解

**`encrypted_key` = K1传输密钥**

这就是为什么：
- 所有签名API都需要 `encrypted_key` 参数
- `encrypted_key` 是Backend和KMS之间的"钥匙"
- 通过 `key_alias + chain_id` 可以查到对应的 `encrypted_key`
