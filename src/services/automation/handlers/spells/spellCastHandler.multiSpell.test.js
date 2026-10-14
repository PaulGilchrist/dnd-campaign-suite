import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

describe('spellCastHandler - Multi-spell automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('shows available spells when perSpellTracking is true, marks spells as used', async () => {
    const ps = makePlayerStats();
    let result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true }), ps, campaignName, null);
    expect(result.payload.html).toContain('Available free casts');
    expect(result.payload.html).toContain('Fire Bolt');
    expect(result.payload.html).toContain('Light');

    // Fire Bolt used, Light not used
    runtimeState.getRuntimeValue.mockReturnValueOnce(true).mockReturnValueOnce(null);
    result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true }), ps, campaignName, null);
    expect(result.payload.html).toContain('Light');
    expect(result.payload.html).not.toContain('Fire Bolt');

    // Light also not used yet (tests the !stored true path)
    runtimeState.getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(null);
    result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true }), ps, campaignName, null);
    expect(result.payload.html).toContain('Light');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_Light_freeCast', true, campaignName,
    );

    // All used
    runtimeState.getRuntimeValue.mockReturnValue(true);
    result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true }), ps, campaignName, null);
    expect(result.payload.description).toContain('All spells from this feature have been used');
    expect(result.payload.description).toContain('Long Rest');
  });

  it('shows short or long rest recharge text when specified', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(true);
    const action = makeAction({
      spell: ['Fire Bolt', 'Light'],
      perSpellTracking: true,
      recharge: 'short_or_long_rest',
    });
    const result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toContain('Short or Long Rest');
  });

  it('handles non-perSpellTracking with channel divinity expended popup', async () => {
    const ps = makePlayerStats();

    // Already expended — no setRuntimeValue
    runtimeState.getRuntimeValue.mockReturnValue(['Fire Bolt', 'Light']);
    await handle(makeAction({ spell: ['Fire Bolt', 'Light'] }), ps, campaignName, null);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

    // First use — shows channel divinity expended popup
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const result = await handle(makeAction({ spell: ['Fire Bolt', 'Light'] }), ps, campaignName, null);
    expect(result.payload.html).toContain('Channel Divinity expended');

    // Join with " or "
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const result2 = await handle(makeAction({ spell: ['Fire Bolt', 'Light', 'Mage Hand'] }), ps, campaignName, null);
    expect(result2.payload.html).toContain('Fire Bolt or Light or Mage Hand');
  });
});

describe('spellCastHandler - PerSpellTracking inner if (!stored)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('sets freeKey to true when not yet stored for a spell', async () => {
    runtimeState.getRuntimeValue.mockReturnValueOnce(true).mockReturnValueOnce(null);

    const ps = makePlayerStats();
    const action = makeAction({ spell: ['Fire Bolt', 'Light'], perSpellTracking: true });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.html).toContain('Light');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_Light_freeCast', true, campaignName,
    );
  });
});

describe('spellCastHandler - Non-perSpellTracking multi-spell with storedSpells set', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('sets freeCast to spellNames when not yet stored', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ spell: ['Fire Bolt', 'Light'] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.html).toContain('Channel Divinity expended');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_freeCast', ['Fire Bolt', 'Light'], campaignName,
    );
  });
});
