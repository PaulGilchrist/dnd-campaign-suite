// MA-0023 regression: Aboleth Psychic Drain legendary row. Gate = at least
// one creature Charmed/Grappled BY the aboleth (provenance per MA-0019;
// tentacle grapples per MA-0018). Unmet → popup + psychic_drain_refused log,
// ZERO legendary spend, no save, no heal. Met → expend 1 use (MA-0021
// economy), delegated Consume Memories resolves via the untouched MA-0019
// armed-target save seam (DC 16 INT, 3d6 full/half), then self_heal 1d10
// rolls through the canonical applyHealingToTarget helper (MA-0016) logging
// hp_change isHealing naming Psychic Drain.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const TENTACLE = { name: 'Tentacle', attack_bonus: 9, damage_dice_primary: '2d6 + 5', damage_type_primary: 'Bludgeoning', reach: '15 ft.' };
const CONSUME_MEMORIES = {
  name: 'Consume Memories',
  description: 'Intelligence Saving Throw: DC 16, one creature within 30 feet that is Charmed or Grappled by the aboleth. Failure: 10 (3d6) Psychic damage. Success: Half damage.',
  save_dc: 16,
  save_type: 'Intelligence',
  damage_dice_primary: '3d6',
  damage_type_primary: 'Psychic',
  save_effect: 'Failure: 10 (3d6) Psychic damage. Success: Half damage',
  target_prerequisite: { conditions: ['charmed', 'grappled'], by_attacker: true },
};

function abolethLegendary() {
  const aboleth = monstersData.find(m => m.name === 'Aboleth');
  return aboleth.legendary_actions;
}

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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
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
  { name: 'Aboleth 1', type: 'npc', targetName: 'TestPC', currentHp: 140, maxHp: 150, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAboleth(uses) {
  runtime.store['Aboleth 1.monsterLegendaryUses'] = uses;
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  const m = makeMonster({ name: 'Aboleth', actions: [TENTACLE, CONSUME_MEMORIES], legendary_actions: abolethLegendary() });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function drainLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-legendary')).find(el => el.closest('div')?.textContent.includes('Psychic Drain')) || null;
}

describe('MA-0023 data: Psychic Drain structured on disk', () => {
  it('row delegates Consume Memories, heals 1d10, any-ally prerequisite', () => {
    const row = monstersData.find(m => m.name === 'Aboleth').legendary_actions.find(a => a.name === 'Psychic Drain');
    expect(row.delegates_to).toBe('Consume Memories');
    expect(row.self_heal).toBe('1d10');
    expect(row.target_prerequisite).toEqual({ conditions: ['charmed', 'grappled'], any_ally_of_attacker: true });
  });
});

describe('MA-0023 Psychic Drain gate refusal (unmet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('no charmed/grappled creature: popup + psychic_drain_refused log, ZERO spend, no save, no heal', async () => {
    runtime.store['TestPC.activeConditions'] = [];
    renderAboleth({ max: 3, used: 0 });
    const link = drainLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'psychic_drain_refused')).toBe(true));
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'ability_use')).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'hp_change')).toBe(false);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ctx.value.creatures[0].currentHp).toBe(140);
  });

  it('charmed but attributed to another source: still refused (provenance)', async () => {
    runtime.store['TestPC.activeConditions'] = ['charmed'];
    runtime.store['TestPC.activeConditionMeta'] = { charmed: { dc: 15, source: 'Some Hag' } };
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(drainLink());
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'psychic_drain_refused')).toBe(true));
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});

describe('MA-0023 Psychic Drain full resolve (met)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('tentacle-grappled PC (MA-0018 provenance): spends 1, delegated DC16 INT save fires, aboleth self-heals 1d10 with hp_change isHealing', async () => {
    runtime.store['TestPC.activeConditions'] = ['grappled'];
    runtime.store['TestPC.activeConditionMeta'] = { grappled: { dc: 14, source: 'Aboleth 1' } };
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(drainLink());

    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    // Delegated Consume Memories resolves through the existing save seam untouched.
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const saveCall = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(saveCall[2]).toMatchObject({ saveDc: 16, targetName: 'TestPC', autoDamageFormula: '3d6' });
    // Spend + heal logs both name Psychic Drain.
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Psychic Drain \(Consume Memories save\)/);
    const heal = await waitFor(() => {
      const e = addEntry.mock.calls.map(c => c[1]).find(x => x.type === 'hp_change');
      expect(e).toBeTruthy();
      return e;
    });
    expect(heal.targetName).toBe('Aboleth 1');
    expect(heal.isHealing).toBe(true);
    expect(heal.delta).toBeGreaterThanOrEqual(1);
    expect(heal.delta).toBeLessThanOrEqual(10);
    expect(heal.description).toContain('Psychic Drain');
    expect(ctx.value.creatures[0].currentHp).toBeGreaterThan(140);
    expect(ctx.value.creatures[0].currentHp).toBeLessThanOrEqual(150);
  });

  it('charmed-by-aboleth ally also opens the gate; heal clamps at max HP', async () => {
    ctx.value.creatures[0].currentHp = 150;
    runtime.store['Thug 1.activeConditions'] = ['charmed'];
    runtime.store['Thug 1.activeConditionMeta'] = { charmed: { dc: 15, source: 'Aboleth 1' } };
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(drainLink());
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'hp_change' && e.targetName === 'Aboleth 1' && e.isHealing === true)).toBe(true));
    expect(ctx.value.creatures[0].currentHp).toBeLessThanOrEqual(150);
  });
});
