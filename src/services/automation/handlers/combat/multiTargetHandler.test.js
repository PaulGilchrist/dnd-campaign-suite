// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyMultiTarget } from './multiTargetHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'tavern-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiencyBonus: 3,
    hitPoints: 30,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Word of Creation',
    automation: {
      range: '30 ft',
      ...automation,
    },
  };
}

function makeCombatSummary(creatures = [], players = []) {
  return { creatures, players, placedItems: [] };
}

function makeDamageSpell(spellName, damageType) {
  return { name: spellName, damage: { damage_type: damageType } };
}

function makeHealSpell(overrides = {}) {
  return { name: 'Power Word Heal', ...overrides };
}

// ── Tests ──────────────────────────────────────────────────────

describe('multiTargetHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockImplementation((_name) => {
      return { creatures: [], players: [], placedItems: [] };
    });
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('should use default feature name when action.name is missing and no combat context', async () => {
      const ps = makePlayerStats();
      const action = { automation: { range: '30 ft' } };
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.name).toBe('Words of Creation');
    });

    it('should return popup when first target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ payload: { targetName: 'Goblin' } });
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Orc' }]));

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No first target found');
    });

    it('should return popup when action.payload has no targetName', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ payload: {} });
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No first target found');
    });
  });

  describe('multi-target selection popup', () => {
    it('should return multi_target_selection popup with creature targets', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      const cs = makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
          { name: 'Ally', type: 'player', currentHp: 20, maxHp: 30 },
        ],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('multi_target_selection');
      expect(result.payload.firstTargetName).toBe('Goblin');
      expect(result.payload.range).toBe('30 ft');
      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
    });

    it('should exclude the first target from creatureTargets', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      const cs = makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster' },
          { name: 'Ally', type: 'player' },
        ],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).not.toContain('Goblin');
      expect(result.payload.creatureTargets).toContain('Orc');
    });

    it('should use default feature name when action.name is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.name).toBe('Words of Creation');
    });

    it('should resolve map positions when mapName is provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });

      await handle(action, ps, campaignName, mapName);

      expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, ps.name);
    });

    it('should skip map resolution when mapName is null', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(30);

      await handle(action, ps, campaignName, null);

      expect(resolveMapPositions).not.toHaveBeenCalled();
    });

    it('should use default range when automation.range is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: {},
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(10);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.range).toBe('10 ft');
    });

    it('should include spellFilter in payload when provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft', spellFilter: ['evocation', 'conjuration'] },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.spellFilter).toEqual(['evocation', 'conjuration']);
    });

    it('should use empty array for spellFilter when not provided', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));
      getCombatSummary.mockReturnValue(makeCombatSummary([{ name: 'Goblin' }]));
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.spellFilter).toEqual([]);
    });
  });

  describe('range-based creature filtering', () => {
    it('should filter creatures within range when attackerPos is available', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      const cs = makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster' },
          { name: 'Ally', type: 'player' },
        ],
        [{ name: 'TestHero', gridX: 1, gridY: 1 }, { name: 'Ally', gridX: 3, gridY: 3 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValue(10);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Ally');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });

    it('should include all creatures when attackerPos is null but range is specified', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }, { name: 'Ally', type: 'player' }],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      ));
      getCombatSummary.mockReturnValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }, { name: 'Ally', type: 'player' }],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      ));
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });

    it('should include all creatures when range is null', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: {},
        payload: { targetName: 'Goblin' },
      };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }, { name: 'Ally', type: 'player' }],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      ));
      getCombatSummary.mockReturnValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }, { name: 'Ally', type: 'player' }],
        [{ name: 'TestHero', gridX: 5, gridY: 10 }]
      ));
      rangeToFeet.mockReturnValue(null);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });

    it('should exclude creatures out of range when attackerPos and range are both available', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '10 ft' },
        payload: { targetName: 'Goblin' },
      };
      const cs = makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster' },
          { name: 'Nearby', type: 'monster' },
          { name: 'FarAway', type: 'monster' },
        ],
        [{ name: 'TestHero', gridX: 1, gridY: 1 }]
      );
      getCombatContext.mockResolvedValue(cs);
      getCombatSummary.mockReturnValue(cs);
      rangeToFeet.mockReturnValue(10);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Nearby');
      expect(result.payload.creatureTargets).toContain('FarAway');
      expect(result.payload.creatureTargets).not.toContain('Goblin');
    });
  });
});

describe('multiTargetHandler.applyMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockReturnValue(Promise.resolve());
  });

  describe('early returns', () => {
    it('should return null when secondTargetName is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', '', null, null
      );

      expect(result).toBeNull();
    });

    it('should return null when secondTargetName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', null, null, null
      );

      expect(result).toBeNull();
    });

    it('should return null when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(null);

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result).toBeNull();
    });

    it('should return null when first target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Orc' }]));

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result).toBeNull();
    });

    it('should return null when second target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin' }]));

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result).toBeNull();
    });
  });

  describe('range validation', () => {
    function makeBaseCombatSummary() {
      return makeCombatSummary(
        [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
        ],
        [{ name: 'TestHero', gridX: 1, gridY: 1 }]
      );
    }

    it('should return out-of-range popup when first target is out of range', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValue(50);

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('out of range');
    });

    it('should return out-of-range popup when second target is out of range', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValueOnce(10).mockReturnValueOnce(50);

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });

    it('should skip range check when mapName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await applyMultiTarget(
        action, ps, campaignName, null,
        'Goblin', 'Orc', null, null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should skip range check when attackerPos is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: null });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should not check range when rangeFt is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(makeBaseCombatSummary());
      rangeToFeet.mockReturnValue(null);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', null, null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('damage application', () => {
    it('should apply damage to second target when spell has damage and rawDamage > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 20 };
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalledWith(
        cs, 'Orc', 20, ['cold'], campaignName, null, false, ps.name
      );
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(ps.name, campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Orc',
        delta: -10,
        currentHp: 5,
        maxHp: 22,
        isHealing: false,
        sourceName: ps.name,
        note: 'Cone of Cold (multi-target spread)',
      });
      expect(result.payload.description).toContain('Orc');
    });

    it('should skip damage application when rawDamage is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 0 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('should skip damage application when spell has no damage property', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = { name: 'Some Spell' };
      const metaCtx = { totalDamage: 20 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('should use action.payload.spellName when spell.name is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { spellName: 'Misty Step' },
      };
      const spell = { damage: { damage_type: 'fire' }, name: undefined };
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(result.payload.description).toContain('Misty Step');
    });

    it('should use rawDamage from metaCtx when totalDamage is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { rawDamage: 15 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object), 'Orc', 15, ['fire'], campaignName, null, false, ps.name
      );
    });

    it('should not apply damage when applyDamageToTarget returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue(null);

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Word of Creation',
        description: expect.stringContaining('Orc'),
      }));
    });

    it('should not call endInvisibility when finalDamage is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Fireball', 'fire');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 0 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('should use empty string for damageType when spell.damage exists but damage_type is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = { damage: {} };
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 5 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object), 'Orc', 10, [''], campaignName, null, false, ps.name
      );
    });
  });

  describe('power word heal application', () => {
    it('should apply healing when spellName is "power word heal"', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell({ maxHp: 30 });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 7 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Orc', 7, campaignName);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Orc',
        delta: 7,
        currentHp: 22,
        maxHp: 22,
        isHealing: true,
        sourceName: ps.name,
        note: 'Power Word Heal (multi-target spread)',
      });
    });

    it('should use getRuntimeValue for current HP when target.currentHp is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 18, actualHeal: 8 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'currentHitPoints', campaignName);
    });

    it('should use maxHp from playerStats when target has no maxHp and runtimeValue is null', async () => {
      const ps = makePlayerStats({ hitPoints: 25 });
      const action = makeAction();
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(null);
      applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 15 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Orc', 15, campaignName);
    });

    it('should skip healing when healAmount is 0 (target already full HP)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 22, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(22);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 0 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('should skip healing when applyHealingToTarget returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell();
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue(null);

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Word of Creation',
        description: expect.stringContaining('Orc'),
      }));
    });

    it('should remove conditions when spell has status_effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell({ status_effects: ['poisoned', 'blinded'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'blinded', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc', 'activeConditions', ['frightened'], campaignName
      );
    });

    it('should log condition removals', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell({ status_effects: ['poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: 'Orc',
        condition: 'Poisoned',
        reason: 'Power Word Heal (multi-target spread)',
        timestamp: expect.any(Number),
      });
    });

    it('should not set powerWordHealStandPermission when target has no prone condition', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell({ status_effects: ['poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['blinded', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      const setCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'powerWordHealStandPermission'
      );
      expect(setCalls).toHaveLength(0);
    });

    it('should handle status_effects with case-insensitive condition matching', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeHealSpell({ status_effects: ['Poisoned'] });
      const metaCtx = {};
      const cs = makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 }],
        []
      );
      getCombatContext.mockResolvedValue(cs);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc', 'activeConditions', ['frightened'], campaignName
      );
    });
  });

  describe('ability log entry', () => {
    it('should call addEntry with correct ability_use log', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 10 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: action.name,
        description: expect.stringContaining('Cone of Cold'),
        targetName: 'Orc',
        timestamp: expect.any(Number),
      });
    });

    it('should include spell name from payload when spell.name is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { spellName: 'Misty Step' },
      };
      const spell = { damage: { damage_type: 'force' }, name: undefined };
      const metaCtx = { totalDamage: 5 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 15, finalDamage: 5 });

      await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Misty Step'),
      }));
    });
  });

  describe('success popup', () => {
    it('should return automation_info popup on successful application', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('Cone of Cold');
      expect(result.payload.description).toContain('Orc');
    });

    it('should include range in success description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(result.payload.description).toContain('30 ft');
    });

    it('should use default range in description when automation.range is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: {},
        payload: { targetName: 'Goblin' },
      };
      const spell = makeDamageSpell('Cone of Cold', 'cold');
      const metaCtx = { totalDamage: 10 };
      getCombatContext.mockResolvedValue(makeCombatSummary(
        [{ name: 'Goblin', type: 'monster' }, { name: 'Orc', type: 'monster' }], []
      ));
      applyDamageToTarget.mockReturnValue({ newHp: 5, finalDamage: 5 });

      const result = await applyMultiTarget(
        action, ps, campaignName, mapName,
        'Goblin', 'Orc', spell, metaCtx
      );

      expect(result.payload.description).toContain('10 ft');
    });
  });
});
