/**
 * Next.js platform integration
 * @module platforms/nextjs
 */

import { EnclaveClient } from '../../client/EnclaveClient';
import type { EnclaveConfig } from '../../types/config';

/**
 * Create Enclave client for server-side usage
 * @param config - Enclave configuration
 * @returns Enclave client instance
 */
export function createServerClient(config: EnclaveConfig): EnclaveClient {
  // For server-side, we typically don't connect WebSocket
  // and may use a different authentication method
  return new EnclaveClient({
    ...config,
    // Disable WebSocket for server-side
    autoReconnect: false,
  });
}

/**
 * Create Enclave client for client-side usage
 * @param config - Enclave configuration
 * @returns Enclave client instance
 */
export function createClientClient(config: EnclaveConfig): EnclaveClient {
  return new EnclaveClient(config);
}

/**
 * Check if running on server
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if running on client
 */
export function isClient(): boolean {
  return !isServer();
}

// Re-export React integration for Next.js app router
export { EnclaveProvider, useEnclave, useEnclaveClient } from '../react/EnclaveProvider';
export * from '../react/hooks';
