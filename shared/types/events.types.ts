import { Task } from './task.types';

// Типы событий для EventBus
export const EVENT_TYPES = {
  // Task events
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_STARTED: 'task:started',
  TASK_STOPPED: 'task:stopped',
  TASK_PAUSED: 'task:paused',
  
  // Wallet events
  WALLET_ADDED: 'wallet:added',
  WALLET_DELETED: 'wallet:deleted',
  
  // Settings events
  SETTINGS_UPDATED: 'settings:updated',
  
  // Process events
  PROCESS_LOG: 'process:log',
  PROCESS_ERROR: 'process:error',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Event payloads
export interface TaskCreatedEvent {
  task: Task;
}

export interface TaskUpdatedEvent {
  taskId: number;
  updates: Partial<Task>;
}

export interface TaskDeletedEvent {
  taskId: number;
}

export interface ProcessLogEvent {
  taskId: number;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export type EventPayload = 
  | TaskCreatedEvent 
  | TaskUpdatedEvent 
  | TaskDeletedEvent 
  | ProcessLogEvent
  | Record<string, unknown>;

// Event listener type
export type EventListener<T = EventPayload> = (payload: T) => void;