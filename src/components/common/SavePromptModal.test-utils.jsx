// Shared test utilities for SavePromptModal tests
//
// Subscriber event feeders are NOT here: each test lane vi.mock's
// ./Subscriber.jsx inline with exactly the triggers it exercises
// (see .rendering / .bonuses / .actions / .rerolls / .dodge-2024).
// The old generic createMockSubscriber factory had no importers and was
// removed as dead code.

import { vi } from 'vitest';

// ── EventSource setup ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

export function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

export function teardownGlobalEventSource() {
  delete globalThis.EventSource;
}

// ── Fixtures ──

export function createCharacter(name, saveModifiers, evasionEffects, abilities) {
  return {
    name,
    computedStats: {
      abilities: abilities || [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 1 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Charisma', bonus: 4 },
      ],
      evasionEffects: evasionEffects || [],
    },
    saveModifiers: saveModifiers || [],
  };
}

export function createRageCharacter(name, rageDamage) {
  return {
    name,
    level: 1,
    class: { class_levels: [{ rage_damage: rageDamage }] },
    computedStats: {
      abilities: [{ name: 'Constitution', bonus: 3 }],
      evasionEffects: [],
      automation: { passives: [] },
    },
    saveModifiers: [],
  };
}

// ── Default beforeEach/afterEach setup ──

export function setupDefaults(rollD20, computeAuraBonus, getRuntimeValue) {
  vi.clearAllMocks();
  setupGlobalEventSource();
  rollD20.mockReset().mockReturnValue(15);
  computeAuraBonus.mockReset().mockResolvedValue({ bonus: 0, sourceName: null });
  getRuntimeValue.mockReset().mockImplementation(() => null);
}

export function cleanupDefaults() {
  vi.clearAllMocks();
  teardownGlobalEventSource();
}
