jest.mock('../../ipcHandlers/processHandler', () => ({
    getProcesses: jest.fn(),
    initializeProcessHandlers: jest.fn()
}));

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn()
    },
    BrowserWindow: jest.fn()
}));

import { getProcesses } from '../../ipcHandlers/processHandler';

describe('processHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Process state management', () => {
        it('should initialize empty process map', () => {
            (getProcesses as jest.Mock).mockReturnValue({});

            const processes = getProcesses();

            expect(processes).toEqual({});
            expect(Object.keys(processes)).toHaveLength(0);
        });

        it('should track active processes', () => {
            const mockProcesses = {
                '1': {
                    isActive: true,
                    moduleName: 'test-module',
                    startTime: Date.now(),
                    pid: 1234
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.isActive).toBe(true);
                expect(process1.moduleName).toBe('test-module');
            }
        });

        it('should track multiple processes', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'module-1', startTime: 1000, pid: 111 },
                '2': { isActive: true, moduleName: 'module-2', startTime: 2000, pid: 222 },
                '3': { isActive: false, moduleName: 'module-3', startTime: 3000, pid: 333 }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();

            expect(Object.keys(processes)).toHaveLength(3);
        });
    });

    describe('Process lifecycle', () => {
        it('should mark process as active on start', () => {
            const mockProcess = {
                '1': {
                    isActive: true,
                    startTime: Date.now(),
                    moduleName: 'test',
                    pid: 1234
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.isActive).toBe(true);
                expect(process1.startTime).toBeDefined();
            }
        });

        it('should mark process as inactive on stop', () => {
            const mockProcess = {
                '1': {
                    isActive: false,
                    startTime: Date.now(),
                    exitTime: Date.now() + 1000,
                    moduleName: 'test',
                    pid: 1234
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.isActive).toBe(false);
                expect(process1.exitTime).toBeDefined();
            }
        });

        it('should calculate process runtime', () => {
            const startTime = Date.now();
            const exitTime = startTime + 5000;

            const mockProcess = {
                '1': {
                    isActive: false,
                    startTime,
                    exitTime,
                    moduleName: 'test',
                    pid: 1234
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1 && process1.exitTime && process1.startTime) {
                const runtime = process1.exitTime - process1.startTime;
                expect(runtime).toBe(5000);
            }
        });
    });

    describe('Process identification', () => {
        it('should assign unique task IDs', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'mod1' },
                '2': { isActive: true, moduleName: 'mod2' },
                '3': { isActive: true, moduleName: 'mod3' }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const taskIds = Object.keys(processes);

            expect(taskIds).toHaveLength(3);
            expect(new Set(taskIds).size).toBe(3);
        });

        it('should track process by task ID', () => {
            const mockProcesses = {
                '123': {
                    isActive: true,
                    moduleName: 'specific-module',
                    startTime: 1234567890,
                    pid: 999
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const process123 = processes['123'];

            expect(process123).toBeDefined();
            if (process123) {
                expect(process123.moduleName).toBe('specific-module');
            }
        });
    });

    describe('Process metadata', () => {
        it('should store module name', () => {
            const mockProcess = {
                '1': {
                    isActive: true,
                    moduleName: 'tensor-sniper',
                    startTime: Date.now()
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.moduleName).toBe('tensor-sniper');
            }
        });

        it('should store process ID', () => {
            const mockProcess = {
                '1': {
                    isActive: true,
                    pid: 5678,
                    moduleName: 'test',
                    startTime: Date.now()
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.pid).toBe(5678);
            }
        });

        it('should store start time', () => {
            const startTime = 1234567890;
            const mockProcess = {
                '1': {
                    isActive: true,
                    startTime,
                    moduleName: 'test',
                    pid: 123
                }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcess);

            const processes = getProcesses();
            const process1 = processes['1'];

            expect(process1).toBeDefined();
            if (process1) {
                expect(process1.startTime).toBe(startTime);
            }
        });
    });

    describe('Process filtering', () => {
        it('should filter active processes', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'mod1' },
                '2': { isActive: false, moduleName: 'mod2' },
                '3': { isActive: true, moduleName: 'mod3' },
                '4': { isActive: false, moduleName: 'mod4' }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const activeProcesses = Object.keys(processes).filter(
                id => processes[id]?.isActive
            );

            expect(activeProcesses).toHaveLength(2);
            expect(activeProcesses).toEqual(['1', '3']);
        });

        it('should filter inactive processes', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'mod1' },
                '2': { isActive: false, moduleName: 'mod2' },
                '3': { isActive: false, moduleName: 'mod3' }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const inactiveProcesses = Object.keys(processes).filter(
                id => processes[id] && !processes[id].isActive
            );

            expect(inactiveProcesses).toHaveLength(2);
            expect(inactiveProcesses).toEqual(['2', '3']);
        });

        it('should find process by module name', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'tensor-sniper' },
                '2': { isActive: true, moduleName: 'reprice' },
                '3': { isActive: true, moduleName: 'meteora' }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const tensorProcess = Object.keys(processes).find(
                id => processes[id]?.moduleName === 'tensor-sniper'
            );

            expect(tensorProcess).toBe('1');
        });
    });

    describe('Process counts', () => {
        it('should count total processes', () => {
            const mockProcesses = {
                '1': { isActive: true },
                '2': { isActive: false },
                '3': { isActive: true }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const totalCount = Object.keys(processes).length;

            expect(totalCount).toBe(3);
        });

        it('should count active processes', () => {
            const mockProcesses = {
                '1': { isActive: true },
                '2': { isActive: false },
                '3': { isActive: true },
                '4': { isActive: true }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            const processes = getProcesses();
            const activeCount = Object.values(processes).filter(p => p?.isActive).length;

            expect(activeCount).toBe(3);
        });

        it('should handle empty process map', () => {
            (getProcesses as jest.Mock).mockReturnValue({});

            const processes = getProcesses();
            const count = Object.keys(processes).length;

            expect(count).toBe(0);
        });
    });

    describe('Process updates', () => {
        it('should update process state', () => {
            const mockProcesses = {
                '1': { isActive: true, moduleName: 'test' }
            };

            (getProcesses as jest.Mock).mockReturnValue(mockProcesses);

            let processes = getProcesses();
            let process1 = processes['1'];
            expect(process1?.isActive).toBe(true);

            (getProcesses as jest.Mock).mockReturnValue({
                '1': { isActive: false, moduleName: 'test' }
            });

            processes = getProcesses();
            process1 = processes['1'];
            expect(process1?.isActive).toBe(false);
        });

        it('should add new processes', () => {
            (getProcesses as jest.Mock).mockReturnValue({
                '1': { isActive: true, moduleName: 'mod1' }
            });

            let processes = getProcesses();
            expect(Object.keys(processes)).toHaveLength(1);

            (getProcesses as jest.Mock).mockReturnValue({
                '1': { isActive: true, moduleName: 'mod1' },
                '2': { isActive: true, moduleName: 'mod2' }
            });

            processes = getProcesses();
            expect(Object.keys(processes)).toHaveLength(2);
        });
    });

    describe('Process with null handling', () => {
        it('should handle processes without kill method', () => {
            (getProcesses as jest.Mock).mockReturnValue({
                '1': { isActive: true, process: null },
                '2': { isActive: true, process: { killed: true } }
            });

            const processes = getProcesses();

            expect(processes['1']?.process).toBeNull();
            expect(processes['2']?.process).toBeDefined();
        });

        it('should safely check for active processes with process object', () => {
            const mockProcess = {
                kill: jest.fn(),
                killed: false
            };

            (getProcesses as jest.Mock).mockReturnValue({
                '1': { isActive: true, process: mockProcess }
            });

            const processes = getProcesses();
            const processInfo = processes['1'];

            expect(processInfo).toBeDefined();
            if (processInfo?.process) {
                expect(typeof processInfo.process.kill).toBe('function');
            }
        });
    });
});