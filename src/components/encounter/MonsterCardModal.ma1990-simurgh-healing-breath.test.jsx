// MA-1990 regression: Simurgh "Healing Breath (Costs 2 Actions)"
// (legendary_actions[2]) shipped {name, description} only — the bare MA-0021
// generic Expend chip SPENT TWO legendary uses (MA-1883 name-cost parse live)
// and resolved NOTHING: no delegates_to, no numeric fields, and the row's
// "regains 22 (4d10) Hit Points" prose never matches
// extractDamageDiceFromDescription's /(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+)/ —
// final else console.error MA-0510 silent-burn (live-confirmed 2026-10-12:
// spends {max:3, used:2}, ability_use-only log, popup null, Bandit held 5/11,
// Simurgh 486/486, zero roll/hp_change entries).
//
// FIX shape = MA-1944 option-A precedent (orchestrator-adjudicated): flat
// `advisory: "healing_breath"` + `advisory_message` carrying the full RAW
// numerics. On legendary rows advisory PREEMPTS the numeric/delegate legs
// (resolveLegendaryRowMechanic :755-762, after the gate spend) and routes
// buildLegendaryAdvisoryPopup/Log — honest record-only spend. delegates_to
// is NOT co-authored (MA-1975 exclusivity: the delegate lane :895-905 would
// replace mechanicAction before the advisory branch could inspect the child;
// a delegating press would force an unconditional Talon attack, MA-1847 axis).
//
// Live seam pinned below: press spends 2 of 3 (cost parsed from the ROW NAME)
// then lands the advisory popup + advisory ability_use record carrying
// "22 (4d10)" and "5 Hit Points" — zero rollAttack/rollDamage/rollSavingThrow
// (no monster-heal transport exists in the legendary lane; self_heal heals
// the monster only — GM-enforced), NO console MA-0510 dead-end.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { legendaryHeaderAction, legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const r = { rollAttack: null, rollDamage: null, rollSavingThrow: null };
  return r;
});
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
    popupHtml: _popupHtml,
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
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

const CREATURES = [
  { name: 'Simurgh 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 486, maxHp: 486, ac: 21, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 5, maxHp: 11, ac: 12, conditions: [] },
];

const simurgh = () => monsters.find(m => m.index === 'simurgh');
const legendaryRows = () => simurgh().legendary_actions;
const headerRow = () => legendaryRows()[0];
const healingRow = () => legendaryRows().find(a => a.name === 'Healing Breath (Costs 2 Actions)');

// ---- disk fingerprint ----
describe('MA-1990 disk fingerprint: Simurgh Healing Breath flat advisory (MA-1944 option-A shape)', () => {
  it('row keys exactly [name, advisory, advisory_message, description] — advisory "healing_breath", RAW numerics carried, description byte-unchanged', () => {
    const row = healingRow();
    expect(Object.keys(row)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(row.name).toBe('Healing Breath (Costs 2 Actions)');
    expect(row.advisory).toBe('healing_breath');
    expect(row.advisory_message).toContain('22 (4d10)');
    expect(row.advisory_message).toContain('Simurgh regains 5 Hit Points');
    expect(row.advisory_message).toMatch(/GM-enforced/);
    expect(row.description).toBe('The Simurgh exhales warm wind over one creature within 30 ft. The target regains 22 (4d10) Hit Points and the Simurgh regains 5 Hit Points.');
  });

  it('NO delegates_to co-authorship (MA-1975 exclusivity — delegate lane replaces mechanicAction before the advisory branch can inspect the child) and no numeric/economy fields', () => {
    const row = healingRow();
    expect(row.delegates_to).toBeUndefined();
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.self_heal).toBeUndefined();
    expect(row.uses).toBeUndefined();
    expect(row.recharge).toBeUndefined();
  });

  it('header economy and siblings byte-intact (header uses:3, Talon delegate child, Soothing Cry untouched)', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 3');
    expect(h.uses).toBe(3);
    expect(legendaryHeaderAction(simurgh())).toBe(h);
    expect(legendaryRows()[1].name).toBe('Talon');
    expect(legendaryRows()[1].delegates_to).toBe('Talon');
    const soothe = legendaryRows().find(a => a.name === 'Soothing Cry (Costs 2 Actions)');
    expect(soothe.advisory).toBeUndefined();
    expect(legendaryRows().length).toBe(4);
  });

  it('MA-1883 name-cost parse stays 2 (the spend the fix makes honest)', () => {
    expect(legendaryActionCost(healingRow())).toBe(2);
  });
});

// ---- live press seam ----
describe('MA-1990 MonsterCardModal press: Healing Breath spends 2 then lands the advisory record (no silent burn)', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderSimurgh(uses) {
    runtime.store['Simurgh 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Simurgh',
      armor_class: 21,
      hit_points: 486,
      actions: simurgh().actions,
      legendary_actions: simurgh().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Simurgh 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('Healing Breath keeps the gated Expend chip', () => {
    renderSimurgh({ max: 3, used: 0 });
    const chip = laRow('Healing Breath').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('press spends 2 and lands advisory popup + advisory ability_use record with the RAW numerics — zero rolls, NO console MA-0510', async () => {
    renderSimurgh({ max: 3, used: 0 });
    fireEvent.click(laRow('Healing Breath').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Simurgh 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const popups = setPopupHtml.mock.calls.map(c => String(c[0]));
    expect(popups.some(h => /Legendary Action — Healing Breath \(Costs 2 Actions\)/.test(h) && h.includes('22 (4d10)') && h.includes('Simurgh regains 5 Hit Points') && /GM-enforced/.test(h))).toBe(true);
    const entries = addEntry.mock.calls.map(c => c[1]);
    const spend = entries.find(e => e.type === 'ability_use' && /spends 2 legendary uses for Healing Breath \(Costs 2 Actions\)/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.characterName).toBe('Simurgh 1');
    const advisory = entries.find(e => e.type === 'ability_use' && e.abilityName === 'Healing Breath (Costs 2 Actions)' && /advisory record/.test(e.description));
    expect(advisory).toBeTruthy();
    expect(advisory.description).toContain('22 (4d10)');
    expect(advisory.description).toContain('Simurgh regains 5 Hit Points');
    expect(advisory.description).toMatch(/GM-enforced/);
    // advisory is record-only: no roll, no damage, no save, no heal transport.
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // MA-0510 dead-end is DEAD: no console error on the resolved press.
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same-boundary refire refuses (turn latch) — zero extra spend, record stayed one advisory', async () => {
    renderSimurgh({ max: 3, used: 0 });
    fireEvent.click(laRow('Healing Breath').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Simurgh 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Healing Breath').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Simurgh 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('insufficient-cost refire honest (MA-1883): 1 remaining < cost 2 — popup names the shortfall, zero spend', async () => {
    renderSimurgh({ max: 3, used: 2 });
    fireEvent.click(laRow('Healing Breath').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('costs 2 legendary uses');
    expect(runtime.store['Simurgh 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
  });
});
