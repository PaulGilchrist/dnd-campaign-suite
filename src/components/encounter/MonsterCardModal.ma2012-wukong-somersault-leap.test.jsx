// @maintained-by-ai
// MA-2012 regression: Sun Wukong "Somersault Leap" (legendary_actions[2])
// shipped {name, description} only — the generic MA-0021 "Expend Legendary"
// chip (MonsterAction.jsx:220) SPENT one use unconditionally (resolveLegendaryRow
// expendLegendaryUse :920) and resolved NOTHING: no advisory, no ability_check,
// no delegates_to, no numeric fields — resolveLegendaryRowMechanic fell through
// every branch into the MA-0510 console.error dead-end (:776, live-confirmed
// 2026-10-13: legal-boundary press burned {max:3, used:0→1}, ability_use
// spend-line-only log, popup null, console ERROR 'no resolvable mechanic').
//
// FIX shape = MA-1944 option-A / MA-1990-1991 flat-advisory precedent, byte-
// twin of the MA-1936 King Kong Climbing Dash row: flat `advisory:
// "somersault_leap"` + `advisory_message` carrying the RAW clause ("flies up to
// his full fly Speed (300 ft.) without provoking Opportunity Attacks"). Movement
// distance + no-OA suppression are structurally unexpressible (§398/§70 — no
// moveToken/setTokenPos consumers; opportunity consumers are PC-side only) —
// advisory pins the honest GM-enforced advisory seam, never a fabricated
// movement consumer. Advisory PREEMPTS the numeric/delegate legs
// (resolveLegendaryRowMechanic :755-761, after the gate spend) → honest
// record-only spend. delegates_to is NOT co-authored (MA-1975 exclusivity —
// the delegate lane :895-905 replaces mechanicAction before the advisory branch
// could inspect the child).
//
// Trim fold (#751 carried rec): this file pins ONLY the Somersault-Leap-unique
// faces — the flat-advisory row fingerprint (exact keys BY NAME + RAW clause +
// MA-1883 name-cost parse folded = 1, plain press) plus the Wukong-only header/
// sibling economy (no sibling Wukong file owns it) and the honest press (chip
// render folded into press: spend 1, advisory popup + record-only ability_use,
// zero rolls, NO console MA-0510). Shared refusal gates are owned elsewhere and
// are NOT re-pinned here: same-boundary turn latch →
// MonsterCardModal.legendary-uses.test.jsx :309-316 (per #735/#744/#751/#753);
// exhausted pool → same file :195-212; cost-shortfall →
// MonsterCardModal.ma1883-demogorgon-legendary-cast-spell.test.jsx :216-224
// (+ service twin monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js
// :238-242); own-turn refusal → MonsterCardModal.pounce-shadow-dragon.test.jsx
// :300-305.
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
  { name: 'Sun Wukong 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 520, maxHp: 520, ac: 23, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const wukong = () => monsters.find(m => m.index === 'sun-wukong');
const legendaryRows = () => wukong().legendary_actions;
const leapRow = () => legendaryRows().find(a => a.name === 'Somersault Leap');

// ---- disk fingerprint (folded: row + economy + cost parse, one lock) ----
describe('MA-2012 disk fingerprint: Sun Wukong Somersault Leap flat advisory (MA-1944 option-A / MA-1936 King Kong byte-twin shape)', () => {
  it('leap row keys exactly [name, advisory, advisory_message, description] — advisory "somersault_leap", RAW clause carried, description byte-unchanged, MA-1883 name-cost 1 (exact keys prove no delegates_to/numeric/economy co-authorship — MA-1975 exclusivity: the delegate lane :895-905 replaces mechanicAction before the advisory branch :755 can inspect the child) — header economy and siblings byte-intact (uses:3 gate behind the press below, Club delegate child, Locking Word cost-2 save child)', () => {
    const row = leapRow();
    expect(Object.keys(row)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(row.name).toBe('Somersault Leap');
    expect(row.advisory).toBe('somersault_leap');
    expect(row.advisory_message).toContain('flies up to his full fly Speed');
    expect(row.advisory_message).toContain('300 ft.');
    expect(row.advisory_message).toContain('without provoking Opportunity Attacks');
    expect(row.advisory_message).toMatch(/advisory record/);
    expect(row.advisory_message).toMatch(/GM-enforced/);
    expect(row.description).toBe('Sun Wukong flies up to his full fly Speed without provoking Opportunity Attacks.');
    // Plain press — the spend the fix makes honest (behaviorally re-pinned below).
    expect(legendaryActionCost(row)).toBe(1);
    // Wukong-only economy: no sibling Wukong test file owns this, and the
    // press describe's {max: 3} is otherwise a bare mock with no disk anchor.
    const h = legendaryRows()[0];
    expect(h.name).toBe('Legendary Action Uses: 3');
    expect(h.uses).toBe(3);
    expect(legendaryHeaderAction(wukong())).toBe(h);
    expect(legendaryRows()[1].name).toBe('Club');
    expect(legendaryRows()[1].delegates_to).toBe('Ruyi Jingu Bang');
    expect(legendaryRows()[3].name).toBe('Locking Word (Costs 2 Actions)');
    expect(legendaryRows()[3].save_dc).toBe(24);
    expect(legendaryRows()[3].save_type).toBe('Wisdom');
    expect(legendaryRows().length).toBe(4);
  });
});

// ---- live press seam ----
describe('MA-2012 MonsterCardModal press: Somersault Leap spends 1 then lands the advisory record (no silent burn)', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderWukong(uses) {
    runtime.store['Sun Wukong 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Sun Wukong',
      armor_class: 23,
      hit_points: 520,
      actions: wukong().actions,
      legendary_actions: wukong().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Sun Wukong 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  // Refusal faces deliberately NOT re-pinned (fold rec #751, precedents
  // #735/#744/#753): same-boundary turn latch → legendary-uses.test.jsx
  // :309-316; exhausted pool → same file :195-212; cost-shortfall →
  // ma1883-demogorgon modal :216-224 (+ service twin :238-242);
  // own-turn → pounce-shadow-dragon :300-305.
  it('gated Expend chip renders, press spends 1 and lands advisory popup + advisory ability_use record with the RAW clause — zero rolls, NO console MA-0510', async () => {
    renderWukong({ max: 3, used: 0 });
    const chip = laRow('Somersault Leap').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');

    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Sun Wukong 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const popups = setPopupHtml.mock.calls.map(c => String(c[0]));
    expect(popups.some(h => /Legendary Action — Somersault Leap/.test(h) && h.includes('flies up to his full fly Speed') && h.includes('300 ft.') && /GM-enforced/.test(h))).toBe(true);
    const entries = addEntry.mock.calls.map(c => c[1]);
    const spend = entries.find(e => e.type === 'ability_use' && /expends a legendary use for Somersault Leap/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.characterName).toBe('Sun Wukong 1');
    const advisory = entries.find(e => e.type === 'ability_use' && e.abilityName === 'Somersault Leap' && /advisory record/.test(e.description));
    expect(advisory).toBeTruthy();
    expect(advisory.description).toContain('flies up to his full fly Speed');
    expect(advisory.description).toContain('300 ft.');
    expect(advisory.description).toMatch(/GM-enforced/);
    // advisory is record-only: no roll, no damage, no save, no movement transport.
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // MA-0510 dead-end is DEAD: no console error on the resolved press.
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
