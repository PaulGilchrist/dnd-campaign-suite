// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

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
import * as tempHpBuffHandler from '../buffs/tempHpBuffHandler.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const defaultPlayerName = 'Barbarian';

function makePlayerStats(overrides = {}) {
  return {
    name: defaultPlayerName,
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

function resetMocks() {
  vi.clearAllMocks();
}

function getActiveBuffsCall() {
  const calls = useRuntimeState.setRuntimeValue.mock.calls.filter(
    (c) => c[1] === 'activeBuffs' && Array.isArray(c[2]) && c[2].length > 0
  );
  return calls.length > 0 ? calls[calls.length - 1][2][0] : null;
}

// Configures getRuntimeValue to return a sequence of values in order.
// Each call to getRuntimeValue within the handler advances through the array.
function sequenceMock(values) {
  useRuntimeState.getRuntimeValue.mockReset();
  let index = 0;
  useRuntimeState.getRuntimeValue.mockImplementation(() => {
    return values[index++] ?? values[values.length - 1];
  });
}

// ── Stubs ──────────────────────────────────────────────────────

/**
 * Stub the "not currently active" check that the handler performs
 * on activeBuffs before proceeding with activation.  Every test
 * that exercises the activation path (not the deactivation path)
 * must stub this first call.
 */
function stubNotActive() {
  useRuntimeState.getRuntimeValue.mockReturnValueOnce([]);
}

// ── Shared beforeEach ──────────────────────────────────────────

beforeEach(() => resetMocks());

// ── Deactivation (wasActive === true) ─────────────────────────

describe('handle — deactivation (stance already active)', () => {
  it('returns popup description when deactivating a stance', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: 'Rage', effect: 'stance' },
    ]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Rage ended');
  });

  it('clears extended flag for Rage deactivation', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: 'Rage', effect: 'stance' },
    ]);

    await handle(action, ps, campaignName);

    expect(tempTeleportHandler.clearExtendedFlag).toHaveBeenCalledWith(
      defaultPlayerName,
      campaignName
    );
  });

  it('does not clear extended flag for non-Rage stances', async () => {
    const ps = makePlayerStats();
    const action = makeAction({}, { name: 'Other Stance' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: 'Other Stance', effect: 'stance' },
    ]);

    await handle(action, ps, campaignName);

    expect(tempTeleportHandler.clearExtendedFlag).not.toHaveBeenCalled();
  });

  it('returns healing illusion modal for improved duplicity deactivation', async () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ effect: 'enhanced_distraction_and_healing' }],
      },
    });
    const action = makeAction({ effect: 'create_illusion' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: action.name, effect: 'create_illusion' },
    ]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('healingIllusion');
  });
});

// ── handle — modal for options ────────────────────────────────

describe('handle — modal when options exist', () => {
  it('returns combatStance modal when action has options', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Bear' }, { name: 'Eagle' }],
    });

    stubNotActive();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('combatStance');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
  });
});

// ── activateStance — uses-based path (maxUses > 0) ────────────

describe('activateStance — uses-based path (maxUses > 0)', () => {
  it('returns popup when uses exhausted', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain(
      'has been used and cannot be used again until a Long Rest'
    );

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('decrements uses counter on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Rage activated (2/3 uses remaining)');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'rageUses',
      2,
      campaignName
    );
  });

  it('uses custom resourceKey for uses tracking', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, resourceKey: 'customUses' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'customUses',
      2,
      campaignName
    );
  });

  it('derives default usesKey from action name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 2 }, { name: 'Extra Attack' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'extraattackUses',
      1,
      campaignName
    );
  });
});

// ── activateStance — resource-based path (maxUses === 0) ──────

describe('activateStance — resource-based path (maxUses === 0)', () => {
  it('returns popup when resource is 0 or below', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Rage uses remaining.');
  });

  it('decrements resource on activation with default key', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0 });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'ragePoints',
      2,
      campaignName
    );
  });

  it('uses custom resourceKey for resource-based deduction', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'inspirationDie' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(5);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'inspirationDie',
      4,
      campaignName
    );
  });
});

// ── activateStance — channel divinity path ────────────────────

describe('activateStance — channel divinity path', () => {
  it('returns popup when channel divinity charges exhausted', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceCost: 'channel_divinity' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      'No Channel Divinity charges remaining.'
    );
  });

  it('decrements channel divinity charges on activation', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceCost: 'channel_divinity' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'channelDivinityCharges',
      1,
      campaignName
    );
  });

  it('uses class-level channel divinity charges as default max', async () => {
    const ps = makePlayerStats({
      level: 3,
      class: {
        name: 'Paladin',
        class_levels: [
          { level: 1 },
          { level: 2 },
          { level: 3, channel_divinity: 3 },
        ],
      },
    });
    const action = makeAction({ uses: 0, resourceCost: 'channel_divinity' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'channelDivinityCharges',
      2,
      campaignName
    );
  });

  it('falls back to default 2 charges when class data missing', async () => {
    const ps = makePlayerStats({
      level: 5,
      class: { name: 'Cleric', class_levels: [{ level: 5 }] },
    });
    const action = makeAction({ uses: 0, resourceCost: 'channel_divinity' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      defaultPlayerName,
      'channelDivinityCharges',
      1,
      campaignName
    );
  });
});

// ── activateStance — buff construction ────────────────────────

describe('activateStance — buff construction', () => {
  it('sets default buff properties when no option selected', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    const buff = getActiveBuffsCall();
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
    expect(buff.isImprovedDuplicity).toBe(false);
  });

  it('uses auto.effect when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, effect: 'damage_resistance' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().effect).toBe('damage_resistance');
  });

  it('uses auto.duration when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, duration: '1_hour' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().duration).toBe('1_hour');
  });

  it('reads resistanceTypes from auto when no option', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, resistanceTypes: ['acid', 'fire'] });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().resistanceTypes).toEqual(['acid', 'fire']);
  });

  it('reads advantages, damage bonus, and other properties from auto', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 3,
      advantages: ['melee_attack_roll'],
      damageBonusExpression: '1d8',
      blocksSpellcasting: true,
    });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    const buff = getActiveBuffsCall();
    expect(buff.advantages).toEqual(['melee_attack_roll']);
    expect(buff.damageBonusExpression).toBe('1d8');
    expect(buff.blocksSpellcasting).toBe(true);
  });

  it('sets reactionSave from auto when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, reactionSave: 'dexterity_save_dc_15' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().reactionSave).toBe('dexterity_save_dc_15');
  });

  it('prefers option resistanceTypes over auto resistanceTypes', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear', resistanceTypes: ['bludgeoning'] }],
    });

    sequenceMock([1, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.type).toBe('popup');
    expect(getActiveBuffsCall().resistanceTypes).toEqual(['bludgeoning']);
  });

  it('resolves all_except_force_necrotic_psychic_radiant to full list', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(getActiveBuffsCall().resistanceTypes).toEqual([
      'acid',
      'bludgeoning',
      'cold',
      'fire',
      'lightning',
      'piercing',
      'poison',
      'slashing',
      'thunder',
    ]);
  });

  it('appends buff to existing activeBuffs array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValueOnce([
      { name: 'OtherBuff', effect: 'stance' },
    ]);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    const buff = getActiveBuffsCall();
    expect(buff).toBeDefined();
    expect(buff.name).toBe('Rage');
  });
});

// ── activateStance — flySpeed logic ───────────────────────────

describe('activateStance — flySpeed logic', () => {
  it('sets flySpeed on option when not wearing armor', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' });
    const action = makeAction(
      {
        uses: 0,
        resourceKey: 'ragePoints',
        options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
      },
      { name: 'Wild Shifting' }
    );

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getActiveBuffsCall().flySpeed).toBe('10_ft');
  });

  it('blocks option flySpeed when wearing armor + noArmor flag', async () => {
    const ps = makePlayerStats({
      armorClassFormula: 'AC 15 Armor (Chain Shirt)',
    });
    const action = makeAction(
      {
        uses: 0,
        resourceKey: 'ragePoints',
        options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
      },
      { name: 'Wild Shifting' }
    );

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getActiveBuffsCall().flySpeed).toBeNull();
  });

  it('sets flySpeed from auto when no option has flySpeed but auto does', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, flySpeed: '30_ft' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().flySpeed).toBe('30_ft');
  });

  it('auto flySpeed is not blocked by armor (noArmor only applies to options)', async () => {
    const ps = makePlayerStats({
      armorClassFormula: 'AC 18 Armor (Plate)',
    });
    const action = makeAction({ uses: 3, flySpeed: '30_ft' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().flySpeed).toBe('30_ft');
  });

  it('option flySpeed takes precedence over auto flySpeed', async () => {
    const ps = makePlayerStats({ armorClassFormula: '' });
    const action = makeAction(
      {
        uses: 0,
        resourceKey: 'ragePoints',
        options: [{ name: 'Falcon', flySpeed: '15_ft' }],
        flySpeed: '30_ft',
      },
      { name: 'Wild Shifting' }
    );

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(getActiveBuffsCall().flySpeed).toBe('15_ft');
  });
});

// ── activateStance — option effect types ──────────────────────

describe('activateStance — option effect types', () => {
  it('sets ice_walk effect for Cold option', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Cold', effect: 'ice_walk' }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Cold');

    expect(getActiveBuffsCall().effect).toBe('ice_walk');
  });

  it('sets speed_boost effect with speedBonus for Fire option', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Fire', effect: 'speed_boost', speedBonus: 15 }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Fire');

    expect(getActiveBuffsCall().effect).toBe('speed_boost');
    expect(getActiveBuffsCall().speedBonus).toBe(15);
  });

  it('sets speed_boost with default 10 when speedBonus missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Fire', effect: 'speed_boost' }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Fire');

    expect(getActiveBuffsCall().speedBonus).toBe(10);
  });

  it('sets teleport_ready effect for Thunder option', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Thunder', effect: 'teleport', teleportDistance: '60 ft' }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Thunder');

    expect(getActiveBuffsCall().effect).toBe('teleport_ready');
    expect(getActiveBuffsCall().teleportDistance).toBe('60 ft');
  });

  it('uses default teleport distance when not specified', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Thunder', effect: 'teleport' }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Thunder');

    expect(getActiveBuffsCall().teleportDistance).toBe('30 ft');
  });
});

// ── activateStance — Rage-specific effects ────────────────────

describe('activateStance — Rage-specific effects', () => {
  it('removes charmed and frightened conditions when activating Rage', async () => {
    sequenceMock([
      [], // call 0: activeBuffs → not active
      1, // call 1: ragePoints > 0
      [], // call 2: activeBuffs for buff append
      ['charmed', 'frightened', 'poisoned'], // call 3: activeConditions
    ]);

    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName);

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeDefined();
    expect(conditionsCall[2]).toEqual(['poisoned']);
  });

  it('does NOT modify activeConditions when none include charmed/frightened', async () => {
    sequenceMock([[], 1, [], ['poisoned']]);

    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName);

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeUndefined();
  });

  it('handles activeConditions as non-array gracefully', async () => {
    sequenceMock([[], 1, [], null]);

    const ps = makePlayerStats();
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    await handle(action, ps, campaignName);

    const conditionsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeConditions'
    );
    expect(conditionsCall).toBeUndefined();
  });

  it('calls grantTempHpOnRage for each triggerOnRage feature', async () => {
    const feat1 = { name: 'Feat1', automation: {}, triggerOnRage: true };
    const feat2 = { name: 'Feat2', automation: {}, triggerOnRage: true };
    const ps = makePlayerStats({
      automation: { specialActions: [feat1, feat2] },
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).toHaveBeenCalledTimes(2);
    expect(tempHpBuffHandler.grantTempHpOnRage).toHaveBeenNthCalledWith(
      1,
      { name: 'Feat1', automation: feat1 },
      ps,
      campaignName
    );
    expect(tempHpBuffHandler.grantTempHpOnRage).toHaveBeenNthCalledWith(
      2,
      { name: 'Feat2', automation: feat2 },
      ps,
      campaignName
    );
  });

  it('does NOT call grantTempHpOnRage when no features have triggerOnRage', async () => {
    const ps = makePlayerStats({
      automation: { specialActions: [{ name: 'Normal Feature' }] },
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).not.toHaveBeenCalled();
  });

  it('returns teleport modal when teleport_on_rage feature exists', async () => {
    const teleportFeature = {
      name: 'Primal Warrior Teleport',
      effect: 'teleport_on_rage',
    };
    const ps = makePlayerStats({
      automation: { specialActions: [teleportFeature] },
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('teleport');
    expect(result.payload.triggeredByRage).toBe(true);
    expect(result.payload.action).toBe(teleportFeature);
  });

  it('does NOT return teleport modal when no teleport_on_rage feature', async () => {
    const ps = makePlayerStats({ automation: { specialActions: [] } });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
  });

  it('handles missing automation.specialActions gracefully', async () => {
    const ps = makePlayerStats({ automation: {} });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    await handle(action, ps, campaignName);

    expect(tempHpBuffHandler.grantTempHpOnRage).not.toHaveBeenCalled();
  });

  it('returns instinctive pounce popup when rage_bonus_movement feature exists', async () => {
    const pounceFeature = {
      name: 'Instinctive Pounce',
      effect: 'rage_bonus_movement',
      automation: { type: 'combat_stance' },
    };
    const ps = makePlayerStats({
      automation: { specialActions: [pounceFeature] },
      speed: 35,
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain(
      'Instinctive Pounce: You can move up to 17 feet'
    );
    expect(result.payload.automationType).toBe('combat_stance');
  });

  it('caps instinctive pounce movement at half speed', async () => {
    const pounceFeature = {
      name: 'Instinctive Pounce',
      effect: 'rage_bonus_movement',
      automation: { type: 'combat_stance' },
    };
    const ps = makePlayerStats({
      automation: { specialActions: [pounceFeature] },
      speed: 25,
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('12 feet');
  });

  it('prefers teleport modal over instinctive pounce modal', async () => {
    const teleportFeature = {
      name: 'Teleport',
      effect: 'teleport_on_rage',
    };
    const pounceFeature = {
      name: 'Pounce',
      effect: 'rage_bonus_movement',
    };
    const ps = makePlayerStats({
      automation: { specialActions: [teleportFeature, pounceFeature] },
    });
    const action = makeAction({ uses: 0, resourceKey: 'ragePoints' });

    sequenceMock([[], 1, [], []]);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('teleport');
  });
});

// ── activateStance — create_illusion teleport ─────────────────

describe('activateStance — create_illusion teleport', () => {
  it('returns teleport modal when teleport_swap_with_illusion exists', async () => {
    const teleportFeature = {
      name: 'Swap',
      effect: 'teleport_swap_with_illusion',
    };
    const ps = makePlayerStats({
      automation: { specialActions: [teleportFeature] },
    });
    const action = makeAction({ uses: 3, effect: 'create_illusion' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('teleport');
    expect(result.payload.triggeredByDuplicity).toBe(true);
  });

  it('does NOT return teleport modal for non-illusion effects', async () => {
    const teleportFeature = {
      name: 'Swap',
      effect: 'teleport_swap_with_illusion',
    };
    const ps = makePlayerStats({
      automation: { specialActions: [teleportFeature] },
    });
    const action = makeAction({ uses: 3, effect: 'stance' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Rage activated (1/3 uses remaining)');
  });
});

// ── activateStance — elemental stride teleport ────────────────

describe('activateStance — elemental stride teleport', () => {
  it('returns teleport modal when option has teleport effect', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Thunder', effect: 'teleport' }],
    });

    sequenceMock([1, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Thunder');

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('teleport');
    expect(result.payload.triggeredByElementalStride).toBe(true);
  });
});

// ── activateStance — description building (option-based) ──────

describe('activateStance — description with options', () => {
  it('describes Bear option with resistance text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear' }],
    });

    sequenceMock([1, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('Bear chosen');
    expect(result.payload.description).toContain(
      'Resistance to Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Poison, Slashing, Thunder'
    );
  });

  it('describes Eagle option with Dash/Disengage text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Eagle' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Eagle');

    expect(result.payload.description).toContain('Eagle chosen');
    expect(result.payload.description).toContain('Disengage and Dash');
  });

  it('describes Wolf option with ally advantage text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Wolf' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Wolf');

    expect(result.payload.description).toContain('Wolf chosen');
    expect(result.payload.description).toContain(
      'allies have Advantage on attack rolls'
    );
  });

  it('describes Falcon option with fly speed text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).toContain('Falcon chosen');
    expect(result.payload.description).toContain('Fly Speed');
  });

  it('describes Lion option with enemy disadvantage text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Lion' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Lion');

    expect(result.payload.description).toContain('Lion chosen');
    expect(result.payload.description).toContain(
      'Disadvantage on attack rolls'
    );
  });

  it('describes Ram option with prone text', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Ram' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Ram');

    expect(result.payload.description).toContain('Ram chosen');
    expect(result.payload.description).toContain('Prone condition');
  });

  it('includes rage use count in option activation description', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear' }],
    });

    sequenceMock([2, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('1 Rage use(s) remaining');
  });

  it('reads remainingRage as null and defaults to 0 in description', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear' }],
    });

    sequenceMock([1, null]);

    const result = await applyStanceOption(action, ps, campaignName, 'Bear');

    expect(result.payload.description).toContain('0 Rage use(s) remaining');
  });

  it('shows armor-blocked note for Falcon + noArmor when wearing armor', async () => {
    const ps = makePlayerStats({
      armorClassFormula: 'AC 15 Armor (Chain Shirt)',
    });
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Falcon', flySpeed: '10_ft', noArmor: true }],
    });

    sequenceMock([1, 1]);

    const result = await applyStanceOption(action, ps, campaignName, 'Falcon');

    expect(result.payload.description).toContain(
      'Blocked because you are wearing armor.'
    );
  });

  it('returns invalid option popup for unknown option name', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Bear' }],
    });

    const result = await applyStanceOption(
      action,
      ps,
      campaignName,
      'UnknownOption'
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Invalid option: UnknownOption');
  });
});

// ── Uses-based description (no options) ───────────────────────

describe('activateStance — uses-based description', () => {
  it('describes uses count when no option selected', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 }, { name: 'Second Wind' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe(
      'Second Wind activated (1/3 uses remaining)'
    );
  });

  it('appends illusion spellcasting note for create_illusion effect', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3, effect: 'create_illusion' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain(
      "While active, you can cast spells as though you were in the illusion's space."
    );
  });
});

// ── Edge cases — isImprovedDuplicity ──────────────────────────

describe('activateStance — isImprovedDuplicity flag', () => {
  it('sets isImprovedDuplicity true for enhanced duplicity passive', async () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ effect: 'enhanced_distraction_and_healing' }],
      },
    });
    const action = makeAction({ uses: 3, effect: 'create_illusion' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().isImprovedDuplicity).toBe(true);
  });

  it('does not set isImprovedDuplicity for non-illusion effects', async () => {
    const ps = makePlayerStats({
      automation: {
        passives: [{ effect: 'enhanced_distraction_and_healing' }],
      },
    });
    const action = makeAction({ uses: 3, effect: 'stance' });

    stubNotActive();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName);

    expect(getActiveBuffsCall().isImprovedDuplicity).toBe(false);
  });
});

// ── Edge cases — option property resolution ───────────────────

describe('activateStance — option property resolution', () => {
  it('uses option property over null default', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Test', resistanceTypes: ['fire'] }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Test');

    expect(getActiveBuffsCall().resistanceTypes).toEqual(['fire']);
  });

  it('uses default when option property is null or undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      uses: 0,
      resourceKey: 'ragePoints',
      options: [{ name: 'Test', resistanceTypes: null }],
    });

    sequenceMock([1, 1]);

    await applyStanceOption(action, ps, campaignName, 'Test');

    expect(getActiveBuffsCall().resistanceTypes).toEqual([]);
  });
});

// ── Integration — full buff lifecycle ─────────────────────────

describe('activateStance — full buff lifecycle', () => {
  it('buff is appended to existing buffs array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ uses: 3 });

    sequenceMock([
      [{ name: 'PreExisting', effect: 'stance' }], // call 0: activeBuffs (wasActive)
      2, // call 1: rageUses
      [{ name: 'PreExisting', effect: 'stance' }], // call 2: activeBuffs (append)
    ]);

    await handle(action, ps, campaignName);

    const lastBuffCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs'
    );
    expect(lastBuffCall[2]).toHaveLength(2);
    expect(lastBuffCall[2][0].name).toBe('PreExisting');
    expect(lastBuffCall[2][1].name).toBe('Rage');
  });
});
