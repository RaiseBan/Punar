import { ConfigError, WalletError, ValidationError } from '../../repositories/errors';

describe('Repository Errors', () => {
    describe('ConfigError', () => {
        it('should create ConfigError with message', () => {
            const error = new ConfigError('Config not found');
            
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('ConfigError');
            expect(error.message).toBe('Config not found');
        });

        it('should be catchable as Error', () => {
            try {
                throw new ConfigError('Test error');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as ConfigError).message).toBe('Test error');
                expect((error as ConfigError).name).toBe('ConfigError');
            }
        });

        it('should have correct stack trace', () => {
            const error = new ConfigError('Test');
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('ConfigError');
        });

        it('should work with instanceof check', () => {
            const error = new ConfigError('Test');
            expect(error instanceof ConfigError).toBe(true);
            expect(error instanceof Error).toBe(true);
        });

        it('should preserve error message in stack', () => {
            const message = 'Configuration file is missing';
            const error = new ConfigError(message);
            expect(error.stack).toContain(message);
        });
    });

    describe('WalletError', () => {
        it('should create WalletError with message', () => {
            const error = new WalletError('Wallet not found');
            
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('WalletError');
            expect(error.message).toBe('Wallet not found');
        });

        it('should be catchable as Error', () => {
            try {
                throw new WalletError('Invalid wallet');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as WalletError).message).toBe('Invalid wallet');
            }
        });

        it('should differentiate from ConfigError', () => {
            const walletError = new WalletError('Wallet issue');
            const configError = new ConfigError('Config issue');

            expect(walletError.name).toBe('WalletError');
            expect(configError.name).toBe('ConfigError');
            expect(walletError.name).not.toBe(configError.name);
        });

        it('should work with instanceof check', () => {
            const error = new WalletError('Test');
            expect(error instanceof WalletError).toBe(true);
            expect(error instanceof Error).toBe(true);
            expect(error instanceof ConfigError).toBe(false);
        });

        it('should have stack trace', () => {
            const error = new WalletError('Test wallet error');
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('Test wallet error');
        });
    });

    describe('ValidationError', () => {
        it('should create ValidationError with message', () => {
            const error = new ValidationError('Invalid input');
            
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Invalid input');
        });

        it('should be usable in try-catch blocks', () => {
            const throwValidationError = () => {
                throw new ValidationError('Bad data');
            };

            expect(throwValidationError).toThrow('Bad data');
            expect(throwValidationError).toThrow(ValidationError);
        });

        it('should work with instanceof check', () => {
            const error = new ValidationError('Test');
            expect(error instanceof ValidationError).toBe(true);
            expect(error instanceof Error).toBe(true);
            expect(error instanceof WalletError).toBe(false);
            expect(error instanceof ConfigError).toBe(false);
        });

        it('should differentiate from other error types', () => {
            const validationError = new ValidationError('Validation failed');
            const walletError = new WalletError('Wallet failed');
            const configError = new ConfigError('Config failed');

            expect(validationError.name).toBe('ValidationError');
            expect(walletError.name).toBe('WalletError');
            expect(configError.name).toBe('ConfigError');
        });

        it('should preserve error details', () => {
            const message = 'Field "email" is required';
            const error = new ValidationError(message);
            
            expect(error.message).toBe(message);
            expect(error.stack).toContain(message);
        });
    });

    describe('Error inheritance', () => {
        it('all custom errors should extend Error', () => {
            const configError = new ConfigError('test');
            const walletError = new WalletError('test');
            const validationError = new ValidationError('test');

            expect(configError instanceof Error).toBe(true);
            expect(walletError instanceof Error).toBe(true);
            expect(validationError instanceof Error).toBe(true);
        });

        it('should be catchable as generic Error', () => {
            try {
                throw new ConfigError('Config error');
            } catch (error) {
                expect(error instanceof Error).toBe(true);
            }

            try {
                throw new WalletError('Wallet error');
            } catch (error) {
                expect(error instanceof Error).toBe(true);
            }

            try {
                throw new ValidationError('Validation error');
            } catch (error) {
                expect(error instanceof Error).toBe(true);
            }
        });

        it('should maintain distinct types', () => {
            const configError = new ConfigError('test');
            const walletError = new WalletError('test');
            const validationError = new ValidationError('test');

            expect(configError instanceof WalletError).toBe(false);
            expect(configError instanceof ValidationError).toBe(false);
            expect(walletError instanceof ConfigError).toBe(false);
            expect(walletError instanceof ValidationError).toBe(false);
            expect(validationError instanceof ConfigError).toBe(false);
            expect(validationError instanceof WalletError).toBe(false);
        });
    });

    describe('Error handling scenarios', () => {
        it('should handle ConfigError in error handling flow', () => {
            const handleError = (error: Error) => {
                if (error instanceof ConfigError) {
                    return 'config_error';
                } else if (error instanceof WalletError) {
                    return 'wallet_error';
                }
                return 'unknown_error';
            };

            expect(handleError(new ConfigError('test'))).toBe('config_error');
            expect(handleError(new WalletError('test'))).toBe('wallet_error');
            expect(handleError(new Error('test'))).toBe('unknown_error');
        });

        it('should allow error type discrimination', () => {
            const processError = (error: unknown) => {
                if (error instanceof ValidationError) {
                    return { type: 'validation', message: error.message };
                } else if (error instanceof WalletError) {
                    return { type: 'wallet', message: error.message };
                } else if (error instanceof ConfigError) {
                    return { type: 'config', message: error.message };
                }
                return { type: 'unknown', message: String(error) };
            };

            expect(processError(new ValidationError('bad input'))).toEqual({
                type: 'validation',
                message: 'bad input'
            });
        });
    });
});
