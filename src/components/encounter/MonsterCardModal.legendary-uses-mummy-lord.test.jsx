// @maintained-by-ai — audited + trimmed 2026-10-18: 325L/14 tests → 5 behavioral
// tests (BY-name data locks #387, mount affordance, save-chip owner lane
// :171-190 = MA-0676 twin cited by #629, delegated-attack click §432).
// Dead-mock purge bisected green; lane ranges above are this file's post-trim lines.
// MA-1204 regression: Mummy Lord "Dread Command" (legendary_actions[0], uses:1)
// was swallowed as the economy header (§99 header-swallow): legendaryHeaderAction
// (monsterLegendaryUses.js, rows[0].uses != null) returned Dread Command itself,
// the card rendered its name+(1 left) in a plain no-onClick header div
// (MonsterCardBody.jsx MonsterLegendaryHeaderRow), children slice(1) dropped it,
// and LegendarySpendLink never ran — ZERO affordance, pool max 1 vs RAW 3, click
// zero-delta, console 0. Its Glare/Necrotic Strike siblings SILENT-BURNED the
// swallowed-header counter (console.error "no resolvable mechanic", MA-0510
// fingerprint). Fix is DATA-only per §99/§165/§168 (MA-0620 dracolich + MA-0675
// elemental-cataclysm + MA-1057 kraken fixed twins on disk): prepend header
// {name:"Legendary Action Uses: 3", uses:3} (RAW Mummy Lord = 3 legendary
// actions; plain numeric header per §231), Dread Command gets NUMERIC spell fields
// copied from the Spellcasting row (save_dc:17 = 8 + WIS +4 + PB +5, Wisdom,
// dc_success:"none" + range per spells.json Command), Glare delegates_to
// "Dreadful Glare" and Necrotic Strike delegates_to "Rotting Fist" (both exist
// in actions[], resolveDelegates spans actions, monsterLegendaryUses.js:8),
// per-child uses/recharge dropped (§165).
// Generic legs cite-skipped to owners: gate math/refuse/regain/latch/delegation
// resolution monsterLegendaryUses.test.js :79-157/:171-198; modal exhaust+latch
// seam template legendary-uses.test.jsx :310/:418; beholder :115-223.
// Dead-mock purge (empirical bisect green, #505): diceRoller/sanitize/dataLoader/
// conditionEffects/rangeValidation/mapsService inert for this lane; damageUtils
// STAYS — its getCombatContext arms the legendary gate ctx (real module = a
// jsdom network fetch failing open to null, MA-1966 consumer).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryDelegateAction,
} from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
  { name: 'Mummy Lord 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 187, maxHp: 187, ac: 17, conditions: [] },
];

const KEY = 'Mummy Lord 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Mummy Lord 1.monsterLegendaryActionCooldowns';

const ml = () => monstersData.find(m => m.name === 'Mummy Lord');
const legendary = () => ml().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const actionRow = (name) => ml().actions.find(a => a.name === name);

// MA-1204 data lock (BY-name #387): economy header PREPENDED with numeric uses:3
// (was: no header — rows[0] was the Dread Command prose child with uses:1,
// swallowed as the header, zero affordance), children §165-clean.
describe('MA-1204 monsters.json data: mummy lord legendary header + rows by-name locks', () => {
  it('rows[0] is the economy header with uses:3, resolver no longer swallows Dread Command; no child authors uses/recharge (§165)', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[1].name).toBe('Dread Command');
    expect(legendaryHeaderAction(ml())).toBe(legendary()[0]);
    expect(legendary()[0].description).toBe("The mummy lord takes 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The mummy lord regains expended legendary uses at the start of its turn.");
    for (const a of legendary().slice(1)) {
      expect(a.uses, `legendary child "${a.name}" must not author uses`).toBeUndefined();
      expect(a.recharge, `legendary child "${a.name}" must not author recharge`).toBeUndefined();
    }
  });

  it('Dread Command authors NUMERIC spell fields (DC 17 WIS from disk 8+4+5, dc_success none, no child uses; save_effect grants zero conditions); Glare/Necrotic Strike delegates_to resolvable actions[] rows (§99)', () => {
    const dc = row('Dread Command');
    expect(dc.save_dc).toBe(17);
    expect(dc.save_type).toBe('Wisdom');
    expect(dc.dc_success).toBe('none');
    expect(dc.range).toBe('60 feet');
    expect(dc.uses).toBeUndefined();
    // DC provenance on disk truth: 8 + WIS +4 + PB +5 = 17 (Spellcasting-row twin).
    expect(ml().ability_score_modifiers.wis).toBe(4);
    expect(ml().proficiency_bonus).toBe(5);
    // save_effect must NOT name a canonical condition (obey-the-command has no
    // consumer — Death Knight Dread Authority advisory twin MA-0058): zero grants.
    expect(extractConditionsFromSaveEffect(dc.save_effect)).toEqual([]);
    const glare = row('Glare');
    expect(glare.delegates_to).toBe('Dreadful Glare');
    expect(legendaryDelegateAction(ml(), glare)).toBe(actionRow('Dreadful Glare'));
    const ns = row('Necrotic Strike');
    expect(ns.delegates_to).toBe('Rotting Fist');
    expect(legendaryDelegateAction(ml(), ns)).toBe(actionRow('Rotting Fist'));
    expect(actionRow('Rotting Fist').attack_bonus).toBe(9);
  });
});

// MA-1204 live seam: header counter mounts at 3, Dread Command renders its own
// gated "DC 17 Wisdom" save chip riding the shared legendary gate (MA-0676
// Rumbling Movement twin — save-chip lane :171-190, owner cited by #629
// elemental-cataclysm), Glare/Necrotic Strike Expend chips resolve their
// delegates with ZERO console.error "no resolvable mechanic".
// Exhaust/own-turn/turn-latch legs: monsterLegendaryUses.test.js :86-:99 +
// template legendary-uses.test.jsx :310/:418; regain :145-157.
describe('MA-1204 MonsterCardModal mummy lord gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderAMummyLord(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Mummy Lord',
      actions: ml().actions,
      legendary_actions: ml().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mummy Lord 1', creatures: CREATURES })} />);
  }
  function mlRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows "Legendary Action Uses: 3 (3 left)" (name not swallowed); Dread Command renders gated save chip, delegates render Expend chips', () => {
    renderAMummyLord({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 3');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(document.querySelector('.mc-legendary-header-row').textContent).not.toContain('Dread Command');
    const dcChip = mlRow('Dread Command').querySelector('.mc-dice-link-save-clickable');
    expect(dcChip).not.toBe(null);
    expect(dcChip.textContent).toContain('DC 17');
    expect(dcChip.textContent).toContain('Wisdom');
    expect(mlRow('Glare').querySelector('.mc-dice-link-legendary').textContent).toContain('Expend Legendary');
    expect(mlRow('Necrotic Strike').querySelector('.mc-dice-link-legendary').textContent).toContain('Expend Legendary');
  });

  it('Dread Command save-chip click spends 3→2, stamps cooldown, adjudicates DC 17 WIS vs armed Bandit, zero console dead-end', async () => {
    renderAMummyLord({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(mlRow('Dread Command').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(17);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.targetName).toBe('Bandit 1');
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ dread_command: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Dread Command/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Dread Command/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // MA-1057/MA-0675 twin shape: Dreadful Glare is a COMPOSITE row with disk
  // attack_bonus:0 (DC0-decoy convention), so the delegate rides the ATTACK
  // seam — rollAttack at +0 vs the armed Bandit AC 12 with the delegated row's
  // own autoDamageFormula 6d6 + 4 Psychic (§432 kraken twin). Necrotic Strike
  // rides the identical delegated-attack seam (+9 Rotting Fist, numbers BY-name
  // locked above) — one click per distinct lane.
  it('Glare gated click spends 1 and adjudicates the delegated Dreadful Glare leg at +0 attack_bonus, zero console dead-end', async () => {
    renderAMummyLord({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(mlRow('Glare').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Glare (Dreadful Glare save)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(0);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('6d6 + 4');
    expect(options.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Glare/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Glare \(Dreadful Glare save\)/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
