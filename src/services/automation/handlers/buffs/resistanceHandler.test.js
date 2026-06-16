import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

// ── Imports (Vite returns mocked versions) ───────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────

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
  function resetMocks() {
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
    expirations.addExpiration.mockClear();
    logService.addEntry.mockClear().mockResolvedValue(undefined);
    damageUtils.getCombatContext.mockClear();
  }

  beforeEach(() => {
    resetMocks();
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

    it('returns error popup when no combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
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

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
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

    it('normalizes damage type capitalization', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'lightning'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceChosenDamageType',
        'Lightning',
        campaignName
      );
    });

    it('returns null when no target or damage type', async () => {
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

    it('updates existing buff when already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Resistance', effect: 'damage_reduction', resistanceTypes: ['Acid'] },
      ]);

      await applyResistance(
        action,
        ps,
        campaignName,
        'Goblin',
        'cold'
      );

      // Should replace the existing Resistance buff
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            resistanceTypes: ['Cold'],
          }),
        ]),
        campaignName
      );
    });
  });

  describe('getResistanceDamageType', () => {
    it('returns stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getResistanceDamageType('Goblin', campaignName)).toBe('Fire');
    });

    it('returns null when no damage type stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(getResistanceDamageType('Goblin', campaignName)).toBeNull();
    });
  });

  describe('isResistanceUsedThisTurn', () => {
    it('returns true when used this turn', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(true);

      expect(isResistanceUsedThisTurn('Goblin', campaignName)).toBe(true);
    });

    it('returns false when not used this turn', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(false);

      expect(isResistanceUsedThisTurn('Goblin', campaignName)).toBe(false);
    });

    it('returns false when not set', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(isResistanceUsedThisTurn('Goblin', campaignName)).toBe(false);
    });
  });

  describe('setResistanceUsedThisTurn', () => {
    it('sets the used flag', async () => {
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
