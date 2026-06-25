// @improved-by-ai
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

      const result = await handle(makeAction(), lowLevelStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Twinkling Constellations');
      expect(result.payload.description).toBe('Twinkling Constellations requires level 10.');
    });

    it('returns automation_info popup when player is below level 10 with low level', async () => {
      const lowLevelStats = makePlayerStats({ level: 5 });
      const action = makeAction({ customField: 'test' });

      const result = await handle(action, lowLevelStats, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('returns modal when player is level 10', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('twinklingConstellation');
      expect(result.payload.action).toEqual(makeAction());
      expect(result.payload.playerStats).toEqual(makePlayerStats());
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('returns modal when player is above level 10', async () => {
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

    it('includes automation in popup payload when below level 10', async () => {
      const lowLevelStats = makePlayerStats({ level: 5 });
      const action = makeAction({ customField: 'test' });

      const result = await handle(action, lowLevelStats, campaignName);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('applyConstellationOption', () => {
    it('returns error popup for invalid constellation name', async () => {
      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Invalid');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Twinkling Constellations');
      expect(result.payload.automationType).toBe('twinkling_constellation');
      expect(result.payload.description).toContain('Invalid constellation: Invalid');
      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('returns error popup for null constellation name', async () => {
      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Invalid constellation:');
    });

    it('returns error popup for empty string constellation name', async () => {
      const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, '');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Invalid constellation:');
    });

    it('applies Archer constellation with 1d8 at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(makeAction(), lowLevelStats, campaignName, 'Archer');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Archer');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.automationType).toBe('twinkling_constellation');
    });

    it('uses 2d8 damage dice for Archer at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);
      const twinkleStats = makePlayerStats({ level: 10 });

      const result = await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Archer');

      expect(result.payload.description).toContain('2d8');
      expect(result.payload.description).toContain('Ranged Spell Attack');
      expect(result.payload.description).toContain('Radiant damage');
    });

    it('applies Chalice constellation with 1d8 at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(makeAction(), lowLevelStats, campaignName, 'Chalice');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Chalice');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('Healing Spell Ally Buff');
    });

    it('uses 2d8 healing dice for Chalice at level 10+', async () => {
      getRuntimeValue.mockReturnValue([]);
      const twinkleStats = makePlayerStats({ level: 10 });

      const result = await applyConstellationOption(makeAction(), twinkleStats, campaignName, 'Chalice');

      expect(result.payload.description).toContain('2d8');
      expect(result.payload.description).toContain('Healing Spell Ally Buff');
      expect(result.payload.description).toContain('within 30 feet');
    });

    it('applies Dragon constellation with concentration benefit at level 9', async () => {
      getRuntimeValue.mockReturnValue([]);
      const lowLevelStats = makePlayerStats({ level: 9 });

      const result = await applyConstellationOption(makeAction(), lowLevelStats, campaignName, 'Dragon');

      expect(result.payload.description).toContain('Dragon');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).not.toContain('Fly Speed');
    });

    it('applies Dragon constellation with concentration benefit and fly speed at level 10', async () => {
      getRuntimeValue.mockReturnValue([]);
      const level10Stats = makePlayerStats({ level: 10 });

      const result = await applyConstellationOption(makeAction(), level10Stats, campaignName, 'Dragon');

      expect(result.payload.description).toContain('Dragon');
      expect(result.payload.description).toContain('Concentration Benefit');
      expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
    });

    it('applies Dragon constellation with fly speed at level 15', async () => {
      getRuntimeValue.mockReturnValue([]);
      const highLevelStats = makePlayerStats({ level: 15 });

      const result = await applyConstellationOption(makeAction(), highLevelStats, campaignName, 'Dragon');

      expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
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

    it('does not include removed Starry Form buff after replacing it', async () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' },
        { name: 'Other Buff', effect: 'other' },
      ]);

      await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Dragon');

      const callArgs = setRuntimeValue.mock.calls[0];
      const buffs = callArgs[2];
      const starryForms = buffs.filter(b => b.name === 'Starry Form' && b.constellation === 'Archer');
      expect(starryForms).toHaveLength(0);
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
