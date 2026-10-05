// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = { DragonbornTest: {} };

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[name]?.[key] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { store[name] = { ...store[name], [key]: value }; }),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { endDraconicFlightBuff, isDraconicFlightBuff } from './draconicFlightService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed', duration: '10_minutes' };

describe('CLA-096 draconicFlightService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.DragonbornTest = {};
  });

  it('matches only the Draconic Flight fly buff', () => {
    expect(isDraconicFlightBuff(FLY_BUFF)).toBe(true);
    expect(isDraconicFlightBuff({ name: 'Heavenly Wings', effect: 'fly_speed_equals_walk_speed' })).toBe(false);
    expect(isDraconicFlightBuff({ name: 'Draconic Flight', effect: 'ice_walk' })).toBe(false);
    expect(isDraconicFlightBuff(null)).toBe(false);
  });

  it('removes the buff via one spread write and logs the retract', () => {
    store.DragonbornTest.activeBuffs = [FLY_BUFF, { name: 'Bless', effect: 'bless' }];

    const removed = endDraconicFlightBuff('DragonbornTest', campaignName, 'retracted');

    expect(removed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornTest', 'activeBuffs', [{ name: 'Bless', effect: 'bless' }], campaignName);
    expect(getRuntimeValue('DragonbornTest', 'activeBuffs')).toEqual([{ name: 'Bless', effect: 'bless' }]);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'DragonbornTest',
      abilityName: 'Draconic Flight',
      description: expect.stringContaining('retracts the spectral wings'),
    }));
  });

  it('logs the duration-expiry text for the expired reason', () => {
    store.DragonbornTest.activeBuffs = [FLY_BUFF];

    const removed = endDraconicFlightBuff('DragonbornTest', campaignName, 'expired');

    expect(removed).toBe(true);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: expect.stringContaining("10 minutes have elapsed"),
    }));
  });

  it('logs the incapacitated dissolve text', () => {
    store.DragonbornTest.activeBuffs = [FLY_BUFF];

    endDraconicFlightBuff('DragonbornTest', campaignName, 'incapacitated');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: expect.stringContaining('due to the Incapacitated condition'),
    }));
  });

  it('is a no-op without a standing buff (no write, no log)', () => {
    store.DragonbornTest.activeBuffs = [{ name: 'Bless', effect: 'bless' }];

    const removed = endDraconicFlightBuff('DragonbornTest', campaignName, 'retracted');

    expect(removed).toBe(false);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
