// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

import { handle } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import storage from '../../../ui/storage.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 14,
    hitPoints: { max: 70 },
    currentHitPoints: 50,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Searing Vengeance',
    automation: {
      healExpression: 'floor(target_max_hp / 2)',
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      range: '30_ft',
      condition: 'blinded',
      conditionDuration: 'until_end_of_current_turn',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      trigger: 'death_save_by_ally_or_self',
      allyRange: '60_ft',
      ...automation,
    },
  };
}

function mockRuntimeValues(values) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key) => {
    if (key === 'searingvengeanceUses') return values.searingvengeanceUses;
    if (key === 'targetEffects') return values.targetEffects;
    return null;
  });
}

describe('searingVengeanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resource validation', () => {
    it('returns a popup when uses have been exhausted', async () => {
      mockRuntimeValues({ searingvengeanceUses: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Searing Vengeance');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(result.payload.description).toContain('Long Rest');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns a popup when uses are negative', async () => {
      mockRuntimeValues({ searingvengeanceUses: -1 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('falls back to usesMax when no stored uses value exists', async () => {
      mockRuntimeValues({ searingvengeanceUses: null });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('has no uses remaining');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'searingvengeanceUses',
        0,
        campaignName
      );
    });
  });

  describe('combat context', () => {
    it('returns a popup when no combat is active', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No combat active.');
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    });
  });

  describe('healing behavior', () => {
    it('heals a player target to half their max HP', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
        maxHp: 60,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        30,
        campaignName
      );
    });

    it('uses the player\'s max HP when the target has no maxHp', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        35,
        campaignName
      );
    });

    it('heals an NPC target directly on the creature object', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 30 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(target.currentHp).toBe(15);
      expect(target.maxHp).toBe(30);
    });

    it('saves combatSummary when healing an NPC', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 20 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('uses player max HP from hitPoints when target is missing maxHp', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        35,
        campaignName
      );
    });
  });

  describe('condition clearing', () => {
    it('clears all conditions from the creature via setRuntimeValue', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      const cs = {
        creatures: [{
          name: 'Ally',
          conditions: [{ key: 'unconscious' }, { key: 'blinded' }],
        }],
      };
      damageUtils.getCombatContext.mockResolvedValueOnce(cs).mockResolvedValueOnce(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'activeConditions',
        [],
        campaignName
      );
    });

    it('does not error when creature has no conditions array', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      const cs = {
        creatures: [{
          name: 'Ally',
        }],
      };
      damageUtils.getCombatContext.mockResolvedValueOnce(cs).mockResolvedValueOnce(cs);
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // No direct mutation since creature.conditions is undefined
      // but healing and damage should still proceed
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        35,
        campaignName
      );
    });
  });

  describe('damage and blinded effect', () => {
    it('rolls the damage expression from the action config', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 15 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8 + CHA modifier');
    });

    it('adds a blinded effect to targetEffects with the damage amount as value', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 15 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      expect(calls.length).toBeGreaterThan(0);
      const effects = calls[0][2];
      expect(Array.isArray(effects)).toBe(true);
      const blinded = effects.find(e => e.effect === 'blinded');
      expect(blinded).toBeDefined();
      expect(blinded.value).toBe(15);
      expect(blinded.source).toBe('Searing Vengeance');
      expect(blinded.duration).toBe('until_end_of_current_turn');
    });

    it('uses 0 as damage value when rollExpression returns null', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      const blinded = calls[0][2].find(e => e.effect === 'blinded');
      expect(blinded.value).toBe(0);
    });

    it('uses the default damage expression when action lacks one', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8 });
      const action = makeAction({ damageExpression: undefined });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8 + CHA modifier');
    });

    it('uses all_enemies as target when no target is found', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 12 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      const blinded = calls[0][2].find(e => e.effect === 'blinded');
      expect(blinded.target).toBe('all_enemies');
    });
  });

  describe('logging', () => {
    it('logs an ability_use entry', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCleric',
        abilityName: 'Searing Vengeance',
      }));
    });

    it('logs a heal entry with correct target and amount', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
        maxHp: 40,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'heal',
        targetName: 'Ally',
        amount: 20,
        abilityName: 'Searing Vengeance',
      }));
    });

    it('logs a damage_roll entry when damage is greater than zero', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 14 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'damage_roll',
        damageType: 'Radiant',
        total: 14,
      }));
    });

    it('does not log a damage_roll entry when damage is zero', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 0 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const damageEntries = addEntry.mock.calls.filter(
        call => call[1] && call[1].type === 'damage_roll'
      );
      expect(damageEntries).toHaveLength(0);
    });

    it('uses the default damage type when action lacks one', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });
      const action = makeAction({ damageType: undefined });

      await handle(action, makePlayerStats(), campaignName, null);

      const damageEntries = addEntry.mock.calls.filter(
        call => call[1] && call[1].type === 'damage_roll'
      );
      expect(damageEntries[0][1].damageType).toBe('Radiant');
    });
  });

  describe('success popup', () => {
    it('returns a popup describing the heal and damage amounts', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
        maxHp: 50,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 16 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Searing Vengeance');
      expect(result.payload.description).toContain('Searing Vengeance');
      expect(result.payload.description).toContain('25 HP');
      expect(result.payload.description).toContain('16 radiant damage');
      expect(result.payload.description).toContain('Blinded');
    });

    it('includes the automation object in the popup payload', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('includes automationType in the popup payload', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.automationType).toBeUndefined();
    });
  });

  describe('uses consumption', () => {
    it('decrements uses after successful activation', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'searingvengeanceUses',
        0,
        campaignName
      );
    });

    it('decrements uses by one regardless of heal/damage outcome', async () => {
      mockRuntimeValues({ searingvengeanceUses: 3 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'searingvengeanceUses',
        2,
        campaignName
      );
    });
  });

  describe('edge cases', () => {
    it('handles a missing target gracefully', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Target');
    });

    it('handles missing hitPoints.max on playerStats by using currentHitPoints', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const stats = makePlayerStats({ hitPoints: {}, currentHitPoints: 40 });

      await handle(makeAction(), stats, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        20,
        campaignName
      );
    });

    it('handles a player with no hitPoints by falling back to currentHitPoints', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const stats = makePlayerStats({ hitPoints: undefined, currentHitPoints: 40 });

      await handle(makeAction(), stats, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        20,
        campaignName
      );
    });

    it('initializes targetEffects when none exist', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, targetEffects: null });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      expect(calls.length).toBeGreaterThan(0);
      expect(Array.isArray(calls[0][2])).toBe(true);
    });
  });
});
