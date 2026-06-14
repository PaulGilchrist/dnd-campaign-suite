import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle, applyProtectionFromEnergy, isProtectionFromEnergyActive, getProtectionFromEnergyDamageType } from './protectionFromEnergyHandler.js';

import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as expirations from '../../rules/expirations.js';
import * as logService from '../../ui/logService.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';

// ── Helpers ───────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Wizard',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Protection from Energy',
    automation: {
      type: 'protection_from_energy',
      damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
      ...automation,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('protectionFromEnergyHandler', () => {
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
      expect(result.payload.type).toBe('protectionFromEnergy_target_selection');
      expect(result.payload.name).toBe('Protection from Energy');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
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
      const ps = makePlayerStats({ name: 'Wizard' });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Wizard', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual(['Goblin']);
    });
  });

  describe('applyProtectionFromEnergy', () => {
    it('applies resistance buff to target with chosen damage type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Resistance to Fire damage');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Protection from Energy',
            effect: 'damage_resistance',
            resistanceTypes: ['Fire'],
          }),
        ]),
        campaignName
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Wizard',
        'Goblin',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Protection from Energy',
          }),
        ]),
        campaignName
      );
    });

    it('normalizes damage type capitalization', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        'lightning'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        expect.any(String),
        'Lightning',
        campaignName
      );
    });

    it('returns null when no target or damage type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEnergy(
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
        { name: 'Protection from Energy', effect: 'damage_resistance', resistanceTypes: ['Acid'] },
      ]);

      await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        'cold'
      );

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

  describe('isProtectionFromEnergyActive', () => {
    it('returns true when buff is active', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isProtectionFromEnergyActive('Goblin', campaignName)).toBe(true);
    });

    it('returns false when buff is not active', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      expect(isProtectionFromEnergyActive('Goblin', campaignName)).toBe(false);
    });
  });

  describe('getProtectionFromEnergyDamageType', () => {
    it('returns stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getProtectionFromEnergyDamageType('Goblin', campaignName)).toBe('Fire');
    });

    it('returns null when no damage type stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(getProtectionFromEnergyDamageType('Goblin', campaignName)).toBeNull();
    });
  });
});
