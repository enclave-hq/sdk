# 🔐 KMS Dual-Layer Encryption Architecture Analysis

## Architecture Overview

```
Private Key --[K1 Encrypt]--> EncPK --[K2 Encrypt]--> EncPK2 (Stored in Database)
           (Backend Holds)           (KMS Memory)      (Database Persistence)
```

## Three-Layer Protection Mechanism

### 1. **Original Private Key (PrvK)**

- User's actual private key
- Only exists briefly in memory during signing
- Immediately cleared after signing completion

### 2. **K1 Transport Key (encrypted_key)**

- Transport encryption key held by Backend
- Used for first layer encryption: `PrvK --[K1]--> EncPK`
- This is the `encrypted_key` parameter in the API!

### 3. **K2 Storage Key**

- Storage encryption key in KMS memory
- Used for second layer encryption: `EncPK --[K2]--> EncPK2`
- Further protected by Local/AWS KMS

## API Call Flow

### When storing private key:

1. Backend calls: `POST /api/v1/dual-layer/encrypt`
2. KMS generates K1, returns to Backend
3. KMS encrypts with K2 and stores to database
4. Backend saves K1 as `encrypted_key`

### When signing:

1. Backend sends: `encrypted_key` (K1) + data to be signed
2. KMS decrypts with K1 to get EncPK
3. KMS decrypts with K2 to get original private key
4. Execute signing, immediately clear private key

## Key Understanding

**`encrypted_key` = K1 Transport Key**

This is why:

- All signing APIs require `encrypted_key` parameter
- `encrypted_key` is the "key" between Backend and KMS
- Through `key_alias + chain_id` you can find the corresponding `encrypted_key`
