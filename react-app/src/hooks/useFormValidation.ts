import { useState, useCallback } from 'react';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface FieldState {
  touched: boolean;
  error: string | null;
}

export function useFormValidation<T extends Record<string, unknown>>(fields: {
  [K in keyof T]: {
    value: T[K];
    validator: (value: T[K]) => ValidationResult;
  };
}) {
  const [errors, setErrors] = useState<Record<keyof T, string | null>>(
    {} as Record<keyof T, string | null>
  );
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  const validateField = useCallback(
    (fieldName: keyof T, value: unknown): string | null => {
      const field = fields[fieldName];
      if (!field) return null;

      const result = field.validator(value as T[keyof T]);
      return result.isValid ? null : result.error || 'Validation failed';
    },
    [fields]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<keyof T, string | null> = {} as Record<keyof T, string | null>;
    let hasErrors = false;

    (Object.keys(fields) as Array<keyof T>).forEach((fieldName) => {
      const error = validateField(fieldName, fields[fieldName].value);
      newErrors[fieldName] = error;
      if (error) hasErrors = true;
    });

    setErrors(newErrors);
    // Отмечаем все поля как touched при валидации всех
    setTouched(new Set(Object.keys(fields) as Array<keyof T>));
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
    setTouched(new Set());
  }, []);

  const getError = useCallback(
    (fieldName: keyof T): string | null => {
      return errors[fieldName] || null;
    },
    [errors]
  );

  const hasError = useCallback(
    (fieldName: keyof T): boolean => {
      return Boolean(errors[fieldName]);
    },
    [errors]
  );

  // Новый метод: получить состояние поля (touched + error)
  const getFieldState = useCallback(
    (fieldName: string): FieldState => {
      const key = fieldName as keyof T;
      return {
        touched: touched.has(key),
        error: errors[key] || null,
      };
    },
    [touched, errors]
  );

  // Новый метод: обработчик onBlur
  const handleBlur = useCallback(
    (fieldName: string, value: unknown) => {
      const key = fieldName as keyof T;
      // Отмечаем поле как touched
      setTouched((prev) => new Set(prev).add(key));

      // Валидируем и устанавливаем ошибку
      const error = validateField(key, value);
      setFieldError(key, error);
    },
    [validateField, setFieldError]
  );

  return {
    errors,
    validateField,
    validateAll,
    setFieldError,
    clearErrors,
    getError,
    hasError,
    getFieldState,
    handleBlur,
  };
}
