// MA-1847 modal seam: the Apep "Devour the Boat (Costs 2 Actions)" row now
// renders its OWN "DC 26 Constitution" save chip riding the shared legendary
// gate (MA-0567 rows[1+] twin). resolveLegendaryRow refuses an armed-target
// prerequisite failure BEFORE the spend (MA-0023 pre-spend refusal model,
// MA-0019 evaluateTargetPrerequisiteGate helpers reused): un-grappled armed
// target → popup + devour_the_boat_costs_2_actions_refused log, ZERO
// legendary spend, no save prompt, no roll. Grappled armed target → spend 1
// (advisory cost-2 stays name-text — MA-1839 engine residual) then the
// DC 26 CON save fires with the 6d10 Piercing pool and the no_healing rider
// armed on the save context (§233 grammar, MA-0016 hit-lane twin).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const apep = monstersData.find((m) => m.index === 'apep');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [7, 7], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) } }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml, _resetPopup: () => { _popupHtml = null; } };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'ElderPaladin', creatures: [] } }));
const armed = vi.hoisted(() => ({ target: null }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => armed.target),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;
const resetPopup = useLoggedDiceRoll._resetPopup;

const CREATURES = [
  { name: 'Apep 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 624, maxHp: 624, ac: 23, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 175, maxHp: 175, conditions: [] },
];

function renderApep(uses) {
  runtime.store['Apep 1.monsterLegendaryUses'] = uses;
  runtime.store['Apep 1._legendaryUses_usedRound'] = null;
  ctx.value = { round: 2, activeCreatureName: 'ElderPaladin', creatures: CREATURES };
  const m = makeMonster({ name: 'Apep', legendary_actions: apep.legendary_actions });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Apep 1', creatures: CREATURES })} />);
}

function devourChip() {
  const rows = [...document.querySelectorAll('.mc-action')].filter((r) => r.querySelector('strong')?.textContent.startsWith('Devour the Boat'));
  expect(rows.length).toBeGreaterThan(0);
  return rows[0].querySelector('.mc-dice-link-save-clickable');
}

describe('MA-1847 Devour chip rides the legendary gate with its own save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
    armed.target = CREATURES[1];
  });

  it('row renders its own 6d10 + DC 26 Constitution chips on the card (no Expend chip, no delegated attack chip)', () => {
    renderApep({ max: 3, used: 0 });
    const row = [...document.querySelectorAll('.mc-action')].find((r) => r.querySelector('strong')?.textContent.startsWith('Devour the Boat'));
    const chips = [...row.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['6d10', 'DC 26 Constitution']);
  });

  it('UN-grappled armed target: refused BEFORE the spend — popup + refused log, zero LA, no save', async () => {
    runtime.store['ElderPaladin.activeConditions'] = [];
    runtime.store['ElderPaladin.activeConditionMeta'] = {};
    renderApep({ max: 3, used: 0 });
    fireEvent.click(devourChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'devour_the_boat_costs_2_actions_refused')).toBe(true));
    expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.type === 'ability_use')).toBe(false);
  });

  it('grappled armed target: spends 1 (cost-2 advisory floor), DC 26 CON save fires with 6d10 Piercing + no_healing rider armed', async () => {
    runtime.store['ElderPaladin.activeConditions'] = ['grappled'];
    runtime.store['ElderPaladin.activeConditionMeta'] = { grappled: { dc: 26, source: 'Apep 1' } };
    renderApep({ max: 3, used: 0 });
    fireEvent.click(devourChip());

    await waitFor(() => expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toUpperCase()).toContain('CON');
    expect(call[2]).toMatchObject({
      saveDc: 26,
      targetName: 'ElderPaladin',
      autoDamageFormula: '6d10',
      autoDamageDamageType: 'Piercing',
      dcSuccess: 'half',
      saveTargetEffect: { effect: 'no_healing' },
    });
    const spend = addEntry.mock.calls.map((c) => c[1]).find((e) => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Devour the Boat (Costs 2 Actions)');
    expect(spend.description).toContain('Devour the Boat (Costs 2 Actions)');
    expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'devour_the_boat_costs_2_actions_refused')).toBe(false);
  });

  it('same-boundary refire after spend: honest latch refusal, no second save', async () => {
    runtime.store['ElderPaladin.activeConditions'] = ['grappled'];
    runtime.store['ElderPaladin.activeConditionMeta'] = { grappled: { dc: 26, source: 'Apep 1' } };
    renderApep({ max: 3, used: 0 });
    fireEvent.click(devourChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    fireEvent.click(devourChip());
    await waitFor(() => expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'legendary_use_refused' && /turn/.test(e.description))).toBe(true));
    expect(runtime.store['Apep 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
  });
});
