// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

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

// ── Imports (Vite returns mocked versions) ───────────────────────

import {
  handle,
  applyProtectionFromEnergy,
  isProtectionFromEnergyActive,
  getProtectionFromEnergyDamageType,
} from './protectionFromEnergyHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

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

    it('returns empty creatureTargets when caster is the only creature', async () => {
      const ps = makePlayerStats({ name: 'Wizard' });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Wizard', type: 'player' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('passes action.automation through to popup payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('handles action with no automation property', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Protection from Energy' };
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.automation).toEqual({});
    });

    it('handles action with no automation.damageTypes', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Protection from Energy', automation: {} };
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'npc' }],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
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
            duration: 'Concentration, up to 1 hour',
            sourceCharacter: 'Wizard',
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
        'protectionFromEnergyDamageType',
        'Lightning',
        campaignName
      );
    });

    it('returns null when targetName is missing', async () => {
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

    it('returns null when chosenDamageType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        null
      );

      expect(result).toBeNull();
    });

    it('returns null when both targetName and chosenDamageType are missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('returns null when targetName is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        '',
        'fire'
      );

      expect(result).toBeNull();
    });

    it('returns null when chosenDamageType is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        ''
      );

      expect(result).toBeNull();
    });

    it('replaces existing buff instead of appending', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance', resistanceTypes: ['Acid'] },
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
      ]);

      await applyProtectionFromEnergy(
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

      expect(buffs.filter((b) => b.name === 'Protection from Energy')).toHaveLength(1);
      expect(buffs.find((b) => b.name === 'Protection from Energy').resistanceTypes).toEqual(['Cold']);
      expect(buffs.find((b) => b.name === 'Shield of Faith')).toBeTruthy();
    });

    it('uses default duration when automation has no duration', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: undefined });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyProtectionFromEnergy(
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
      const buff = buffs.find((b) => b.name === 'Protection from Energy');

      expect(buff.duration).toBe('Concentration, up to 1 hour');
    });

    it('uses custom duration from automation when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: 'Concentration, up to 10 minutes' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyProtectionFromEnergy(
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
      const buff = buffs.find((b) => b.name === 'Protection from Energy');

      expect(buff.duration).toBe('Concentration, up to 10 minutes');
    });

    it('calls addEntry with the correct log payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        'fire'
      );

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Wizard',
        abilityName: 'Protection from Energy',
        description: 'Wizard cast Protection from Energy on Goblin for Fire resistance.',
        targetName: 'Goblin',
        timestamp: expect.any(Number),
      });
    });

    it('returns popup with target and damage type in description', async () => {
      const ps = makePlayerStats({ name: 'Paladin' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        campaignName,
        'Goblin',
        'cold'
      );

      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('Cold');
    });

    it('returns popup with automationType in description', async () => {
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

      expect(result.payload.automationType).toBe('protection_from_energy');
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

    it('returns false when stored value is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(isProtectionFromEnergyActive('Goblin', campaignName)).toBe(false);
    });

    it('returns false when stored value is not an array', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('not-an-array');

      expect(isProtectionFromEnergyActive('Goblin', campaignName)).toBe(false);
    });

    it('returns false when buff has wrong effect type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'something_else' },
      ]);

      expect(isProtectionFromEnergyActive('Goblin', campaignName)).toBe(false);
    });

    it('returns false when buff has wrong name', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'damage_resistance' },
      ]);

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
