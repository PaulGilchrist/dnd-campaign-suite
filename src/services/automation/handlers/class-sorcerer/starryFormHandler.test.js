// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyConstellationOption } from './starryFormHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Starry Form',
    automation: { type: 'starry_form', uses: 2, duration: '1_minute', ...automation },
  };
}

describe('starryFormHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle - buff toggle', () => {
    it('should end starry form when already active and clear the buff', async () => {
      const existingBuffs = [{ name: 'Starry Form', effect: 'starry_form' }];
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Starry Form ended');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        [],
        campaignName,
      );
    });

    it('should preserve other buffs when ending starry form', async () => {
      const existingBuffs = [
        { name: 'Starry Form', effect: 'starry_form' },
        { name: 'Mage Armor', effect: 'mage_armor' },
      ];
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        [{ name: 'Mage Armor', effect: 'mage_armor' }],
        campaignName,
      );
    });

    it('should open constellation modal when starry form is not active', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(result.payload.action).toEqual(makeAction());
      expect(result.payload.playerStats).toEqual(makePlayerStats());
    });
  });

  describe('handle - uses exhausted', () => {
    it('should return no uses remaining when usesMax > 0 and current uses is zero', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'starryFormUses') return 0;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return no uses remaining when custom resource key is zero', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'customResource') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ resourceKey: 'customResource', uses: 5 }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handle - decrementing uses', () => {
    it('should decrement starryFormUses when available', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'starryFormUses') return 2;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'starryFormUses',
        1,
        campaignName,
      );
    });

    it('should decrement custom resource when available', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'customResource') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ resourceKey: 'customResource', uses: 5 }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'customResource',
        2,
        campaignName,
      );
    });
  });

  describe('handle - uses: 0 means unlimited resource check', () => {
    it('should decrement resource when uses is 0 and resource is available', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 1;
      });

      const result = await handle(
        {
          name: 'Starry Form',
          automation: { type: 'starry_form', uses: 0, duration: '1_minute' },
        },
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'starryFormUses',
        0,
        campaignName,
      );
    });

    it('should block when resource is zero and uses is 0', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 0;
      });

      const result = await handle(
        {
          name: 'Starry Form',
          automation: { type: 'starry_form', uses: 0, duration: '1_minute' },
        },
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('applyConstellationOption - validation', () => {
    it('should return error popup for invalid constellation name', async () => {
      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Invalid',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Invalid constellation');
      expect(result.payload.name).toBe('Starry Form');
      expect(result.payload.automationType).toBe('starry_form');
    });

    it('should apply Archer buff and decrement uses', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Archer',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('2d8');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'starry_form',
            constellation: 'Archer',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
    });

    it('should apply Chalice buff and decrement uses', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Chalice',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Chalice');
      expect(result.payload.description).toContain('2d8');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'starry_form',
            constellation: 'Chalice',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
    });

    it('should apply Dragon buff with concentration benefit at low levels', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 5 });

      const result = await applyConstellationOption(
        makeAction(),
        lowLevelStats,
        campaignName,
        'Dragon',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Dragon');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).not.toContain('Fly Speed');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'starry_form', resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }),
        ]),
        campaignName,
      );
    });

    it('should apply Dragon buff with fly speed at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Dragon',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'fly_speed_20_hover',
            flySpeed: 20,
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
          }),
        ]),
        campaignName,
      );
    });
  });
});
