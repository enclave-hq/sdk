/**
 * React hooks for Enclave SDK
 * @module platforms/react/hooks
 */

import { useEffect, useState } from 'react';
import { autorun } from 'mobx';
import { useEnclave } from './EnclaveProvider';
import type {
  Checkbook,
  Allocation,
  WithdrawRequest,
  TokenPrice,
  Pool,
  Token,
} from '../../types/models';

/**
 * Hook to observe checkbooks from store
 * @returns Array of checkbooks
 */
export function useCheckbooks(): Checkbook[] {
  const { client } = useEnclave();
  const [checkbooks, setCheckbooks] = useState<Checkbook[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setCheckbooks(client.stores.checkbooks.all);
    });

    return () => dispose();
  }, [client]);

  return checkbooks;
}

/**
 * Hook to observe allocations from store
 * @returns Array of allocations
 */
export function useAllocations(): Allocation[] {
  const { client } = useEnclave();
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setAllocations(client.stores.allocations.all);
    });

    return () => dispose();
  }, [client]);

  return allocations;
}

/**
 * Hook to observe idle allocations
 * @returns Array of idle allocations
 */
export function useIdleAllocations(): Allocation[] {
  const { client } = useEnclave();
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setAllocations(client.stores.allocations.idle);
    });

    return () => dispose();
  }, [client]);

  return allocations;
}

/**
 * Hook to observe withdrawal requests from store
 * @returns Array of withdrawal requests
 */
export function useWithdrawals(): WithdrawRequest[] {
  const { client } = useEnclave();
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setWithdrawals(client.stores.withdrawals.all);
    });

    return () => dispose();
  }, [client]);

  return withdrawals;
}

/**
 * Hook to observe token prices from store
 * @returns Array of token prices
 */
export function usePrices(): TokenPrice[] {
  const { client } = useEnclave();
  const [prices, setPrices] = useState<TokenPrice[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setPrices(client.stores.prices.all);
    });

    return () => dispose();
  }, [client]);

  return prices;
}

/**
 * Hook to get price for specific token
 * @param symbol - Token symbol
 * @returns Token price or undefined
 */
export function useTokenPrice(symbol: string): TokenPrice | undefined {
  const { client } = useEnclave();
  const [price, setPrice] = useState<TokenPrice | undefined>();

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setPrice(client.stores.prices.getBySymbol(symbol));
    });

    return () => dispose();
  }, [client, symbol]);

  return price;
}

/**
 * Hook to observe pools from store
 * @returns Array of pools
 */
export function usePools(): Pool[] {
  const { client } = useEnclave();
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setPools(client.stores.pools.all);
    });

    return () => dispose();
  }, [client]);

  return pools;
}

/**
 * Hook to observe tokens from store
 * @returns Array of tokens
 */
export function useTokens(): Token[] {
  const { client } = useEnclave();
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setTokens(client.stores.pools.allTokens);
    });

    return () => dispose();
  }, [client]);

  return tokens;
}

/**
 * Hook to get user address
 * @returns User's universal address or null
 */
export function useAddress() {
  const { client } = useEnclave();
  const [address, setAddress] = useState(client?.address || null);

  useEffect(() => {
    if (!client) return;

    const dispose = autorun(() => {
      setAddress(client.address);
    });

    return () => dispose();
  }, [client]);

  return address;
}

/**
 * Hook to get connection state
 * @returns Connection info
 */
export function useConnection() {
  const { isConnected, isConnecting, error } = useEnclave();

  return {
    isConnected,
    isConnecting,
    error,
  };
}

