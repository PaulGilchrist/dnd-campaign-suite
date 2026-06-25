// @improved-by-ai
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

function makeActionWithNoUses() {
  return {
    name: 'Starry Form',
    automation: { type: 'starry_form', uses: 0, duration: '1_minute' },
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
      expect(result.payload.name).toBe('Starry Form');
      expect(result.payload.automationType).toBe('starry_form');
      expect(result.payload.description).toBe('Starry Form ended');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        [],
        campaignName,
      );
    });

    it('should not remove other buffs when ending starry form', async () => {
      const existingBuffs = [
        { name: 'Starry Form', effect: 'starry_form' },
        { name: 'Mage Armor', effect: 'mage_armor' },
      ];
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return existingBuffs;
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('Starry Form ended');
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
      expect(result.payload.campaignName).toBe(campaignName);
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

    it('should use usesMax fallback when current uses is null', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'starryFormUses') return null;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      // null falls back to usesMax (2) via ?? operator, so it proceeds to modal
      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'starryFormUses',
        1,
        campaignName,
      );
    });

    it('should return no uses remaining when using a custom resource key that is zero', async () => {
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

      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return no uses remaining when custom resource key is explicitly zero', async () => {
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

    it('should decrement to zero when one use remains', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'starryFormUses') return 1;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'starryFormUses',
        0,
        campaignName,
      );
    });
  });

  describe('handle - uses: 0 means unlimited resource check', () => {
    it('should check resource value when uses is 0 (unlimited use)', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 1;
      });

      const result = await handle(makeActionWithNoUses(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'starryFormUses',
        0,
        campaignName,
      );
    });

    it('should block when resource is zero and uses is 0 (unlimited use)', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 0;
      });

      const result = await handle(makeActionWithNoUses(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('has no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use custom resourceKey when uses is 0', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'customResource') return 5;
        return null;
      });

      const result = await handle(
        makeAction({ uses: 0, resourceKey: 'customResource' }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.type).toBe('modal');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'customResource',
        4,
        campaignName,
      );
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

    it('should accept all valid constellation options', async () => {
      for (const option of ['Archer', 'Chalice']) {
        getRuntimeValue.mockReturnValue([]);

        const result = await applyConstellationOption(
          makeAction(),
          makePlayerStats(),
          campaignName,
          option,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestSorcerer',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({
              effect: 'starry_form',
              constellation: option,
            }),
          ]),
          campaignName,
        );
        vi.clearAllMocks();
      }

      // Dragon at level 10 gets fly_speed_20_hover effect instead of starry_form
      getRuntimeValue.mockReturnValue([]);
      const dragonResult = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Dragon',
      );
      expect(dragonResult.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'fly_speed_20_hover',
            constellation: 'Dragon',
          }),
        ]),
        campaignName,
      );
    });
  });

  describe('applyConstellationOption - Archer', () => {
    it('should apply Archer buff with 1d8 damage at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(
        makeAction(),
        lowLevelStats,
        campaignName,
        'Archer',
      );

      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('Wisdom Modifier Radiant damage');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ constellation: 'Archer' }),
        ]),
        campaignName,
      );
    });

    it('should apply Archer buff with 2d8 damage at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Archer',
      );

      expect(result.payload.description).toContain('2d8');
      expect(result.payload.description).toContain('Ranged Spell Attack');
    });
  });

  describe('applyConstellationOption - Chalice', () => {
    it('should apply Chalice buff with 1d8 healing at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(
        makeAction(),
        lowLevelStats,
        campaignName,
        'Chalice',
      );

      expect(result.payload.description).toContain('Chalice');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('Wisdom Modifier HP');
    });

    it('should apply Chalice buff with 2d8 healing at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Chalice',
      );

      expect(result.payload.description).toContain('2d8');
      expect(result.payload.description).toContain('Healing Spell Ally Buff');
    });
  });

  describe('applyConstellationOption - Dragon', () => {
    it('should apply Dragon concentration benefit at all levels', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 5 });

      const result = await applyConstellationOption(
        makeAction(),
        lowLevelStats,
        campaignName,
        'Dragon',
      );

      expect(result.payload.description).toContain('Dragon');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).not.toContain('Fly Speed');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'starry_form' }),
        ]),
        campaignName,
      );
    });

    it('should apply Dragon concentration benefit and fly speed at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Dragon',
      );

      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'fly_speed_20_hover',
            flySpeed: 20,
          }),
        ]),
        campaignName,
      );
    });
  });

  describe('applyConstellationOption - duration', () => {
    it('should use default duration from automation when not specified', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyConstellationOption(
        makeAction(),
        makePlayerStats(),
        campaignName,
        'Archer',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ duration: '1_minute' }),
        ]),
        campaignName,
      );
    });

    it('should preserve custom duration from automation', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyConstellationOption(
        makeAction({ duration: '10_minutes' }),
        makePlayerStats(),
        campaignName,
        'Chalice',
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ duration: '10_minutes' }),
        ]),
        campaignName,
      );
    });
  });
});
