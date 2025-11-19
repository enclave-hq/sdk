/**
 * Environment detection utilities
 * @module utils/environment
 */

/**
 * Runtime environment type
 */
export enum RuntimeEnvironment {
  BROWSER = 'browser',
  NODE = 'node',
  REACT_NATIVE = 'react-native',
  UNKNOWN = 'unknown',
}

/**
 * Detect current runtime environment
 * @returns Runtime environment
 */
export function detectEnvironment(): RuntimeEnvironment {
  // Check for React Native
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return RuntimeEnvironment.REACT_NATIVE;
  }

  // Check for browser
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return RuntimeEnvironment.BROWSER;
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions != null && process.versions.node != null) {
    return RuntimeEnvironment.NODE;
  }

  return RuntimeEnvironment.UNKNOWN;
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return detectEnvironment() === RuntimeEnvironment.BROWSER;
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return detectEnvironment() === RuntimeEnvironment.NODE;
}

/**
 * Check if running in React Native
 */
export function isReactNative(): boolean {
  return detectEnvironment() === RuntimeEnvironment.REACT_NATIVE;
}

/**
 * Check if WebSocket is available
 */
export function hasWebSocket(): boolean {
  if (isBrowser()) {
    return typeof WebSocket !== 'undefined';
  }

  if (isNode()) {
    try {
      require.resolve('ws');
      return true;
    } catch {
      return false;
    }
  }

  if (isReactNative()) {
    return typeof WebSocket !== 'undefined';
  }

  return false;
}

/**
 * Check if localStorage is available
 */
export function hasLocalStorage(): boolean {
  if (!isBrowser()) return false;

  try {
    const testKey = '__enclave_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if crypto API is available
 */
export function hasCrypto(): boolean {
  if (isBrowser()) {
    return typeof window.crypto !== 'undefined';
  }

  if (isNode()) {
    try {
      require.resolve('crypto');
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Get user agent string (browser only)
 */
export function getUserAgent(): string | null {
  if (isBrowser() && typeof navigator !== 'undefined') {
    return navigator.userAgent;
  }
  return null;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  if (isNode()) {
    return process.env.NODE_ENV === 'development';
  }

  // Browser: check for development indicators
  if (isBrowser()) {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.includes('.local')
    );
  }

  return false;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  if (isNode()) {
    return process.env.NODE_ENV === 'production';
  }

  return !isDevelopment();
}

/**
 * Get runtime information
 */
export interface RuntimeInfo {
  environment: RuntimeEnvironment;
  hasWebSocket: boolean;
  hasLocalStorage: boolean;
  hasCrypto: boolean;
  isDevelopment: boolean;
  userAgent?: string;
  version?: string;
}

/**
 * Get comprehensive runtime information
 */
export function getRuntimeInfo(): RuntimeInfo {
  return {
    environment: detectEnvironment(),
    hasWebSocket: hasWebSocket(),
    hasLocalStorage: hasLocalStorage(),
    hasCrypto: hasCrypto(),
    isDevelopment: isDevelopment(),
    userAgent: getUserAgent() || undefined,
    version: typeof process !== 'undefined' ? process.version : undefined,
  };
}
