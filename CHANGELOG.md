# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.6] - 2025-01-21

### Added
- Add `tokenKeys` filter support to `ListAllocationsRequest` for filtering allocations by multiple token keys (e.g., ["USDT", "USDC"])
- Add `token_keys` filter support to `SearchAllocationsRequest` for filtering allocations by multiple token keys
- Add `tokenKeys` parameter to `AllocationsStore.fetchList()` method
- Update `advanced-queries.ts` example to group allocations by checkbook in response display

### Changed
- Update `AllocationsAPI.listAllocations()` to support `tokenKeys` array parameter (converts to comma-separated string for GET request)
- Update `AllocationsAPI.searchAllocations()` to support `token_keys` array parameter in POST request
- Improve allocation response display in examples to show checkbook grouping

## [2.3.5] - 2025-12-01

### Added
- Add `searchAllocations` method to `AllocationsAPI` for querying allocations by chain ID and address list
- Add `getCheckbookByDeposit` method to `CheckbooksAPI` for looking up checkbooks by deposit transaction hash
- Add `advanced-queries.ts` example demonstrating the new query features
- Add support for IP whitelisted endpoints in `APIClient` (no auth warnings for public endpoints)

### Changed
- Update `APIClient` to suppress auth warnings for IP whitelisted endpoints (`/api/allocations/search`, `/api/checkbooks/by-deposit`)
- Update SDK documentation across all languages (README and SDK_COMPLETE_GUIDE) to reflect new API methods
- Update API method counts: AllocationsAPI (5 methods), CheckbooksAPI (5 methods), total 68 methods

## [2.3.3] - 2025-01-29

### Changed
- Version bump for npm release

## [2.3.2] - 2025-01-29

### Removed
- Remove debug console.log statements from WithdrawalsAPI (Available fields logging)

## [2.2.2] - 2025-01-28

### Changed
- Synchronize SDK_VERSION constant in source code with package.json version
- Update build banner to reflect current version

## [2.2.1] - 2025-01-27

### Fixed
- Fix `generateCommitment` method to use `tokenKey: string` instead of `tokenId: number` parameter
- Remove incorrect tokenId to tokenKey conversion (tokenKey should be passed directly)

### Changed
- Update StatisticsAPI, CommitmentFormatter, and related utilities
- Improve checkbook status handling and integration test documentation

## [2.2.0] - 2025-01-26

### Added
- Add `getGlobalZKPayProxy()` method to `ChainConfigAPI` for retrieving global ZKPay Proxy address
- Export chain utility functions: `getChainType()`, `isEVMChain()`, `isTronChain()`, and `ChainType` enum
- Add `sync_block_number` and `last_synced_at` fields to `ChainConfig` interface

### Changed
- Improve `EnclaveClient` authentication logic to use `userAddress.chainId` when available
- Enhance `WalletManager` initialization to use `address.chainId` for default chain ID
- Update `ChainConfig` interface to match backend API response format
- Remove `zkpay_address` from chain-specific configuration (now global configuration)

### Removed
- Remove `getZKPayAddress()` and `allZKPayAddresses` from `ChainConfigStore` (use `getGlobalZKPayProxy()` instead)

## [2.1.5] - 2025-01-25

### Added
- Add KYT Oracle API support for risk scoring and fee information queries
- Add `KYTOracleAPI` with methods for getting fee info and associating addresses with invitation codes
- Add example file for KYT Oracle API usage

### Changed
- Improve withdrawal actions with enhanced error handling
- Update StatisticsAPI and StatisticsStore with new features
- Enhance WithdrawFormatter with additional functionality
- Update CommitmentCore utilities

## [2.1.2] - 2025-01-24

### Added
- Add ChainConfigStore for managing chain configurations (Treasury, ZKPay addresses, RPC endpoints)

### Changed
- Enhance CheckbooksAPI with additional functionality
- Improve TokenRoutingAPI with new features
- Simplify WithdrawFormatter (47 lines removed)
- Enhance WithdrawalsStore with new capabilities
- Update WebSocketClient and retry utilities

## [2.1.1] - 2025-01-24

### Changed
- Version bump for npm release

## [2.1.0] - 2025-01-23

### Changed
- **BREAKING**: Updated `WithdrawalParams` interface to remove redundant `targetChain` and `targetAddress` fields
  - Beneficiary information is now exclusively provided via `intent.beneficiary` (UniversalAddress format)
  - This aligns with the updated ZKVM Service API format
- Updated `IntentRequest` to use `beneficiary: UniversalAddress` instead of separate `beneficiaryChainId` and `beneficiaryAddress`
- Removed `preferredChain` field from `AssetTokenIntent` (no longer used in backend API)
- Updated `CreateWithdrawRequestRequest` to match new backend API format with unified beneficiary structure

### Fixed
- Fixed type compatibility issues with beneficiary address format (supports both `address` and `data` fields)
- Improved validation logic to use beneficiary information from intent

### Internal
- Updated `convertIntentToBackendFormat` to use new beneficiary UniversalAddress format
- Updated `WithdrawalsAPI.createWithdrawRequest` validation to match new structure
- Updated `WithdrawalsStore.create` type definitions

## [2.0.2] - Previous version

Previous changes...





