# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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





