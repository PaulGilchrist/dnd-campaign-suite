// MA-1057 regression: Kraken "Storm Bolt" (legendary_actions[0], uses:1) was
// swallowed as the economy header (MA-0675 §99 harder-zero): legendaryHeaderAction
// (monsterLegendaryUses.js:156, rows[0].uses != null) returned Storm Bolt itself,
// the card rendered its name+(1 left) in a plain no-onClick header div
// (MonsterCardBody.jsx MonsterLegendaryHeaderRow), children slice(1) dropped it
// from the clickable rows, and LegendarySpendLink never ran — ZERO affordance,
// economy capped at 1, frozen "(1 left)", click zero-delta, console 0. Fix is
// DATA-only per §99/§165/§168 (MA-0675 elemental-cataclysm + MA-0956 gynosphinx
// fixed twins on disk): prepend header {name:"Legendary Action Uses: 3", uses:3}
// (RAW Kraken = 3; disk description names NO legendary count — honest gap, floor
// = CR-23 SRD 3, matching the CR-22/23 numeric-3 twins §231), give Storm Bolt
// delegates_to:"Lightning Strike" (actions[] row exists: DC 23 Dex 6d10 Lightning —
// resolveDelegates spans actions[], monsterLegendaryUses.js:8) and drop per-child
// uses/recharge noise. Toxic Ink keeps its save transport fields (rides the shared
// legendary gate as rows[1]; MA-1058 owns its own audit).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect, parseBothOutcomesClause } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
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
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 5),
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

const CREATURES = [
  { name: 'Kraken 1', type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: 472, maxHp: 472, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Kraken 1.monsterLegendaryUses';
const LATCH_KEY = 'Kraken 1._legendaryUses_usedRound';

const kraken = () => monstersData.find(m => m.index === 'kraken');
const legendary = () => kraken().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const lightningRow = () => kraken().actions.find(a => a.name === 'Lightning Strike');

// MA-1057 data lock: economy header PREPENDED with numeric uses:3 (was: no
// header — rows[0] was the Storm Bolt prose child, swallowed as the header,
// capping the economy at its own uses:1). Description byte-mirrors the VERIFIED
// death-knight header (playbook §168) with death knight→kraken; the kraken's
// own description names NO legendary count (honest gap — CR-23 SRD floor = 3,
// matching CR-22/23 numeric-3 twins §231).
describe('MA-1057 monsters.json data: kraken legendary header authors uses:3', () => {
  it('rows[0] is the economy header with uses:3 (was: Storm Bolt)', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[1].name).toBe('Storm Bolt');
    expect(legendaryHeaderAction(kraken())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(legendary()[0].description).toBe("The kraken takes 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The kraken regains expended legendary uses at the start of its turn.");
  });

  it('header boilerplate mirrors the VERIFIED death-knight sibling byte-for-byte', () => {
    const dk = monstersData.find(m => m.index === 'death-knight').legendary_actions[0];
    const mirror = dk.description.replace(/\bdeath knight\b/g, 'kraken').replace('takes 2 legendary', 'takes 3 legendary');
    expect(legendary()[0].description).toBe(mirror);
  });

  it('Storm Bolt delegates_to Lightning Strike, no own numeric mechanic, no per-child uses/recharge (§165)', () => {
    const sb = row('Storm Bolt');
    expect(sb.delegates_to).toBe('Lightning Strike');
    expect(sb.description).toBe('The kraken uses Lightning Strike.');
    expect(sb.attack_bonus).toBeUndefined();
    expect(sb.save_dc).toBeUndefined();
    expect(sb.uses).toBeUndefined();
    expect(sb.recharge).toBeUndefined();
  });

  it('delegate resolves the kraken own Lightning Strike row: DC 23 Dex 6d10 Lightning save', () => {
    const ls = lightningRow();
    expect(ls.save_dc).toBe(23);
    expect(ls.save_type).toBe('Dexterity');
    expect(ls.damage_dice_primary).toBe('6d10');
    expect(ls.damage_type_primary).toBe('Lightning');
    const delegate = legendaryDelegateAction(kraken(), row('Storm Bolt'));
    expect(delegate).toBe(ls);
    expect(legendaryDelegateAttackName(row('Storm Bolt'), ls)).toBe('Storm Bolt (Lightning Strike save)');
  });

  it('Toxic Ink keeps save transport, drops per-child uses/recharge noise (§165)', () => {
    const ti = row('Toxic Ink');
    expect(ti.uses).toBeUndefined();
    expect(ti.recharge).toBeUndefined();
    expect(ti.save_type).toBe('Constitution');
    expect(ti.save_effect).toBe("Failure: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. Failure or Success: The kraken can't take this action again until the start of its next turn.");
    expect(ti.description).toContain('Constitution Saving Throw: DC 23');
  });

  // MA-1058 DATA fix: prose "DC 23" (MA-0237 prose-DC family) + prose
  // "15-foot Emanation" (MA-0590 reads RANGE field only, §181) now NUMERIC.
  // save_type/save_effect byte-unchanged (ticket). save_dc arms the legendary
  // save chip (ActionSaveRoll gate save_dc!=null, MonsterAction.jsx:106) and
  // routes the gated click to handleSaveRoll (resolveLegendaryRowMechanic
  // :570); range arms the picker (breathAoeShape). Twin placement mirrors the
  // VERIFIED harpy Luring Song / vrock Spores rows: save_dc→save_type→range→save_effect.
  it('MA-1058 Toxic Ink authors numeric save_dc:23 + range "15-foot Emanation", save_type/save_effect byte-unchanged', () => {
    const ti = row('Toxic Ink');
    expect(ti.save_dc).toBe(23);
    expect(ti.range).toBe('15-foot Emanation');
    // byte-unchanged (from MA-1057 above):
    expect(ti.save_type).toBe('Constitution');
    expect(ti.save_effect).toBe("Failure: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. Failure or Success: The kraken can't take this action again until the start of its next turn.");
    // key order mirrors harpy/vrock emanation save twins:
    expect(Object.keys(ti)).toEqual(['name', 'description', 'save_dc', 'save_type', 'range', 'save_effect']);
  });

  // MA-0590 seam: range-field-only parse opens the SaveAttackAoeModal picker
  // (Emanation→Radius, rangeGateFt = attacker-origin feet). damageless save —
  // NO damage dice anywhere (§Actual fd==0), save_dc present pre/post-fix.
  it('MA-1058 breathAoeShape parses Toxic Ink as a 15-ft Radius emanation picker (range field byte)', () => {
    const ti = row('Toxic Ink');
    expect(breathAoeShape(ti, null)).toEqual({ shape: 'Radius', feet: 15, rangeGateFt: 15 });
  });

  // §157/§160 both-outcomes marker: the "Failure or Success:" tail on this row
  // attaches to the REUSE LIMIT ("can't take this action again"), NOT to the
  // conditions. parseBothOutcomesClause reads the tail after the marker — the
  // kraken tail names no canonical condition and no "can't take Reactions" →
  // null, so SUCCESS grants NOTHING (conditions stay fail-only per RAW). The
  // fail leg grants Blinded+Poisoned from the "Failure:" section.
  it('MA-1058 §157 marker is byte-inert (reuse-limit tail names no condition) — success grants nothing, fail grants Blinded+Poisoned', () => {
    const ti = row('Toxic Ink');
    expect(parseBothOutcomesClause(ti.save_effect)).toBeNull();
    expect(extractConditionsFromSaveEffect(ti.save_effect)).toEqual(['blinded', 'poisoned']);
  });
});

// MA-1057 live seam: header counter mounts at 3, Storm Bolt gains the gated
// Expend chip (was: zero affordance, swallowed header, frozen (1 left), click
// zero-delta), the gated click spends the shared pool and adjudicates the
// delegated Lightning Strike DC 23 Dex save against the armed target.
describe('MA-1057 MonsterCardModal kraken gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
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

  it('header shows "Legendary Action Uses: 3 (3 left)"; Storm Bolt renders a gated Expend chip', () => {
    renderAKraken({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 3');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  // MA-1058 STALE-PIN INVERSION (§216): pre-fix Toxic Ink had NO save_dc, so
  // LegendarySpendLink rendered the generic "Expend Legendary" chip that spent
  // the use then hit the resolveLegendaryRowMechanic else-branch console.error
  // (§423 burn). Post-fix save_dc:23 arms ActionSaveRoll: LegendarySpendLink
  // self-suppresses on numeric rows (MonsterAction.jsx:182) and the row now
  // renders its OWN "DC 23 Constitution" save chip (mc-dice-link-save-clickable)
  // which rides the shared legendary gate — MonsterCardBody rewires the
  // legendary section's onSaveRoll to legendaryGate=handleLegendaryRow (:216),
  // so the gated spend (economy) + adjudication (picker) BOTH ride one chip.
  it('MA-1058 Toxic Ink now renders its own "DC 23 Constitution" save chip (no Expend chip), riding the shared gate', () => {
    renderAKraken({ max: 3, used: 0 });
    const r = krakenRow('Toxic Ink');
    expect(r.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = r.querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 23');
    expect(chip.textContent).toContain('Constitution');
  });

  // MA-0675 live shape: Lightning Strike carries disk-truth attack_bonus:0,
  // so the delegate resolves through the ATTACK seam (Eruption→Elemental
  // Burst +15/5d6 twin): rollAttack rides the delegated row's own numbers —
  // +0 vs the armed Bandit AC 12 with autoDamageFormula 6d10 Lightning.
  it('Storm Bolt gated click spends 1 and adjudicates the delegated Lightning Strike leg against the armed target, zero console dead-end', async () => {
    renderAKraken({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Storm Bolt (Lightning Strike save)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(0);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('6d10');
    expect(options.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Storm Bolt/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Storm Bolt \(Lightning Strike save\)/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('repeat same-window refuses (turn latch): zero extra spend, zero extra save, one spend log', async () => {
    renderAKraken({ max: 3, used: 0 });
    const chip = krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /expends a legendary use for Storm Bolt/.test(String(e.description)));
    expect(spends.length).toBe(1);
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(1);
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero save', async () => {
    renderAKraken({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(String(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'legendary_use_refused').description)).toContain('exhausted');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero save', async () => {
    renderAKraken({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Kraken 1', creatures: CREATURES };
    fireEvent.click(krakenRow('Storm Bolt').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses and latch with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 3 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Bandit 1' };
    const res = await regainLegendaryUses({
      monsterName: 'Kraken 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Kraken 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
