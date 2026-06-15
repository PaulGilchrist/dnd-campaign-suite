import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyMultiTarget } from './multiTargetHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { postLogEntry } from '../../../shared/logPoster.js';

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

const baseCombatSummary = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'Ally', type: 'player', currentHp: 20, maxHp: 30 },
  ],
  players: [
    { name: 'TestHero', gridX: 5, gridY: 10 },
    { name: 'Ally', gridX: 8, gridY: 12 },
  ],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('multiTargetHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should return popup when first target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No first target found');
    });

    it('should return popup when action.payload has no targetName', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      // No payload.targetName

      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('multi_target_selection');
      expect(result.payload.name).toBe('Word of Creation');
      expect(result.payload.firstTargetName).toBe('Goblin');
      expect(Array.isArray(result.payload.creatureTargets)).toBe(true);
      expect(result.payload.range).toBe('30 ft');
    });

    it('should exclude the first target from creatureTargets', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      getCombatSummary.mockReturnValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).not.toContain('Goblin');
      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
    });

    it('should use default feature name when action.name is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };

      getCombatContext.mockResolvedValue(baseCombatSummary);
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

      getCombatContext.mockResolvedValue(baseCombatSummary);
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

      getCombatContext.mockResolvedValue(baseCombatSummary);
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

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(10);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.range).toBe('10 ft');
    });

    it('should include spellFilter in payload from automation', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft', spellFilter: ['evocation', 'conjuration'] },
        payload: { targetName: 'Goblin' },
      };

      getCombatContext.mockResolvedValue(baseCombatSummary);
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

      getCombatContext.mockResolvedValue(baseCombatSummary);
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

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
          { name: 'Ally', type: 'player', currentHp: 20, maxHp: 30 },
        ],
        players: [
          { name: 'TestHero', gridX: 1, gridY: 1 },
          { name: 'Ally', gridX: 3, gridY: 3 },
        ],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getCombatSummary.mockReturnValue(combatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValue(10); // within range

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Ally');
    });

    it('should include all creatures when attackerPos is null but range is specified', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: { range: '30 ft' },
        payload: { targetName: 'Goblin' },
      };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      getCombatSummary.mockReturnValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
    });

    it('should include all creatures when withinRangeFt is null', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Word of Creation',
        automation: {},
        payload: { targetName: 'Goblin' },
      };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      getCombatSummary.mockReturnValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(null);
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.creatureTargets).toContain('Orc');
      expect(result.payload.creatureTargets).toContain('Ally');
    });
  });
});

describe('multiTargetHandler.applyMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('should return null when secondTargetName is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        '',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should return null when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should return null when first target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Orc' }] });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should return null when second target not found in combat summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).toBeNull();
    });
  });

  describe('range validation', () => {
    it('should return out-of-range popup when first target is out of range', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValue(50); // out of range

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('out of range');
    });

    it('should return out-of-range popup when second target is out of range', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });
      getDistanceFeet.mockReturnValueOnce(10).mockReturnValueOnce(50); // first in range, second out

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });

    it('should skip range check when mapName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue(null);

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        null,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).not.toBeNull();
      expect(result.payload.type).toBe('automation_info');
    });

    it('should skip range check when attackerPos is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(30);
      resolveMapPositions.mockResolvedValue({ attackerPos: null });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).not.toBeNull();
    });

    it('should not check range when rangeFt is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatSummary);
      rangeToFeet.mockReturnValue(null);
      resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 1 } });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        null,
        null
      );

      expect(result).not.toBeNull();
    });
  });

  describe('damage application', () => {
    it('should apply damage to second target when spell has damage and rawDamage > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 20 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalledWith(
        baseCombatSummary,
        'Orc',
        20,
        ['cold'],
        campaignName,
        null,
        false,
        ps.name
      );
      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Orc',
        delta: 5 - baseCombatSummary.creatures[1].currentHp,
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
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 0 };

      getCombatContext.mockResolvedValue(baseCombatSummary);

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('should skip damage application when spell has no damage property', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = { name: 'Some Spell' };
      const metaCtx = { totalDamage: 20 };

      getCombatContext.mockResolvedValue(baseCombatSummary);

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('should use action.payload.spellName when spell.name is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = { damage: { damage_type: 'fire' } };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        { ...spell, name: undefined },
        metaCtx
      );

      // The spellName will be from action.payload.spellName or 'Unknown Spell'
      expect(result.payload.description).toContain('Unknown Spell');
    });

    it('should use rawDamage from metaCtx when totalDamage is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Fireball',
        damage: { damage_type: 'fire' },
      };
      const metaCtx = { rawDamage: 15 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalledWith(
        baseCombatSummary,
        'Orc',
        15,
        ['fire'],
        campaignName,
        null,
        false,
        ps.name
      );
    });

    it('should not apply damage when applyDamageToTarget returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Fireball',
        damage: { damage_type: 'fire' },
      };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue(null);

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(postLogEntry).not.toHaveBeenCalled();
    });
  });

  describe('power word heal application', () => {
    it('should apply healing when spellName is "power word heal"', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        maxHp: 30,
      };
      const metaCtx = {};

      getCombatContext.mockResolvedValue(baseCombatSummary);
      getRuntimeValue.mockReturnValue(15); // current HP of Orc
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 7 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyHealingToTarget).toHaveBeenCalledWith(
        baseCombatSummary,
        'Orc',
        7,
        campaignName
      );
      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
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
      const spell = {
        name: 'Power Word Heal',
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 18, actualHeal: 4 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(getRuntimeValue).toHaveBeenCalledWith('Orc', 'currentHitPoints', campaignName);
    });

    it('should use maxHp from playerStats when target has no maxHp', async () => {
      const ps = makePlayerStats({ hitPoints: 25 });
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(null);
      applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 15 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyHealingToTarget).toHaveBeenCalledWith(
        combatSummary,
        'Orc',
        15,
        campaignName
      );
    });

    it('should skip healing when healAmount is 0 (target already full HP)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 22, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(22);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 0 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('should remove conditions when spell has status_effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        status_effects: ['poisoned', 'blinded'],
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'blinded', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['frightened'],
        campaignName
      );
    });

    it('should log condition removals', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        status_effects: ['poisoned'],
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: 'Orc',
        condition: 'Poisoned',
        reason: 'Power Word Heal (multi-target spread)',
        timestamp: expect.any(Number),
      });
    });

    it('should not call setRuntimeValue when no conditions are removed', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        status_effects: ['poisoned'],
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['frightened'];
        return null;
      });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should handle status_effects with lowercase type strings', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        status_effects: ['poisoned'],
      };
      const metaCtx = {};

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });
      getRuntimeValue.mockImplementation((targetName, key, _camp) => {
        if (key === 'activeConditions') return ['poisoned', 'frightened'];
        return null;
      });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['frightened'],
        campaignName
      );
    });
  });

  describe('ability log entry', () => {
    it('should call addEntry with correct ability_use log', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: action.name,
        description: `${ps.name} used ${action.name} to spread Cone of Cold to Orc.`,
        targetName: 'Orc',
        timestamp: expect.any(Number),
      });
    });

    it('should catch and suppress addEntry errors', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      addEntry.mockReturnValue(Promise.reject(new Error('log error')));

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(result).not.toBeNull();
    });
  });

  describe('success popup', () => {
    it('should return automation_info popup on successful application', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('Cone of Cold');
      expect(result.payload.description).toContain('Orc');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should include range in success description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Cone of Cold',
        damage: { damage_type: 'cold' },
      };
      const metaCtx = { totalDamage: 10 };

      getCombatContext.mockResolvedValue(baseCombatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });

      const result = await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(result.payload.description).toContain('30 ft');
    });
  });

  describe('damage/heal interaction', () => {
    it('should apply both damage and power word heal effects when applicable', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const spell = {
        name: 'Power Word Heal',
        damage: { damage_type: 'force' },
        status_effects: ['poisoned'],
      };
      const metaCtx = { totalDamage: 5 };

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'Orc', type: 'monster', currentHp: 10, maxHp: 22 },
        ],
        players: [],
        placedItems: [],
      };

      getCombatContext.mockResolvedValue(combatSummary);
      applyDamageToTarget.mockReturnValue({ newHp: 5 });
      getRuntimeValue.mockReturnValue(10);
      applyHealingToTarget.mockReturnValue({ newHp: 22, actualHeal: 12 });

      await applyMultiTarget(
        action,
        ps,
        campaignName,
        mapName,
        'Goblin',
        'Orc',
        spell,
        metaCtx
      );

      expect(applyDamageToTarget).toHaveBeenCalled();
      expect(applyHealingToTarget).toHaveBeenCalled();
    });
  });
});
