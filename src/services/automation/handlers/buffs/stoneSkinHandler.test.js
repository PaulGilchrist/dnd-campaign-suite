import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyStoneSkin, isStoneSkinActive, getStoneSkinDamageTypes } from './stoneSkinHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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

const mockAction = {
  name: 'Stone Skin',
  automation: {
    type: 'protection_from_energy',
    damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
    target: 'willing_creature',
    duration: 'Concentration, up to 1 hour',
    casting_time: '1 action',
  },
};

const mockPlayerStats = { name: 'TestWizard' };
const mockCampaignName = 'TestCampaign';

describe('stoneSkinHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(mockAction, mockPlayerStats, mockCampaignName, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('returns target selection popup when combat context exists', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1' },
          { name: 'Ally2' },
          { name: 'TestWizard' },
        ],
      });

      const result = await handle(mockAction, mockPlayerStats, mockCampaignName, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('stoneSkin_target_selection');
      expect(result.payload.creatureTargets).toEqual(['Ally1', 'Ally2']);
    });
  });

  describe('applyStoneSkin', () => {
    it('returns null when no target', async () => {
      const result = await applyStoneSkin(mockAction, mockPlayerStats, mockCampaignName, null);
      expect(result).toBeNull();
    });

    it('applies resistance buff to target', async () => {
      getRuntimeValue.mockReturnValueOnce([]);

      const result = await applyStoneSkin(mockAction, mockPlayerStats, mockCampaignName, 'Ally1');

      expect(setRuntimeValue).toHaveBeenCalledWith(
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
        mockCampaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith('TestWizard', 'Ally1', expect.any(Array), mockCampaignName);
      expect(addEntry).toHaveBeenCalled();
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Resistance to Bludgeoning, Piercing, and Slashing damage');
    });

    it('replaces existing Stone Skin buff', async () => {
      const existingBuff = {
        name: 'Stone Skin',
        effect: 'damage_resistance',
        resistanceTypes: ['Bludgeoning'],
      };
      getRuntimeValue.mockReturnValueOnce([existingBuff]);

      await applyStoneSkin(mockAction, mockPlayerStats, mockCampaignName, 'Ally1');

      // Should have filtered out the old buff and added the new one
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        mockCampaignName,
      );
    });
  });

  describe('isStoneSkinActive', () => {
    it('returns true when Stone Skin buff exists', () => {
      getRuntimeValue.mockReturnValueOnce([
        { name: 'Stone Skin', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive('Ally1', mockCampaignName)).toBe(true);
    });

    it('returns false when Stone Skin buff does not exist', () => {
      getRuntimeValue.mockReturnValueOnce([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive('Ally1', mockCampaignName)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
      getRuntimeValue.mockReturnValueOnce([]);

      expect(isStoneSkinActive('Ally1', mockCampaignName)).toBe(false);
    });
  });

  describe('getStoneSkinDamageTypes', () => {
    it('returns the stored damage types', () => {
      getRuntimeValue.mockReturnValueOnce(['Bludgeoning', 'Piercing', 'Slashing']);

      expect(getStoneSkinDamageTypes('Ally1', mockCampaignName)).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('returns undefined when not set', () => {
      getRuntimeValue.mockReturnValueOnce(undefined);

      expect(getStoneSkinDamageTypes('Ally1', mockCampaignName)).toBeUndefined();
    });
  });
});
