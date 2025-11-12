/**
 * Chain utilities and SLIP-44 integration
 * @module utils/chain
 */

import {
  ChainType,
  ChainInfo,
  nativeToSlip44,
  slip44ToNative,
  getChainInfoByNative,
  getChainInfoBySlip44,
  isSupportedChain,
} from '@enclave-hq/chain-utils';

export { ChainType };

/**
 * Extended chain information for SDK
 */
export interface SDKChainInfo extends ChainInfo {
  /** Display name for UI */
  displayName?: string;
  /** Chain icon URL */
  iconUrl?: string;
  /** Is mainnet */
  isMainnet?: boolean;
}

/**
 * Chain mappings (Native ID -> SLIP-44)
 */
const CHAIN_MAPPINGS: Record<number, { slip44: number; name: string }> = {
  1: { slip44: 60, name: 'Ethereum' },
  56: { slip44: 714, name: 'BSC' },
  137: { slip44: 966, name: 'Polygon' },
  195: { slip44: 195, name: 'Tron' },
  42161: { slip44: 1042161, name: 'Arbitrum' },
  10: { slip44: 1000010, name: 'Optimism' },
  8453: { slip44: 1008453, name: 'Base' },
  43114: { slip44: 9000, name: 'Avalanche' },
};

/**
 * Get SLIP-44 ID from native chain ID
 */
export function getSlip44FromChainId(chainId: number): number | null {
  // Check local mappings first
  const mapping = CHAIN_MAPPINGS[chainId];
  if (mapping) {
    return mapping.slip44;
  }
  
  // Fall back to chain-utils
  return nativeToSlip44(chainId);
}

/**
 * Get native chain ID from SLIP-44 ID
 */
export function getChainIdFromSlip44(slip44: number): number | string | null {
  return slip44ToNative(slip44);
}

/**
 * Get chain information by native chain ID
 */
export function getChainInfo(chainId: number): ChainInfo | null {
  return getChainInfoByNative(chainId);
}

/**
 * Get chain information by SLIP-44 ID
 */
export function getChainInfoBySlip44Id(slip44: number): ChainInfo | null {
  return getChainInfoBySlip44(slip44);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return isSupportedChain(chainId);
}

/**
 * Get chain name by chain ID
 * Supports both native chain ID and SLIP-44 ID
 */
export function getChainName(chainId: number): string {
  // First check native chain ID mappings
  const mapping = CHAIN_MAPPINGS[chainId];
  if (mapping) {
    return mapping.name;
  }
  
  // Check if it's a SLIP-44 ID by looking through mappings
  for (const mapping of Object.values(CHAIN_MAPPINGS)) {
    if (mapping.slip44 === chainId) {
      return mapping.name;
    }
  }
  
  // Fall back to chain-utils
  const info = getChainInfoByNative(chainId);
  if (info) {
    return info.name;
  }
  
  // Try SLIP-44 lookup
  const slip44Info = getChainInfoBySlip44(chainId);
  if (slip44Info) {
    return slip44Info.name;
  }
  
  return `Chain ${chainId}`;
}

/**
 * Get chain type (EVM, TRON, etc.)
 */
export function getChainType(chainId: number): ChainType | null {
  const info = getChainInfoByNative(chainId);
  return info ? info.chainType : null;
}

/**
 * Check if chain is EVM-compatible
 */
export function isEVMChain(chainId: number): boolean {
  const type = getChainType(chainId);
  return type === ChainType.EVM;
}

/**
 * Check if chain is Tron
 */
export function isTronChain(chainId: number): boolean {
  const type = getChainType(chainId);
  return type === ChainType.TRON;
}

/**
 * Get all supported chain IDs
 */
export function getAllSupportedChainIds(): number[] {
  return Object.keys(CHAIN_MAPPINGS).map(Number);
}

/**
 * Get all supported chains information
 */
export function getAllSupportedChains(): SDKChainInfo[] {
  return getAllSupportedChainIds()
    .map(chainId => {
      const info = getChainInfo(chainId);
      const mapping = CHAIN_MAPPINGS[chainId];
      
      if (!info) return null;
      
      return {
        ...info,
        displayName: mapping?.name,
        isMainnet: !info.isTestnet,
      } as SDKChainInfo;
    })
    .filter((info): info is SDKChainInfo => info !== null);
}


