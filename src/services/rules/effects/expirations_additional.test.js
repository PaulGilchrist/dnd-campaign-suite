// @maintained-by-ai
// Barrel lane for expirations.js → turnStartEffects.js: effect handlers NOT
// pinned elsewhere — ensureArray guard (full-message pin),
// vitalityOfTheTree_turn_start, aura_of_life_turn_start_heal (log included),
// confusion_turn_start (delegates to handleConfusionTurnStart + logs the
// behavior), and regenerate_turn_start_heal via the barrel dispatch
// (cited by regenerateHandler.active.test.js as the turn-start tick face).
// Direct orchestration dispatch/order: applyTurnStartEffects.test.js.
// Inner Radiance empty-list inertness: turnStartEffects_innerRadiance.test.js.
// addExpiration queue write + barrel-import smoke: #1280/#1281 lanes.
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
  // Faithful-enough stub: numeric strings evaluate to their number so
  // healExpression pass-through is distinguishable from fixed heals.
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : Number(expr))),
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

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { handleConfusionTurnStart } from '../../automation/handlers/spells/confusionTurnStartHandler.js';
import utils from '../../ui/utils.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

// ---------------------------------------------------------------------------
// ensureArray (private helper — tested via the barrel's applyTurnStartEffects)
// ---------------------------------------------------------------------------
describe('ensureArray', () => {
  it('rejects non-array turnStartEffects with the typed rejection message', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await expect(
      applyTurnStartEffects('TestCharacter', { turnStartEffects: 'not-an-array' }, 'TestCampaign'),
    ).rejects.toThrow('Expected array for turnStartEffects, got string');

    await expect(
      applyTurnStartEffects('TestCharacter', { turnStartEffects: null }, 'TestCampaign'),
    ).rejects.toThrow('Expected array for turnStartEffects, got null');
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — handler types not pinned in sibling lanes
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — additional effect types', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
  });

  describe('vitalityOfTheTree_turn_start effect', () => {
    it.each([
      ['Rage buff active', [{ name: 'Rage', effect: 'rage' }], true],
      ['Rage buff absent', [{ name: 'Haste', effect: 'haste' }], false],
    ])('sets vitalityOfTheTreeAvailable to %s', async (_case, activeBuffs, expected) => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return activeBuffs;
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'vitalityOfTheTree_turn_start' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'vitalityOfTheTreeAvailable',
        expected,
        'TestCampaign',
      );
    });
  });

  describe('aura_of_life_turn_start_heal effect', () => {
    it('heals dropped-to-0 character to 1 HP and logs the hp_change entry', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'auraOfLifeHpMaxProtected') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 0;
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'aura_of_life_turn_start_heal' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        1,
        'TestCampaign',
      );
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'hp_change',
        targetName: 'TestCharacter',
        delta: 1,
        isHealing: true,
        sourceName: null,
        note: 'Aura of Life (1 HP at start of turn)',
      });
    });

    it.each([
      ['protection flag false', { auraOfLifeHpMaxProtected: false, currentHitPoints: 0 }],
      ['already above 0 HP', { auraOfLifeHpMaxProtected: true, currentHitPoints: 5 }],
    ])('does not write currentHitPoints when %s', async (_case, values) => {
      getRuntimeValue.mockImplementation((name, prop) => values[prop] ?? null);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'aura_of_life_turn_start_heal' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        expect.anything(),
        'TestCampaign',
      );
    });
  });

  describe('confusion_turn_start effect', () => {
    it('delegates to handleConfusionTurnStart and logs the turn-start behavior', async () => {
      getRuntimeValue.mockImplementation(() => null);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'confusion_turn_start' }],
      }, 'TestCampaign');

      expect(handleConfusionTurnStart).toHaveBeenCalledWith('TestCharacter', 'TestCampaign');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'condition',
        action: 'turn_start_behavior',
        characterName: 'TestCharacter',
        condition: 'Confused',
        reason: 'Confusion spell turn-start effect',
        note: 'Attacks nearest creature',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('regenerate_turn_start_heal effect', () => {
    it('fix#356(a) one-authoritative-writer exact-HP arithmetic: healExpression pays EXACTLY once per turn', async () => {
      // Pre-fix double-write (flat-1 buff tick after the typed row) made the
      // old flat-mock arm indistinguishable (+1 tick invisible, #1296 harvest).
      // Stateful store: the tick's 13+1=14 add-on is now visible.
      const store = { regenerateActive: true, hitPoints: 20, currentHitPoints: 10 };
      getRuntimeValue.mockImplementation((name, prop) => store[prop] ?? null);
      const hpWrites = [];
      setRuntimeValue.mockImplementation(async (name, prop, value) => {
        if (prop === 'currentHitPoints') { hpWrites.push(value); store[prop] = value; }
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'regenerate_turn_start_heal', healExpression: '3' }],
      }, 'TestCampaign');

      // Exactly ONE currentHitPoints write, landing 10+3=13 — the disk
      // expression owner (healExpression) wins; the spell-buff sibling tick
      // skips via the turn-seam latch. Pre-fix this arm was RED [13, 14].
      expect(hpWrites).toEqual([13]);
    });

    it('fix#356(a) fallback control: regenerateActive WITHOUT a typed row pays exactly one +1 tick', async () => {
      // Cast lanes stamp regenerateActive without a row
      // (spellCastService/execution/helpers.js:538, regenerateHandler.js:154) -
      // the flat tick stays alive for those, healing 10+1=11 once.
      const store = { regenerateActive: true, hitPoints: 20, currentHitPoints: 10 };
      getRuntimeValue.mockImplementation((name, prop) => store[prop] ?? null);
      const hpWrites = [];
      setRuntimeValue.mockImplementation(async (name, prop, value) => {
        if (prop === 'currentHitPoints') { hpWrites.push(value); store[prop] = value; }
      });

      await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(hpWrites).toEqual([11]);
    });

    it('does not heal currentHitPoints when regenerateActive is false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return false;
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'regenerate_turn_start_heal', healExpression: '3' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        expect.anything(),
        'TestCampaign',
      );
    });
  });
});
