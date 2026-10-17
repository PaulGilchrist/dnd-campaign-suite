// @maintained-by-ai
// CharSheet sheet-side feature-rider wiring lane: spend flags, resource
// decrements, log shapes, and tracker updates produced by CharSheet.handlers
// invocations.
//
// Trimmed 2026-10-16 (20 → 13 tests). Lane ownership after the trim:
//   - handleReroll Indomitable consumption, level tiers, and Fanatical
//     Focus / Disciplined Survivor log names → CharSheet.handlers.indomitable.test.jsx
//     (only the raging-lane fanaticalFocusUsed store write stays here).
//   - Puncture, Savage Attacker choice math, Tactical Mind refusal tiers,
//     Psi-Bolstered Knack eligibility → CharSheet.handlers4.test.jsx (its
//     versions assert the same paths with stricter popup/damage shape).
//   - BI feature injection (UI) → CharSheet.bardicInspiration.test.jsx.
// Consolidated here: the five Bardic-Inspiration spend tests fold into one
// it.each exact-shape matrix (numeric args, string args, missing checkName —
// same execution path) plus the abort-without-spend guard.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY,
  boonOfCombatProwessLocked,
} from '../../services/rules/features/boonOfCombatProwess.js';
import {
  handleReroll,
  handleStrokeOfLuck,
  handleBardicInspiration,
  handleBiDefenseCombatSummary,
  handleBardicInspirationOffense,
  handleEmpoweredSpell,
  handleDarkOnesLuck,
  handleSuperiorityManeuver,
} from './CharSheet.handlers';

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
  getCurrentCombatRound: vi.fn(() => 1),
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

// ---------------------------------------------------------------------------
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = createMockStore();

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

const createPlayerStats = (overrides = {}) => createMockPlayerStats({ name: 'Test Character', ...overrides });

const campaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Tests — handleReroll (Fanatical Focus lane only; Indomitable consumption
// and Disciplined Survivor focus spend live in CharSheet.handlers.indomitable.test.jsx)
// ---------------------------------------------------------------------------

describe('handleReroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('raging reroll consumes Fanatical Focus without collateral writes to focusPoints or indomitableUses', () => {
    handleReroll(createPlayerStats(), campaignName, { autoRerollCondition: 'raging' });

    expect(mockStore.get('Test Character:fanaticalFocusUsed')).toBe(true);
    expect(mockStore.get('Test Character:focusPoints')).toBeUndefined();
    expect(mockStore.get('Test Character:indomitableUses')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleStrokeOfLuck
// ---------------------------------------------------------------------------

describe('handleStrokeOfLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('CLA-339: stroke of luck use stamps strokeOfLuckUsed only, no boon round-latch collateral, and logs ability_use', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const stats = createPlayerStats();

    handleStrokeOfLuck(stats, campaignName, { name: 'Shortsword', rolls: [6], bonus: 8, hit: false }, 'strokeOfLuck');

    expect(mockStore.get('Test Character:strokeOfLuckUsed')).toBe(true);
    expect(mockStore.get(`Test Character:${BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY}`)).toBeUndefined();
    expect(addEntry).toHaveBeenCalled();
    const entry = addEntry.mock.calls.at(-1)[1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Stroke of Luck');
    expect(entry.description).toContain('d20 6 → 20');
    expect(entry.description).toContain('total 14 → 28');
  });

  it('FT-007: boon of combat prowess use latches the current round (locked until it advances), never strokeOfLuckUsed, and logs the conversion', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const stats = createPlayerStats();

    await handleStrokeOfLuck(stats, campaignName, { name: 'Shortsword', rolls: [4], bonus: 8, hit: false, targetName: 'Knight 1' }, 'boonOfCombatProwess');

    // getCurrentCombatRound is mocked to round 1 — the latch must stamp exactly that round,
    // and the real lock helper must consult it to refuse a second spend this round.
    expect(mockStore.get(`Test Character:${BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY}`)).toBe(1);
    expect(boonOfCombatProwessLocked('Test Character', campaignName)).toBe(true);
    expect(mockStore.get('Test Character:strokeOfLuckUsed')).toBeUndefined();
    expect(addEntry).toHaveBeenCalled();
    const entry = addEntry.mock.calls.at(-1)[1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Boon of Combat Prowess');
    expect(entry.description).toContain('vs Knight 1');
    expect(entry.description).toContain('Miss converted to Hit');
  });
});

// ---------------------------------------------------------------------------
// Tests — handleBardicInspiration
// ---------------------------------------------------------------------------

describe('handleBardicInspiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it.each([
    {
      label: 'numeric popup args',
      popupHtml: { name: 'Insight', rolls: [10], bonus: 9, modifier: 0 },
      dieValue: 2,
      dieSize: 12,
      expectedDescription: 'Test Character used Bardic Inspiration (1d12): +21 to Insight (d20 10 + 9 = 19 → 21). Inspiration granted by Bard.',
    },
    {
      // String args from the popup must still sum numerically — never concatenate ('1912').
      label: 'string popup args',
      popupHtml: { name: 'Insight', rolls: ['10'], bonus: '9', modifier: '0' },
      dieValue: '2',
      dieSize: '12',
      expectedDescription: 'Test Character used Bardic Inspiration (1d12): +21 to Insight (d20 10 + 9 = 19 → 21). Inspiration granted by Bard.',
    },
    {
      label: 'missing popupHtml.name defaults to "Ability Check"',
      popupHtml: { rolls: [10], bonus: 9, modifier: 0 },
      dieValue: 2,
      dieSize: 12,
      expectedDescription: 'Test Character used Bardic Inspiration (1d12): +21 to Ability Check (d20 10 + 9 = 19 → 21). Inspiration granted by Bard.',
    },
  ])('spends the BI die with the exact log shape — $label', async ({ popupHtml, dieValue, dieSize, expectedDescription }) => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('Test Character:bardicInspirationDie', '12');
    mockStore.set('Test Character:bardicInspirationGrantedBy', 'Bard');

    await handleBardicInspiration(createPlayerStats(), campaignName, popupHtml, dieValue, dieSize);

    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Bardic Inspiration');
    expect(entry.description).toBe(expectedDescription);
    expect(entry.dieValue).toBe(2);
    expect(typeof entry.dieValue).toBe('number');
    expect(entry.dieSize).toBe('d12');
    // The spend clears the grant so the offer cannot be reused.
    expect(mockStore.get('Test Character:bardicInspirationDie')).toBe(null);
    expect(mockStore.get('Test Character:bardicInspirationGrantedBy')).toBe(null);
  });

  it('aborts without logging or clearing the grant when the popup passes no rolled die value', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('Test Character:bardicInspirationDie', '12');

    await handleBardicInspiration(createPlayerStats(), campaignName, { name: 'Insight', rolls: [10], bonus: 9 });

    expect(addEntry).not.toHaveBeenCalled();
    expect(mockStore.get('Test Character:bardicInspirationDie')).toBe('12');
  });
});

// ---------------------------------------------------------------------------
// Tests — handleBiDefenseCombatSummary
// ---------------------------------------------------------------------------

describe('handleBiDefenseCombatSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('rewrites lastAttack with the defense uplift and persists the summary; with no lastAttack it changes nothing', async () => {
    const { loadCombatSummary } = await import('../../services/encounters/combatData.js');
    const storage = await import('../../services/ui/storage.js');
    const cs = { creatures: [] };
    loadCombatSummary.mockResolvedValue(cs);
    mockStore.set('campaign:lastAttack', { hit: true, targetName: 'Enemy' });

    await handleBiDefenseCombatSummary(createPlayerStats(), campaignName, { dieValue: 4, newAc: 18, willMiss: true });

    const lastAttack = mockStore.get('campaign:lastAttack');
    expect(lastAttack.effectiveAc).toBe(18);
    expect(lastAttack.bardicInspirationDefense).toEqual({ used: true, biRoll: 4, newEffectiveAc: 18 });
    expect(lastAttack.hit).toBe(false);
    expect(lastAttack.isAutoMiss).toBe(true);
    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);

    // No recorded last attack → nothing to uplift, nothing persisted.
    storage.default.set.mockClear();
    mockStore.set('campaign:lastAttack', null);
    await handleBiDefenseCombatSummary(createPlayerStats(), campaignName, { dieValue: 4, newAc: 18, willMiss: true });
    expect(storage.default.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleBardicInspirationOffense
// ---------------------------------------------------------------------------

describe('handleBardicInspirationOffense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('applies the rolled bonus damage to lastAttack\'s target, decrements uses, clears the grant, and logs', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { applyDamageToTarget } = await import('../../services/rules/combat/applyDamage.js');
    const storage = await import('../../services/ui/storage.js');
    mockStore.set('campaign:lastAttack', { targetName: 'Goblin', damageType: 'Slashing' });
    mockStore.set('Test Character:bardicInspirationUses', { current: 3 });

    await handleBardicInspirationOffense(createPlayerStats(), campaignName, [], 4, 'd6');

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin', 4, ['Slashing'],
      { campaignName, characters: [], ignoreResistance: false, attackerName: 'Test Character' },
    );
    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', expect.anything(), campaignName);
    expect(mockStore.get('Test Character:bardicInspirationUses')).toBe(2);
    expect(mockStore.get('Test Character:bardicInspirationDie')).toBe(null);
    expect(mockStore.get('Test Character:bardicInspirationCombatOptions')).toBe(null);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.abilityName).toBe('Combat Inspiration - Offense');
    expect(entry.biDieRoll).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Tests — handleEmpoweredSpell
// ---------------------------------------------------------------------------

describe('handleEmpoweredSpell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('unwraps executeEmpoweredReroll\'s popup result, forwarding the Cha mod, and returns null when there is no result', async () => {
    const { executeEmpoweredReroll } = await import('../../services/rules/spells/empoweredSpellService.js');
    executeEmpoweredReroll.mockResolvedValue({ popupState: { result: { rerolledValue: 18 } } });

    const stats = createPlayerStats();
    const result = await handleEmpoweredSpell(stats, campaignName, [], { empoweredSpellChaMod: 3 }, {});

    expect(executeEmpoweredReroll).toHaveBeenCalledWith(expect.objectContaining({
      campaignName,
      playerStats: stats,
      chaMod: 3,
    }));
    expect(result).toEqual({ rerolledValue: 18 });

    executeEmpoweredReroll.mockResolvedValueOnce(null);
    await expect(handleEmpoweredSpell(stats, campaignName, [], { empoweredSpellChaMod: 3 }, {})).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — handleSuperiorityManeuver
// ---------------------------------------------------------------------------

describe('handleSuperiorityManeuver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('spends one superiority die, logs the maneuver, and shows the adjusted-total popup', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    getManeuversForRules.mockResolvedValue([{ name: 'Tripping Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const setPopupHtml = vi.fn();
    await handleSuperiorityManeuver({
      playerStats: createPlayerStats({ rules: '2024' }),
      campaignName,
      setPopupHtml,
      popupHtml: { name: 'Athletics Check', rolls: [15], bonus: 3 },
      maneuverName: 'Tripping Attack',
      dieValue: 8,
    });

    expect(mockStore.get('Test Character:superiorityDice')).toBe(2);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.abilityName).toBe('Tripping Attack');
    expect(entry.description).toContain('18 → 26');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Tripping Attack',
    }));
  });

  it('on an initiative roll, rewrites the tracker initiative, persists the summary, and broadcasts initiative-rolled', async () => {
    const { loadCombatSummary } = await import('../../services/encounters/combatData.js');
    const storage = await import('../../services/ui/storage.js');
    const { getManeuversForRules, getSuperiorityDice } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
    const cs = { creatures: [{ type: 'player', name: 'Test Character', initiative: '10' }] };
    loadCombatSummary.mockResolvedValue(cs);
    getManeuversForRules.mockResolvedValue([{ name: 'Tripping Attack' }]);
    getSuperiorityDice.mockReturnValue(3);

    const initiativeEvent = vi.fn();
    window.addEventListener('initiative-rolled', initiativeEvent);
    try {
      await handleSuperiorityManeuver({
        playerStats: createPlayerStats({ rules: '2024' }),
        campaignName,
        setPopupHtml: vi.fn(),
        popupHtml: { name: 'Initiative', rolls: [15], bonus: 3 },
        maneuverName: 'Tripping Attack',
        dieValue: 8,
      });
    } finally {
      window.removeEventListener('initiative-rolled', initiativeEvent);
    }

    expect(cs.creatures.find((c) => c.name === 'Test Character').initiative).toBe('26');
    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(initiativeEvent).toHaveBeenCalledWith(expect.objectContaining({
      detail: { characterName: 'Test Character', roll: 26 },
    }));
  });
});

// ---------------------------------------------------------------------------
// Tests — handleDarkOnesLuck
// ---------------------------------------------------------------------------

describe('handleDarkOnesLuck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('spends one use and logs the d10 boost with uses remaining against the Cha-derived max', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('Test Character:darkOnesLuckUses', 3);

    const stats = createPlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }] });
    await handleDarkOnesLuck(stats, campaignName, { name: 'Persuasion Check', rolls: [12], bonus: 3, darkOnesLuckValue: 7 });

    expect(mockStore.get('Test Character:darkOnesLuckUses')).toBe(2);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.abilityName).toBe("Dark One's Own Luck");
    expect(entry.description).toContain('+1d10(7)');
    expect(entry.description).toContain('d20 12 + 3 = 15 → 22');
    expect(entry.description).toContain('Uses remaining: 2/3');
  });
});
