// CLA-144: Flurry of Healing and Harm — both numeric halves were dead:
// (1) Hand of Healing rolled the unparseable literal '1d12 + WIS modifier + 7'
// (unresolved WIS token + double append) → heal 0; (2) Hand of Harm automation
// was searched in specialActions only (it files under reactions at
// casting_time '1 reaction') AND applyDamageToTarget was called un-awaited
// (Promise.finalDamage === 0), so the CON save never armed.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

    expect(rollExpression).toHaveBeenCalledWith('1d12 + 7');
    expect(applyHealingDirectly).toHaveBeenCalledWith(expect.any(Object), 'AasimarTest', 15, campaignName);
    const healRoll = addEntry.mock.calls.find(c => c[1].type === 'roll' && c[1].name === 'Hand of Healing');
    expect(healRoll[1].formula).toBe('1d12 + 7');
    expect(healRoll[1].total).toBe(15);
    const healHp = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && c[1].isHealing === true);
    expect(healHp[1].delta).toBe(15);
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'flurryHealingHarmUses', 6, campaignName);
  });

  it('falls back to the canonical numeric formula when no Hand of Healing row exists', async () => {
    rollExpression.mockImplementation(f => (/^\d+d\d+ [+-] \d+$/.test(f) ? { total: 15, rolls: [8], modifier: 7 } : null));

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk({ bonusActions: [] }), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1, healingTarget: 'AasimarTest',
    });

    expect(rollExpression).toHaveBeenCalledWith('1d12 + 7');
  });
});

describe('CLA-144 Hand of Harm — save arms from reactions lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCombatSummary());
    getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
    rollD20.mockReturnValue(18);
    buildSaveDc.mockReturnValue(21);
    createSaveListener.mockReturnValue({ promptId: 'p1', promise: Promise.resolve({ promptId: 'p1', success: false }) });
    usesCounter(0);
  });

  it('arms CON save vs DC 21 when Hand of Harm lives in reactions (not specialActions)', async () => {
    rollExpression.mockImplementation(f => (f === '1d12+5' ? { total: 14, rolls: [9], modifier: 5 } : { total: 10, rolls: [4, 3, 3], modifier: 0 }));
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Bandit 1',
      saveType: 'CON',
      saveDc: 21,
      attackerName: 'Disciplined_Monk',
      damageFormula: '3d6',
      damageType: 'Necrotic',
    }));
    // Monk spellcasting ability — raw automation carried saveAbility 'ability' DC with no ability; must be stamped WIS.
    expect(buildSaveDc.mock.calls[0][0]).toMatchObject({ saveDc: 'ability', saveAbility: 'WIS' });
  });

  it('applies lv17+ scaled 3d6 Necrotic + disadvantage te on failed save', async () => {
    rollExpression.mockImplementation(f => (f === '1d12+5' ? { total: 14, rolls: [9], modifier: 5 } : { total: 10, rolls: [4, 3, 3], modifier: 0 }));
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    dispatchSaveResult('p1', false);
    await new Promise(r => setTimeout(r, 0));

    expect(rollExpression).toHaveBeenCalledWith('3d6');
    const harmApply = applyDamageToTarget.mock.calls.find(c => c[2] === 10);
    expect(harmApply).toBeDefined();
    expect(harmApply[3]).toEqual(['Necrotic']);
    const harmRoll = addEntry.mock.calls.find(c => c[1].type === 'roll' && c[1].name === 'Hand of Harm');
    expect(harmRoll[1].formula).toBe('3d6');
    expect(harmRoll[1].total).toBe(10);
    const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    expect(teWrite[2][0]).toMatchObject({ effect: 'disadvantage_next_attack', target: 'Bandit 1', duration: 'until_used' });
    const condLog = addEntry.mock.calls.find(c => c[1].type === 'condition' && c[1].action === 'applied');
    expect(condLog[1].characterName).toBe('Bandit 1');
  });

  it('applies nothing on a successful save', async () => {
    rollExpression.mockImplementation(f => (f === '1d12+5' ? { total: 14, rolls: [9], modifier: 5 } : { total: 10, rolls: [4, 3, 3], modifier: 0 }));
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });
    createSaveListener.mockReturnValue({ promptId: 'p2', promise: Promise.resolve({ promptId: 'p2', success: true }) });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    dispatchSaveResult('p2', true);
    await new Promise(r => setTimeout(r, 0));

    expect(rollExpression).not.toHaveBeenCalledWith('3d6');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), campaignName);
  });

  it('uses the built automation.reactions row (resolved DC + scaled dice) when no feature row carries automation', async () => {
    rollExpression.mockImplementation(f => (f === '1d12+5' ? { total: 14, rolls: [9], modifier: 5 } : { total: 10, rolls: [4, 3, 3], modifier: 0 }));
    applyDamageToTarget.mockResolvedValue({ finalDamage: 14, newHp: 66 });
    buildSaveDc.mockImplementation(auto => auto.saveDc);

    // reaction_damage builder output shape: name + level-scaled dice + resolved DC.
    const built = { ...handOfHarmAuto, name: 'Hand of Harm', damageExpression: '3d6', saveDc: 21, saveAbility: 'WIS' };
    const monk = makeMercyMonk({ reactions: [{ name: 'Hand of Harm' }], automation: { actions: [], reactions: [built] } });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: monk, campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ saveDc: 21, damageFormula: '3d6' }));
  });

  it('0-damage strike: no save prompted, honest hand_of_harm_refused logged', async () => {
    rollExpression.mockReturnValue({ total: 14, rolls: [9], modifier: 5 });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 80 });

    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    expect(createSaveListener).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.find(c => c[1].automationType === 'hand_of_harm_refused');
    expect(refusal).toBeDefined();
    expect(refusal[1].description).toContain('0 damage');
  });

  it('reads finalDamage from the AWAITED applyDamageToTarget result (not a Promise)', async () => {
    rollExpression.mockReturnValue({ total: 14, rolls: [9], modifier: 5 });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 8, newHp: 72 });

    const result = await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeMercyMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });

    expect(result.payload.description).toContain('8 damage');
    const hpChange = addEntry.mock.calls.find(c => c[1].type === 'hp_change' && c[1].targetName === 'Bandit 1');
    expect(hpChange[1].delta).toBe(-8);
  });
});
