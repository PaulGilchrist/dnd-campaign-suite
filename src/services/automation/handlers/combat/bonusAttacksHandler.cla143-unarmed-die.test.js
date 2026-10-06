// CLA-143: Flurry of Blows unarmed_strike rows must roll the Unarmed Strike
// die, not attacks[0] (staff-first sheets rolled 1d6 instead of lv20 1d12).
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

import { handle, applyFlurryOfBlows } from './bonusAttacksHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const mapName = 'test-map';

const flurryAction = {
  name: 'Heightened Flurry of Blows',
  automation: {
    type: 'bonus_attacks',
    attacks: 3,
    attackType: 'unarmed_strike',
    cost: { resource: 'focus_points', amount: 1 },
    trigger: 'after_attack_action',
  },
};

// lv20 2024 monk sheet with Quarterstaff equipped first (attacks[0] = staff 1d6+5)
function makeStaffFirstMonk() {
  return {
    name: 'Disciplined_Monk',
    level: 20,
    attacks: [
      { name: 'Quarterstaff', type: 'Action', weaponType: 'melee', hitBonus: 11, damage: '1d6+5', damageType: 'Bludgeoning' },
      { name: 'Unarmed Strike', type: 'Action', weaponType: 'unarmed', hitBonus: 11, damage: '1d12+5', damageType: 'Bludgeoning' },
      { name: 'Unarmed Strike', type: 'Bonus Action', weaponType: 'unarmed', hitBonus: 11, damage: '1d12+5', damageType: 'Bludgeoning' },
    ],
    specialActions: [],
    automation: { actions: [] },
  };
}

function makeCombatSummary() {
  return { creatures: [{ name: 'Bandit 1', currentHp: 11, maxHp: 11, ac: 12 }] };
}

describe('CLA-143 resolveFlurryWeaponStats — unarmed_strike die', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCombatSummary());
    getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
    getRuntimeValue.mockReturnValue(null);
    rollD20.mockReturnValue(18);
    rollExpression.mockReturnValue({ total: 11, rolls: [6, 5], modifier: 5 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 0 });
  });

  it('handle modal payload uses the Unarmed Strike die when staff is attacks[0]', async () => {
    const result = await handle(flurryAction, makeStaffFirstMonk(), campaignName, mapName);
    expect(result.type).toBe('modal');
    expect(result.payload.damageFormula).toBe('1d12+5');
    expect(result.payload.attackBonus).toBe(11);
    expect(result.payload.damageType).toBe('Bludgeoning');
  });

  it('applyFlurryOfBlows rolls and logs the Unarmed Strike die (1d12+5), not the staff die', async () => {
    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeStaffFirstMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });
    expect(rollExpression).toHaveBeenCalledWith('1d12+5');
    const damageLogs = addEntry.mock.calls.filter(c => c[1].rollType === 'damage');
    expect(damageLogs.length).toBe(1);
    expect(damageLogs[0][1].formula).toBe('1d12+5');
  });

  it('falls back to attacks[0] when no unarmed entry exists', async () => {
    const noUnarmed = { ...makeStaffFirstMonk(), attacks: [makeStaffFirstMonk().attacks[0]] };
    const result = await handle(flurryAction, noUnarmed, campaignName, mapName);
    expect(result.payload.damageFormula).toBe('1d6+5');
  });

  it('attackType-less rows keep attacks[0] behavior byte-identical', async () => {
    const noType = { name: 'Some Flurry', automation: { type: 'bonus_attacks', attacks: 2 } };
    const result = await handle(noType, makeStaffFirstMonk(), campaignName, mapName);
    expect(result.payload.damageFormula).toBe('1d6+5');
    await applyFlurryOfBlows({
      action: noType, playerStats: makeStaffFirstMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });
    expect(rollExpression).toHaveBeenCalledWith('1d6+5');
  });

  it('disengage_dodge rows keep attacks[0] behavior byte-identical', async () => {
    const pd = { name: 'Patient Defense', automation: { type: 'bonus_attacks', attacks: 2, attackType: 'disengage_dodge' } };
    const result = await handle(pd, makeStaffFirstMonk(), campaignName, mapName);
    expect(result.payload.damageFormula).toBe('1d6+5');
  });

  it('ability_use ledger reports rolled totals honestly when applied death-clamps to 0', async () => {
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 0 });
    await applyFlurryOfBlows({
      action: flurryAction, playerStats: makeStaffFirstMonk(), campaignName,
      _mapName: mapName, distribution: { 'Bandit 1': 1 }, numAttacks: 1,
    });
    const abilityEntry = addEntry.mock.calls.find(c => c[1].type === 'ability_use');
    expect(abilityEntry[1].description).toContain('Total damage dealt: 0');
    expect(abilityEntry[1].description).toContain('rolled 11');
  });
});
