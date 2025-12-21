/**
 * Базовые классы ошибок для репозиториев
 */

/**
 * Базовая ошибка репозитория
 */
export class RepositoryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RepositoryError';
    Object.setPrototypeOf(this, RepositoryError.prototype);
  }
}

/**
 * Ошибка конфигурации
 */
export class ConfigError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Ошибка работы с кошельками
 */
export class WalletError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'WalletError';
    Object.setPrototypeOf(this, WalletError.prototype);
  }
}

/**
 * Ошибка валидации
 */
export class ValidationError extends RepositoryError {
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Ошибка файловой системы
 */
export class FileSystemError extends RepositoryError {
  constructor(message: string, public readonly path?: string, cause?: Error) {
    super(message, cause);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}
