import { EventType, EventData } from './events';

type EventCallback = (data: EventData) => void | Promise<void>;

class EventBusClass {
  private listeners: Map<EventType, Set<EventCallback>> = new Map();
  private onceListeners: Map<EventType, Set<EventCallback>> = new Map();
  private debug: boolean = false;

  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  on(event: EventType, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.debug) {
      console.log(`[EventBus] Subscribed to "${event}"`);
    }
  }

  once(event: EventType, callback: EventCallback): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(callback);

    if (this.debug) {
      console.log(`[EventBus] Subscribed to "${event}" (once)`);
    }
  }

  off(event: EventType, callback: EventCallback): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.delete(callback);
      if (onceListeners.size === 0) {
        this.onceListeners.delete(event);
      }
    }

    if (this.debug) {
      console.log(`[EventBus] Unsubscribed from "${event}"`);
    }
  }

  async emit(event: EventType, data: EventData): Promise<void> {
    if (this.debug) {
      console.log(`[EventBus] Emitting "${event}"`, data);
    }

    const listeners = this.listeners.get(event);
    if (listeners) {
      const promises: Promise<void>[] = [];

      for (const callback of listeners) {
        try {
          const result = callback(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Error in listener for "${event}":`, error);
        }
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      const promises: Promise<void>[] = [];

      for (const callback of onceListeners) {
        try {
          const result = callback(data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Error in once listener for "${event}":`, error);
        }
      }

      this.onceListeners.delete(event);

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    }
  }

  clear(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      if (this.debug) {
        console.log(`[EventBus] Cleared all listeners for "${event}"`);
      }
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
      if (this.debug) {
        console.log('[EventBus] Cleared all listeners');
      }
    }
  }

  listenerCount(event: EventType): number {
    const regularCount = this.listeners.get(event)?.size || 0;
    const onceCount = this.onceListeners.get(event)?.size || 0;
    return regularCount + onceCount;
  }

  getActiveEvents(): EventType[] {
    const events = new Set<EventType>();
    this.listeners.forEach((_, event) => events.add(event));
    this.onceListeners.forEach((_, event) => events.add(event));
    return Array.from(events);
  }
}

export const EventBus = new EventBusClass();
export { EventBusClass };