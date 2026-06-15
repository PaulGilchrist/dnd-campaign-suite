import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import storage from '../../../ui/storage.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
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

// ── Tests ──────────────────────────────────────────────────────

describe('searingVengeanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Resource checks', () => {
    it('should return "no uses remaining" popup when uses is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('has no uses remaining');
    });

    it('should return "no uses remaining" popup when uses is negative', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(-1);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
    });

    it('should default to usesMax when stored value is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('no uses remaining');
    });
  });

  describe('Combat context checks', () => {
    it('should return "no combat" popup when getCombatContext returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
    });
  });

  describe('Healing logic', () => {
    it('should calculate heal amount as half target max HP', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
        maxHp: 60,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 18 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        30,
        campaignName
      );
    });

    it('should use player max HP as fallback when target has no maxHp', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 12 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'currentHitPoints',
        35,
        campaignName
      );
    });

    it('should decrement uses after successful activation', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'searingvengeanceUses',
        0,
        campaignName
      );
    });

    it('should clear conditions from target creature', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      let cs1 = {
        creatures: [{
          name: 'Ally',
          conditions: [{ key: 'unconscious' }, { key: 'blinded' }],
        }],
      };
      damageUtils.getCombatContext.mockResolvedValueOnce(cs1).mockResolvedValueOnce(cs1);
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Verify conditions were cleared on the creature object
      expect(cs1.creatures[0].conditions).toEqual([]);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs1, campaignName);
    });
  });

  describe('Damage and conditions', () => {
    it('should roll damage expression and apply blinded condition', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 15 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8 + CHA modifier');
      
      // Check that setRuntimeValue was called with targetEffects containing blinded
      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      const effectsCall = calls.find(c => c[1] === 'targetEffects');
      expect(effectsCall).toBeDefined();
      expect(effectsCall[2]).toContainEqual(
        expect.objectContaining({
          effect: 'blinded',
          source: 'Searing Vengeance',
        })
      );
    });

    it('should use default damage when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Check that setRuntimeValue was called with targetEffects containing blinded with value 0
      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      const effectsCall = calls.find(c => c[1] === 'targetEffects');
      expect(effectsCall).toBeDefined();
      expect(effectsCall[2]).toContainEqual(
        expect.objectContaining({
          value: 0,
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log ability_use entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestWarlock',
        abilityName: 'Searing Vengeance',
      }));
    });

    it('should log heal entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
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

    it('should log damage entry when damage > 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
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
  });

  describe('Success popup', () => {
    it('should return popup with correct description including heal and damage amounts', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
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
      expect(result.payload.description).toContain('Searing Vengeance');
      expect(result.payload.description).toContain('25 HP');
      expect(result.payload.description).toContain('16 radiant damage');
      expect(result.payload.description).toContain('Blinded');
    });
  });

  describe('NPC target handling', () => {
    it('should set currentHp directly for NPC targets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 30 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(target.currentHp).toBe(15);
      expect(target.maxHp).toBe(30);
    });

    it('should save combatSummary when healing NPC', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 20 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollExpression.mockReturnValue({ total: 10 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });
  });

  describe('Default values', () => {
    it('should handle minimal automation config', async () => {
      const minimalAction = makeAction({
        healExpression: '10',
        damageExpression: '1d8',
      });
      minimalAction.name = 'Searing Vengeance';

      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({
        name: 'Ally',
        type: 'player',
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5 });

      const result = await handle(minimalAction, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });
});
