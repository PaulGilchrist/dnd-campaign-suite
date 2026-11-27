// @maintained-by-ai 2026-11-26
// CLA-144: Flurry of Healing and Harm — both numeric halves were dead:
// (1) Hand of Healing rolled the unparseable literal '1d12 + WIS modifier + 7'
// (unresolved WIS token + double append) → heal 0; (2) Hand of Harm automation
// was searched in specialActions only (it files under reactions at
// casting_time '1 reaction') AND applyDamageToTarget was called un-awaited
// (Promise.finalDamage === 0), so the CON save never armed.
//
// Lane ownership (bonusAttacksHandler trio):
// - THIS file owns: heal-formula resolution (incl. no-row fallback), Hand of
//   Harm automation lookup (all three homes: specialActions / reactions /
//   built automation.reactions, pinned via one it.each), scaling/alsoInflicts
//   on save outcome, the awaited applyDamageToTarget read (finalDamage≠raw
//   divergence pinned inside the save-success test), the hasFlurryHealingHarm
//   feature gate, and is the SOLE writer pin of the runtime key
//   'flurryHealingHarmUses' decrement (single 7→6 and multi-strike 2→1→0
//   order — absorbed from the main file's embedded
//   describe('Flurry of Healing and Harm integration') so that block in
//   bonusAttacksHandler.test.js can be dropped without losing coverage).
//   The mid-flurry heal→harm lane switch stays in the main file.
// - cla143 sibling owns: unarmed-die selection (resolveFlurryWeaponStats) +
//   rolled-vs-applied honesty. turnStartEffects pins the key's turn-start SET;
//   this lane owns the in-flurry DECREMENT writes.
// Note: the source's 'could not be resolved' refusal log is dead code —
// isHandOfHarmStrike already requires a truthy handOfHarmAuto (see SOURCE
// BUGS in the audit report), so only the live 0-damage refusal is pinned.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
  rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
  buildSaveDc: vi.fn(),
}));

import { applyFlurryOfBlows } from './bonusAttacksHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyHealingDirectly } from '../../common/healingRoll.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';

const campaignName = 'test-campaign';
const mapName = 'test-map';

const flurryAction = {
  name: 'Heightened Flurry of Blows',
  automation: {
    type: 'bonus_attacks',
    attacks: 3,
    attackType: 'unarmed_strike',
  },
};

// Raw classes.json Warrior of Mercy shapes (2024).
const handOfHealingAuto = {
  type: 'healing',
  healExpression: 'martial_arts_die + WIS modifier',
  action: 'bonus_action',
  resourceCost: 'focus_point',
  casting_time: '1 bonus action',
};

const handOfHarmAuto = {
  type: 'reaction_damage',
  trigger: 'creature_within_5ft_hits_on_attack_roll',
  damageExpression: '1d6',
  damageType: 'Necrotic',
  saveType: 'CON',
  saveDc: 'ability',
  scaling: { 11: '2d6', 17: '3d6' },
  resourceCost: 'focus_point',
  alsoInflicts: 'disadvantage_next_attack',
  casting_time: '1 reaction',
};

// lv20 2024 Mercy monk: martial_arts_die d12, WIS 24 → +7. Hand of Healing
// lands in bonusActions, Hand of Harm in reactions (NOT specialActions).
function makeMercyMonk(overrides = {}) {
  return {
    name: 'Disciplined_Monk',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Wisdom', bonus: 7 }, { name: 'Constitution', bonus: 2 }],
    attacks: [
      { name: 'Unarmed Strike', type: 'Action', weaponType: 'unarmed', hitBonus: 11, damage: '1d12+5', damageType: 'Bludgeoning' },
    ],
    class: { class_levels: [{ level: 20, martial_arts_die: 12 }] },
    bonusActions: [{ name: 'Hand of Healing', automation: handOfHealingAuto }],
    reactions: [{ name: 'Hand of Harm', automation: handOfHarmAuto }],
    specialActions: [{ name: 'Flurry of Healing and Harm' }],
    automation: { actions: [], reactions: [] },
    ...overrides,
  };
}

function makeCombatSummary() {
  return { creatures: [{ name: 'Bandit 1', currentHp: 80, maxHp: 80, ac: 12 }] };
}

function usesCounter(n) {
  getRuntimeValue.mockImplementation((key, field, _cn) => {
    if (key === 'Disciplined_Monk' && field === 'flurryHealingHarmUses') return n;
    return null;
  });
}

// Every harm-lane test needs a numeric attack roll and a deterministic
// necrotic roll: '1d12+5' is the strike, anything else is the 3d6 harm dice.
function strikeAndHarmRolls() {
  rollExpression.mockImplementation(f => (f === '1d12+5' ? { total: 14, rolls: [9], modifier: 5 } : { total: 10, rolls: [4, 3, 3], modifier: 0 }));
}

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success, roll: 5, total: 7 } }));
}

describe('CLA-144 Hand of Healing — numeric formula resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCombatSummary());
    getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
    rollD20.mockReturnValue(18);
    applyHealingDirectly.mockReturnValue({ newHp: 30, actualHeal: 15 });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 15, newHp: 65 });
    usesCounter(7);
  });

  it('rolls a fully numeric heal formula (no literal WIS token) and applies heal > 0', async () => {
    rollExpression.mockImplementation(f => (/^\d+d\d+ [+-] \d+$/.test(f) ? { total: 15, rolls: [8], modifier: 7 } : null));

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1, healingTarget: 'AasimarTest',
    });

    // Exactly one roll, fully numeric — the original defect was the literal
    // '1d12 + WIS modifier + 7' (unresolved token + double append).
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('1d12 + 7');
    expect(applyHealingDirectly).toHaveBeenCalledWith(expect.any(Object), 'AasimarTest', 15, campaignName);
    const healRoll = addEntry.mock.calls.find(c => c[1].type === 'roll' && c[1].name === 'Hand of Healing');
    expect(healRoll[1].formula).toBe('1d12 + 7');
    expect(healRoll[1].total).toBe(15);
    const healHp = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && c[1].isHealing === true);
    expect(healHp[1].delta).toBe(15);
    expect(healHp[1].note).toContain('Hand of Healing');
    // The ONLY runtime write is the single decrement.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'flurryHealingHarmUses', 6, campaignName);
  });

  // Audit hygiene (2026-11-14 MM, healingRoll.js:88 sign-stamp law): a HoH
  // flurry rider clamped to 0 at the target's cap logs its honest delta-0 row
  // but must NEVER stamp isHealing:true. The use still burns.
  it('stamps isHealing:false on the hp_change row when the rider heal clamps to 0', async () => {
    rollExpression.mockImplementation(f => (/^\d+d\d+ [+-] \d+$/.test(f) ? { total: 15, rolls: [8], modifier: 7 } : null));
    applyHealingDirectly.mockReturnValue({ newHp: 30, actualHeal: 0 }); // target already at max

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1, healingTarget: 'AasimarTest',
    });

    const healHp = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && String(c[1].note).includes('Hand of Healing'));
    expect(healHp[1].delta).toBe(0);
    expect(healHp[1].isHealing).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'flurryHealingHarmUses', 6, campaignName);
  });

  // Absorbed from main bonusAttacksHandler.test.js integration block: the
  // per-strike threading of the uses counter (2→1→0, never re-read) is
  // pinned ONLY here — single-strike 7→6 above does not cover it.
  it('decrements flurryHealingHarmUses for each healing strike (2→1→0)', async () => {
    rollExpression.mockImplementation(f => (/^\d+d\d+ [+-] \d+$/.test(f) ? { total: 15, rolls: [8], modifier: 7 } : null));
    usesCounter(2);

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 2 }, numAttacks: 2, healingTarget: 'AasimarTest',
    });

    expect(applyHealingDirectly).toHaveBeenCalledTimes(2);
    expect(applyHealingDirectly).toHaveBeenCalledWith(expect.any(Object), 'AasimarTest', 15, campaignName);
    // Healing strikes never take the damage lane.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    // The ONLY runtime writes are the threaded decrement, in strict order.
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Disciplined_Monk', 'flurryHealingHarmUses', 1, campaignName);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Disciplined_Monk', 'flurryHealingHarmUses', 0, campaignName);
  });

  it('falls back to the canonical numeric formula when no Hand of Healing row exists', async () => {
    rollExpression.mockImplementation(f => (/^\d+d\d+ [+-] \d+$/.test(f) ? { total: 15, rolls: [8], modifier: 7 } : null));

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk({ bonusActions: [] }), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1, healingTarget: 'AasimarTest',
    });

    expect(rollExpression).toHaveBeenCalledWith('1d12 + 7');
    expect(applyHealingDirectly).toHaveBeenCalledWith(expect.any(Object), 'AasimarTest', 15, campaignName);
  });

  // Absorbed from main bonusAttacksHandler.test.js integration block: the
  // hasFlurryHealingHarm gate is pinned ONLY here. Counter readability must
  // not matter — the gate is the specialActions row, not the uses value.
  it('does not apply Flurry of Healing and Harm when player lacks the feature', async () => {
    rollExpression.mockReturnValue({ total: 14, rolls: [9], modifier: 5 });

    const result = await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk({ specialActions: [] }), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1, healingTarget: 'AasimarTest',
    });

    // Plain unarmed-strike damage lane only: no heal, no harm save, zero writes.
    expect(applyHealingDirectly).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(result.handOfHarmSavePromises).toBeUndefined();
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
  });
});

describe('CLA-144 Hand of Harm — save arms from every automation home', () => {
  // The listener removes itself as its LAST act (after any awaited harm
  // application), so spying on removeEventListener gives every save-outcome
  // test an observable condition for vi.waitFor — no bare setTimeout flushes.
  // The save-armed it.each never dispatches a result, so afterEach also
  // detaches whatever listeners each test registered (leaked 'p1' listeners
  // would otherwise re-fire on later dispatches and inflate write censuses).
  let addListenerSpy;
  let removeListenerSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    addListenerSpy = vi.spyOn(window, 'addEventListener');
    removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    getCombatSummary.mockReturnValue(makeCombatSummary());
    getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
    rollD20.mockReturnValue(18);
    // Realistic buildSaveDc stand-in: rows carry saveDc 'ability' (the mock
    // resolves the WIS DC to 21); the built reaction already carries 21.
    buildSaveDc.mockImplementation(auto => (typeof auto.saveDc === 'number' ? auto.saveDc : 21));
    createSaveListener.mockReturnValue({ promptId: 'p1', promise: Promise.resolve({ promptId: 'p1', success: false }) });
    usesCounter(0);
  });

  afterEach(() => {
    for (const [type, handler] of addListenerSpy.mock.calls) {
      if (type === 'save-result') window.removeEventListener('save-result', handler);
    }
    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });

  // CLA-144 defect 2: a specialActions-only lookup missed the reaction-filed
  // row and the save never armed. All three homes in resolveHandOfHarmAutomation
  // must arm the identical save.
  it.each([
    {
      home: 'the specialActions row',
      monk: () => makeMercyMonk({
        reactions: [],
        specialActions: [
          { name: 'Flurry of Healing and Harm' },
          { name: 'Hand of Harm', automation: handOfHarmAuto },
        ],
      }),
      // This branch returns the raw row without the WIS stamp — pin the divergence.
      checkDcArg: arg => {
        expect(arg).toMatchObject({ saveDc: 'ability' });
        expect(arg.saveAbility).toBeUndefined();
      },
    },
    {
      home: 'the reactions row (saveAbility stamped WIS for the monk)',
      monk: () => makeMercyMonk(),
      checkDcArg: arg => expect(arg).toMatchObject({ saveDc: 'ability', saveAbility: 'WIS' }),
    },
    {
      home: 'the built automation.reactions row (resolved DC + scaled dice)',
      monk: () => makeMercyMonk({
        reactions: [{ name: 'Hand of Harm' }],
        automation: { actions: [], reactions: [{ ...handOfHarmAuto, name: 'Hand of Harm', damageExpression: '3d6', saveDc: 21, saveAbility: 'WIS' }] },
      }),
      checkDcArg: arg => expect(arg).toMatchObject({ saveDc: 21 }),
    },
  ])('arms the CON save vs DC 21 on 3d6 when Hand of Harm resolves from $home', async ({ monk, checkDcArg }) => {
    strikeAndHarmRolls();
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });

    const result = await applyFlurryOfBlows({
      action: flurryAction, playerStats: monk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    checkDcArg(buildSaveDc.mock.calls[0][0]);
    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Bandit 1',
      attackerName: 'Disciplined_Monk',
      saveType: 'CON',
      saveDc: 21,
      sourceName: 'Heightened Flurry of Blows',
      damageFormula: '3d6',
      damageType: 'Necrotic',
    });
    // The save promise is surfaced to the caller so the UI can await it.
    expect(result.handOfHarmSavePromises).toHaveLength(1);
  });

  it('applies lv17+ scaled 3d6 Necrotic + disadvantage te on failed save', async () => {
    strikeAndHarmRolls();
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    dispatchSaveResult('p1', false);
    // Listener removes itself after any awaited harm application completes.
    await vi.waitFor(() => expect(removeListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function)));

    expect(rollExpression).toHaveBeenCalledWith('3d6');
    // Call 1 = the strike; call 2 = the awaited harm application.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
    expect(applyDamageToTarget.mock.calls[1]).toEqual([
      expect.any(Object), 'Bandit 1', 10, ['Necrotic'],
      expect.objectContaining({ campaignName, attackerName: 'Disciplined_Monk' }),
    ]);
    const harmRoll = addEntry.mock.calls.find(c => c[1].type === 'roll' && c[1].name === 'Hand of Harm');
    expect(harmRoll[1].formula).toBe('3d6');
    expect(harmRoll[1].total).toBe(10);
    const harmHp = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && String(c[1].note).includes('Hand of Harm'));
    expect(harmHp[1].delta).toBe(-14);
    expect(harmHp[1].currentHp).toBe(66);
    // The ONLY runtime write is the registry-known disadvantage te, appended.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue.mock.calls[0]).toEqual([
      'campaign', 'targetEffects',
      [expect.objectContaining({ target: 'Bandit 1', source: 'Heightened Flurry of Blows', option: 'disadvantage_next_attack', effect: 'disadvantage_next_attack', duration: 'until_used' })],
      campaignName,
    ]);
    const condLog = addEntry.mock.calls.find(c => c[1].type === 'condition' && c[1].action === 'applied');
    expect(condLog[1].characterName).toBe('Bandit 1');
  });

  // Doubles as the awaited-applyDamageToTarget pin: the strike mocks
  // finalDamage 8 ≠ rolled 14, so an un-awaited Promise read would show
  // '0 damage' here (the original CLA-144 defect).
  it('successful save: no harm roll, no harm damage, zero writes', async () => {
    strikeAndHarmRolls();
    applyDamageToTarget.mockResolvedValue({ finalDamage: 8, newHp: 72 });
    createSaveListener.mockReturnValue({ promptId: 'p2', promise: Promise.resolve({ promptId: 'p2', success: true }) });

    const result = await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    // Awaited read: popup and hp row carry the finalDamage (8), not raw (14).
    expect(result.payload.description).toContain('8 damage');
    const hpChange = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && c[1].targetName === 'Bandit 1');
    expect(hpChange[1].delta).toBe(-8);

    dispatchSaveResult('p2', true);
    // Success path does no async work — the self-removal flushes the listener.
    await vi.waitFor(() => expect(removeListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function)));

    expect(rollExpression).not.toHaveBeenCalledWith('3d6');
    // Only the strike's damage application happened.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('0-damage strike: no save prompted, honest hand_of_harm_refused logged', async () => {
    strikeAndHarmRolls();
    applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 80 });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    expect(createSaveListener).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.find(c => c[1].automationType === 'hand_of_harm_refused');
    expect(refusal).toBeDefined();
    expect(refusal[1].description).toContain('dealt 0 damage');
  });
});
