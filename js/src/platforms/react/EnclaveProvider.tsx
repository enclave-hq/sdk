/**
 * React Context Provider for Enclave SDK
 * @module platforms/react/EnclaveProvider
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { EnclaveClient } from '../../client/EnclaveClient';
import type { EnclaveConfig } from '../../types/config';

/**
 * Enclave context type
 */
export interface EnclaveContextType {
  /** Enclave client instance */
  client: EnclaveClient | null;
  /** Is client connected */
  isConnected: boolean;
  /** Is client connecting */
  isConnecting: boolean;
  /** Connection error if any */
  error: Error | null;
}

/**
 * Enclave React Context
 */
const EnclaveContext = createContext<EnclaveContextType | undefined>(undefined);

/**
 * Enclave Provider Props
 */
export interface EnclaveProviderProps {
  /** Enclave configuration */
  config: EnclaveConfig;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Children components */
  children: ReactNode;
}

/**
 * Enclave Provider Component
 * Provides Enclave SDK client to React component tree
 */
export function EnclaveProvider({
  config,
  autoConnect = true,
  children,
}: EnclaveProviderProps): JSX.Element {
  const [client, setClient] = useState<EnclaveClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client
  useEffect(() => {
    try {
      const enclaveClient = new EnclaveClient(config);
      setClient(enclaveClient);

      // Auto-connect if enabled
      if (autoConnect) {
        setIsConnecting(true);
        enclaveClient
          .connect()
          .then(() => {
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
          })
          .catch((err) => {
            setError(err);
            setIsConnecting(false);
          });
      }

      return () => {
        // Disconnect on unmount
        enclaveClient.disconnect();
      };
    } catch (err) {
      setError(err as Error);
      setIsConnecting(false);
    }
  }, []);

  const contextValue: EnclaveContextType = {
    client,
    isConnected,
    isConnecting,
    error,
  };

  return (
    <EnclaveContext.Provider value={contextValue}>
      {children}
    </EnclaveContext.Provider>
  );
}

/**
 * Hook to use Enclave client
 * @returns Enclave context
 * @throws Error if used outside EnclaveProvider
 */
export function useEnclave(): EnclaveContextType {
  const context = useContext(EnclaveContext);
  
  if (context === undefined) {
    throw new Error('useEnclave must be used within an EnclaveProvider');
  }

  return context;
}

/**
 * Hook to get Enclave client instance
 * @returns Enclave client or null if not initialized
 */
export function useEnclaveClient(): EnclaveClient | null {
  const { client } = useEnclave();
  return client;
}

