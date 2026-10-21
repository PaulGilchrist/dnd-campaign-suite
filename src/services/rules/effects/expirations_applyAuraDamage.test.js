// @maintained-by-ai
// Barrel-facing lane for expirations.js re-exports (verifies the barrel wires
// consumers to the real services). Owns: applyAuraDamage early-return gates
// (null summary, non-array creatures, damageValue 0/NaN/negative/undefined),
// allyFilter, targetFilter, out-of-range skip, per-creature error recovery,
// combat-summary-updated event dispatch; applyTurnStartEffects Holy Nimbus
// pre-playerStats seam and runtime turnStartEffects merge; expireStaleEffects
// overrideActiveName precedence.
// Owned elsewhere (not duplicated): exact applyAuraDamage call shapes,
// self-skip, fallback loadCombatSummary — applyAuraDamage.test.js; detached-
// copy persistence + inactive skip — auraDamageService.test.js; innerRadiance
// tick via the turnStartEffects loop — turnStartEffects_innerRadiance.test.js;
// regenerate-buff tick and dispatch contract — applyTurnStartEffects.test.js;
// heroism_temp_hp handler — turnStartEffects_additional.test.js; expireStale
// fallback name + early exits — expireStaleEffects.test.js.
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
import { getCombatSummary, loadCombatSummary, getActiveCreatureName, getCurrentCombatRound } from '../../encounters/combatData.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

const ACTIVE_KEY = 'innerRadianceActive';

// Deterministic empty baseline every test: vi.clearAllMocks preserves
// mockReturnValue/mockImplementation, so each test must start from explicit
// inert stubs rather than whatever a previous test left behind.
function resetMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockImplementation(() => null);
  getCombatSummary.mockReturnValue(null);
  loadCombatSummary.mockResolvedValue(null);
  isWithinRange.mockResolvedValue(true);
  applyDamageToTarget.mockReturnValue(undefined);
  getAllyList.mockReturnValue([]);
  getActiveCreatureName.mockReturnValue(null);
  getCurrentCombatRound.mockReturnValue(3);
  window.dispatchEvent = vi.fn();
}

function auraActiveOnly() {
  getRuntimeValue.mockImplementation((_name, prop) => (prop === ACTIVE_KEY ? true : null));
}

// Run the aura against the given creatures with a plain 5-damage Radiant aura.
async function damageEnemies(creatures, options = {}) {
  getCombatSummary.mockReturnValue({ creatures });
  await applyAuraDamage('Test', {}, 'Campaign', [], {
    activeKey: ACTIVE_KEY,
    damageValue: 5,
    range: 10,
    damageType: 'Radiant',
    ...options,
  });
}

const damagedNames = () => applyDamageToTarget.mock.calls.map((c) => c[1]);

// ---------------------------------------------------------------------------
// applyAuraDamage — target selection filters
// ---------------------------------------------------------------------------
describe('applyAuraDamage — target selection filters', () => {
  beforeEach(resetMocks);

  it('with allyFilter, skips tracked allies and damages only the enemy (reads the source ally list)', async () => {
    auraActiveOnly();
    getAllyList.mockReturnValue(['Ally']);
    await damageEnemies(
      [{ name: 'Ally' }, { name: 'Enemy' }],
      { allyFilter: true },
    );

    expect(getAllyList).toHaveBeenCalledWith('Test');
    expect(damagedNames()).toEqual(['Enemy']);
  });

  it('without allyFilter, damages allies from the stored ally list too', async () => {
    auraActiveOnly();
    getAllyList.mockReturnValue(['Ally']);
    await damageEnemies([{ name: 'Ally' }, { name: 'Enemy' }]);

    expect(damagedNames()).toEqual(['Ally', 'Enemy']);
  });

  it('skips creatures out of range', async () => {
    auraActiveOnly();
    isWithinRange.mockImplementation((_active, target) => target === 'Nearby');
    await damageEnemies([{ name: 'Nearby' }, { name: 'Far' }]);

    expect(damagedNames()).toEqual(['Nearby']);
    expect(isWithinRange).toHaveBeenCalledWith('Test', 'Far', 10);
  });

  it('applies targetFilter to exclude non-matching creatures', async () => {
    auraActiveOnly();
    await damageEnemies(
      [{ name: 'Fiend', type: 'fiend' }, { name: 'Ooze', type: 'ooze' }],
      { targetFilter: (c) => c.type === 'fiend' },
    );

    expect(damagedNames()).toEqual(['Fiend']);
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — early-return gates (nothing is damaged or broadcast)
// ---------------------------------------------------------------------------
describe('applyAuraDamage — early-return gates', () => {
  beforeEach(resetMocks);

  it('returns before loading persistence when no summary exists anywhere', async () => {
    auraActiveOnly();
    getCombatSummary.mockReturnValue(null);
    loadCombatSummary.mockResolvedValue(null);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: ACTIVE_KEY,
      damageValue: 5,
      range: 10,
    });

    expect(loadCombatSummary).toHaveBeenCalledWith('Campaign');
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('returns without damaging or broadcasting when creatures is not an array', async () => {
    auraActiveOnly();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await damageEnemies('not-an-array');

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(window.dispatchEvent).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        'expirations: expected creatures to be an array in combatSummary',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it.each([0, -5, NaN, undefined])('returns without damaging when damageValue is %p', async (damageValue) => {
    auraActiveOnly();
    await damageEnemies([{ name: 'Orc' }], { damageValue });

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — per-creature error recovery
// ---------------------------------------------------------------------------
describe('applyAuraDamage — error recovery', () => {
  beforeEach(resetMocks);

  it('continues past a per-creature failure so the second target still takes exact damage', async () => {
    auraActiveOnly();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    applyDamageToTarget
      .mockImplementationOnce(() => { throw new Error('first target failed'); })
      .mockReturnValue(undefined);

    try {
      await damageEnemies([{ name: 'Orc' }, { name: 'Goblin' }]);

      expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
      expect(applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object), 'Goblin', 5, ['Radiant'],
        { campaignName: 'Campaign', characters: [], ignoreResistance: false, attackerName: 'Test' },
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// applyAuraDamage — dispatches combat-summary-updated event
// ---------------------------------------------------------------------------
describe('applyAuraDamage — event dispatch', () => {
  beforeEach(resetMocks);

  it('broadcasts exactly one combat-summary-updated event after damaging', async () => {
    auraActiveOnly();
    await damageEnemies([{ name: 'Orc' }]);

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
    expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated');
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — Holy Nimbus runs before the playerStats guard
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — Holy Nimbus pre-guard seam', () => {
  beforeEach(resetMocks);

  it('damages the active NPC from a PC Holy Nimbus even when playerStats is null, and writes nothing after the guard', async () => {
    const paladin = {
      name: 'Paladin',
      computedStats: { proficiency: 2, abilities: [{ name: 'Charisma', bonus: 3 }] },
    };
    getRuntimeValue.mockImplementation((name, prop) =>
      (name === 'Paladin' && prop === 'holyNimbusActive') ? true : null);
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Orc' }] });

    await applyTurnStartEffects('Orc', null, 'TestCampaign', [paladin]);

    // Proficiency 2 + Charisma 3 = 5 radiant, dealt to the active creature.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Orc', 5, ['Radiant'],
      { campaignName: 'TestCampaign', characters: [paladin], ignoreResistance: false, attackerName: 'Paladin' },
    );
    // The playerStats guard must stop all post-guard effect processing.
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — runtime turnStartEffects merging
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — runtime turnStartEffects merging', () => {
  beforeEach(resetMocks);

  it('merges runtime effects with computed ones, deduping by type', async () => {
    // Runtime carries a duplicate heroic_inspiration plus a runtime-only
    // flurry entry; computed carries heroic plus a computed-only living_legend.
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'turnStartEffects') return [
        { type: 'heroic_inspiration', name: 'Heroic runtime dup' },
        { type: 'flurry_healing_harm', usesExpression: 'WIS modifier minimum 1' },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        { type: 'heroic_inspiration', name: 'Heroic computed' },
        { type: 'living_legend_turn_start' },
      ],
    }, 'TestCampaign');

    const writesFor = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);
    // Computed entry wins and the runtime duplicate is dropped: exactly one write.
    expect(writesFor('hasInspiration')).toEqual([['TestCharacter', 'hasInspiration', true, 'TestCampaign']]);
    // Computed-only effect processed.
    expect(writesFor('unerringStrikeUsed')).toEqual([['TestCharacter', 'unerringStrikeUsed', false, 'TestCampaign']]);
    // Runtime-only effect processed (no Wisdom ability → floor of 1 use).
    expect(writesFor('flurryHealingHarmUses')).toEqual([['TestCharacter', 'flurryHealingHarmUses', 1, 'TestCampaign']]);
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — overrideActiveName precedence
// ---------------------------------------------------------------------------
describe('expireStaleEffects — overrideActiveName precedence', () => {
  beforeEach(resetMocks);

  it('processes the override name and never consults getActiveCreatureName', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => (prop === 'pendingExpirations' ? [] : null));
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Orc' }] });
    getActiveCreatureName.mockReturnValue('Goblin');

    await expireStaleEffects('test-campaign', 'Orc');

    expect(getActiveCreatureName).not.toHaveBeenCalled();
    expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'pendingExpirations');
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'pendingExpirations');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
