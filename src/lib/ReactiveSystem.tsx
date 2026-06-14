import React from 'react';

// --- Event Bus ---
type Handler = (data: any) => void;
class EventBus {
  private handlers: Record<string, Handler[]> = {};

  on(event: string, handler: Handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  emit(event: string, data: any) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(h => h(data));
    }
  }
}

export const Bus = new EventBus();

// --- Data Store (Reactive Snapshots) ---
class DataStore {
  private state: Record<string, any> = {
    scrubber: {
      pinchPower: 0.4,
      distortionPower: 1.6,
      currentProgress: 0.0
    },
    simulation: {
      particleCount: 50000,
      flowStrength: 1.0,
      brushRadius: 80.0,
      persistence: 0.985,
      distortion: 60.0,
      chroma: 0.5,
      densityPersistence: 0.5,
      gridTiling: 4.0,
      curlScale: 1.0,
      currentPreset: 'Mercury',
      primaryColor: '#00FF88',
      accentColor: '#FFFFFF',
      running: true
    }
  };

  update(key: string, value: any) {
    this.state[key] = { ...this.state[key], ...value };
    Bus.emit(`store/${key}`, this.state[key]);
  }

  getSnapshot() {
    return this.state;
  }
}

export const Store = new DataStore();

// --- Finite State Machine (Animations/UI) ---
export enum AppStates {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ACTIVE = 'ACTIVE',
  INTERACTING = 'INTERACTING'
}

class FSM {
  private current: AppStates = AppStates.IDLE;

  transition(next: AppStates) {
    const prev = this.current;
    this.current = next;
    Bus.emit('fsm/transition', { prev, next });
    console.log(`[FSM] ${prev} -> ${next}`);
  }

  getState() { return this.current; }
}

export const StateMachine = new FSM();
