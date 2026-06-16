import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { handle, applyConstellationOption } from './starryFormHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

describe('starryFormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buff toggle', () => {
    it('should end starry form when already active', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form' }]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Starry Form ended');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        [],
        campaignName,
      );
    });

    it('should activate starry form when not active', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        return 2;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('starryFormConstellation');
    });
  });

  describe('uses check', () => {
    it('should return no uses remaining when uses exhausted', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('has no uses remaining');
    });

    it('should decrement uses when available', async () => {
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

    it('should use custom resourceKey when provided', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'customResource') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ resourceKey: 'customResource', uses: 0 }),
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

    it('should return no uses when custom resource is zero', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(
        makeAction({ resourceKey: 'customResource', uses: 0 }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.payload.description).toContain('has no uses remaining');
    });

    it('should handle null resource value', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'customResource') return null;
        return null;
      });

      const result = await handle(makeAction({ uses: 0, resourceKey: 'customResource' }), makePlayerStats(), campaignName);

      // null resource means currentResource = 0, so it should return "no uses remaining"
      expect(result.payload.description).toContain('has no uses remaining');
    });
  });
});

describe('starryFormHandler.applyConstellationOption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for invalid constellation', async () => {
    const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Invalid');

    expect(result.payload.description).toContain('Invalid constellation');
  });

    it('should apply Archer constellation buff', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'starry_form',
            constellation: 'Archer',
          }),
        ]),
        campaignName,
      );
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('2d8');
    });

    it('should apply Chalice constellation buff', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      expect(result.payload.description).toContain('Chalice');
      expect(result.payload.description).toContain('2d8');
    });

    it('should apply Archer constellation with 1d8 at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(makeAction(), lowLevelStats, campaignName, 'Archer');

      expect(result.payload.description).toContain('1d8');
    });

    it('should apply Chalice constellation with 1d8 at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(makeAction(), lowLevelStats, campaignName, 'Chalice');

      expect(result.payload.description).toContain('1d8');
    });

    it('should apply Dragon constellation buff', async () => {
      getRuntimeValue.mockReturnValue([]);

      const dragonResult = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Dragon');

      expect(dragonResult.payload.description).toContain('Dragon');
      expect(dragonResult.payload.description).toContain('Concentration Benefit');
    });

  it('should apply fly speed for Dragon at level 10+', async () => {
    getRuntimeValue.mockReturnValue([]);
    const twinkleStats = makePlayerStats({ level: 10 });

    const result = await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Dragon');

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

  it('should use 2d8 damage dice for Archer at level 10+', async () => {
    getRuntimeValue.mockReturnValue([]);
    const twinkleStats = makePlayerStats({ level: 10 });

    const result = await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Archer');

    expect(result.payload.description).toContain('2d8');
  });

  it('should use 2d8 healing dice for Chalice at level 10+', async () => {
    getRuntimeValue.mockReturnValue([]);
    const twinkleStats = makePlayerStats({ level: 10 });

    const result = await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Chalice');

    expect(result.payload.description).toContain('2d8');
  });

    it('should use default duration from automation', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestSorcerer',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ duration: '1_minute' }),
      ]),
      campaignName,
    );
  });
});
