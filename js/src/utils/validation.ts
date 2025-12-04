/**
 * Data validation utilities
 * @module utils/validation
 */

import { ValidationError } from './errors';
import { isValidHex, isValidAddress } from './crypto';
import type { UniversalAddress } from '../types/models';

/**
 * Validate required field
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if value is null or undefined
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Validate string is not empty
 * @param value - String to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if string is empty
 */
export function validateNonEmptyString(value: string, fieldName: string): void {
  validateRequired(value, fieldName);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName);
  }
}

/**
 * Validate positive number
 * @param value - Number to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a positive number
 */
export function validatePositiveNumber(value: number, fieldName: string): void {
  validateRequired(value, fieldName);
  if (typeof value !== 'number' || value <= 0 || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a positive number`, fieldName);
  }
}

/**
 * Validate non-negative number
 * @param value - Number to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a non-negative number
 */
export function validateNonNegativeNumber(value: number, fieldName: string): void {
  validateRequired(value, fieldName);
  if (typeof value !== 'number' || value < 0 || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a non-negative number`, fieldName);
  }
}

/**
 * Validate amount string (must be numeric and positive)
 * @param value - Amount string to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid amount
 */
export function validateAmount(value: string, fieldName: string): void {
  validateNonEmptyString(value, fieldName);

  const amount = BigInt(value);
  if (amount <= 0n) {
    throw new ValidationError(`${fieldName} must be positive`, fieldName);
  }
}

/**
 * Validate hex string
 * @param value - Hex string to validate
 * @param fieldName - Field name for error message
 * @param length - Expected length in bytes (optional)
 * @throws ValidationError if not a valid hex string
 */
export function validateHex(value: string, fieldName: string, length?: number): void {
  validateNonEmptyString(value, fieldName);

  if (!isValidHex(value, length)) {
    const lengthMsg = length ? ` of length ${length} bytes` : '';
    throw new ValidationError(`${fieldName} must be a valid hex string${lengthMsg}`, fieldName);
  }
}

/**
 * Validate Ethereum address
 * @param value - Address to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid address
 */
export function validateEthAddress(value: string, fieldName: string): void {
  validateNonEmptyString(value, fieldName);

  if (!isValidAddress(value)) {
    throw new ValidationError(`${fieldName} must be a valid Ethereum address`, fieldName);
  }
}

/**
 * Validate universal address
 * @param value - Universal address to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid universal address
 */
export function validateUniversalAddress(
  value: UniversalAddress | undefined | null,
  fieldName: string
): void {
  validateRequired(value, fieldName);

  if (!value.chainId || !value.data) {
    throw new ValidationError(`${fieldName} must have chainId and data`, fieldName);
  }

  validatePositiveNumber(value.chainId, `${fieldName}.chainId`);
  validateNonEmptyString(value.data, `${fieldName}.data`);
}

/**
 * Validate array is not empty
 * @param value - Array to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if array is empty
 */
export function validateNonEmptyArray<T>(
  value: T[] | undefined | null,
  fieldName: string
): asserts value is T[] {
  validateRequired(value, fieldName);

  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`, fieldName);
  }
}

/**
 * Validate URL format
 * @param value - URL string to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid URL
 */
export function validateUrl(value: string, fieldName: string): void {
  validateNonEmptyString(value, fieldName);

  try {
    new URL(value);
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`, fieldName);
  }
}

/**
 * Validate chain ID
 * @param value - Chain ID to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid chain ID
 */
export function validateChainId(value: number, fieldName: string): void {
  validatePositiveNumber(value, fieldName);

  // Chain ID should be a reasonable number (not too large)
  if (value > 2 ** 32) {
    throw new ValidationError(`${fieldName} exceeds maximum chain ID`, fieldName);
  }
}

/**
 * Validate enum value
 * @param value - Value to validate
 * @param enumObj - Enum object
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid enum value
 */
export function validateEnum<T extends Record<string, string>>(
  value: string,
  enumObj: T,
  fieldName: string
): void {
  validateNonEmptyString(value, fieldName);

  const validValues = Object.values(enumObj);
  if (!validValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${validValues.join(', ')}`, fieldName);
  }
}

/**
 * Validate pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @throws ValidationError if invalid pagination params
 */
export function validatePagination(page?: number, limit?: number): void {
  if (page !== undefined) {
    validatePositiveNumber(page, 'page');
  }

  if (limit !== undefined) {
    validatePositiveNumber(limit, 'limit');

    if (limit > 1000) {
      throw new ValidationError('limit cannot exceed 1000', 'limit');
    }
  }
}

/**
 * Validate signature format
 * @param signature - Signature to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if not a valid signature
 */
export function validateSignature(signature: string, fieldName: string): void {
  validateNonEmptyString(signature, fieldName);

  // Ethereum signatures are 65 bytes (130 hex chars + 0x prefix)
  if (!isValidHex(signature, 65)) {
    throw new ValidationError(`${fieldName} must be a valid 65-byte signature`, fieldName);
  }
}

/**
 * Validate object has required fields
 * @param obj - Object to validate
 * @param fields - Required field names
 * @param objectName - Object name for error message
 * @throws ValidationError if missing required fields
 */
export function validateRequiredFields(
  obj: Record<string, any>,
  fields: string[],
  objectName: string
): void {
  validateRequired(obj, objectName);

  const missingFields = fields.filter(field => obj[field] === undefined || obj[field] === null);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `${objectName} is missing required fields: ${missingFields.join(', ')}`,
      objectName
    );
  }
}
