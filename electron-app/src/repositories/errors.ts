export class RepositoryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RepositoryError';
    Object.setPrototypeOf(this, RepositoryError.prototype);
  }
}

export class ConfigError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class WalletError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'WalletError';
    Object.setPrototypeOf(this, WalletError.prototype);
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class FileSystemError extends RepositoryError {
  constructor(message: string, public readonly path?: string, cause?: Error) {
    super(message, cause);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}
