import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

describe('twinklingConstellationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when player is below level 10', async () => {
    const lowLevelStats = makePlayerStats({ level: 9 });

    const result = await handle(makeAction(), lowLevelStats, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Twinkling Constellations requires level 10.');
  });

  it('should return modal when player is level 10', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('twinklingConstellation');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('should return modal when player is above level 10', async () => {
    const highLevelStats = makePlayerStats({ level: 15 });

    const result = await handle(makeAction(), highLevelStats, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('twinklingConstellation');
  });

  it('should default level to 1 when not provided', async () => {
    const noLevelStats = { name: 'TestSorcerer' };

    const result = await handle(makeAction(), noLevelStats, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Twinkling Constellations requires level 10.');
  });

  it('should include automation in popup payload', async () => {
    const lowLevelStats = makePlayerStats({ level: 5 });
    const action = makeAction({ customField: 'test' });

    const result = await handle(action, lowLevelStats, campaignName);

    expect(result.payload.automation).toEqual(action.automation);
  });
});

describe('twinklingConstellationHandler.applyConstellationOption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for invalid constellation', async () => {
    const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Invalid');

    expect(result.payload.description).toContain('Invalid constellation');
    expect(result.payload.automationType).toBe('twinkling_constellation');
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

  it('should remove existing Starry Form buff before adding new one', async () => {
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

  it('should handle Dragon constellation without fly speed at level 10 exactly', async () => {
    getRuntimeValue.mockReturnValue([]);
    const level10Stats = makePlayerStats({ level: 10 });

    const result = await applyConstellationOption(makeAction(), level10Stats, campaignName, 'Dragon');

    expect(result.payload.description).toContain('Fly Speed 20 feet (hover)');
  });

  it('should include automationType in popup payload', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

    expect(result.payload.automationType).toBe('twinkling_constellation');
  });

  it('should include automation in popup payload', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = await applyConstellationOption(makeAction(), makePlayerStats(), campaignName, 'Archer');

    expect(result.payload.automation).toEqual(makeAction().automation);
  });
});
