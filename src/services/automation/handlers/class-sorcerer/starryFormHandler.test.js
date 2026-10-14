import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyConstellationOption } from './starryFormHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';

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

  describe('handle - always shows modal', () => {
    it('should open constellation modal without consuming Wild Shape when starry form is already active and player is level 10+', async () => {
      const existingBuffs = [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'activeBuffs') return existingBuffs;
        if (key === 'targetEffects') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should consume Wild Shape when starry form is already active but player is below level 10', async () => {
      const existingBuffs = [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'activeBuffs') return existingBuffs;
        if (key === 'targetEffects') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats({ level: 5 }), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should consume Wild Shape when starry form is not active even at level 10+', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should open constellation modal with other buffs present', async () => {
      const existingBuffs = [
        { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' },
        { name: 'Mage Armor', effect: 'mage_armor' },
      ];
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'activeBuffs') return existingBuffs;
        if (key === 'targetEffects') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handle - uses exhausted', () => {
    it('should return no uses remaining when usesMax > 0 and current uses is zero', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'wildShapeUses') return 0;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return no uses remaining when wildShapeUses is zero regardless of resourceKey', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'wildShapeUses') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ resourceKey: 'starryFormUses', uses: 5 }),
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
        if (key === 'wildShapeUses') return 2;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should always use wildShapeUses even when a custom resourceKey is present', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ resourceKey: 'starryFormUses', uses: 5 }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'wildShapeUses',
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
        'wildShapeUses',
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

    it('should replace existing Starry Form buff when one already exists', async () => {
      const existingBuffs = [
        { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' },
        { name: 'Mage Armor', effect: 'mage_armor' },
      ];
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        if (key === 'targetEffects') return [];
        return null;
      });

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Chalice',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Chalice');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'starry_form', constellation: 'Chalice' }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ constellation: 'Archer' }),
        ]),
        campaignName,
      );
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

    it('should apply Archer buff with 1d8 at low levels', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 5 });

      const result = await applyConstellationOption(
        makeAction(),
        lowLevelStats,
        campaignName,
        'Archer',
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).not.toContain('2d8');
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
