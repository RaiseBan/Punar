import { useState, useCallback } from 'react';
import { ValidationResult } from '../utils/validators';

interface FieldValidation {
  error: string | null;
  touched: boolean;
}

type ValidatorFunction = (value: any) => ValidationResult;

interface FieldConfig {
  value: any;
  validator?: ValidatorFunction;
}

export function useFormValidation<T extends Record<string, any>>(
  initialFields: Record<keyof T, FieldConfig>
) {
  const [fields, setFields] = useState(() => {
    const initial: Record<string, FieldValidation> = {};
    Object.keys(initialFields).forEach((key) => {
      initial[key] = { error: null, touched: false };
    });
    return initial;
  });

  // Валидация одного поля
  const validateField = useCallback(
    (fieldName: keyof T, value: any): string | null => {
      const config = initialFields[fieldName];
      if (!config.validator) return null;

      const result = config.validator(value);
      return result.isValid ? null : result.error || 'Invalid value';
    },
    [initialFields]
  );

  // Установка ошибки для поля
  const setFieldError = useCallback((fieldName: keyof T, error: string | null) => {
    setFields((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], error, touched: true },
    }));
  }, []);

  // Пометить поле как "тронутое"
  const touchField = useCallback((fieldName: keyof T) => {
    setFields((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], touched: true },
    }));
  }, []);

  // Валидация при изменении (blur)
  const handleBlur = useCallback(
    (fieldName: keyof T, value: any) => {
      touchField(fieldName);
      const error = validateField(fieldName, value);
      setFieldError(fieldName, error);
    },
    [validateField, setFieldError, touchField]
  );

  // Валидация всех полей
  const validateAll = useCallback(
    (values: Record<keyof T, any>): boolean => {
      let isValid = true;
      const newFields = { ...fields };

      Object.keys(initialFields).forEach((key) => {
        const fieldName = key as keyof T;
        const error = validateField(fieldName, values[fieldName]);
        
        newFields[key] = { error, touched: true };
        
        if (error) {
          isValid = false;
        }
      });

      setFields(newFields);
      return isValid;
    },
    [initialFields, validateField, fields]
  );

  // Очистка всех ошибок
  const clearErrors = useCallback(() => {
    const cleared: Record<string, FieldValidation> = {};
    Object.keys(fields).forEach((key) => {
      cleared[key] = { error: null, touched: false };
    });
    setFields(cleared);
  }, [fields]);

  // Получить состояние поля
  const getFieldState = useCallback(
    (fieldName: keyof T) => {
      return fields[fieldName] || { error: null, touched: false };
    },
    [fields]
  );

  // Есть ли ошибки в форме
  const hasErrors = useCallback(() => {
    return Object.values(fields).some((field) => field.error !== null);
  }, [fields]);

  return {
    fields,
    validateField,
    setFieldError,
    touchField,
    handleBlur,
    validateAll,
    clearErrors,
    getFieldState,
    hasErrors,
  };
}