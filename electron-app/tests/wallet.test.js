const path = require('path');
// const { expect, jest, describe, beforeEach, afterEach, test} = require('@jest/globals');

// Мокируем модуль electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/мокнутый/путь/userData')
  }
}));

describe('Функции кошелька', () => {
  let originalNodeEnv;
  
  // Сохраняем оригинальное значение NODE_ENV
  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    jest.resetModules();
  });
  
  // Восстанавливаем оригинальное значение после каждого теста
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  test('getGlobalConfigDirectory возвращает корректный путь в production', () => {
    // Устанавливаем production среду
    process.env.NODE_ENV = 'production';
    
    // Импортируем модуль после изменения окружения
    const { getGlobalConfigDirectory } = require('../src/utils/wallet');
    
    const configDir = getGlobalConfigDirectory();
    const electron = require('electron');
    
    // Проверяем результат
    expect(electron.app.getPath).toHaveBeenCalledWith('userData');
    expect(configDir).toBe(path.join('/мокнутый/путь/userData', 'globalConfigs'));
  });

  test('getGlobalConfigDirectory возвращает корректный путь в development', () => {
    // Устанавливаем development среду
    process.env.NODE_ENV = 'development';
    
    // Импортируем модуль после изменения окружения
    const { getGlobalConfigDirectory } = require('../src/utils/wallet');
    
    const configDir = getGlobalConfigDirectory();
    const electron = require('electron');
    
    // Проверяем результат
    expect(electron.app.getPath).not.toHaveBeenCalled();
    expect(configDir).toContain('globalConfigs');
    expect(path.isAbsolute(configDir)).toBe(true);
  });
}); 