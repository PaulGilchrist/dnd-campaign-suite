// @maintained-by-ai
// CLA-195 regression + featureRiders #58 lane ownership: handleReroll must
// consume Indomitable uses against the level-tier cap (indomitableUses),
// spend exactly one focus point per Disciplined Survivor reroll (focusPoints,
// refusing at zero), log every reroll by feature name, and never write a
// sibling lane's resource. The raging lane's fanaticalFocusUsed store write
// is owned by CharSheet.featureRiders.test.jsx — only the Fanatical Focus
// log name and lane isolation are asserted here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleReroll } from './CharSheet.handlers';
import { addEntry } from '../../services/ui/logService.js';

import {
  createMockStore,
  createMockPlayerStats,
} from './CharSheet.test-utils';

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue({ damageApplied: true }),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockStore = createMockStore();
const campaignName = 'test-campaign';

const createFighter = (level) => createMockPlayerStats({
  name: 'EvasiveFighter',
  level,
  class: { name: 'Fighter' },
});

// ---------------------------------------------------------------------------
// Tests — handleReroll reroll lanes
// ---------------------------------------------------------------------------

describe('handleReroll — reroll lane resource consumption (CLA-195)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it.each([
    { level: 9, max: 1 },
    { level: 12, max: 1 },
    { level: 13, max: 2 },
    { level: 17, max: 3 },
  ])('Indomitable: lv$level consumes exactly $max use(s) per long rest and refuses the next silently', ({ level, max }) => {
    const stats = createFighter(level);
    const conditionEffects = { autoRerollCondition: '', autoRerollBonus: 18 };

    // max successful rerolls plus one attempt over the cap.
    for (let attempt = 0; attempt <= max; attempt++) {
      handleReroll(stats, campaignName, conditionEffects, { roll: 14, total: 37 });
    }

    // Accumulates 1..max, stops at the cap, and the over-cap attempt logs nothing.
    expect(mockStore.get('EvasiveFighter:indomitableUses')).toBe(max);
    expect(addEntry).toHaveBeenCalledTimes(max);
    addEntry.mock.calls.forEach(([, entry], i) => {
      expect(entry).toMatchObject({
        type: 'ability_use',
        characterName: 'EvasiveFighter',
        abilityName: 'Indomitable',
      });
      expect(entry.description).toContain('(+18)');
      expect(entry.description).toContain(`Uses used: ${i + 1}/${max}`);
      expect(entry.description).toContain('New d20 14, total 37');
    });

    // Lane isolation: the Indomitable lane never touches sibling resources.
    expect(mockStore.get('EvasiveFighter:focusPoints')).toBeUndefined();
    expect(mockStore.get('EvasiveFighter:fanaticalFocusUsed')).toBeUndefined();
  });

  it('raging reroll logs Fanatical Focus without touching focusPoints or indomitableUses', () => {
    const stats = createFighter(18);

    handleReroll(stats, campaignName, { autoRerollCondition: 'raging' }, { roll: 8, total: 11 });

    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry).toMatchObject({
      type: 'ability_use',
      characterName: 'EvasiveFighter',
      abilityName: 'Fanatical Focus',
    });
    expect(entry.description).toContain('Fanatical Focus');
    expect(entry.description).toContain('New d20 8, total 11');
    // Lane isolation only — the fanaticalFocusUsed write itself is owned by
    // CharSheet.featureRiders.test.jsx.
    expect(mockStore.get('EvasiveFighter:focusPoints')).toBeUndefined();
    expect(mockStore.get('EvasiveFighter:indomitableUses')).toBeUndefined();
  });

  it('disciplined_survivor spends exactly one focus point per reroll and refuses at zero focus', () => {
    const stats = createFighter(18);
    mockStore.set('EvasiveFighter:focusPoints', 1);

    handleReroll(stats, campaignName, { autoRerollCondition: 'disciplined_survivor' }, { roll: 5, total: 9 });

    expect(mockStore.get('EvasiveFighter:focusPoints')).toBe(0);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry).toMatchObject({
      type: 'ability_use',
      characterName: 'EvasiveFighter',
      abilityName: 'Disciplined Survivor',
    });
    expect(entry.description).toContain('1 Focus Point');
    expect(entry.description).toContain('New d20 5, total 9');

    // Zero-focus guard: no second spend, no second log.
    handleReroll(stats, campaignName, { autoRerollCondition: 'disciplined_survivor' });

    expect(mockStore.get('EvasiveFighter:focusPoints')).toBe(0);
    expect(addEntry).toHaveBeenCalledTimes(1);
    // Lane isolation: this lane never consumes Indomitable.
    expect(mockStore.get('EvasiveFighter:indomitableUses')).toBeUndefined();
  });
});
