// @maintained-by-ai
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
// Trim fold (#751 rec): this file pins ONLY the Healing-Breath-unique faces —
// the fixed row fingerprint (advisory shape + RAW numerics + MA-1883 cost-2)
// and the honest press (spend 2 from the ROW NAME, advisory popup + record-only
// ability_use, zero rolls, NO console MA-0510). Shared refusal gates are owned
// elsewhere and are NOT re-pinned here: turn latch →
// MonsterCardModal.legendary-uses.test.jsx :309-316 (per #735/#744/#751);
// exhausted pool → same file :190-212; cost-2 insufficient-shortfall →
// MonsterCardModal.ma1883-demogorgon-legendary-cast-spell.test.jsx :216-224
// (+ service twin monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js
// :238-242); own-turn refusal → MonsterCardModal.pounce-shadow-dragon.test.jsx
// :300-305. Simurgh header economy (uses:3) + Talon-delegate + Soothing-Cry
// sibling fingerprints → MonsterCardModal.ma1991-simurgh-soothing-cry.test.jsx
// :136-147 — not re-pinned here. (cite-drift refresh #336T: was :138-148 pre-retag)
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

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
const healingRow = () => simurgh().legendary_actions.find(a => a.name === 'Healing Breath (Costs 2 Actions)');

// ---- disk fingerprint ----
describe('MA-1990 disk fingerprint: Simurgh Healing Breath flat advisory (MA-1944 option-A shape)', () => {
  it('row keys exactly [name, advisory, advisory_message, description] — advisory "healing_breath", RAW numerics carried, description byte-unchanged, MA-1883 name-cost 2 (exact keys prove no delegates_to/numeric/economy co-authorship — MA-1975 exclusivity: the delegate lane :895-905 would replace mechanicAction before the advisory branch :755 can inspect the child)', () => {
    const row = healingRow();
    expect(Object.keys(row)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(row.name).toBe('Healing Breath (Costs 2 Actions)');
    expect(row.advisory).toBe('healing_breath');
    expect(row.advisory_message).toContain('22 (4d10)');
    expect(row.advisory_message).toContain('Simurgh regains 5 Hit Points');
    expect(row.advisory_message).toMatch(/GM-enforced/);
    expect(row.description).toBe('The Simurgh exhales warm wind over one creature within 30 ft. The target regains 22 (4d10) Hit Points and the Simurgh regains 5 Hit Points.');
    // The spend the fix makes honest (behaviorally re-pinned by the press below).
    expect(legendaryActionCost(row)).toBe(2);
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

  // Refusal faces deliberately NOT re-pinned (fold rec #751, precedents
  // #735/#744): same-boundary turn latch → legendary-uses.test.jsx :309-316;
  // exhausted pool → same file :190-212; cost-2 shortfall →
  // ma1883-demogorgon modal :216-224 (+ service twin :238-242);
  // own-turn → pounce-shadow-dragon :300-305.
  it('gated Expend chip renders, press spends 2 (3->1 left) and lands advisory popup + advisory ability_use record with the RAW numerics — zero rolls, NO console MA-0510', async () => {
    renderSimurgh({ max: 3, used: 0 });
    const chip = laRow('Healing Breath').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');

    fireEvent.click(chip);
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
});
