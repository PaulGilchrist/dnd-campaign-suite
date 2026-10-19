// @maintained-by-ai
// MA-1991 regression: Simurgh "Soothing Cry (Costs 2 Actions)"
// (legendary_actions[3]) shipped {name, delegates_to:null, description} only —
// the MA-1936/MA-1990 twin: the generic MA-0021 Expend chip SPENT TWO
// legendary uses (MA-1883 name-cost parse live) and resolved NOTHING:
// delegates_to:null is falsy so the delegate lane never runs, the row
// carries no numeric mechanic, and the final else hits the MA-0510
// console.error dead-end — live-confirmed 2026-10-13:
// spends {max:3, used:2}, ability_use-only log, popup null, Bandit 1
// pre-rigged Frightened INTACT after every press (no condition-END
// transport exists on the legendary lane).
//
// FIX shape = MA-1944/MA-1990 option-A precedent (orchestrator-adjudicated):
// flat `advisory: "soothing_cry"` + `advisory_message` carrying the full RAW
// text, authored AFTER `delegates_to:null` per the MA-1936 byte-shape
// (King Kong Climbing Dash / Ladon Vigilant Watch twins keep the explicit
// null — falsy, the delegate lane skips it, the advisory branch preempts).
//
// Trim fold (#752 recs): this file pins ONLY the Soothing-Cry-unique faces —
// the fixed row fingerprint (exact keys incl. explicit-null delegates_to,
// advisory shape + RAW text + MA-1883 cost-2 folded in per #747) — plus the
// SIMURGH HEADER ECONOMY SOLE-HOME (healing-breath ma1990 folded its header
// pin here) and the honest press (spend 2 from the ROW NAME, advisory popup +
// record-only ability_use, zero rolls, ZERO condition grants, NO console
// MA-0510). Shared refusal gates are owned elsewhere and are NOT re-pinned
// here: same-boundary turn latch → MonsterCardModal.legendary-uses.test.jsx
// :309-316; exhausted pool → same file :195-212; cost-2 shortfall →
// MonsterCardModal.ma1883-demogorgon-legendary-cast-spell.test.jsx :216-224
// (+ service twin monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js
// :238-242); own-turn → MonsterCardModal.pounce-shadow-dragon.test.jsx
// :300-305. Chip-render folded into the press per #752's ma1990 exemplar.
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
  rangeToFeet: vi.fn(() => 60),
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
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: ['frightened'] },
];

const simurgh = () => monsters.find(m => m.index === 'simurgh');
const legendaryRows = () => simurgh().legendary_actions;
const soothingRow = () => legendaryRows().find(a => a.name === 'Soothing Cry (Costs 2 Actions)');

// ---- disk fingerprint ----
describe('MA-1991 disk fingerprint: Simurgh Soothing Cry flat advisory (MA-1944/MA-1990 option-A shape)', () => {
  it('row keys exactly [name, delegates_to, advisory, advisory_message, description] — explicit-null delegates_to (MA-1936 byte-shape: falsy, delegate lane never runs, advisory branch preempts), advisory "soothing_cry" carrying the RAW text, description byte-unchanged, MA-1883 name-cost 2 (exact keys prove no numeric/economy co-authorship)', () => {
    const row = soothingRow();
    expect(Object.keys(row)).toEqual(['name', 'delegates_to', 'advisory', 'advisory_message', 'description']);
    expect(row.name).toBe('Soothing Cry (Costs 2 Actions)');
    expect(row.delegates_to).toBe(null);
    expect(row.advisory).toBe('soothing_cry');
    expect(row.advisory_message).toContain('Each ally within 60 ft. is calmed');
    expect(row.advisory_message).toContain('Charmed, Frightened, or Confused');
    expect(row.advisory_message).toMatch(/GM-enforced/);
    expect(row.advisory_message).toMatch(/spends 2 per press/);
    expect(row.description).toBe('Each ally within 60 ft. is calmed, ending one effect causing them to be Charmed, Frightened, or Confused.');
    // The spend the fix makes honest (behaviorally re-pinned by the press below).
    expect(legendaryActionCost(row)).toBe(2);
  });

  it('header economy and siblings byte-intact (header uses:3, Talon delegate child, Healing Breath keeps healing_breath advisory) — SIMURGH HEADER SOLE-HOME per ma1990 fold', () => {
    const h = legendaryRows()[0];
    expect(h.name).toBe('Legendary Action Uses: 3');
    expect(h.uses).toBe(3);
    expect(legendaryHeaderAction(simurgh())).toBe(h);
    expect(legendaryRows()[1].name).toBe('Talon');
    expect(legendaryRows()[1].delegates_to).toBe('Talon');
    const heal = legendaryRows().find(a => a.name === 'Healing Breath (Costs 2 Actions)');
    expect(heal.advisory).toBe('healing_breath');
    expect(legendaryRows().length).toBe(4);
  });
});

// ---- live press seam ----
describe('MA-1991 MonsterCardModal press: Soothing Cry spends 2 then lands the advisory record (no silent burn)', () => {
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

  // Refusal faces deliberately NOT re-pinned (fold rec #752, precedents
  // #735/#744/#751): same-boundary turn latch → legendary-uses.test.jsx
  // :309-316; exhausted pool → same file :195-212; cost-2 shortfall →
  // ma1883-demogorgon modal :216-224 (+ service twin :238-242);
  // own-turn → pounce-shadow-dragon :300-305.
  it('gated Expend chip renders, press spends 2 (3->1 left) and lands advisory popup + advisory ability_use record with the RAW text — zero rolls, ZERO condition grants, NO console MA-0510', async () => {
    renderSimurgh({ max: 3, used: 0 });
    const chip = laRow('Soothing Cry').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');

    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Simurgh 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const popups = setPopupHtml.mock.calls.map(c => String(c[0]));
    expect(popups.some(h => /Legendary Action — Soothing Cry \(Costs 2 Actions\)/.test(h) && h.includes('Each ally within 60 ft. is calmed') && h.includes('Charmed, Frightened, or Confused') && /GM-enforced/.test(h))).toBe(true);
    const entries = addEntry.mock.calls.map(c => c[1]);
    const spend = entries.find(e => e.type === 'ability_use' && /spends 2 legendary uses for Soothing Cry \(Costs 2 Actions\)/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.characterName).toBe('Simurgh 1');
    const advisory = entries.find(e => e.type === 'ability_use' && e.abilityName === 'Soothing Cry (Costs 2 Actions)' && /advisory record/.test(e.description));
    expect(advisory).toBeTruthy();
    expect(advisory.description).toContain('Each ally within 60 ft. is calmed');
    expect(advisory.description).toContain('Charmed, Frightened, or Confused');
    expect(advisory.description).toMatch(/GM-enforced/);
    // advisory is record-only: no roll, no damage, no save, and the
    // condition-END it describes never fabricates a grant (GM-enforced).
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(entries.some(e => e.type === 'condition' || e.type === 'condition removed')).toBe(false);
    // MA-0510 dead-end is DEAD: no console error on the resolved press.
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
