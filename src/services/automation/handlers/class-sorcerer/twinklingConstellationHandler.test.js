// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { handle, applyConstellationOption } from './twinklingConstellationHandler.js';
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
    name: 'Twinkling Constellations',
    automation: { type: 'twinkling_constellation', ...automation },
  };
}

describe('twinklingConstellationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns automation_info popup when player is below level 10', async () => {
      const lowLevelStats = makePlayerStats({ level: 9 });
      const action = makeAction({ customField: 'test' });

      const result = await handle(action, lowLevelStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Twinkling Constellations');
      expect(result.payload.description).toBe('Twinkling Constellations requires level 10.');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('returns modal with action, playerStats, and campaignName when player is level 10+', async () => {
      const highLevelStats = makePlayerStats({ level: 15 });

      const result = await handle(makeAction(), highLevelStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('twinklingConstellation');
      expect(result.payload.action).toEqual(makeAction());
      expect(result.payload.playerStats).toEqual(highLevelStats);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('defaults level to 1 when not provided, triggering level gate', async () => {
      const noLevelStats = { name: 'TestSorcerer' };

      const result = await handle(makeAction(), noLevelStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Twinkling Constellations requires level 10.');
    });

    it('returns modal when player is level 10', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('twinklingConstellation');
    });
  });

  describe('applyConstellationOption', () => {
    it('returns error popup for invalid constellation names', async () => {
      const invalidNames = ['Invalid', null, ''];

      for (const name of invalidNames) {
        const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, name);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Twinkling Constellations');
        expect(result.payload.automationType).toBe('twinkling_constellation');
        expect(result.payload.description).toContain('Invalid constellation:');
        expect(result.payload.automation).toEqual(makeAction().automation);
      }
    });

    it('applies Archer constellation with correct dice based on level', async () => {
      getRuntimeValue.mockReturnValue([]);

      const level9Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Archer');
      expect(level9Result.payload.description).toContain('1d8');

      const level10Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Archer');
      expect(level10Result.payload.description).toContain('2d8');
      expect(level10Result.payload.description).toContain('Ranged Spell Attack');
      expect(level10Result.payload.description).toContain('Radiant damage');
    });

    it('applies Chalice constellation with correct dice based on level', async () => {
      getRuntimeValue.mockReturnValue([]);

      const level9Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Chalice');
      expect(level9Result.payload.description).toContain('1d8');
      expect(level9Result.payload.description).toContain('Healing Spell Ally Buff');

      const level10Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Chalice');
      expect(level10Result.payload.description).toContain('2d8');
      expect(level10Result.payload.description).toContain('within 30 feet');
    });

    it('applies Dragon constellation with correct effects based on level', async () => {
      getRuntimeValue.mockReturnValue([]);

      const level9Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 9 }), campaignName, 'Dragon');
      expect(level9Result.payload.description).toContain('Dragon');
      expect(level9Result.payload.description).toContain('Concentration Benefit');
      expect(level9Result.payload.description).not.toContain('Fly Speed');

      const level10Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 10 }), campaignName, 'Dragon');
      expect(level10Result.payload.description).toContain('Fly Speed 20 feet (hover)');

      const level15Result = await applyConstellationOption(makeAction(), makePlayerStats({ level: 15 }), campaignName, 'Dragon');
      expect(level15Result.payload.description).toContain('Fly Speed 20 feet (hover)');
    });

    it('sets activeBuffs via setRuntimeValue with correct buff entry', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Starry Form',
            effect: 'starry_form',
            constellation: 'Archer',
            duration: '1_minute',
            hasAutomation: true,
          }),
        ]),
        campaignName,
      );
    });

    it('sets fly speed buff entry for Dragon constellation at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);
      const twinkleStats = makePlayerStats({ level: 10 });

      await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Dragon');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Starry Form',
            effect: 'fly_speed_20_hover',
            flySpeed: 20,
            constellation: 'Dragon',
          }),
        ]),
        campaignName,
      );
    });

    it('removes existing Starry Form buff before adding new one', async () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' },
        { name: 'Other Buff', effect: 'other' },
      ]);

      await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Other Buff' }),
          expect.objectContaining({ constellation: 'Chalice' }),
        ]),
        campaignName,
      );
    });

    it('handles missing activeBuffs in runtime state gracefully', async () => {
      getRuntimeValue.mockReturnValue(null);

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Archer');
      expect(setRuntimeValue).toHaveBeenCalled();
    });

    it('handles non-array activeBuffs in runtime state gracefully', async () => {
      getRuntimeValue.mockReturnValue('not-an-array');

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Chalice');

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalled();
    });

    it('includes automation in popup payload', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('defaults level to 1 for damage dice calculation when level is missing', async () => {
      getRuntimeValue.mockReturnValue([]);
      const noLevelStats = { name: 'TestSorcerer' };

      const result = await applyConstellationOption(makeAction(), noLevelStats, campaignName, 'Archer');

      expect(result.payload.description).toContain('1d8');
    });
  });
});
