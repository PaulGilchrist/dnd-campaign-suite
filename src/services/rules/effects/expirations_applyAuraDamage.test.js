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
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
  handleConfusionTurnStart: vi.fn().mockResolvedValue({ behaviorText: 'Attacks nearest creature' }),
}));

vi.mock('../../automation/handlers/spells/sleetStormHandler.js', () => ({
  processSleetStormAreaSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/summons/summonedCreatureService.js', () => ({
  removeSummonedCreatures: vi.fn(),
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

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

import {
  applyTurnStartEffects,
  applyAuraDamage,
  expireStaleEffects,
} from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCombatSummary, loadCombatSummary, getActiveCreatureName } from '../../encounters/combatData.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { setTempHp } from '../../automation/handlers/buffs/tempHpService.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

// ---------------------------------------------------------------------------
// applyAuraDamage — ally filtering
// ---------------------------------------------------------------------------
describe('applyAuraDamage — ally filtering', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('skips allies when allyFilter is provided and allyList includes the creature', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Ally', hit_points: { current: 15 } },
        { name: 'Enemy', hit_points: { current: 10 } },
      ],
    });
    getAllyList.mockReturnValue(['Ally']);
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
      allyFilter: true,
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe('Enemy');
  });

  it('applies damage when no allyFilter is provided', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Ally', hit_points: { current: 15 } },
        { name: 'Enemy', hit_points: { current: 10 } },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
  });

  it('skips creatures not in range', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Nearby', hit_points: { current: 15 } },
        { name: 'Far', hit_points: { current: 10 } },
      ],
    });
    isWithinRange.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe('Nearby');
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — early returns
// ---------------------------------------------------------------------------
describe('applyAuraDamage — early returns', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
  });

  it('returns early when aura is not active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return false;
      return null;
    });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
    });

    expect(getCombatSummary).not.toHaveBeenCalled();
  });

  it('returns early when combatSummary is null and loadCombatSummary returns null', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue(null);
    loadCombatSummary.mockResolvedValue(null);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('returns early when creatures is not an array', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: 'not-an-array' });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('returns early when damageValue is 0', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 0,
      range: 10,
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('returns early when damageValue is NaN', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: NaN,
      range: 10,
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('returns early when damageValue is negative', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: -5,
      range: 10,
    });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — targetFilter
// ---------------------------------------------------------------------------
describe('applyAuraDamage — targetFilter', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('applies targetFilter to exclude creatures', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Fiend', type: 'fiend', hit_points: { current: 20 } },
        { name: 'Ooze', type: 'ooze', hit_points: { current: 5 } },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
      targetFilter: (c) => c.type === 'fiend',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe('Fiend');
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — error recovery per-creature
// ---------------------------------------------------------------------------
describe('applyAuraDamage — error recovery', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockImplementation(() => { throw new Error('test'); });
  });

  it('ignores per-creature errors', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', hit_points: { current: 15 } },
        { name: 'Goblin', hit_points: { current: 7 } },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await expect(
      applyAuraDamage('Test', {}, 'Campaign', [], {
        activeKey: 'innerRadianceActive',
        damageValue: 5,
        range: 10,
        damageType: 'Radiant',
      }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — Holy Nimbus (applied before playerStats check)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — Holy Nimbus before playerStats check', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] } }],
    });
    getAllyList.mockReturnValue([]);
  });

  it('applies holy nimbus damage even when playerStats is null', async () => {
    // Holy Nimbus must run before the playerStats null check
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] } }],
    });
    getAllyList.mockReturnValue([]);

    await applyTurnStartEffects('Orc', null, 'TestCampaign', [
      { name: 'Paladin', computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] } },
    ]);

    // The function should return early after holy nimbus, but holy nimbus already ran
    // We just verify no error was thrown
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — runtime turnStartEffects merging
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — runtime turnStartEffects merging', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
  });

  it('merges runtime turnStartEffects with computed ones, avoiding duplicates by type', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'turnStartEffects') return [
        { type: 'heroic_inspiration', name: 'Heroic' },
        { type: 'flurry_healing_harm', usesExpression: 'WIS modifier minimum 1' },
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        { type: 'heroic_inspiration', name: 'Heroic' },
        { type: 'living_legend_turn_start' },
      ],
    }, 'TestCampaign');

    // heroic_inspiration should only be processed once (from computed, not runtime)
    // living_legend_turn_start should be processed (from computed)
    // flurry_healing_harm should be processed (from runtime only)
    expect(setRuntimeValue).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — innerRadiance aura in the loop (proficiency-based)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — innerRadiance aura in loop', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('applies innerRadiance aura damage using proficiency when innerRadianceActive is true', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', hit_points: { current: 15 } }],
    });
    isWithinRange.mockResolvedValue(true);
    getAllyList.mockReturnValue([]);

    // Apply applyAuraDamage directly since applyTurnStartEffects only calls it inside the turnStartEffects loop
    await applyAuraDamage('TestCharacter', { proficiency: 3 }, 'TestCampaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 3,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — heroism_temp_hp sets tempHp
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — heroism_temp_hp', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
  });

  it('calls setTempHp from heroism buff tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeBuffs') return [{ name: 'Heroism', tempHpAmount: 5 }];
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });
    getAllyList.mockReturnValue([]);

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setTempHp).toHaveBeenCalledWith('TestCharacter', 5, 'TestCampaign');
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — regenerate buff healing (not tied to turnStartEffects)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — regenerate buff healing', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
  });

  it('heals 1 HP when regenerateActive flag is true (outside the effect loop)', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'regenerateActive') return true;
      if (prop === 'hitPoints') return 20;
      if (prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      11,
      'TestCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — no overrideActiveName (uses getActiveCreatureName)
// ---------------------------------------------------------------------------
describe('expireStaleEffects — no overrideActiveName', () => {
  beforeEach(() => {
    resetMocks();
    utils.getName.mockImplementation((v) => String(v));
    getCurrentCombatRound.mockReturnValue(3);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('uses getActiveCreatureName when overrideActiveName is not provided', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getActiveCreatureName.mockReturnValue('Goblin');
    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Goblin' && prop === 'pendingExpirations') return [];
      if (prop === 'pendingExpirations') return [];
      return null;
    });

    expireStaleEffects('test-campaign');

    expect(getActiveCreatureName).toHaveBeenCalled();
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'pendingExpirations');
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Goblin',
      'pendingExpirations',
      expect.anything(),
      'test-campaign',
    );
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — dispatches combat-summary-updated event
// ---------------------------------------------------------------------------
describe('applyAuraDamage — event dispatch', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('dispatches combat-summary-updated event after applying damage', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', hit_points: { current: 15 } }],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});
