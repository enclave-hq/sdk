/**
 * Amount handling utilities
 * @module utils/amount
 */

import { formatUnits, parseUnits } from 'ethers';
import { ValidationError } from './errors';

/**
 * Format amount from smallest unit to human-readable string
 * @param amount - Amount in smallest unit (e.g., wei)
 * @param decimals - Token decimals (default: 18)
 * @returns Formatted amount string
 */
export function formatAmount(amount: string | bigint, decimals: number = 18): string {
  try {
    return formatUnits(amount, decimals);
  } catch (error) {
    throw new ValidationError(`Failed to format amount: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Parse amount from human-readable string to smallest unit
 * @param amount - Amount string (e.g., "1.5")
 * @param decimals - Token decimals (default: 18)
 * @returns Amount in smallest unit as string
 */
export function parseAmount(amount: string, decimals: number = 18): string {
  try {
    return parseUnits(amount, decimals).toString();
  } catch (error) {
    throw new ValidationError(`Failed to parse amount: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Add two amounts (in smallest unit)
 * @param a - First amount
 * @param b - Second amount
 * @returns Sum as string
 */
export function addAmounts(a: string | bigint, b: string | bigint): string {
  try {
    const aBig = typeof a === 'string' ? BigInt(a) : a;
    const bBig = typeof b === 'string' ? BigInt(b) : b;
    return (aBig + bBig).toString();
  } catch (error) {
    throw new ValidationError(`Failed to add amounts: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Subtract two amounts (in smallest unit)
 * @param a - First amount (minuend)
 * @param b - Second amount (subtrahend)
 * @returns Difference as string
 * @throws ValidationError if result would be negative
 */
export function subtractAmounts(a: string | bigint, b: string | bigint): string {
  try {
    const aBig = typeof a === 'string' ? BigInt(a) : a;
    const bBig = typeof b === 'string' ? BigInt(b) : b;

    if (aBig < bBig) {
      throw new ValidationError('Cannot subtract: result would be negative', 'amount');
    }

    return (aBig - bBig).toString();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`Failed to subtract amounts: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Multiply amount by a factor
 * @param amount - Amount in smallest unit
 * @param factor - Multiplication factor
 * @returns Result as string
 */
export function multiplyAmount(amount: string | bigint, factor: number | bigint): string {
  try {
    const amountBig = typeof amount === 'string' ? BigInt(amount) : amount;
    const factorBig = typeof factor === 'number' ? BigInt(Math.floor(factor)) : factor;
    return (amountBig * factorBig).toString();
  } catch (error) {
    throw new ValidationError(`Failed to multiply amount: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Divide amount by a divisor
 * @param amount - Amount in smallest unit
 * @param divisor - Division divisor
 * @returns Result as string (integer division)
 */
export function divideAmount(amount: string | bigint, divisor: number | bigint): string {
  try {
    const amountBig = typeof amount === 'string' ? BigInt(amount) : amount;
    const divisorBig = typeof divisor === 'number' ? BigInt(Math.floor(divisor)) : divisor;

    if (divisorBig === 0n) {
      throw new ValidationError('Cannot divide by zero', 'divisor');
    }

    return (amountBig / divisorBig).toString();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`Failed to divide amount: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Compare two amounts
 * @param a - First amount
 * @param b - Second amount
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareAmounts(a: string | bigint, b: string | bigint): -1 | 0 | 1 {
  try {
    const aBig = typeof a === 'string' ? BigInt(a) : a;
    const bBig = typeof b === 'string' ? BigInt(b) : b;

    if (aBig < bBig) return -1;
    if (aBig > bBig) return 1;
    return 0;
  } catch (error) {
    throw new ValidationError(`Failed to compare amounts: ${(error as Error).message}`, 'amount');
  }
}

/**
 * Check if amount is zero
 * @param amount - Amount to check
 * @returns True if amount is zero
 */
export function isZeroAmount(amount: string | bigint): boolean {
  try {
    const amountBig = typeof amount === 'string' ? BigInt(amount) : amount;
    return amountBig === 0n;
  } catch {
    return false;
  }
}

/**
 * Check if first amount is greater than second
 * @param a - First amount
 * @param b - Second amount
 * @returns True if a > b
 */
export function isGreaterThan(a: string | bigint, b: string | bigint): boolean {
  return compareAmounts(a, b) === 1;
}

/**
 * Check if first amount is greater than or equal to second
 * @param a - First amount
 * @param b - Second amount
 * @returns True if a >= b
 */
export function isGreaterThanOrEqual(a: string | bigint, b: string | bigint): boolean {
  const cmp = compareAmounts(a, b);
  return cmp === 1 || cmp === 0;
}

/**
 * Check if first amount is less than second
 * @param a - First amount
 * @param b - Second amount
 * @returns True if a < b
 */
export function isLessThan(a: string | bigint, b: string | bigint): boolean {
  return compareAmounts(a, b) === -1;
}

/**
 * Check if first amount is less than or equal to second
 * @param a - First amount
 * @param b - Second amount
 * @returns True if a <= b
 */
export function isLessThanOrEqual(a: string | bigint, b: string | bigint): boolean {
  const cmp = compareAmounts(a, b);
  return cmp === -1 || cmp === 0;
}

/**
 * Get maximum of multiple amounts
 * @param amounts - Array of amounts
 * @returns Maximum amount as string
 */
export function maxAmount(...amounts: (string | bigint)[]): string {
  if (amounts.length === 0) {
    throw new ValidationError('Cannot get max of empty array', 'amounts');
  }

  const first = amounts[0];
  if (first === undefined) {
    throw new ValidationError('Cannot get max of empty array', 'amounts');
  }

  let max = typeof first === 'string' ? BigInt(first) : first;

  for (let i = 1; i < amounts.length; i++) {
    const item = amounts[i];
    if (item === undefined) continue;
    const current = typeof item === 'string' ? BigInt(item) : item;
    if (current > max) {
      max = current;
    }
  }

  return max.toString();
}

/**
 * Get minimum of multiple amounts
 * @param amounts - Array of amounts
 * @returns Minimum amount as string
 */
export function minAmount(...amounts: (string | bigint)[]): string {
  if (amounts.length === 0) {
    throw new ValidationError('Cannot get min of empty array', 'amounts');
  }

  const first = amounts[0];
  if (first === undefined) {
    throw new ValidationError('Cannot get min of empty array', 'amounts');
  }

  let min = typeof first === 'string' ? BigInt(first) : first;

  for (let i = 1; i < amounts.length; i++) {
    const item = amounts[i];
    if (item === undefined) continue;
    const current = typeof item === 'string' ? BigInt(item) : item;
    if (current < min) {
      min = current;
    }
  }

  return min.toString();
}

/**
 * Sum multiple amounts
 * @param amounts - Array of amounts
 * @returns Sum as string
 */
export function sumAmounts(...amounts: (string | bigint)[]): string {
  if (amounts.length === 0) return '0';

  let sum = 0n;
  for (const amount of amounts) {
    sum += typeof amount === 'string' ? BigInt(amount) : amount;
  }

  return sum.toString();
}

/**
 * Format amount with thousand separators
 * @param amount - Amount string
 * @param decimals - Number of decimal places to show
 * @returns Formatted amount with separators
 */
export function formatAmountWithSeparators(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
