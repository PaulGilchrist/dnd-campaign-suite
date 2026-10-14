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

describe('spellCastHandler - Channel Divinity cost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('blocks when charges are 0 or negative, defaults to maxCharges - 1 when stored is null, decrements on use', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    });
    const action = makeAction({ resourceCost: 'channel_divinity' });

    // Zero charges
    runtimeState.getRuntimeValue.mockReturnValue(0);
    let result = await handle(action, ps, campaignName, null);
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');

    // Negative charges
    runtimeState.getRuntimeValue.mockReturnValue(-1);
    result = await handle(action, ps, campaignName, null);
    expect(result.type).toBe('popup');

    // Null → defaults to maxCharges - 1
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const psNull = makePlayerStats({ class: { class_levels: [{ level: 5, channel_divinity: 2 }] } });
    await handle(action, psNull, campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'channelDivinityCharges', 1, campaignName,
    );

    // Decrement
    runtimeState.getRuntimeValue.mockReturnValue(2);
    await handle(action, ps, campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'channelDivinityCharges', 1, campaignName,
    );
  });

  it('handles missing class_levels and uses class_specific fallback', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    // Missing class_levels
    const ps1 = makePlayerStats({ class: {} });
    const action = makeAction({ resourceCost: 'channel_divinity' });
    await handle(action, ps1, campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'channelDivinityCharges', 1, campaignName,
    );

    // class_specific fallback
    const ps2 = makePlayerStats({
      level: 1,
      class: {
        class_levels: [{ level: 1, class_specific: { channel_divinity_charges: 3 } }],
      },
    });
    await handle(action, ps2, campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'channelDivinityCharges', 2, campaignName,
    );
  });

  it('handles missing class entirely, defaults to maxCharges=2', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const ps = makePlayerStats();
    delete ps.class;
    const action = makeAction({ resourceCost: 'channel_divinity' });
    await handle(action, ps, campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', 'channelDivinityCharges', 1, campaignName,
    );
  });
});

describe('spellCastHandler - Uses expression (counter-based free casts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('blocks when free casts are 0 or negative, decrements on use', async () => {
    const action = makeAction({
      uses_expression: 'WIS modifier_min_1',
      usesMax: 1,
    });

    runtimeState.getRuntimeValue.mockReturnValue(0);
    let result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');

    runtimeState.getRuntimeValue.mockReturnValue(-2);
    action.automation.usesMax = 3;
    result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.type).toBe('popup');
  });

  it('defaults to usesMax when stored is null, decrements on use', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const action = makeAction({ uses_expression: 'WIS modifier_min_1', usesMax: 3 });
    let result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.html).toContain('2 remaining');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_freeCastCount', 2, campaignName,
    );

    runtimeState.getRuntimeValue.mockReturnValue(2);
    action.automation.usesMax = 2;
    result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.html).toContain('1 remaining');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_freeCastCount', 1, campaignName,
    );
  });

  it('uses the action name in the runtime key', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const action = {
      name: 'Divine Smite',
      automation: {
        type: 'spell',
        uses_expression: 'STR modifier_min_1',
        usesMax: 2,
      },
    };
    await handle(action, makePlayerStats(), campaignName, null);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_freeCastCount', 1, campaignName,
    );
  });
});

describe('spellCastHandler - Uses + recharge (fixed counter-based free casts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('blocks when free casts are 0 or negative', async () => {
    const action = {
      name: "Paladin's Smite",
      automation: {
        type: 'free_spell',
        spell: 'Divine Smite',
        uses: 1,
        recharge: 'long_rest',
      },
    };

    runtimeState.getRuntimeValue.mockReturnValue(0);
    let result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');

    runtimeState.getRuntimeValue.mockReturnValue(-1);
    result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
  });

  it('defaults to uses when stored is null, decrements on use', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const action = {
      name: "Paladin's Smite",
      automation: {
        type: 'free_spell',
        spell: 'Divine Smite',
        uses: 1,
        recharge: 'long_rest',
      },
    };
    let result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.html).toContain('Free cast of');
    expect(result.payload.html).toContain('Divine Smite');
    expect(result.payload.html).toContain('0 remaining');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', "_Paladin's_Smite_freeCastCount", 0, campaignName,
    );

    // Reset mock for fresh action
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const action2 = {
      name: "Paladin's Smite",
      automation: {
        type: 'free_spell',
        spell: 'Divine Smite',
        uses: 2,
        recharge: 'long_rest',
      },
    };
    result = await handle(action2, makePlayerStats(), campaignName, null);
    expect(result.payload.html).toContain('1 remaining');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', "_Paladin's_Smite_freeCastCount", 1, campaignName,
    );
  });

  it('uses correct recharge text based on recharge type', async () => {
    const actionShort = {
      name: "Paladin's Smite",
      automation: { spell: 'Divine Smite', uses: 0, recharge: 'short_rest' },
    };
    runtimeState.getRuntimeValue.mockReturnValue(0);
    let result = await handle(actionShort, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Short Rest to regain them.');

    const actionShortOrLong = {
      name: "Paladin's Smite",
      automation: { spell: 'Divine Smite', uses: 0, recharge: 'short_or_long_rest' },
    };
    result = await handle(actionShortOrLong, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Short or Long Rest to regain them.');

    const actionLong = {
      name: "Paladin's Smite",
      automation: { spell: 'Divine Smite', uses: 0, recharge: 'long_rest' },
    };
    result = await handle(actionLong, makePlayerStats(), campaignName, null);
    expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
  });

  it('does not interfere with uses_expression pattern', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const action = makeAction({
      spell: 'Fire Bolt',
      uses: 1,
      uses_expression: 'WIS modifier_min_1',
      usesMax: 3,
    });
    const result = await handle(action, makePlayerStats(), campaignName, null);
    expect(result.payload.html).toContain('2 remaining');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard', '_Divine_Smite_freeCastCount', 2, campaignName,
    );
  });
});
