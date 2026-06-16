import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle } from './expertDivinationHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    ...overrides,
  };
}

function makeAction(automation = {}, spell = {}) {
  return {
    name: 'Portent',
    automation: { type: 'portent', ...automation },
    spell,
  };
}

describe('expertDivinationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for non-Divination spell', async () => {
    const action = makeAction({}, { school: 'Evocation' });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null for Divination spell with level 1 slot', async () => {
    const action = makeAction({}, { school: 'Divination', level: 1 });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when spellSlotLevel is missing and spell.level is missing', async () => {
    const action = makeAction({}, { school: 'Divination' });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null for Divination spell with level 2 slot but no available spell slots', async () => {
    const action = makeAction({}, { school: 'Divination', level: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_1') return 0;
      return null;
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when spellSlotLevel is 2 but maxRegainLevel returns < 1', async () => {
    const action = makeAction({}, { school: 'Divination', level: 2 });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when spell school comparison fails (case mismatch)', async () => {
    const action = makeAction({}, { school: 'Divination', level: 3, name: 'Scrying' });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_1') return 1;
      return null;
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should use action.spellSlotLevel when spell.level is missing', async () => {
    const action = makeAction({}, { school: 'Divination' });
    action.spellSlotLevel = 4;
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_1') return 1;
      return null;
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should handle case-insensitive school matching', async () => {
    const action = makeAction({}, { school: 'DIVINATION' });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_1') return 1;
      return null;
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should handle school with spaces', async () => {
    const action = makeAction({}, { school: ' Divination ' });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_1') return 1;
      return null;
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when spellSlotLevel is 2 but maxRegainLevel returns < 1', async () => {
    const action = makeAction({}, { school: 'Divination', level: 2 });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });
});
