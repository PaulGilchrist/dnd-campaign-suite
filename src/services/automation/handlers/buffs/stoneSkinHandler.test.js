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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle, applyStoneSkin, isStoneSkinActive, getStoneSkinDamageTypes } from './stoneSkinHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ───────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return { name: 'TestWizard', ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Stone Skin',
    automation: {
      type: 'protection_from_energy',
      damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
      target: 'willing_creature',
      duration: 'Concentration, up to 1 hour',
      casting_time: '1 action',
      ...automation,
    },
  };
}

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear();
  useRuntimeState.setRuntimeValue.mockClear();
  expirations.addExpiration.mockClear();
  logService.addEntry.mockClear();
  damageUtils.getCombatContext.mockClear();
}

// ── Tests ─────────────────────────────────────────────────────────

describe('stoneSkinHandler', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('handle', () => {
    it('returns info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('returns target selection popup when combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1' },
          { name: 'Ally2' },
          { name: 'TestWizard' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('stoneSkin_target_selection');
      expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2']);
    });

    it('filters out the caster from creature targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestWizard' },
          { name: 'Goblin' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats({ name: 'TestWizard' }), campaignName, 'TestMap');

      expect(result.payload.creatureTargets).toEqual(['Goblin']);
    });

    it('returns empty creatureTargets when only the caster is present', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestWizard' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'TestMap');

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('throws when combat context has no creatures array', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});

      await expect(handle(makeAction(), makePlayerStats(), campaignName, 'TestMap')).rejects.toThrow();
    });
  });

  describe('applyStoneSkin', () => {
    it('returns null when target is null', async () => {
      const result = await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, null);
      expect(result).toBeNull();
    });

    it('returns null when target is undefined', async () => {
      const result = await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, undefined);
      expect(result).toBeNull();
    });

    it('applies resistance buff to target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      const result = await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, 'Ally1');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Resistance to Bludgeoning, Piercing, and Slashing damage');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Stone Skin',
            effect: 'damage_resistance',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            sourceCharacter: 'TestWizard',
          }),
        ]),
        campaignName,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'Ally1',
        expect.any(Array),
        campaignName,
      );

      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('replaces existing Stone Skin buff with updated damage types', async () => {
      const existingBuff = {
        name: 'Stone Skin',
        effect: 'damage_resistance',
        resistanceTypes: ['Bludgeoning'],
      };
      useRuntimeState.getRuntimeValue.mockReturnValue([existingBuff]);

      await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, 'Ally1');

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
      const stoneSkinBuffs = buffsArg.filter((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuffs).toHaveLength(1);
      expect(stoneSkinBuffs[0].resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('preserves other buffs when replacing Stone Skin', async () => {
      const existingStoneSkin = {
        name: 'Stone Skin',
        effect: 'damage_resistance',
        resistanceTypes: ['Bludgeoning'],
      };
      const otherBuff = {
        name: 'Mage Armor',
        effect: 'ac_bonus',
        acValue: 12,
      };
      useRuntimeState.getRuntimeValue.mockReturnValue([existingStoneSkin, otherBuff]);

      await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, 'Ally1');

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
      expect(buffsArg).toHaveLength(2);
      expect(buffsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Mage Armor' }),
          expect.objectContaining({ name: 'Stone Skin', resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }),
        ]),
      );
    });

    it('stores damage types in runtime state', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, 'Ally1');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'stoneSkinDamageTypes',
        ['Bludgeoning', 'Piercing', 'Slashing'],
        campaignName,
      );
    });

    it('uses default damage types when automation does not specify them', async () => {
      const action = makeAction({ damageTypes: undefined });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await applyStoneSkin(action, makePlayerStats(), campaignName, 'Ally1');

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
      const stoneSkinBuff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuff.resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('uses custom duration from automation', async () => {
      const action = makeAction({ duration: '1 minute' });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await applyStoneSkin(action, makePlayerStats(), campaignName, 'Ally1');

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
      const stoneSkinBuff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuff.duration).toBe('1 minute');
    });

    it('uses the action name in the buff and log entry', async () => {
      const action = {
        name: 'Custom Stone Skin',
        automation: makeAction().automation,
      };
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await applyStoneSkin(action, makePlayerStats(), campaignName, 'Ally1');

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
      const stoneSkinBuff = buffsArg.find((b) => b.name === 'Custom Stone Skin');
      expect(stoneSkinBuff).toBeDefined();

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          abilityName: 'Custom Stone Skin',
        }),
      );
    });

    it('includes target name in the log entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await applyStoneSkin(makeAction(), makePlayerStats(), campaignName, 'Goblin');

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          description: expect.stringContaining('Goblin'),
        }),
      );
    });
  });

  describe('isStoneSkinActive', () => {
    it('returns true when Stone Skin buff with damage_resistance exists', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Stone Skin', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(true);
    });

    it('returns false when buff has wrong name', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when buff has wrong effect', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Stone Skin', effect: 'ac_bonus' },
      ]);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is not an array', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('not-an-array');

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(false);
    });

    it('returns true when multiple buffs include Stone Skin', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Mage Armor', effect: 'ac_bonus' },
        { name: 'Stone Skin', effect: 'damage_resistance' },
        { name: 'Shield', effect: 'ac_bonus' },
      ]);

      expect(isStoneSkinActive('Ally1', campaignName)).toBe(true);
    });
  });

  describe('getStoneSkinDamageTypes', () => {
    it('returns the stored damage types', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['Bludgeoning', 'Piercing', 'Slashing']);

      expect(getStoneSkinDamageTypes('Ally1', campaignName)).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('returns undefined when nothing is stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(getStoneSkinDamageTypes('Ally1', campaignName)).toBeUndefined();
    });

    it('returns undefined when activeBuffs exists but stoneSkinDamageTypes does not', () => {
      // When getRuntimeValue is called with the stoneSkinKey, it returns undefined
      // because only activeBuffs were set
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);

      expect(getStoneSkinDamageTypes('Ally1', campaignName)).toBeUndefined();
    });
  });
});
