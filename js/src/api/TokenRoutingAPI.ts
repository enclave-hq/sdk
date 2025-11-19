/**
 * Token Routing Rules API client
 * @module api/TokenRoutingAPI
 */

import type { APIClient } from './APIClient';
import { validateChainId } from '../utils/validation';

/**
 * Token information in a pool
 */
export interface PoolTokenInfo {
  /** Token symbol (e.g., "aUSDT") */
  token_symbol: string;
  /** Token ID */
  token_id: number;
  /** Token address on the chain */
  token_address: string;
  /** Token ID in routing rule (asset_id or token_address) */
  token_id_in_rule?: string;
  /** Token type: "asset_token" or "raw_token" */
  token_type?: 'asset_token' | 'raw_token';
}

/**
 * Pool information
 */
export interface PoolInfo {
  /** Pool ID (adapter_id) */
  pool_id: number;
  /** Pool name */
  pool_name: string;
  /** Pool address */
  pool_address: string;
  /** Tokens in this pool */
  tokens: PoolTokenInfo[];
}

/**
 * Chain information with pools
 */
export interface ChainInfo {
  /** Chain ID (SLIP-44) */
  chain_id: number;
  /** Pools on this chain */
  pools: PoolInfo[];
}

/**
 * Get allowed targets request (with parameters)
 */
export interface GetAllowedTargetsRequest {
  /** Source chain ID (SLIP-44) */
  source_chain_id?: number;
  /** Source token key (token symbol, e.g., "USDT", "USDC") */
  source_token_key?: string;
  /** Intent for withdrawal (RawToken type) */
  intent?: {
    type: string; // 'RawToken'
    beneficiary: {
      chainId: number; // Target chain SLIP-44 ID
      address: string; // Beneficiary address
    };
    tokenKey: string; // Target token key (e.g., "USDT")
  };
}

/**
 * Get allowed targets response (with parameters)
 * When called with parameters, returns full pool information
 */
export interface GetAllowedTargetsResponse {
  /** Source chain ID */
  source_chain_id: number;
  /** Source token ID */
  source_token_id: string;
  /** Allowed targets: array of chains with pools and tokens */
  allowed_targets: Array<{
    chain_id: number;
    pools: Array<{
      pool_id: number;
      pool_name: string;
      pool_address: string;
      tokens: Array<{
        token_symbol: string;
        token_id: number;
        token_address: string;
        token_id_in_rule: string;
        token_type: 'asset_token' | 'raw_token';
      }>;
    }>;
  }>;
}

/**
 * Get all pools and tokens response (no parameters)
 */
export interface GetAllPoolsAndTokensResponse {
  /** Chains with pools and tokens */
  chains: ChainInfo[];
  /** Total number of chains */
  total_chains: number;
}

/**
 * Token Routing Rules API endpoints
 * Provides token routing rules and allowed targets for cross-chain operations
 */
export class TokenRoutingAPI {
  private readonly client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Get allowed target chains and tokens for a source chain+token
   *
   * **Scenario 1: With parameters** - Returns allowed targets for specific source
   * **Scenario 2: Without parameters** - Returns all active pools and tokens grouped by chain
   *
   * @param request - Optional request with source chain and token
   * @returns Allowed targets or all pools and tokens
   * @example
   * ```typescript
   * // Scenario 1: Get allowed targets for specific source
   * const targets = await client.tokenRouting.getAllowedTargets({
   *   source_chain_id: 714,
   *   source_token_id: '0x55d398326f99059fF775485246999027B3197955'
   * });
   * // {
   * //   source_chain_id: 714,
   * //   source_token_id: '0x55d398326f99059fF775485246999027B3197955',
   * //   allowed_targets: [
   * //     {
   * //       chain_id: 60,
   * //       pools: [
   * //         {
   * //           pool_id: 1,
   * //           pool_name: 'Aave V3 Adapter',
   * //           pool_address: '0x...',
   * //           tokens: [
   * //             {
   * //               token_symbol: 'aUSDT',
   * //               token_id: 1,
   * //               token_address: '0x...',
   * //               token_id_in_rule: '0x...',
   * //               token_type: 'asset_token'
   * //             }
   * //           ]
   * //         }
   * //       ]
   * //     }
   * //   ]
   * // }
   *
   * // Scenario 2: Get all pools and tokens
   * const allPools = await client.tokenRouting.getAllowedTargets();
   * // {
   * //   chains: [
   * //     {
   * //       chain_id: 714,
   * //       pools: [
   * //         {
   * //           pool_id: 1,
   * //           pool_name: 'Aave V3 Adapter',
   * //           pool_address: '0x...',
   * //           tokens: [
   * //             {
   * //               token_symbol: 'aUSDT',
   * //               token_id: 1,
   * //               token_address: '0x...'
   * //             }
   * //           ]
   * //         }
   * //       ]
   * //     }
   * //   ],
   * //   total_chains: 1
   * // }
   * ```
   */
  async getAllowedTargets(
    request: GetAllowedTargetsRequest = {}
  ): Promise<GetAllowedTargetsResponse | GetAllPoolsAndTokensResponse> {
    // Validate chain ID if provided
    if (request.source_chain_id !== undefined) {
      validateChainId(request.source_chain_id, 'source_chain_id');
    }

    const params: Record<string, any> = {};
    if (request.source_chain_id !== undefined) {
      params.source_chain_id = request.source_chain_id;
    }
    if (request.source_token_key !== undefined) {
      params.source_token_key = request.source_token_key;
    }
    if (request.intent !== undefined) {
      // Intent 作为 JSON body 发送（POST）或作为查询参数（GET）
      // 这里使用 POST 方式发送 Intent，因为 Intent 可能包含复杂对象
      const body: Record<string, any> = {};
      if (request.intent.type) {
        body.intent_type = request.intent.type;
      }
      if (request.intent.beneficiary) {
        body.beneficiary_chain_id = request.intent.beneficiary.chainId;
        body.beneficiary_address = request.intent.beneficiary.address;
      }
      if (request.intent.tokenKey) {
        body.target_token_key = request.intent.tokenKey;
      }

      // 将 Intent 信息合并到 params 中（作为查询参数）
      Object.assign(params, body);
    }

    const response = await this.client.get<
      GetAllowedTargetsResponse | GetAllPoolsAndTokensResponse
    >('/api/token-routing/allowed-targets', {
      params,
    });

    return response;
  }

  /**
   * Get all active pools and tokens (convenience method)
   * Equivalent to calling getAllowedTargets() without parameters
   * @returns All pools and tokens grouped by chain
   * @example
   * ```typescript
   * const allPools = await client.tokenRouting.getAllPoolsAndTokens();
   * ```
   */
  async getAllPoolsAndTokens(): Promise<GetAllPoolsAndTokensResponse> {
    const response = await this.getAllowedTargets();

    // Type guard: check if response has 'chains' property
    if ('chains' in response) {
      return response as GetAllPoolsAndTokensResponse;
    }

    // If parameters were provided, this shouldn't happen, but handle gracefully
    throw new Error('Unexpected response format: expected all pools and tokens');
  }

  /**
   * Get allowed targets for specific source (convenience method)
   * Equivalent to calling getAllowedTargets() with parameters
   * @param sourceChainId - Source chain ID (SLIP-44)
   * @param sourceTokenId - Source token ID
   * @returns Allowed targets for the source
   * @example
   * ```typescript
   * const targets = await client.tokenRouting.getTargetsForSource(714, '0x55d398326f99059fF775485246999027B3197955');
   * ```
   */
  async getTargetsForSource(
    sourceChainId: number,
    sourceTokenId: string
  ): Promise<GetAllowedTargetsResponse> {
    validateChainId(sourceChainId, 'sourceChainId');

    const response = await this.getAllowedTargets({
      source_chain_id: sourceChainId,
      source_token_key: sourceTokenId,
    });

    // Type guard: check if response has 'allowed_targets' property
    if ('allowed_targets' in response) {
      return response as GetAllowedTargetsResponse;
    }

    throw new Error('Unexpected response format: expected allowed targets');
  }
}
