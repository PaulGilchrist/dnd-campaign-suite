// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'Goblin'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/animalShapesService.js', () => ({
  revertAnimalShapes: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
  revertTruePolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/shapechangeService.js', () => ({
  revertShapechange: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => String(v));
}

// Empty-store baseline: every read misses, so each test opts into exactly
// the state it asserts on.
function emptyRuntime() {
  getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
}

const writesTo = (name, key) =>
  setRuntimeValue.mock.calls.filter((c) => c[0] === name && c[1] === key);

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — expiration-queue lanes (this file's lane).
// Effect-type handler internals are owned by clearExpirationEffects.test.js,
// clearExpirationEffects_additional_types.test.js and the per-spell
// clearExpirationEffects.* files; rest-scene cleanups (Flesh to Stone,
// Prismatic Spray, Otto's, Sanctuary, object transforms, coverRefresh,
// 8-hour buff preservation, SP-012 log) are owned by
// clearAllExpirationEffects_rest_cleanup.test.js.
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — expiration queues', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('resolves every outgoing queue entry (finite AND until:"combat") and empties the queue once', () => {
    const myList = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 2, expiryRounds: 2 },
      { target: 'Human', effects: [{ type: 'tashas_laughter_expiration' }], appliedRound: 1, expiryRounds: Infinity, until: 'combat' },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      if (name === 'Orc' && key === 'activeConditions') return ['stunned', 'poisoned'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // Both entries dispatched: finite and Infinity/until:"combat" alike —
    // a rest/initiative seam purges combat-scoped entries too.
    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', ['poisoned'], 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'tashas_laughter_Human_damageTrigger', false, 'MyCampaign');
    // Queue emptied with exactly one write of the empty array.
    const pendingCalls = writesTo('Goblin', KEY);
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([]);
  });

  it.each([
    { label: 'empty array', stored: [] },
    { label: 'null', stored: null },
  ])('rewrites an outgoing queue that is $label to an empty array', ({ stored }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return stored;
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const pendingCalls = writesTo('Goblin', KEY);
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([]);
  });

  it('clears "to me" entries from other stores, preserves foreign entries, ignores non-string stores', () => {
    getAllStoreKeys.mockReturnValue(['Orc', 'Human', 123, null]);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [];
      if (key === KEY && name === 'Orc') return [
        { target: 'Goblin', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
        { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 2 },
      ];
      if (key === KEY && name === 'Human') return [
        { target: 'Goblin', effects: [{ type: 'condition', condition: 'frightened' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'Orc' && key === 'activeConditions') return ['stunned', 'poisoned'];
      if (name === 'Goblin' && key === 'activeConditions') return ['frightened', 'blinded'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // Partial clear: Orc keeps only the Human-targeted entry, verbatim bytes.
    const orcCalls = writesTo('Orc', KEY);
    expect(orcCalls.length).toBe(1);
    expect(orcCalls[0][2]).toEqual([
      { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 2 },
    ]);
    // Human's only entry targeted Goblin: cleared and its condition resolved.
    const humanCalls = writesTo('Human', KEY);
    expect(humanCalls.length).toBe(1);
    expect(humanCalls[0][2]).toEqual([]);
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['blinded'], 'MyCampaign');
    // Non-string store keys never become write targets.
    const junkCalls = setRuntimeValue.mock.calls.filter((c) => typeof c[0] !== 'string');
    expect(junkCalls.length).toBe(0);
  });

  it('leaves a store with non-array pendingExpirations untouched', () => {
    getAllStoreKeys.mockReturnValue(['Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Orc') return 'not-an-array';
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(writesTo('Orc', KEY).length).toBe(0);
    expect(writesTo('Orc', 'activeConditions').length).toBe(0);
  });

  it('matches incoming entry targets case-insensitively', () => {
    getAllStoreKeys.mockReturnValue(['Orc']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [];
      if (key === KEY && name === 'Orc') return [
        { target: 'goblin', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const orcCalls = writesTo('Orc', KEY);
    expect(orcCalls.length).toBe(1);
    expect(orcCalls[0][2]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects — self buffs and owned feature flags
// (8-hour preservation is owned by
// clearAllExpirationEffects_rest_cleanup.test.js:482)
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — self buffs and flags', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('clears self buffs and every owned cover/majesty/sanctuary flag', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'Goblin' && key === 'activeBuffs') return [{ name: 'Wrath', duration: 1 }];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'mantleOfMajestyActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'innerRadianceActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'unbreakableMajestyActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'unbreakableMajestySaveDc', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'smiteOfProtectionActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'bulwarkOfForceActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'bulwarkOfForceTargets', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'naturesSanctuaryActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'naturesSanctuaryCreatures', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'naturesSanctuaryRange', null, 'MyCampaign');
  });

  it.each([
    { active: true, expectCleared: true },
    { active: false, expectCleared: false },
  ])('self bait-and-switch $active clears the three keys: $expectCleared', ({ active, expectCleared }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY) return [];
      if (name === 'Goblin' && key === 'baitAndSwitchActive') return active;
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const baitCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && ['baitAndSwitchActive', 'baitAndSwitchBonus', 'baitAndSwitchSource'].includes(c[1]),
    );
    if (expectCleared) {
      expect(baitCalls).toEqual([
        ['Goblin', 'baitAndSwitchActive', null, 'MyCampaign'],
        ['Goblin', 'baitAndSwitchBonus', null, 'MyCampaign'],
        ['Goblin', 'baitAndSwitchSource', null, 'MyCampaign'],
      ]);
    } else {
      expect(baitCalls.length).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects effect types reached via the queue that are owned
// by THIS lane (others: clearExpirationEffects.test.js,
// clearExpirationEffects_additional_types.test.js,
// clearExpirationEffects-hurlThroughHell.test.js,
// clearExpirationEffects.draconic-flight-expiry.test.js)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects via queue — heroism and target-effect scoping', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('remove_heroism_buff strips the matching heroism targetEffect in one exact write', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [
        { target: 'Human', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'heroism', source: 'Heroism', target: 'Human' },
        { effect: 'slow', source: 'Slow', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const effectCalls = writesTo('campaign', 'targetEffects');
    expect(effectCalls.length).toBe(1);
    expect(effectCalls[0][2]).toEqual([
      { effect: 'slow', source: 'Slow', target: 'Orc' },
    ]);
  });

  it('remove_target_effect removes only the same effect AND source (FT-082 scoping)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [
        { target: 'Human', effects: [{ type: 'remove_target_effect', effectKey: 'slow', source: 'Slow' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'slow', source: 'Slow', target: 'Human' },
        { effect: 'slow', source: 'Other', target: 'Orc' },
        { effect: 'heroism', source: 'Heroism', target: 'Orc' },
      ];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const effectCalls = writesTo('campaign', 'targetEffects');
    expect(effectCalls.length).toBe(1);
    expect(effectCalls[0][2]).toEqual([
      { effect: 'slow', source: 'Other', target: 'Orc' },
      { effect: 'heroism', source: 'Heroism', target: 'Orc' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// HP-max reverts: remove_heroes_feast_buff / remove_aid_buff share the
// revertHpBuff factory (clearExpirationEffects.js:402-405); pin both
// registry keys plus the two guard branches once.
// ---------------------------------------------------------------------------
describe('clearExpirationEffects via queue — max-HP buff reverts', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it.each([
    { type: 'remove_heroes_feast_buff', buff: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease', increase: 5, hp: 25 },
    { type: 'remove_aid_buff', buff: 'Aid', hpKey: 'aidHpMaxIncrease', increase: 3, hp: 22 },
  ])('$type removes the buff and reverts currentHitPoints by $increase without touching hitPoints',
    ({ type, buff, hpKey, increase, hp }) => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [
          { target: 'Human', effects: [{ type, buffName: buff, hpKey }], appliedRound: 1 },
        ];
        if (key === KEY) return [];
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: buff, duration: 3 },
          { name: 'OtherBuff', duration: 2 },
        ];
        if (name === 'Human' && key === hpKey) return increase;
        if (name === 'Human' && key === 'currentHitPoints') return hp;
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [{ name: 'OtherBuff', duration: 2 }], 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'currentHitPoints', hp - increase, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Human', hpKey, 0, 'MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Human', 'hitPoints', expect.any(Number), 'MyCampaign');
    });

  it('skips HP writes when the stored increase is 0', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [
        { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'Human' && key === 'activeBuffs') return [{ name: 'HeroesFeast', duration: 3 }];
      if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 0;
      if (name === 'Human' && key === 'currentHitPoints') return 25;
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [], 'MyCampaign');
    // revertHpMaxIncrease early-returns: no current or max-HP writes at all.
    expect(writesTo('Human', 'currentHitPoints').length).toBe(0);
    expect(writesTo('Human', 'heroesFeastHpMaxIncrease').length).toBe(0);
  });

  it('still zeroes the increase key but skips currentHitPoints when current HP is missing', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [
        { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'Human' && key === 'activeBuffs') return [{ name: 'HeroesFeast', duration: 3 }];
      if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 5;
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [], 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'heroesFeastHpMaxIncrease', 0, 'MyCampaign');
    expect(writesTo('Human', 'currentHitPoints').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// bait_and_switch_clear queue dispatch against ANOTHER character (the
// self-lane pair above covers clearSelfBuffs; the turn-start producer is
// owned by applyTurnStartEffects.test.js:270).
// ---------------------------------------------------------------------------
describe('clearExpirationEffects via queue — bait_and_switch_clear on a remote target', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it.each([
    { active: true, expectCleared: true },
    { active: false, expectCleared: false },
  ])('target baitAndSwitchActive=$active clears the three keys: $expectCleared', ({ active, expectCleared }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return [
        { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
      ];
      if (key === KEY) return [];
      if (name === 'Human' && key === 'baitAndSwitchActive') return active;
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const baitCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Human' && ['baitAndSwitchActive', 'baitAndSwitchBonus', 'baitAndSwitchSource'].includes(c[1]),
    );
    if (expectCleared) {
      expect(baitCalls).toEqual([
        ['Human', 'baitAndSwitchActive', null, 'MyCampaign'],
        ['Human', 'baitAndSwitchBonus', null, 'MyCampaign'],
        ['Human', 'baitAndSwitchSource', null, 'MyCampaign'],
      ]);
    } else {
      expect(baitCalls.length).toBe(0);
    }
  });
});
