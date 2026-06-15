import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./tempHpBuffHandler.js', () => ({
  grantTempHpOnRage: vi.fn(),
}));

vi.mock('./class-warlock/tempTeleportHandler.js', () => ({
  clearExtendedFlag: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyStanceOption } from './combatStanceHandler.js';

import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as tempHpBuffHandler from './tempHpBuffHandler.js';
import * as tempTeleportHandler from './class-warlock/tempTeleportHandler.js';

// ── Helpers ────────────────────────────────────────────────────

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

const campaignName = 'TestCampaign';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  tempHpBuffHandler.grantTempHpOnRage.mockClear().mockReset();
  tempTeleportHandler.clearExtendedFlag.mockClear().mockReset();
}

// ── Edge cases and null safety ────────────────────────────────

describe('edge cases', () => {
  beforeEach(() => resetMocks());

  it('handles activeBuffs stored as non-array (treated as empty)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce('not-an-array'); // → []
    useRuntimeState.getRuntimeValue.mockReturnValue(1); // ragePoints > 0

    await handle(action, ps, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('handles getRuntimeValue returning undefined for ragePoints', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined); // → currentResource = 0

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('builds buff with all default false/null values for option-less activation', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 }); // uses-based to avoid ragePoints read

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // usesUsed=2 < maxUses=3

    await handle(action, ps, campaignName);

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(setCall).toBeDefined();
    const buff = setCall[2][0];
    expect(buff.optionName).toBeNull();
    expect(buff.flySpeed).toBeNull();
    expect(buff.reactionSave).toBeNull();
    expect(buff.noArmor).toBe(false);
    expect(buff.range).toBeNull();
  });

  it('sets optionName on buff when chosenOption is present', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    await applyStanceOption(action, ps, campaignName, 'Bear');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(setCall[2][0].optionName).toBe('Bear');
  });

  it('sets noArmor on buff from option when present', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Falcon', noArmor: true }] });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(setCall[2][0].noArmor).toBe(true);
  });

  it('option.range is carried to buff', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Custom', range: '10_ft' }] });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    await applyStanceOption(action, ps, campaignName, 'Custom');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(setCall[2][0].range).toBe('10_ft');
  });

  it('option without resistanceTypes defaults to empty array on buff', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Custom' }] });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    await applyStanceOption(action, ps, campaignName, 'Custom');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(setCall[2][0].resistanceTypes).toEqual([]);
  });
});

// ── Armor detection ───────────────────────────────────────────

describe('armor detection', () => {
  beforeEach(() => resetMocks());

  it('identifies armor when formula contains "Armor ("', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 18 Armor (Plate)' });
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
    });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');
    expect(result.payload.description).toContain('Blocked because you are wearing armor.');
  });

  it('does NOT identify armor when formula lacks "Armor ("', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 14' }); // no Armor (
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
     });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');
    expect(result.payload.description).not.toContain('Blocked because you are wearing armor.');
  });

  it('handles missing armorClassFormula (defaults to empty string)', async () => {
    const ps = makePlayerStats({});
    delete ps.armorClassFormula;
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '5_ft', noArmor: true }],
     });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');
    expect(result.payload.description).not.toContain('Blocked because you are wearing armor.');
  });
});

// ── Full activation/deactivation cycle ────────────────────────

describe('full activation/deactivation cycle', () => {
  beforeEach(() => resetMocks());

  it('handle toggles off when called twice with same action name', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 }, { name: 'Second Wind' });

     // First call — activates
    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // usesUsed=2 < maxUses=3

    const result1 = await handle(action, ps, campaignName);
    expect(result1.type).toBe('popup');
    expect(result1.payload.description).toContain('Second Wind activated');

     // Get the buff that was pushed
    const pushedBuff = useRuntimeState.setRuntimeValue.mock.calls
      .find(c => c[1] === 'activeBuffs')?.[2][0];

     // Reset for second call
    resetMocks();

     // Second call — deactivates (stance is now active)
    useRuntimeState.getRuntimeValue.mockReturnValueOnce([pushedBuff]);

    const result2 = await handle(action, ps, campaignName);
    expect(result2.type).toBe('popup');
    expect(result2.payload.description).toBe('Second Wind ended');
  });
});

// ── Payload structure verification ────────────────────────────

describe('payload structure', () => {
  beforeEach(() => resetMocks());

  it('activation popup has correct payload keys', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload).toHaveProperty('type', 'automation_info');
    expect(result.payload).toHaveProperty('name', 'Rage');
    expect(result.payload).toHaveProperty('automationType', 'combat_stance');
    expect(result.payload).toHaveProperty('description');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('option activation popup contains action name in payload.name', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    useRuntimeState.getRuntimeValue.mockReset();

    useRuntimeState.getRuntimeValue.mockImplementation(() => 1);

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.name).toBe('Rage');
    expect(result.payload.automationType).toBe('combat_stance');
  });

  it('deactivation popup describes ended stance by name', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({}, { name: 'Feral Instinct' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([{ name: 'Feral Instinct' }]);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.name).toBe('Feral Instinct');
    expect(result.payload.description).toBe('Feral Instinct ended');
  });

  it('uses-depleted popup has correct structure', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(3); // used all

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('resource-depleted popup has correct structure', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(0); // no resources

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('invalid option popup has correct structure', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    const result = await applyStanceOption(action, ps, campaignName, 'Ghost');

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.automationType).toBe('combat_stance');
    expect(result.payload.name).toBe('Rage');
  });

  it('teleport modal payload includes playerStats and campaignName', async () => {
    const teleportFeature = { name: 'Primal Warrior Teleport', effect: 'teleport_on_rage' };
    const ps = makePlayerStats({ automation: { specialActions: [teleportFeature] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

     { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation( () => { _c++; if (_c === 1) return []; // activeBuffs empty
         if (_c === 2) return 1; // ragePoints > 0
         return []; }); }

    const result = await handle(action, ps, campaignName);

    expect(result.payload).toHaveProperty('playerStats', ps);
    expect(result.payload).toHaveProperty('campaignName', campaignName);
    expect(result.payload.triggeredByRage).toBe(true);
  });

  it('modal for option selection includes action and playerStats in payload', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ options: [{ name: 'Bear' }] });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
  });
});
