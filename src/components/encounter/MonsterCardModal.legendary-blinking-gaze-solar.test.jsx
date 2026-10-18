// @maintained-by-ai
// MA-1479 regression: Solar legendary_actions[0] was the Blinking Gaze CHILD
// with uses:1 — legendaryHeaderAction() (monsterLegendaryUses.js:153, rows[0].uses
// != null) swallowed it as the economy header, and MonsterCardBody.jsx slice(1)
// dropped the child from render entirely: the card printed "Blinking Gaze (1 left)"
// as a no-onClick mc-legendary-header-row div with ZERO affordance (MA-1456 twin,
// §99/§202 harder-zero — the swallowed child IS the would-be attacker), zero
// .mc-dice-link-legendary, DC 25 prose-only + save_type absent meant no save chip
// could ever arm (MonsterAction.jsx:91 gates on numeric save_dc), and the
// once-per-turn cooldown latch never stamped because the row was unreachable.
// Fix is DATA-only SAME pass (§168 MA-1456/MA-0620/MA-0675 byte-shape):
// canonical header rows[0] "Legendary Action Uses: 2" (N=children floor — disk
// text carries no other RAW count; two-child twins death-tyrant/colossus/shadow-
// dragon stamp 2) + children `uses`/`recharge:false` dropped + Blinking Gaze
// numeric save_dc:25 + save_type:"Constitution" so its own DC chip rides the
// shared legendary gate live (MA-0676 §204 twin). Blinded-on-success ("Failure or
// Success:") leg is a DOCUMENTED RESIDUAL: single-target save seam is fail-only
// (applyFailedSaveConditions early-returns on success, §160) and the both-outcomes
// transport is picker-only (§157) with no consumer reachable on this single-target
// shape — advisory prose folded into `description` per the MA-1456 precedent; the
// condition duration rides the MA-0063 GM-enforced durationNote family (MA-0767/
// MA-0918 twins — plain-condition grants have no auto-expiry clock consumer).
// MA-1480 follow-up (same file, stale pins INVERTED §216/§219): Radiant
// Teleport save_dc:25 now authored (prose-only DC 25 Dexterity never enforced
// — FAIL(a)/DATA §54 family MA-0237/0318/0328/0362); twin chips render
// ("2d10" + "DC 25 Dexterity", Slaying Bow MA-1475/1477 shape) and the chip
// click rides spend-then-save (resolveLegendaryRowMechanic :677) adjudicating
// Dex vs DC 25; prose "Success: Half damage" → dc_success ABSENT, default
// 'half' RAW-correct (§63 only bites success-pays-nothing rows; real
// computeDamageAfterSave half-math owned by prismaticSprayHandler.save-results).
// Trim pass (audit): exhausted refusals owned legendary-uses lane (blob:305/
// beholder:281), own-turn refusal owned quetzalcoatl:261/shadow-dragon:305,
// once-per-turn cooldown-refusal damage-chip lane owned blob:254 — this file
// keeps ONLY the save-chip lane: header/children disk lock, save-chip arm +
// twin-chip render, blink click→blinded CON ctx + latch stamp, same-boundary
// save-chip latch keeper, blinking_gaze cooldown refusal on the SAVE fork, and
// Radiant save-chip half-on-success seam (dice chip = same seam, presence only).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
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
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Solar 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 297, maxHp: 297, ac: 21, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const solar = () => monstersData.find(m => m.name === 'Solar');
const legendaryRows = () => solar().legendary_actions;
const headerRow = () => legendaryRows()[0];
const blinkingRow = () => legendaryRows().find(a => a.name === 'Blinking Gaze');
const radiantRow = () => legendaryRows().find(a => a.name === 'Radiant Teleport');

// MA-1479 disk lock (#387, BY-name distinct bytes): header-swallow fixed —
// rows[0] canonical header (numeric uses, no mechanic of its own) + children
// carry no per-child `uses` nor household `recharge:false` (§168/MA-1456).
describe('MA-1479 monsters.json data: solar legendary block header + children', () => {
  it('rows[0] is the canonical header "Legendary Action Uses: 2"; children carry no uses/recharge (header owns the economy)', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toBe("The solar takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The solar regains expended legendary uses at the start of its turn.");
    expect(h.delegates_to).toBeUndefined();
    expect(h.save_dc).toBeUndefined();
    expect(legendaryHeaderAction(solar())).toBe(h);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });

  // Blinking Gaze arms numeric CON save so its DC chip rides the shared
  // legendary gate (§204 twin). Live proof of the once-per-turn clause and
  // slug lives in the latch-stamp + refusal legs below (helpers' own semantics
  // owned by the arcane-prowl/quetzalcoatl lanes — no helper re-read here).
  it('Blinking Gaze arms numeric save_dc:25 + save_type:"Constitution" with cooldown-clause + advisory prose bytes', () => {
    const row = blinkingRow();
    expect(row.save_dc).toBe(25);
    expect(row.save_type).toBe('Constitution');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.save_effect).toBe('The target has the Blinded condition for 1 minute. Failure or Success: The solar can\'t take this action again until the start of its next turn.');
    expect(row.description).toContain('Constitution Saving Throw: DC 25, one creature the solar can see within 120 feet.');
    expect(row.description).toContain('can\'t take this action again until the start of its next turn');
    // Documented residual (§160/§157): the Blinded-on-success leg has no consumer
    // on this single-target shape — advisory prose folded into description.
    expect(row.description).toContain('Blinded-on-success leg advisory');
    expect(row.description).toContain('GM adjudicates');
  });

  // MA-1480 FIXED (was MA-1479 sanitation-scope pin, inverted §216/§219):
  // save_dc:25 authored next to save_type (Slaying Bow :56206 / Blinking
  // Gaze :56242 byte-placement in the SAME monster block) — the §54
  // prose-only-DC fingerprint is closed; prose DC 25 + save_type Dexterity
  // were already on disk (row-of-record §3, DC sanity 8+CHA10+PB7=25).
  // Prose "Success: Half damage." → dc_success STAYS ABSENT: getSaveDcSuccess
  // default 'half' is RAW-correct (§63 half-leak only bites rows whose
  // success pays nothing).
  it('Radiant Teleport arms numeric save_dc:25 + save_type:"Dexterity", dc_success ABSENT (half default RAW — MA-1480 fix)', () => {
    const row = radiantRow();
    expect(row.save_dc).toBe(25);
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.description).toBe('The solar teleports up to 60 feet to an unoccupied space it can see. Dexterity Saving Throw: DC 25, each creature in a 10-foot Emanation originating from the solar at its destination space. Failure: 11 (2d10) Radiant damage. Success: Half damage.');
    expect(row.save_effect).toBe('The target takes 11 (2d10) Radiant damage. Success: The target takes half damage.');
  });
});

// MA-1479 live seam (save-chip lane): canonical header renders "Legendary
// Action Uses: 2 (2 left)" — NOT a swallowed Blinking Gaze header; the child
// renders its own clickable "DC 25 Constitution" save chip riding the shared
// legendary economy (numeric rows self-suppress the Expend chip — zero
// .mc-dice-link-legendary is the byte-proven §204 shape, sole-cited owner;
// MA-0676 §204). Chip click spends then routes rollSavingThrow (spend-then-
// save, MonsterCardBody.jsx save fork) with saveDc 25 / blinded conditions on
// the armed Bandit; cooldown latch blinking_gaze stamps. Generic exhausted/
// own-turn refusals are legendary-uses-lane owned (blob/beholder;
// quetzalcoatl/shadow-dragon) — not re-owned here.
describe('MA-1479 MonsterCardModal solar legendary gated save row', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderSolar(uses) {
    if (uses !== undefined) runtime.store['Solar 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Solar',
      actions: solar().actions,
      legendary_actions: solar().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Solar 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('header renders "Legendary Action Uses: 2 (2 left)" with Blinking Gaze CON chip + Radiant twin chips armed; zero expend chips (§204)', () => {
    renderSolar({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chip = laRow('Blinking Gaze').querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 25 Constitution');
    // MA-1480: post-fix twin chips on the Radiant Teleport row —
    // plan.rollable dice chip "2d10" + labelled save chip "DC 25 Dexterity"
    // (Slaying Bow MA-1475/1477 byte-shape). Click routing pinned once below.
    const rtRow = laRow('Radiant Teleport');
    expect(rtRow.querySelector('.mc-dice-link').textContent).toContain('2d10');
    expect(rtRow.querySelector('.mc-dice-link-save-clickable').textContent).toContain('DC 25 Dexterity');
    // Numeric children self-suppress LegendarySpendLink (MonsterAction.jsx:164) —
    // zero expend chips is the byte-proven §204 shape, not a defect.
    expect(document.querySelectorAll('.mc-dice-link-legendary').length).toBe(0);
  });

  it('DC 25 chip spends 2->1 after another creature turn and routes rollSavingThrow (Con, DC 25, blinded) — latch stamps, zero console error', async () => {
    renderSolar({ max: 2, used: 0 });
    fireEvent.click(laRow('Blinking Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Solar 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('CON');
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveDc).toBe(25);
    expect(saveCtx.saveConditions).toEqual(['blinded']);
    expect(saveCtx.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Blinking Gaze/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/expends a legendary use for Blinking Gaze/);
    // MA-0073 per-action once-per-turn owner latch (also proves the disk
    // cooldown clause + blinking_gaze slug resolve live — no helper re-read).
    expect(runtime.store['Solar 1.monsterLegendaryActionCooldowns']?.blinking_gaze).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same-boundary refire refuses (turn latch) — save never re-rolls, counter held', async () => {
    renderSolar({ max: 2, used: 0 });
    fireEvent.click(laRow('Blinking Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    ROLLERS.rollSavingThrow.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Blinking Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Solar 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('later boundary refuses on the MA-0073 cooldown latch — blinking_gaze_refused (once per turn), zero spend', async () => {
    renderSolar({ max: 2, used: 0 });
    runtime.store['Solar 1.monsterLegendaryActionCooldowns'] = { blinking_gaze: { round: 1, usedBefore: 0 } };
    fireEvent.click(laRow('Blinking Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('can\'t take Blinking Gaze again until the start of its next turn');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => /blinking_gaze_refused \(once per turn\)/.test(e.automationType || ''))).toBe(true));
    expect(runtime.store['Solar 1.monsterLegendaryUses']).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  // MA-1480 STALE-PIN INVERSION (§216/§219): MA-1479 pinned this child
  // "rides the damage else" while its DC was prose-only. With save_dc:25
  // authored the row routes the SAVE leg (resolveLegendaryRowMechanic :677
  // fork BEFORE the damage else :697 — both chips reach the same seam, the
  // dice chip's presence/mis-route fingerprint is THIS assertion) — spend
  // honest, rollSavingThrow DEX vs DC 25, half-on-success threaded via the
  // save context dc_success default 'half', damage formula rides the context
  // (saveProcessing seam), NOT an unsaved rollDamage pre-pay.
  it('Radiant Teleport spends honestly then adjudicates DEX save vs DC 25 (half-on-success) — no unsaved damage leg, latch unstamped', async () => {
    renderSolar({ max: 2, used: 0 });
    fireEvent.click(laRow('Radiant Teleport').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Solar 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('DEX');
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveDc).toBe(25);
    expect(saveCtx.dcSuccess).toBe('half');
    expect(saveCtx.autoDamageFormula).toBe('2d10');
    // No once-per-turn cooldown clause on this row — latch stays unstamped.
    expect(runtime.store['Solar 1.monsterLegendaryActionCooldowns']?.radiant_teleport).toBeUndefined();
    // Damage never pre-pays outside the save seam.
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
