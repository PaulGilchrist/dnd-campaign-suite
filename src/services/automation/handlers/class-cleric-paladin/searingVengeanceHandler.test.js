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

    it('falls back to player max HP when target has no maxHp', async () => {
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

    it('persists NPC healing to combatSummary storage', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 20 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });
  });

  describe('condition clearing', () => {
    it('clears all conditions from the creature', async () => {
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
        'activeConditions',
        [],
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

    it('returns a popup when no target is found', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Target');
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
        type: 'hp_change',
        targetName: 'Ally',
        isHealing: true,
      }));
    });

    it('logs a roll entry with damage details when damage is greater than zero', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 14 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'roll',
        rollType: 'damage',
        damageType: 'Radiant',
        total: 14,
      }));
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
        call => call[1] && call[1].type === 'roll' && call[1].rollType === 'damage'
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
  });

  describe('edge cases', () => {
    it('handles missing hitPoints.max by using currentHitPoints', async () => {
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
  });
});
