// @improved-by-ai
// BUG CLA-099: shared retirement seam + duration formatting for Dragon Wings.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = { AberrantSorcerer: {} };

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[name]?.[key] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { store[name] = { ...store[name], [key]: value }; }),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import {
  endDragonWingsBuff,
  isDragonWingsBuff,
  formatWingsDuration,
  DRAGON_WINGS_ACTIVE_KEY,
} from './dragonWingsService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

const WINGS_BUFF = { name: 'Dragon Wings', effect: 'dragon_wings', duration: '1_hour', flySpeed: 60, hover: true };

describe('CLA-099 dragonWingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.AberrantSorcerer = {};
  });

  it('matches only the Dragon Wings buff', () => {
    expect(isDragonWingsBuff(WINGS_BUFF)).toBe(true);
    expect(isDragonWingsBuff({ name: 'Draconic Flight', effect: 'dragon_wings' })).toBe(false);
    expect(isDragonWingsBuff({ name: 'Dragon Wings', effect: 'ice_walk' })).toBe(false);
    expect(isDragonWingsBuff(null)).toBe(false);
  });

  it('formats the raw duration enum for display', () => {
    expect(formatWingsDuration('1_hour')).toBe('1 hour');
    expect(formatWingsDuration('2_hours')).toBe('2 hours');
    expect(formatWingsDuration('10_minutes')).toBe('10 minutes');
    expect(formatWingsDuration('')).toBe('');
  });

  it('removes the buff, clears the active flag, and logs the retract', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF, { name: 'Bless', effect: 'bless' }];
    store.AberrantSorcerer[DRAGON_WINGS_ACTIVE_KEY] = true;

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'retracted');

    expect(removed).toBe(true);
    expect(store.AberrantSorcerer.activeBuffs).toEqual([{ name: 'Bless', effect: 'bless' }]);
    expect(store.AberrantSorcerer[DRAGON_WINGS_ACTIVE_KEY]).toBe(false);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'AberrantSorcerer',
      abilityName: 'Dragon Wings',
      description: expect.stringContaining('dismisses the draconic wings'),
    }));
  });

  it('logs the duration-expiry text for the expired reason', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF];

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'expired');

    expect(removed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'activeBuffs', [], campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: expect.stringContaining('duration has expired'),
    }));
  });

  it('leaves the uses latch untouched — retiring never refunds the use', () => {
    store.AberrantSorcerer.activeBuffs = [WINGS_BUFF];
    store.AberrantSorcerer.dragonWingsUses = 0;

    endDragonWingsBuff('AberrantSorcerer', campaignName, 'expired');

    expect(setRuntimeValue).not.toHaveBeenCalledWith('AberrantSorcerer', 'dragonWingsUses', expect.anything(), campaignName);
    expect(store.AberrantSorcerer.dragonWingsUses).toBe(0);
  });

  it('is a no-op without a standing buff (buff-write and log skipped, flag still cleared)', () => {
    store.AberrantSorcerer.activeBuffs = [{ name: 'Bless', effect: 'bless' }];
    store.AberrantSorcerer[DRAGON_WINGS_ACTIVE_KEY] = true;

    const removed = endDragonWingsBuff('AberrantSorcerer', campaignName, 'retracted');

    expect(removed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', DRAGON_WINGS_ACTIVE_KEY, false, campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
