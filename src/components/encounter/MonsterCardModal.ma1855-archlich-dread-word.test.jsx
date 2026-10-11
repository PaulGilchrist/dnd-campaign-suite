// MA-1855: Archlich Dread Word (legendary_actions[3]) was a stranded save
// shell — the row authored save_dc/save_type + row-level conditions:[] but NO
// damage_dice_primary/damage_type_primary and NO save_effect, so the prose
// "takes 22 (5d8) Psychic damage" (no Hit|Failure|Success: anchor, §255) let
// extractDamageDiceFromDescription return null and extractConditionsFromSaveEffect
// saw undefined → failed save paid ZERO damage and granted ZERO condition (live
// proof: lastAttack.saveResult:"failure", zero roll-damage, zero hp_change,
// activeConditions absent). Data fix (MA-1847/MA-0622 byte-shape siblings):
// damage_dice_primary "5d8" + damage_type_primary "Psychic" + save_effect
// carrying the canonical "Frightened" word (§346 save-lane word-scan).
// dc_success stays ABSENT — engine default 'half' (§335) is RAW ("half as much
// damage on a successful save"); live ledger post-fix: fail nat 8 → full 5d8
// raw 22 (hp −22), success +23 wb → floor(29/2)=14 (hp −14), zero Frightened
// on success (fail-only grant lane).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const archlich = () => monstersData.find((m) => m.name === 'Archlich');
const dreadRow = () => archlich().legendary_actions.find((a) => a.name === 'Dread Word');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 29, rolls: [8, 6, 3, 6, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 58, rolls: [8, 6, 3, 6, 6, 8, 6, 3, 6, 6], modifier: 0 })),
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'AasimarTest', creatures: [] } }));
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
const resetPopup = useLoggedDiceRoll._resetPopup;

const CREATURES = [
  { name: 'Archlich 1', type: 'npc', targetName: 'Bandit 1', currentHp: 475, maxHp: 475, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [], resistances: [] },
];

function renderArchlich(uses) {
  runtime.store['Archlich 1.monsterLegendaryUses'] = uses;
  runtime.store['Archlich 1._legendaryUses_usedRound'] = null;
  ctx.value = { round: 2, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  const m = makeMonster({ name: 'Archlich', legendary_actions: archlich().legendary_actions });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Archlich 1', creatures: CREATURES })} />);
}

function dreadWordRow() {
  const rows = [...document.querySelectorAll('.mc-action')].filter((r) => r.querySelector('strong')?.textContent.trim().startsWith('Dread Word'));
  expect(rows.length).toBeGreaterThan(0);
  return rows[0];
}

function dreadWordSaveChip() {
  return Array.from(dreadWordRow().querySelectorAll('.mc-dice-link-save-clickable')).find((el) => el.textContent.includes('DC 22 Wisdom')) || null;
}

describe('MA-1855 monsters.json data lock: Archlich Dread Word row', () => {
  it('legendary_actions[3] is Dread Word, DC 22 Wisdom save riding the uses:3 header', () => {
    const la = archlich().legendary_actions;
    expect(la[0].uses).toBe(3);
    expect(la[3].name).toBe('Dread Word');
    expect(dreadRow().save_dc).toBe(22);
    expect(dreadRow().save_type).toBe('Wisdom');
  });

  it('damage + save_effect authored: 5d8 Psychic + canonical Frightened transport, dc_success ABSENT (engine default half, §335)', () => {
    const row = dreadRow();
    expect(row.damage_dice_primary).toBe('5d8');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(canRollExpression(row.damage_dice_primary)).toBe(true);
    expect(row.save_effect).toMatch(/\bFrightened\b/);
    expect(row.dc_success).toBeUndefined();
    // MV-31 transport proof: the REAL save-lane extractor word-scans the row
    // bytes to exactly one canonical condition — no spray of other words.
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['frightened']);
  });

  it('save chip damage pool resolves from the authored field, not the unanchored prose (§255)', () => {
    // Prose carries no Hit|Failure|Success: anchor — without the authored
    // damage_dice_primary the extract lane returns null (the original defect).
    expect(dreadRow().description).toMatch(/takes 22 \(5d8\) Psychic damage/);
    expect(/(?:Hit|Failure|Success):\s*22\s*\(5d8\)/i.test(dreadRow().description)).toBe(false);
  });
});

describe('MA-1855 MonsterCardModal Dread Word save lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
    armed.target = CREATURES[1];
  });

  it('row renders its own 5d8 + DC 22 Wisdom chips (chip identity unchanged by the fix)', () => {
    renderArchlich({ max: 3, used: 0 });
    const chips = [...dreadWordRow().querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['5d8', 'DC 22 Wisdom']);
  });

  it('press spends 1 legendary use and rides the SAVE lane with 5d8 Psychic + frightened armed, dcSuccess half', async () => {
    renderArchlich({ max: 3, used: 0 });
    fireEvent.click(dreadWordSaveChip());
    await waitFor(() => expect(runtime.store['Archlich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(String(ROLLERS.rollSavingThrow.mock.calls[0][0]).toUpperCase()).toContain('WIS');
    expect(context.saveDc).toBe(22);
    expect(context.targetName).toBe('Bandit 1');
    expect(context.autoDamageFormula).toBe('5d8');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.dcSuccess).toBe('half');
    expect(context.saveConditions).toEqual(['frightened']);
    const spend = addEntry.mock.calls.map((c) => c[1]).find((e) => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Dread Word');
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('FAILED save pays FULL 5d8 raw (live ledger: raw 22, hp −22)', () => {
    expect(computeDamageAfterSave(22, false, 'half')).toBe(22);
    expect(computeDamageAfterSave(5, false, 'half')).toBe(5);
    expect(computeDamageAfterSave(40, false, 'half')).toBe(40);
  });

  it('SUCCESS save pays half floored (live ledger: raw 29 → finalDamage 14)', () => {
    expect(computeDamageAfterSave(29, true, 'half')).toBe(14);
    expect(computeDamageAfterSave(23, true, 'half')).toBe(11);
    expect(computeDamageAfterSave(22, true, 'half')).toBe(11);
  });

  it('same-boundary refire after spend: honest latch refusal, no second save (economy unchanged)', async () => {
    renderArchlich({ max: 3, used: 0 });
    fireEvent.click(dreadWordSaveChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    fireEvent.click(dreadWordSaveChip());
    await waitFor(() => expect(addEntry.mock.calls.map((c) => c[1]).some((e) => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Archlich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
  });
});
