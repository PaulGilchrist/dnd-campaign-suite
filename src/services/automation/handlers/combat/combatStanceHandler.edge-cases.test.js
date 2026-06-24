// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
  grantTempHpOnRage: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  clearExtendedFlag: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyStanceOption } from './combatStanceHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Barbarian',
    level: 3,
    class: {
      name: 'Barbarian',
      class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
    },
    automation: {},
    armorClassFormula: '',
    ...overrides,
  };
}

function makeAction(automation = {}, actionOverrides = {}) {
  return {
    name: 'Rage',
    automation: {
      type: 'combat_stance',
      effect: 'stance',
      duration: '10_minutes',
      resistanceTypes: [],
      advantages: [],
      damageBonusExpression: '',
      blocksSpellcasting: false,
      options: [],
      uses: 0,
      resourceKey: null,
      flySpeed: null,
      reactionSave: null,
      ...automation,
    },
    ...actionOverrides,
  };
}

/**
 * Extracts the first buff from the last setRuntimeValue call for 'activeBuffs'.
 * Returns null if no such call exists.
 */
function getLastActiveBuffsBuff() {
  const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(
    (c) => c[1] === 'activeBuffs' && Array.isArray(c[2]) && c[2].length > 0
  );
  return calls.length > 0 ? calls[calls.length - 1][2][0] : null;
}

// ── Non-array activeBuffs handling ─────────────────────────────

describe('non-array activeBuffs values', () => {
  beforeEach(() => vi.clearAllMocks());

  it('treats non-array activeBuffs as empty on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce('not-an-array');
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Rage activated (1/3 uses remaining)');

    const buff = getLastActiveBuffsBuff();
    expect(buff).not.toBeNull();
    expect(buff.name).toBe('Rage');
  });

  it('treats null activeBuffs as empty on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    const buff = getLastActiveBuffsBuff();
    expect(buff).not.toBeNull();
    expect(buff.name).toBe('Rage');
  });

  it('treats activeBuffs as empty on deactivation when non-array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({}, { name: 'Rage' });

    // Non-array activeBuffs → not active (no matching buff to remove)
    useRuntimeState.getRuntimeValue.mockReturnValueOnce('not-an-array');

    const result = await handle(action, ps, campaignName);

    // Since no active buff was found, the handler proceeds to activation
    expect(result.type).toBe('popup');
  });
});

// ── Null/undefined resource handling ───────────────────────────

describe('null/undefined resource handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns depleted message when resourceKey returns undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('treats null resource value as 0 and returns depleted', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('treats null uses value as maxUses (no depletion)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Rage activated (2/3 uses remaining)');
  });
});

// ── Buff default property values ───────────────────────────────

describe('buff default property values', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds buff with all default false/null values for option-less activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    // Call 0: activeBuffs (not active), Call 1: rageUses (2), Call 2: activeBuffs (append)
    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValueOnce(2);
    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);

    await handle(action, ps, campaignName);

    const buff = getLastActiveBuffsBuff();
    expect(buff.optionName).toBeNull();
    expect(buff.flySpeed).toBeNull();
    expect(buff.reactionSave).toBeNull();
    expect(buff.noArmor).toBe(false);
    expect(buff.range).toBeNull();
  });

  it('sets isImprovedDuplicity true with enhanced duplicity passive', async () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ effect: 'enhanced_distraction_and_healing' }],
      },
    });
    const action = makeAction({ uses: 3, effect: 'create_illusion' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getLastActiveBuffsBuff().isImprovedDuplicity).toBe(true);
  });
});

// ── Option property resolution ─────────────────────────────────

describe('option property resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  function stubOptionActivation() {
    useRuntimeState.getRuntimeValue.mockImplementation((player, prop) => {
      if (prop === 'ragePoints') return 1;
      return undefined;
    });
  }

  it('sets optionName on buff when chosenOption is present', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Bear');

    const buff = getLastActiveBuffsBuff();
    expect(buff.optionName).toBe('Bear');
  });

  it('sets noArmor on buff from option when present', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Falcon', noArmor: true }] });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getLastActiveBuffsBuff().noArmor).toBe(true);
  });

  it('option.range is carried to buff', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Custom', range: '10_ft' }] });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Custom');

    expect(getLastActiveBuffsBuff().range).toBe('10_ft');
  });

  it('option without resistanceTypes defaults to empty array on buff', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Custom' }] });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Custom');

    expect(getLastActiveBuffsBuff().resistanceTypes).toEqual([]);
  });

  it('uses default when option property is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Test', resistanceTypes: null }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Test');

    expect(getLastActiveBuffsBuff().resistanceTypes).toEqual([]);
  });

  it('uses default when option property is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Test' }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Test');

    expect(getLastActiveBuffsBuff().resistanceTypes).toEqual([]);
  });
});

// ── Armor detection edge cases ─────────────────────────────────

describe('armor detection edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  function stubOptionActivation() {
    useRuntimeState.getRuntimeValue.mockImplementation((player, prop) => {
      if (prop === 'ragePoints') return 1;
      return undefined;
    });
  }

  it('blocks flySpeed when formula contains "Armor (" and noArmor is true', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 18 Armor (Plate)' });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getLastActiveBuffsBuff().flySpeed).toBeNull();
  });

  it('allows flySpeed when formula lacks "Armor ("', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 14' });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getLastActiveBuffsBuff().flySpeed).toBe('5_ft');
  });

  it('handles missing armorClassFormula (defaults to empty string)', async () => {
    const ps = makePlayerStats({});
    delete ps.armorClassFormula;
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getLastActiveBuffsBuff().flySpeed).toBe('5_ft');
  });

  it('allows flySpeed when noArmor is false even with armor', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 18 Armor (Plate)' });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: false }],
    });

    stubOptionActivation();

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getLastActiveBuffsBuff().flySpeed).toBe('5_ft');
  });

  it('includes blocked message in description when wearing armor blocks Falcon', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 18 Armor (Plate)' });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    stubOptionActivation();

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).toContain('Blocked because you are wearing armor.');
  });

  it('does not include blocked message when not wearing armor', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'Unarmored Defense' });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    stubOptionActivation();

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).not.toContain('Blocked because you are wearing armor.');
  });
});

// ── Non-Rage action deactivation ───────────────────────────────

describe('non-Rage action deactivation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not clear extended flag for non-Rage stances', async () => {
    const ps = makePlayerStats();
    const action = makeAction({}, { name: 'Second Wind' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Second Wind' }]);

    await handle(action, ps, campaignName);

    const tempTeleport = await import('../class-warlock/tempTeleportHandler.js');
    expect(tempTeleport.clearExtendedFlag).not.toHaveBeenCalled();
  });

  it('removes only the matching stance buff on deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({}, { name: 'Rage' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: 'Rage' },
      { name: 'Other Buff' },
    ]);

    await handle(action, ps, campaignName);

    const buffCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs',
    );
    expect(buffCall[2]).toEqual([{ name: 'Other Buff' }]);
  });
});

// ── Payload structure for error/depletion paths ────────────────

describe('payload structure for depletion/invalid paths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses-depleted popup has automation in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('resource-depleted popup has automation in payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('invalid option popup has correct structure and action name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    const result = await applyStanceOption(action, ps, campaignName, 'Ghost');

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.name).toBe('Rage');
    expect(result.payload.description).toBe('Invalid option: Ghost');
  });
});
