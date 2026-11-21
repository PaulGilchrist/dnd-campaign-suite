import { render, cleanup } from '@testing-library/react';
import { vi } from 'vitest';

const mockState = vi.hoisted(() => ({ logEntries: [], initialized: true, combatSummary: null }));
const mockAddEntry = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
  default: vi.fn(() => ({
    logEntries: mockState.logEntries,
    initialized: mockState.initialized,
    addEntry: mockAddEntry,
  })),
}));

// Log's GM-tab initiative census (author dropdown creature list) reads the
// combatSummary lane through these two seams; tests set
// mockState.combatSummary to feed it.
vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(async () => mockState.combatSummary),
}));
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => () => {}),
}));

export { mockState, mockAddEntry, cleanup };

export const CHARS = [{ name: 'Frodo' }, { name: 'Aragorn' }];

// ── factories with spread-last so overrides work ────────────
export const roll = (o = {}) => ({
  id: 'r', type: 'roll', rollType: 'attack', characterName: 'Frodo',
  name: 'LS Attack', timestamp: Date.now(), rolls: [15], total: 20,
  bonus: 5, hit: true, targetAc: 15, isAutoMiss: false, isNatural20: false,
  isNatural1: false, targetName: 'Orc', coverAcBonus: 0, coverReason: '',
  rangeReason: '', damageType: '', mode: '', ...o,
});

export const note = (o = {}) => ({
  id: 'n', type: 'note', characterName: 'Frodo', timestamp: Date.now(),
  noteText: 'Quest begins.', ...o,
});

// Narrative rows carry the canonical `description` field (composer + world
// producer law, server/routes/log.js text-split comment).
export const narrative = (o = {}) => ({
  id: 'nv', type: 'narrative', characterName: 'GM', timestamp: Date.now(),
  description: 'The gate groans open.', ...o,
});

export const travel = (o = {}) => ({
  id: 't', type: 'travel', action: 'advance', hex: { q: 3, r: -7 },
  timestamp: Date.now(), terrain: '', weather: '', eventTitle: '', ...o,
});

export const loot = (o = {}) => ({
  id: 'l', type: 'loot', timestamp: Date.now(), xpPerChar: 0, lootItems: [], ...o,
});

export const cond = (o = {}) => ({
  id: 'c', type: 'condition', characterName: 'Gollum', action: 'applied',
  condition: 'charmed', dc: 13, ability: 'wisdom', sourceName: '',
  timestamp: Date.now(), ...o,
});

export const enc = (o = {}) => ({
  id: 'e', type: 'encounter', action: 'started', encounterName: 'Orc Ambush',
  monsters: [], xpPerChar: 0, lootItems: [], timestamp: Date.now(), ...o,
});

export const hp = (o = {}) => ({
  id: 'hp', type: 'hp_change', targetName: 'Gimli', delta: -5, currentHp: 20,
  maxHp: 25, threshold: undefined, sourceName: '', isUnconscious: false,
  timestamp: Date.now(), ...o,
});

export const ds = (o = {}) => ({
  id: 'ds', type: 'death_save', characterName: 'Gimli', success: true, roll: 15,
  isNatural20: false, isNatural1: false, timestamp: Date.now(), ...o,
});

export const heal = (o = {}) => ({
  id: 'h', type: 'healing', targetName: 'Frodo', sourceName: 'Cleric',
  amount: 10, resurrection: false, timestamp: Date.now(), ...o,
});

export const spell = (o = {}) => ({
  id: 's', type: 'spell', characterName: 'Gandalf', spellName: 'Fireball',
  spellLevel: 3, castingTime: 'Action', metamagic: [], spCost: 0,
  timestamp: Date.now(), ...o,
});

export const meta = (o = {}) => ({
  id: 'm', type: 'metamagic', characterName: 'Gandalf', spellName: 'Fireball',
  targetName: 'Orc', originalDamage: 30, newTotal: 38, damageDifference: 8,
  rerolledDiceCount: 2, rollType: 'empowered-spell', timestamp: Date.now(), ...o,
});

export const automation = (o = {}) => ({
  id: 'a', type: 'automation', creatureName: 'Orc', name: 'Melee Attack',
  description: 'Orc attacks with longsword', timestamp: Date.now(), ...o,
});

export const saveResult = (o = {}) => ({
  id: 'sr', type: 'save_result', characterName: 'Frodo', targetName: 'Orc',
  saveType: 'wisdom', saveDc: 13, success: true, timestamp: Date.now(), ...o,
});

export const psionic = (o = {}) => ({
  id: 'ps', type: 'psionic_sorcery', characterName: 'Sorcerer',
  spellName: 'Burning Hands', sorceryPointsSpent: 1, spellLevel: 1,
  note: '', timestamp: Date.now(), ...o,
});

export const summons = (o = {}) => ({
  id: 'su', type: 'summons', characterName: 'Wizard',
  summonName: 'Small Spider', description: '', summonedCreatures: [],
  duration: '1 hour', timestamp: Date.now(), ...o,
});

export const spellEffect = (o = {}) => ({
  id: 'se', type: 'spell_effect', characterName: 'Cleric',
  spellName: 'Bless', targetName: 'Party', effects: ['Roll d4 on attack rolls'],
  timestamp: Date.now(), ...o,
});

export const buff = (o = {}) => ({
  id: 'b', type: 'buff', characterName: 'Frodo', buffName: 'Blessing',
  reason: 'Cleric cast bless', action: 'added', timestamp: Date.now(), ...o,
});

export const rest = (o = {}) => ({
  id: 'r', type: 'long_rest', message: 'Full rest | HP restored', timestamp: Date.now(), ...o,
});

// ── Q helpers so we don't repeat code ───────────────────────
export const q = (sel) => document.querySelector(sel);

export function setup(Log, entries, initialized, characters, isLocalhost = true) {
  mockState.logEntries.length = 0;
  if (entries) mockState.logEntries.push(...entries);
  mockState.initialized = initialized ?? true;
  return render(<Log campaignName="test-campaign" characters={characters ?? CHARS} isLocalhost={isLocalhost} />);
}

export function beforeEachSetup() {
  cleanup();
  mockState.logEntries.length = 0;
  mockState.initialized = true;
  mockState.combatSummary = null;
  mockAddEntry.mockClear();
}
