// @maintained-by-ai
// MA-1057/MA-1058 Kraken legendary lane — canon kraken BY-name data locks +
// the two effect-distinct gated clicks, once each.
// MA-1057 (harder-zero §99): pre-fix Storm Bolt was legendary_actions[0] and
// was swallowed as the economy header (rows[0].uses != null) — plain no-onClick
// header div, slice(1) dropped it from clickable rows, ZERO affordance, economy
// capped at its own uses:1. Fix is DATA-only: prepend header {name:"Legendary
// Action Uses: 3", uses:3} (RAW = 3; disk description names no legendary count —
// honest gap, CR-23 SRD floor matching the CR-22/23 numeric-3 twins §231) and
// Storm Bolt delegates_to "Lightning Strike" (own actions[] row, DC 23 Dex
// 6d10 — resolveDelegates spans actions[], monsterLegendaryUses.js:8), no
// per-child uses/recharge noise (§165). Header boilerplate byte-mirrors the
// VERIFIED death-knight sibling (§168) with death-knight→kraken, takes 2→3.
// MA-1058 (stale-pin inversion §216): Toxic Ink pre-fix had NO save_dc — the
// generic Expend chip spent then hit the resolveLegendaryRowMechanic else-branch
// console.error (§423 burn). Now numeric save_dc:23 + range arms the row's OWN
// "DC 23 Constitution" save chip which rides the shared legendary gate
// (MonsterCardBody legendaryGate=handleLegendaryRow :216) — spend + picker on
// ONE chip. §157: the "Failure or Success:" tail attaches to the REUSE LIMIT,
// names no canonical condition → parseBothOutcomesClause null → SUCCESS grants
// NOTHING; fail leg grants Blinded+Poisoned.
// Generics cite-skipped (never re-run here): header/max/remaining, expend gate
// (turn / own-turn / exhausted), spend flow, turn-start regain, delegate
// resolution — monsterLegendaryUses.test.js :64-77/:79-109/:112-143/:145-162/
// :171-211; modal latch + exhausted sibling seams — legendary-uses.test.jsx
// (e.g. :310, :418) and legendary-uses-beholder.test.jsx:213-223; Toxic Ink
// LIVE picker adjudication (fail-grant meta, damageless pays zero) —
// SaveAttackAoeModal.kraken-toxic-ink.test.jsx (whose header names THIS file
// canon for the row-data byte pins, incl. breathAoeShape range→Radius parse).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect, parseBothOutcomesClause } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));
vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay emanation-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ROLLERS = vi.hoisted(() => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  return { rollAttack, rollDamage, rollSavingThrow };
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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

const CREATURES = [
  { name: 'Kraken 1', type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: 472, maxHp: 472, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Kraken 1.monsterLegendaryUses';

const kraken = () => monstersData.find(m => m.index === 'kraken');
const legendary = () => kraken().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const lightningRow = () => kraken().actions.find(a => a.name === 'Lightning Strike');

// MA-1057 disk lane: header PREPENDED with numeric uses:3 (was: Storm Bolt
// swallowed as rows[0]); Storm Bolt delegates with NO own numbers (§165); the
// delegate target row exists on disk with its RAW save numbers.
describe('MA-1057 kraken disk: economy header + Storm Bolt delegate byte pins', () => {
  it('rows[0] economy header uses:3 (boilerplate §168 death-knight mirror); Storm Bolt delegates_to Lightning Strike, no own numeric mechanic, no per-child uses/recharge; Lightning Strike authors DC 23 Dex 6d10 Lightning', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[0].description).toBe("The kraken takes 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The kraken regains expended legendary uses at the start of its turn.");
    const sb = row('Storm Bolt');
    expect(sb.delegates_to).toBe('Lightning Strike');
    expect(sb.description).toBe('The kraken uses Lightning Strike.');
    expect(sb.attack_bonus).toBeUndefined();
    expect(sb.save_dc).toBeUndefined();
    expect(sb.uses).toBeUndefined();
    expect(sb.recharge).toBeUndefined();
    const ls = lightningRow();
    expect(ls.save_dc).toBe(23);
    expect(ls.save_type).toBe('Dexterity');
    expect(ls.damage_dice_primary).toBe('6d10');
    expect(ls.damage_type_primary).toBe('Lightning');
  });
});

// MA-1058 disk lane canon (per SaveAttackAoeModal.kraken-toxic-ink.test.jsx
// header): numeric save_dc arms the save chip, range arms the picker
// (MA-0590 range-field-only parse → Radius), §157 tail byte-inert so SUCCESS
// grants NOTHING (fail-only Blinded+Poisoned). Key order mirrors harpy/vrock
// emanation save twins: save_dc→save_type→range→save_effect.
describe('MA-1058 kraken disk: Toxic Ink byte pins + parser derivatives', () => {
  it('save_dc:23 + range "15-foot Emanation" (uses/recharge dropped §165, save_type/save_effect byte-unchanged), key order pinned; breathAoeShape parses 15-ft Radius picker; §157 clause null; fail leg extracts blinded+poisoned', () => {
    const ti = row('Toxic Ink');
    expect(ti.uses).toBeUndefined();
    expect(ti.recharge).toBeUndefined();
    expect(ti.save_dc).toBe(23);
    expect(ti.save_type).toBe('Constitution');
    expect(ti.range).toBe('15-foot Emanation');
    expect(ti.save_effect).toBe("Failure: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. Failure or Success: The kraken can't take this action again until the start of its next turn.");
    expect(ti.description).toContain('Constitution Saving Throw: DC 23');
    expect(Object.keys(ti)).toEqual(['name', 'description', 'save_dc', 'save_type', 'range', 'save_effect']);
    expect(breathAoeShape(ti, null)).toEqual({ shape: 'Radius', feet: 15, rangeGateFt: 15 });
    expect(parseBothOutcomesClause(ti.save_effect)).toBeNull();
    expect(extractConditionsFromSaveEffect(ti.save_effect)).toEqual(['blinded', 'poisoned']);
  });
});

// Live seam: one render, one click per effect-distinct row — the two kraken
// legendary affordances adjudicate through their distinct mechanics.
describe('MA-1057/MA-1058 MonsterCardModal kraken gated clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    aoeProps.current = null;
  });

  function renderAKraken(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Kraken',
      actions: kraken().actions,
      legendary_actions: kraken().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Kraken 1', creatures: CREATURES })} />);
  }
  function krakenRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  // MA-1057: card mounts the counter + the gated Expend chip (was: swallowed
  // header, frozen "(1 left)", zero affordance). Lightning Strike carries
  // disk-truth attack_bonus:0, so the delegated leg rides the ATTACK seam
  // (+0 vs armed Bandit AC 12, autoDamageFormula 6d10) — never the
  // "no resolvable mechanic" console dead-end (§423).
  it('Storm Bolt mounts Expend-chip on "(3 left)" header; gated click spends 1 and adjudicates the delegated Lightning Strike leg once against the armed target, zero console dead-end', async () => {
    renderAKraken({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary');
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Storm Bolt (Lightning Strike save)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(0);
    expect(ROLLERS.rollAttack.mock.calls[0][2].autoDamageFormula).toBe('6d10');
    expect(ROLLERS.rollAttack.mock.calls[0][2].targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Storm Bolt/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Storm Bolt \(Lightning Strike save\)/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // MA-1058 stale-pin inversion: post-fix the row self-suppresses the generic
  // Expend chip (MonsterAction.jsx:182) and renders its OWN "DC 23
  // Constitution" save chip; one gated click spends the economy AND opens the
  // 15-ft emanation picker — the picker owns adjudication (no auto roll here;
  // fail/success grants are canon in SaveAttackAoeModal.kraken-toxic-ink).
  it('Toxic Ink renders its own "DC 23 Constitution" save chip (no Expend chip); one gated click spends 1 and opens the 15-ft emanation picker, zero auto-roll', async () => {
    renderAKraken({ max: 3, used: 0 });
    const r = krakenRow('Toxic Ink');
    expect(r.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = r.querySelector('.mc-dice-link-save-clickable');
    expect(chip.textContent).toContain('DC 23');
    expect(chip.textContent).toContain('Constitution');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(document.querySelector('.emanation-picker-stub')).not.toBe(null));
    expect(aoeProps.current.saveDc).toBe(23);
    expect(aoeProps.current.range).toBe(15);
    expect(aoeProps.current.titleOverride).toMatch(/15-ft Radius/);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Toxic Ink/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Toxic Ink/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
