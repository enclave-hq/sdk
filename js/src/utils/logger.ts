/**
 * Logging utility
 * @module utils/logger
 */

import type { ILogger } from '../types/config';
import { LogLevel } from '../types/config';

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements ILogger {
  private level: LogLevel;
  private prefix: string;

  constructor(level: LogLevel = LogLevel.INFO, prefix: string = '[Enclave]') {
    this.level = level;
    this.prefix = prefix;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if level is enabled
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * Format log message
   */
  private format(level: string, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `${timestamp} ${this.prefix} [${level}] ${message}${formattedArgs}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.format('DEBUG', message, args));
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.format('INFO', message, args));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format('WARN', message, args));
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.format('ERROR', message, args));
    }
  }
}

/**
 * Silent logger implementation (no output)
 */
export class SilentLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Create logger instance
 */
export function createLogger(
  level: LogLevel = LogLevel.INFO,
  silent: boolean = false
): ILogger {
  if (silent) {
    return new SilentLogger();
  }
  return new ConsoleLogger(level);
}

/**
 * Global default logger instance
 */
let defaultLogger: ILogger = createLogger();

/**
 * Get default logger
 */
export function getLogger(): ILogger {
  return defaultLogger;
}

/**
 * Set default logger
 */
export function setLogger(logger: ILogger): void {
  defaultLogger = logger;
}

