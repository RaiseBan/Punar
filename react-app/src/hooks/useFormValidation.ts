import { useState, useCallback } from 'react';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function useFormValidation<T extends Record<string, unknown>>(fields: {
  [K in keyof T]: {
    value: T[K];
    validator: (value: T[K]) => ValidationResult;
  };
}) {
  const [errors, setErrors] = useState<Record<keyof T, string | null>>({} as Record<keyof T, string | null>);

  const validateField = useCallback((fieldName: keyof T, value: unknown): string | null => {
    const field = fields[fieldName];
    if (!field) return null;

    const result = field.validator(value as T[keyof T]);
    return result.isValid ? null : result.error || 'Validation failed';
  }, [fields]);

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<keyof T, string | null> = {} as Record<keyof T, string | null>;
    let hasErrors = false;

    (Object.keys(fields) as Array<keyof T>).forEach((fieldName) => {
      const error = validateField(fieldName, fields[fieldName].value);
      newErrors[fieldName] = error;
      if (error) hasErrors = true;
    });

    setErrors(newErrors);
    return !hasErrors;
  }, [fields, validateField]);

  const setFieldError = useCallback((fieldName: keyof T, error: string | null) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({} as Record<keyof T, string | null>);
  }, []);

  const getError = useCallback((fieldName: keyof T): string | null => {
    return errors[fieldName] || null;
  }, [errors]);

  const hasError = useCallback((fieldName: keyof T): boolean => {
    return Boolean(errors[fieldName]);
  }, [errors]);

  return {
    errors,
    validateField,
    validateAll,
    setFieldError,
    clearErrors,
    getError,
    hasError,
  };
}