// @maintained-by-ai
// MA-0620/MA-0621 regression: Dracolich legendary rows carried `uses:1` on
// "Pounce" with no header row — legendaryHeaderAction() swallowed Pounce as
// the economy header (MA-0567/MA-0510 header-swallow) and the prose spellcast
// child "Sickening Ray" had no numeric mechanic, so its gated chip silently
// BURNED the use with console.error "no resolvable mechanic" (§46). Fix is
// DATA-only, header+children SAME pass: canonical header rows[0]
// "Legendary Action Uses: 1" (MA-0040/Death Knight byte-shape, §165);
// Pounce delegates_to:"Rend" resolving the dracolich's OWN Rend numbers
// (+13 / 2d10 + 7 Slashing + 1d8 Necrotic) through the MA-0022 delegate
// attack seam, half-Speed movement advisory (§70 twin); Sickening Ray rides
// the MA-0219 Guiding Light numeric-spellchild seam (+11 spell attack,
// 3d8 Poison per 2024 Ray of Sickness level 2) and MA-0621 authors RAW
// level-2 poison-on-hit transport via hit_conditions (§150, MA-0010/MA-0452
// byte-shape twins — Assassin Shortsword, Bearded Devil Beard).
// Refusal legs are cite-skipped to their owners: exhausted pool
// MonsterCardModal.legendary-uses.test.jsx:195-212 (used>=max gate is
// monster-independent — dracolich max:1 adds no distinct math vs the
// canonical max:3 leg), turn latch same file :309-316, own-turn full-popup
// bytes pounce-shadow-dragon.test.jsx:300-305; header uses:1 data byte also
// pinned at terrifying-presence-dracolich.test.jsx:144-146 (FP owner).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
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
  { name: 'Dracolich 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 225, maxHp: 225, ac: 20, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const dracolich = () => monstersData.find(m => m.name === 'Dracolich');
const legendaryRows = () => dracolich().legendary_actions;

// MA-0620 data lock (folded, #757 press-fold shape): rows[0] is the canonical
// economy header (numeric uses, MA-0040 Death Knight byte-shape) — NOT a
// swallowed Pounce; children carry no per-child `uses` (§165); the Pounce row
// is the full-row {name, delegates_to, description} shape with the half-Speed
// advisory annotated into description (byte-distinct "dracolich" subject
// suffix vs the MA-0197 gold-family "dragon" twins), no own numeric mechanic,
// resolving the dracolich's OWN Rend row (+13 / 2d10 + 7 Slashing + 1d8
// Necrotic) through the delegate seam, labelled "Pounce (Rend attack)".
describe('MA-0620 monsters.json data: dracolich legendary header + Pounce delegate', () => {
  it('rows[0] canonical header uses:1; children childless of uses; Pounce full-row delegates_to Rend (advisory prose, no own numbers); own Rend +13 / 2d10 + 7 Slashing + 1d8 Necrotic resolves through the delegate seam', () => {
    const h = legendaryRows()[0];
    expect(Object.keys(h)).toEqual(['name', 'uses', 'description']);
    // name/uses values dropped per rec #779: byte-verbatim owner is
    // MonsterCardModal.terrifying-presence-dracolich.test.jsx:120-123
    // (same disk row, same two bytes). Keys-shape + description stay here.
    expect(h.description).toContain('regains expended legendary uses at the start of its turn');
    expect(legendaryHeaderAction(dracolich())).toBe(h);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
    const row = legendaryRows().find(a => a.name === 'Pounce');
    expect(Object.keys(row)).toEqual(['name', 'delegates_to', 'description']);
    expect(row.delegates_to).toBe('Rend');
    expect(row.description).toBe('The dracolich moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    const rend = dracolich().actions.find(a => a.name === 'Rend');
    expect(rend.attack_bonus).toBe(13);
    expect(rend.damage_dice_primary).toBe('2d10 + 7');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('1d8');
    expect(rend.damage_type_secondary).toBe('Necrotic');
    expect(legendaryDelegateAction(dracolich(), row)).toBe(rend);
    expect(legendaryDelegateAttackName(row, rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0219/MA-0621 data lock: Sickening Ray authors its own numeric spell
// fields (+11 attack_bonus mirrored on spell_attack_bonus, 3d8 Poison per 2024
// Ray of Sickness level 2) — no silent-burn — plus RAW poison-on-hit transport
// via hit_conditions, and NO save leg (no save_dc/save_type).
describe('MA-0621 monsters.json data: Sickening Ray numeric spellchild + hit_conditions', () => {
  it('+11 spell attack / 3d8 Poison / 60 feet authored with hit_conditions ["poisoned"] and no save leg', () => {
    const row = legendaryRows().find(a => a.name === 'Sickening Ray');
    expect(row.attack_bonus).toBe(11);
    expect(row.spell_attack_bonus).toBe(11);
    expect(row.damage_dice_primary).toBe('3d8');
    expect(row.damage_type_primary).toBe('Poison');
    expect(row.range).toBe('60 feet');
    expect(row.hit_conditions).toEqual(['poisoned']);
    expect(row.save_dc).toBeUndefined();
    expect(row.save_type).toBeUndefined();
  });
});

// MA-0620 live seam (press-folded, #757 shape): header renders the canonical
// "Legendary Action Uses: 1" counter (NOT a swallowed Pounce); the gated
// "Expend Legendary" chip on the prose Pounce row spends the single use then
// rolls the delegated +13 Rend attack (armed target, 2d10 + 7 Slashing
// auto-damage + 1d8 Necrotic secondary, non-spell, no save leg) and logs the
// spend — zero console "no resolvable mechanic". Refusal legs (exhausted/
// latch/own-turn) are owned elsewhere — see header cites.
describe('MA-0620 MonsterCardModal dracolich Pounce gated delegate press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderDracolich(uses) {
    runtime.store['Dracolich 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Dracolich',
      actions: dracolich().actions,
      legendary_actions: dracolich().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Dracolich 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('counter (1 left) + header NOT swallowed by Pounce; gated chip press spends 1 and rolls the delegated +13 Rend attack (armed target, 2d10 + 7 + 1d8 Necrotic), logs the spend, no save leg, zero console dead-end', async () => {
    renderDracolich({ max: 1, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header.textContent).toContain('Legendary Action Uses: 1');
    expect(header.textContent).not.toContain('Pounce');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(1 left)');
    const chip = laRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(13);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d10 + 7');
    expect(options.autoDamageName).toBe('Pounce (Rend attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('1d8');
    expect(options.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(options.isSpellDamage).toBe(false);
    expect(options.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});

// MA-0219/MA-0621 live seam: the numeric spellchild row renders the +11
// spell chip (generic .mc-dice-link, not the gated legendary-prose chip);
// press spends the use, rolls +11 with 3d8 Poison spell-origin damage and the
// MA-0010 hitClause ["poisoned"] labelled "Sickening Ray" — no save leg, no
// console silent-burn.
describe('MA-0621 MonsterCardModal Sickening Ray spellchild press — spend, +11 roll, poisoned hitClause, zero silent burn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  it('+11 spell chip press spends 1, rolls 3d8 Poison spell-origin with poisoned hitClause, no save leg, zero console dead-end', async () => {
    runtime.store['Dracolich 1.monsterLegendaryUses'] = { max: 1, used: 0 };
    const m = makeMonster({
      name: 'Dracolich',
      actions: dracolich().actions,
      legendary_actions: dracolich().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Dracolich 1', creatures: CREATURES })} />);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const row = Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith('Sickening Ray'));
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = row.querySelector('.mc-dice-link');
    expect(chip.textContent).toContain('+11');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Sickening Ray');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d8');
    expect(options.damageType).toBe('Poison');
    expect(options.isSpellDamage).toBe(true);
    expect(options.hitClause).not.toBeNull();
    expect(options.hitClause.conditions).toEqual(['poisoned']);
    expect(options.hitClause.attackName).toBe('Sickening Ray');
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
