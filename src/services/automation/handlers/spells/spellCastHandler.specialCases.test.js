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
import * as logPoster from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

describe('spellCastHandler - War God\'s Blessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('sets _War_Gods_Blessing_active and returns HTML popup when noConcentration with multi-spell array', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = {
      name: "War God's Blessing",
      description: 'You can guide your allies...',
      automation: {
        type: 'free_spell',
        spell: ['Attack of Opportunity', 'Reaction Attack'],
        resourceCost: 'channel_divinity',
        noConcentration: true,
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.html).toContain('War God\'s Blessing');
    expect(result.payload.html).toContain('Channel Divinity expended');
    expect(result.payload.html).toContain('Attack of Opportunity and Reaction Attack');
    expect(result.payload.html).toContain('do not require Concentration');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_War_Gods_Blessing_active', true, campaignName,
    );

    expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: "War God's Blessing",
    }));
  });
});

describe('spellCastHandler - Channel Divinity per-spell tracking reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('resets used/freeCast flags when perSpellTracking is true with spell array', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: ['Charm Person', 'Sleep'],
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };

    await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Charm_Person_used', null, campaignName,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Charm_Person_freeCast', null, campaignName,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Sleep_used', null, campaignName,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Sleep_freeCast', null, campaignName,
    );

    expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: expect.stringContaining('Charm Person or Sleep'),
    }));
  });

  it('handles non-array spell in perSpellTracking reset', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: 'Charm Person',
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };

    await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Charm_Person_used', null, campaignName,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Channel_Divinity:_Charm_Charm_Person_freeCast', null, campaignName,
    );
  });
});

describe('spellCastHandler - 2024 ruleset fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches from /data/2024/spells.json when playerStats.rules is 2024', async () => {
    const { rollExpression } = await import('../../../dice/diceRoller.js');
    const { getEmpoweredEvocationFeatures } = await import('../../../../services/rules/spells/postCastRiderService.js');

    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }]),
    });
    globalThis.fetch = fetchMock;

    const ps = makePlayerStats({
      rules: '2024',
      spellAbilities: {
        spells: [],
      },
    });
    rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
    getEmpoweredEvocationFeatures.mockReturnValue([]);

    const action = {
      name: 'Divine Smite',
      automation: {
        type: 'spell',
        spell: 'Fire Bolt',
      },
    };
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(fetchMock).toHaveBeenCalledWith('/data/2024/spells.json');

    delete globalThis.fetch;
  });

  it('fetches from /data/spells.json when playerStats.rules is 5e', async () => {
    const { rollExpression } = await import('../../../dice/diceRoller.js');
    const { getEmpoweredEvocationFeatures } = await import('../../../../services/rules/spells/postCastRiderService.js');

    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }]),
    });
    globalThis.fetch = fetchMock;

    const ps = makePlayerStats({
      rules: '5e',
      spellAbilities: {
        spells: [],
      },
    });
    rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
    getEmpoweredEvocationFeatures.mockReturnValue([]);

    const action = {
      name: 'Divine Smite',
      automation: {
        type: 'spell',
        spell: 'Fire Bolt',
      },
    };
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(fetchMock).toHaveBeenCalledWith('/data/spells.json');

    delete globalThis.fetch;
  });

  it('handles fetch failure gracefully', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    globalThis.fetch = fetchMock;

    const ps = makePlayerStats({
      spellAbilities: {
        spells: [],
      },
    });

    const action = {
      name: 'Divine Smite',
      automation: {
        type: 'spell',
        spell: 'NonExistentSpell',
      },
    };
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(fetchMock).toHaveBeenCalled();

    delete globalThis.fetch;
  });
});

describe('spellCastHandler - Error handlers (.catch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('logs console.error when addEntry rejects in Mantle of Majesty', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const ps = makePlayerStats({ name: 'GlamourBard', spellAbilities: { saveDc: 15 }, proficiency: 5 });
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });
    logPoster.addEntry.mockRejectedValue(new Error('Log error'));

    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        concentration: true,
      },
    };

    await handle(action, ps, campaignName, null);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('logs console.error when addEntry rejects in War God\'s Blessing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = {
      name: "War God's Blessing",
      automation: {
        type: 'free_spell',
        spell: ['Attack of Opportunity', 'Reaction Attack'],
        resourceCost: 'channel_divinity',
        noConcentration: true,
      },
    };

    logPoster.addEntry.mockRejectedValue(new Error('Log error'));
    await handle(action, ps, campaignName, null);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('logs console.error when addEntry rejects in perSpellTracking reset', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: ['Charm Person', 'Sleep'],
        resourceCost: 'channel_divinity',
        perSpellTracking: true,
      },
    };

    logPoster.addEntry.mockRejectedValue(new Error('Log error'));
    await handle(action, ps, campaignName, null);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[spellCast] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
