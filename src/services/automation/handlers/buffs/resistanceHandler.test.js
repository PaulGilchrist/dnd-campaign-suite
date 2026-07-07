// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import {
  handle,
  applyResistance,
  getResistanceDamageType,
  isResistanceUsedThisTurn,
  setResistanceUsedThisTurn,
} from './resistanceHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Cleric',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Resistance',
    automation: {
      type: 'damage_reduction',
      reductionExpression: '1d4',
      damageTypes: [],
      trigger: 'damage_taken_of_chosen_resistance_type',
      casting_time: '1 action',
      ...automation,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('resistanceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup when combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('resistance_target_selection');
      expect(result.payload.name).toBe('Resistance');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.damageTypes).toEqual([
        'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
        'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder',
      ]);
    });

    it('filters out the caster from creature targets', async () => {
      const ps = makePlayerStats({ name: 'Cleric' });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Cleric', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual(['Goblin']);
    });

    it('returns error popup when no combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Resistance');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain('Resistance');
    });

    it('returns empty creatureTargets when caster is the only creature', async () => {
      const ps = makePlayerStats({ name: 'Cleric' });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Cleric', type: 'player' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('applyResistance', () => {
    it('applies damage reduction buff to target with chosen damage type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Fire');
      expect(result.payload.description).toContain('1d4');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Resistance',
            effect: 'damage_reduction',
            resistanceTypes: ['Fire'],
            sourceCharacter: 'Cleric',
          }),
        ]),
        campaignName
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceChosenDamageType',
        'Fire',
        campaignName
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        false,
        campaignName
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Cleric',
        'Goblin',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Resistance',
          }),
        ]),
        campaignName
      );
    });

    it('returns null when targetName is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        campaignName,
        null,
        'fire'
      );

      expect(result).toBeNull();
    });

    it('returns null when chosenDamageType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        null
      );

      expect(result).toBeNull();
    });

    it('replaces existing Resistance buff instead of appending', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resistance', effect: 'damage_reduction', resistanceTypes: ['Acid'] },
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
      ]);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'cold'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs.filter((b) => b.name === 'Resistance')).toHaveLength(1);
      expect(buffs.find((b) => b.name === 'Resistance').resistanceTypes).toEqual(['Cold']);
      expect(buffs.find((b) => b.name === 'Shield of Faith')).toBeTruthy();
    });

    it('uses duration from automation when provided, default otherwise', async () => {
      const ps = makePlayerStats();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      // With custom duration
      await applyResistance(
        makeAction({ duration: 'Concentration, up to 10 minutes' }),
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      let callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      let buffs = callArgs[2];
      let resistanceBuff = buffs.find((b) => b.name === 'Resistance');

      expect(resistanceBuff.duration).toBe('Concentration, up to 10 minutes');

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      // With default duration
      await applyResistance(
        makeAction({ duration: undefined }),
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      buffs = callArgs[2];
      resistanceBuff = buffs.find((b) => b.name === 'Resistance');

      expect(resistanceBuff.duration).toBe('Concentration, up to 1 minute');
    });

    it('calls addEntry with the correct log payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Cleric',
        abilityName: 'Resistance',
        description: expect.stringContaining('Cleric cast Resistance on Goblin for Fire resistance'),
        targetName: 'Goblin',
        timestamp: expect.any(Number),
      });
    });

    it('appends Resistance when no existing buffs array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs).toHaveLength(1);
      expect(buffs[0].name).toBe('Resistance');
    });

    it('uses playerStats.name as sourceCharacter in buff', async () => {
      const ps = makePlayerStats({ name: 'Paladin' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs[0].sourceCharacter).toBe('Paladin');
    });
  });

  describe('getResistanceDamageType', () => {
    it('returns stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getResistanceDamageType('Goblin', campaignName)).toBe('Fire');
    });
  });

  describe('isResistanceUsedThisTurn', () => {
    it('returns true when flag is true, false otherwise', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(true);
      expect(isResistanceUsedThisTurn('Goblin', campaignName)).toBe(true);

      useRuntimeState.getRuntimeValue.mockReturnValue(false);
      expect(isResistanceUsedThisTurn('Goblin', campaignName)).toBe(false);
    });
  });

  describe('setResistanceUsedThisTurn', () => {
    it('sets the flag', async () => {
      await setResistanceUsedThisTurn('Goblin', true, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        true,
        campaignName
      );
    });
  });
});
