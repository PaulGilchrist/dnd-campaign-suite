import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./tempHpBuffHandler.js', () => ({
  grantTempHpOnRage: vi.fn(),
}));

vi.mock('./tempTeleportHandler.js', () => ({
  clearExtendedFlag: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyStanceOption } from './combatStanceHandler.js';

import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as tempHpBuffHandler from './tempHpBuffHandler.js';
import * as tempTeleportHandler from './tempTeleportHandler.js';

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

function getPushedBuff() {
  const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(
    c => c[1] === 'activeBuffs' && Array.isArray(c[2]) && c[2].length > 0
  );
  return calls.length > 0 ? calls[calls.length - 1][2][0] : null;
}

function setupRageSequence(sequence) {
  useRuntimeState.getRuntimeValue.mockReset();
  let idx = [0];
  useRuntimeState.getRuntimeValue.mockImplementation(() => {
    return sequence[idx[0]++] ?? 1;
  });
}

// ── activateStance — Uses-based (maxUses > 0) ────────────────

describe('activateStance uses-based path', () => {
  beforeEach(() => resetMocks());

  it('returns popup when usesUsed >= maxUses', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 }); // no resourceKey → derive from name

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(0); // usesUsed === 0 <= 0

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('has been used and cannot be used again until a Long Rest.');
  });

  it('increments uses counter on activation (uses-based)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 }); // no resourceKey → default 'rageUses'

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(1); // usesUsed=1 < maxUses=3

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Rage activated');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'rageUses');
    expect(setCall).toBeDefined();
    expect(setCall[2]).toBe(0); // 1 - 1 = 0
  });

  it('uses custom resourceKey for uses tracking when provided', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, resourceKey: 'customUses' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // customUses=2 < 3

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Barbarian', 'customUses', 1, campaignName
    );
  });

  it('derives default usesKey from action name', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 2 }, { name: 'Extra Attack' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // activeBuffs (handle line 28)
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // extraAttackUses=2 < 2

    await handle(action, ps, campaignName);

    // Default key: action.name.toLowerCase().replace(/\s+/g, '') + 'Uses' = 'extraattackUses'
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Barbarian', 'extraattackUses', 1, campaignName
    );
  });

  it('description shows uses count on activation (uses-based)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // usesUsed=2, activates to 1/3

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('Rage activated (1/3 uses remaining)');
  });

  it('does NOT touch ragePoints or resources when maxUses > 0', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(1); // rageUses only, not ragePoints

    await handle(action, ps, campaignName);

    const rageCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'ragePoints');
    expect(rageCall).toBeUndefined();
  });
});

// ── activateStance — Resource-based (maxUses === 0) ───────────

describe('activateStance resource-based path', () => {
  beforeEach(() => resetMocks());

  it('returns popup when resource is 0 or less', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(0); // ragePoints === 0

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('returns popup when resource is negative', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(-1);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('decrements resource on activation', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(3); // ragePoints=3 > 0

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Barbarian', 'ragePoints', 2, campaignName
    );
  });

  it('treats null storedResource as 0 and returns "no uses" popup', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(null); // → currentResource=0 ≤ 0

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('uses custom resourceKey for resource-based deduction', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'inspirationDie' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(5); // inspirationDie=5 > 0

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Barbarian', 'inspirationDie', 4, campaignName
    );
  });
});

// ── activateStance — Buff object construction ─────────────────

describe('activateStance buff construction', () => {
  beforeEach(() => resetMocks());

  it('sets default buff properties when no option selected', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]); // not active
    useRuntimeState.getRuntimeValue.mockReturnValue(1); // usesUsed < maxUses

    await handle(action, ps, campaignName);

    const buff = getPushedBuff();
    expect(buff.name).toBe('Rage');
    expect(buff.effect).toBe('stance');
    expect(buff.duration).toBe('10_minutes');
    expect(buff.resistanceTypes).toEqual([]);
    expect(buff.advantages).toEqual([]);
    expect(buff.damageBonusExpression).toBe('');
    expect(buff.blocksSpellcasting).toBe(false);
    expect(buff.optionName).toBeNull();
    expect(buff.noArmor).toBe(false);
    expect(buff.range).toBeNull();
    expect(buff.flySpeed).toBeNull();
    expect(buff.reactionSave).toBeNull();
  });

  it('uses auto.effect when provided', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, effect: 'damage_resistance' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().effect).toBe('damage_resistance');
  });

  it('uses auto.duration when provided', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, duration: '1_hour' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().duration).toBe('1_hour');
  });

  it('reads resistanceTypes from auto when no option', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, resistanceTypes: ['acid', 'fire'] });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().resistanceTypes).toEqual(['acid', 'fire']);
  });

  it('reads advantages and other properties from auto', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({
      uses: 3,
      advantages: ['melee_attack_roll'],
      damageBonusExpression: '1d8',
      blocksSpellcasting: true,
    });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    const buff = getPushedBuff();
    expect(buff.advantages).toEqual(['melee_attack_roll']);
    expect(buff.damageBonusExpression).toBe('1d8');
    expect(buff.blocksSpellcasting).toBe(true);
  });

  it('sets reactionSave from auto when provided', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, reactionSave: 'dexterity_save_dc_15' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().reactionSave).toBe('dexterity_save_dc_15');
  });

  it('prefers option resistanceTypes over auto resistanceTypes', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Bear', resistanceTypes: ['bludgeoning'] }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1); // ragePoints > 0, remainingRage also 1

    await applyStanceOption(action, ps, campaignName, 'Bear');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].resistanceTypes).toEqual(['bludgeoning']);
  });
});

// ── activateStance — flySpeed logic ───────────────────────────

describe('activateStance flySpeed logic', () => {
  beforeEach(() => resetMocks());

  it('sets flySpeed on option when not wearing armor', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' }); // no armor
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: false }],
    }, { name: 'Wild Shifting' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1); // all reads return 1 > 0

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].flySpeed).toBe('10_ft');
  });

  it('sets flySpeed and effect when option has flySpeed + noArmor (not wearing armor)', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' }); // not wearing armor
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
    }, { name: 'Wild Shifting' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].flySpeed).toBe('10_ft');
    expect(setCall[2][0].effect).toBe('fly_speed_equals_walk_speed');
  });

  it('blocks option flySpeed when wearing armor + noArmor flag', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 15 Armor (Chain Shirt)' }); // wearing armor
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
    }, { name: 'Wild Shifting' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].flySpeed).toBeNull(); // blocked by armor
  });

  it('sets flySpeed from auto when no option has flySpeed but auto does', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3, flySpeed: '30_ft' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().flySpeed).toBe('30_ft');
  });

  it('auto.flySpeed is not blocked by armor (noArmor only applies to options)', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 18 Armor (Plate)' });
    const action = makeAction({ uses: 3, flySpeed: '30_ft' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getPushedBuff().flySpeed).toBe('30_ft');
  });

  it('option flySpeed takes precedence over auto flySpeed when option exists', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' });
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '15_ft' }],
      flySpeed: '30_ft', // auto-level — should NOT be used when option is present
    }, { name: 'Wild Shifting' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeBuffs' && Array.isArray(c[2])
    );
    expect(setCall).toBeDefined();
    expect(setCall[2][0].flySpeed).toBe('15_ft');
  });
});

// ── activateStance — Rage-specific effects ────────────────────

describe('activateStance Rage-specific effects', () => {
  beforeEach(() => resetMocks());

  it('removes charmed and frightened conditions when activating Rage', async () => {
    setupRageSequence([
      [],                           // call 0: activeBuffs → not active
      1,                            // call 1: ragePoints > 0
      [],                           // call 2: activeBuffs for buff append
      ['charmed', 'frightened', 'poisoned'], // call 3: activeConditions
    ]);

    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName);

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeDefined();
    expect(conditionsCall[2]).toEqual(['poisoned']);
  });

  it('does NOT modify activeConditions when none include charmed/frightened', async () => {
    setupRageSequence([[], 1, [], ['poisoned', 'blinded']]);

    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName);

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeUndefined();
  });

  it('handles activeConditions as non-array gracefully', async () => {
    setupRageSequence([[], 1, [], null]);

    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName); // should not throw

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeUndefined();
  });

  it('handles activeConditions as undefined', async () => {
    setupRageSequence([[], 1, [], undefined]);

    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName); // should not throw

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeUndefined();
  });

  it('calls grantTempHpOnRage for features with triggerOnRage', async () => {
    const tempFeature = { name: 'Damage Resistance HP', automation: {}, triggerOnRage: true };
    const ps = makePlayerStats({ automation: { specialActions: [tempFeature] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]); // activeConditions empty, no condition changes

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).toHaveBeenCalledTimes(1);
    const callArg0 = tempHpBuffHandler.grantTempHpOnRage.mock.calls[0][0];
    expect(callArg0.name).toBe('Damage Resistance HP');
    expect(callArg0.automation).toBe(tempFeature);
  });

  it('calls grantTempHpOnRage for each triggerOnRage feature', async () => {
    const feat1 = { name: 'Feat1', automation: {}, triggerOnRage: true };
    const feat2 = { name: 'Feat2', automation: {}, triggerOnRage: true };
    const ps = makePlayerStats({ automation: { specialActions: [feat1, feat2] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]);

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).toHaveBeenCalledTimes(2);
    const call1 = tempHpBuffHandler.grantTempHpOnRage.mock.calls[0];
    expect(call1[0].name).toBe('Feat1');
    expect(call1[0].automation).toBe(feat1);
    const call2 = tempHpBuffHandler.grantTempHpOnRage.mock.calls[1];
    expect(call2[0].name).toBe('Feat2');
    expect(call2[0].automation).toBe(feat2);
  });

  it('does NOT call grantTempHpOnRage when feature lacks triggerOnRage', async () => {
    const ps = makePlayerStats({
      automation: { specialActions: [{ name: 'Normal Feature' }] },
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]);

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).not.toHaveBeenCalled();
  });

  it('does NOT call grantTempHpOnRage for non-Rage actions', async () => {
    const ps = makePlayerStats({ automation: { specialActions: [{ triggerOnRage: true }] } });
    const action = makeAction({ uses: 0, resourceKey: 'somePoints' }, { name: 'Something Else' });

    useRuntimeState.getRuntimeValue.mockReset();
    let idx = [0];
    useRuntimeState.getRuntimeValue.mockImplementation(() => {
      const i = idx[0]++;
      if (i === 0) return [];        // not active
      if (i === 1) return 1;         // somePoints > 0
      return [];                     // activeBuffs for append
    });

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).not.toHaveBeenCalled();
  });

  it('returns teleport modal when teleport_on_rage feature exists', async () => {
    const teleportFeature = { name: 'Primal Warrior Teleport', effect: 'teleport_on_rage' };
    const ps = makePlayerStats({ automation: { specialActions: [teleportFeature] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('teleport');
    expect(result.payload.triggeredByRage).toBe(true);
    expect(result.payload.action).toBe(teleportFeature);
  });

  it('does NOT return teleport modal when no teleport_on_rage feature', async () => {
    const ps = makePlayerStats({ automation: { specialActions: [] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
  });

  it('handles missing automation.specialActions gracefully', async () => {
    const ps = makePlayerStats({ automation: {} }); // no specialActions
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    setupRageSequence([[], 1, [], []]);

    await handle(action, ps, campaignName); // should not throw

    expect(tempHpBuffHandler.grantTempHpOnRage).not.toHaveBeenCalled();
  });
});

// ── activateStance — Description building (option-based) ──────

describe('activateStance description with options', () => {
  beforeEach(() => resetMocks());

  it('describes Bear option with resistance text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

    useRuntimeState.getRuntimeValue.mockReset();
    { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => { return ++_c === 1 ? 1 : 0; }); }

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('Bear chosen');
    expect(result.payload.description).toContain('Resistance to Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Poison, Slashing, Thunder');
  });

  it('describes Eagle option with Dash/Disengage text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Eagle' }] });

    { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Eagle');

    expect(result.payload.description).toContain('Eagle chosen');
    expect(result.payload.description).toContain('Disengage and Dash');
  });

  it('describes Wolf option with ally advantage text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Wolf' }] });

     { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Wolf');

    expect(result.payload.description).toContain('Wolf chosen');
    expect(result.payload.description).toContain('allies have Advantage on attack rolls');
  });

  it('describes Falcon option with fly speed text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Falcon' }] });

      { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).toContain('Falcon chosen');
    expect(result.payload.description).toContain('Fly Speed');
  });

  it('describes Lion option with enemy disadvantage text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Lion' }] });

    { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Lion');

    expect(result.payload.description).toContain('Lion chosen');
    expect(result.payload.description).toContain('Disadvantage on attack rolls');
  });

  it('describes Ram option with prone text', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Ram' }] });

     { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Ram');

    expect(result.payload.description).toContain('Ram chosen');
    expect(result.payload.description).toContain('Prone condition');
  });

  it('includes rage use count in option activation description', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

      { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation(() => ++_c === 1 ? 2 : 1); }

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('1 Rage use(s) remaining');
  });

  it('reads remainingRage as null and defaults to 0 in description', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints', options: [{ name: 'Bear' }] });

      { let _c = 0; useRuntimeState.getRuntimeValue.mockImplementation( () => { if (++_c === 1) return 1; // ragePoints > 0
       return null; }); }

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('0 Rage use(s) remaining');
  });

  it('shows "Blocked because you are wearing armor" for Falcon + noArmor', async () => {
    const ps = makePlayerStats({ armorClassFormula: 'AC 15 Armor (Chain Shirt)' });
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).toContain('Blocked because you are wearing armor.');
  });

  it('does NOT show armor-blocked note when not wearing armor', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' }); // no armor
    const action = makeAction({
      uses: 0, resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
    });

    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.getRuntimeValue.mockReturnValue(1);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).not.toContain('Blocked because you are wearing armor.');
  });
});

// ── Uses-based description (no options) ───────────────────────

describe('uses-based activation description', () => {
  beforeEach(() => resetMocks());

  it('describes uses count when no option selected', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ uses: 3 }, { name: 'Second Wind' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2); // usesUsed=2 → activates to 1/3

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('Second Wind activated (1/3 uses remaining)');
  });
});
