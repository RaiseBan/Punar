import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Валидация Solana публичного ключа (адреса)
 */
export function validatePublicKey(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Public key is required' };
  }

  try {
    new PublicKey(value.trim());
    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: 'Invalid Solana public key' };
  }
}

/**
 * Валидация приватного ключа (base58)
 */
export function validatePrivateKey(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Private key is required' };
  }

  try {
    const decoded = bs58.decode(value.trim());
    
    // Solana приватный ключ должен быть 64 байта
    if (decoded.length !== 64) {
      return { isValid: false, error: 'Private key must be 64 bytes' };
    }
    
    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: 'Invalid base58 private key' };
  }
}

/**
 * Валидация суммы в SOL
 */
export function validateSolAmount(value: string | number): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return { isValid: false, error: 'Amount is required' };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Amount must be greater than 0' };
  }

  if (num > 1000000) {
    return { isValid: false, error: 'Amount is too large' };
  }

  // Проверка на разумное количество десятичных знаков
  const decimals = value.toString().split('.')[1];
  if (decimals && decimals.length > 9) {
    return { isValid: false, error: 'Too many decimal places (max 9)' };
  }

  return { isValid: true };
}

/**
 * Валидация URL (для RPC endpoints)
 */
export function validateUrl(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    const url = new URL(value.trim());
    
    // Проверяем что это http или https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { isValid: false, error: 'URL must use http or https protocol' };
    }
    
    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Валидация положительного целого числа
 */
export function validatePositiveInteger(value: string | number): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return { isValid: false, error: 'Value is required' };
  }

  const num = typeof value === 'string' ? parseInt(value) : value;

  if (isNaN(num) || !Number.isInteger(num)) {
    return { isValid: false, error: 'Must be a valid integer' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Must be greater than 0' };
  }

  return { isValid: true };
}

/**
 * Валидация положительного числа (включая дробные)
 */
export function validatePositiveNumber(value: string | number): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return { isValid: false, error: 'Value is required' };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Must be greater than 0' };
  }

  return { isValid: true };
}

/**
 * Валидация непустой строки
 */
export function validateNonEmptyString(value: string, fieldName: string = 'Field'): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Валидация Tensor collection ID или URL
 */
export function validateTensorCollection(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'Collection ID/URL is required' };
  }

  const trimmed = value.trim();

  // Если это URL
  if (trimmed.startsWith('http')) {
    if (!trimmed.includes('tensor.trade')) {
      return { isValid: false, error: 'Must be a valid Tensor URL' };
    }
  }

  return { isValid: true };
}

/**
 * Валидация API токена
 */
export function validateApiToken(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, error: 'API token is required' };
  }

  if (value.trim().length < 10) {
    return { isValid: false, error: 'API token is too short' };
  }

  return { isValid: true };
}

/**
 * Валидация Telegram Bot Token
 */
export function validateTelegramBotToken(value: string): ValidationResult {
    if (!value || !value.trim()) {
      return { isValid: false, error: 'Bot token is required' };
    }
  
    // Формат Telegram токена: число:буквенно-цифровая строка
    // Пример: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    
    if (!tokenPattern.test(value.trim())) {
      return { isValid: false, error: 'Invalid Telegram bot token format (should be NUMBER:STRING)' };
    }
  
    return { isValid: true };
  }
  
  /**
   * Валидация Chat IDs (comma-separated numbers)
   */
  export function validateChatIds(value: string): ValidationResult {
    if (!value || !value.trim()) {
      return { isValid: true }; // Опционально
    }
  
    const ids = value.split(',').map(s => s.trim()).filter(s => s);
    
    for (const id of ids) {
      if (!/^-?\d+$/.test(id)) {
        return { isValid: false, error: `Invalid chat ID: ${id} (must be a number)` };
      }
    }
  
    return { isValid: true };
  }