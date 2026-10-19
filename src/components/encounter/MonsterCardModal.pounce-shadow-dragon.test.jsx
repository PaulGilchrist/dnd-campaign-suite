// @maintained-by-ai
// MA-1456 regression: Shadow Dragon legendary rows[0] "Pounce" carried `uses:1`
// with no header row above it — legendaryHeaderAction() swallowed Pounce as the
// economy header (name+counter render, zero affordance; MA-0510/§99 header-swallow)
// and prose child "Veil of Shadow" (delegates_to undefined, no numeric fields, prose
// dice "10 (3d6)" lacks a Hit/Failure/Success: anchor) silently BURNED the shared
// use through resolveLegendaryRowMechanic's final else console.error (§46). Fix is
// DATA-only, header+children SAME pass (§168 Death Knight/Colossus byte-shape):
// canonical header rows[0] "Legendary Action Uses: 2" (N adjudicated: disk carries no
// RAW count; floor = children count; CR13+ two-child twins death-tyrant/colossus
// stamp 2 without lair suffix); Pounce delegates_to:"Rend" resolving +10 / 2d6 + 5
// Slashing + 1d6 Necrotic through the MA-0022 delegate attack seam (§432 kraken twin
// — Rend's DC0 household decoy makes the label read "(Rend save)" while the row
// rides the ATTACK seam, §640(a)); Veil of Shadow — MA-1457 FOLLOW-UP supersedes the
// interim MA-0058/MA-0957 advisory stopgap: the row now carries damage_dice_primary
// "3d6" + damage_type_primary "Necrotic" so its gated click RIDES THE DAMAGE ELSE
// (§698) and rolls 3d6 Necrotic vs the armed target (advisory field stripped — the
// advisory branch §678 PRECEDES the damage else and would silently suppress the roll).
// Stealth stays §70 GM-enforced, folded into `description` (MA-1456 Pounce precedent);
// once-per-turn cooldown engine-enforced by the MA-0073 legendary cooldown latch.
//
// Refusal legs cite-owned (monster-independent gates in monsterLegendaryUses.js):
// exhausted pool MonsterCardModal.legendary-uses.test.jsx:195-212 (its canonical
// trimmed leg absorbs zero-spend + zero-roll incl. numeric-chip refusal-before-roll
// :204; max:2 here is pinned by the data lock and the '(2 left)' counter render);
// turn latch same-boundary same file :309-316 ('Only one legendary action' popup text
// owners: ma1881-demogorgon :162, blinking-gaze-solar :244, legendary-uses-unicorn
// :187). OWN-TURN full-popup bytes below are CANONICAL — cited by pounce-ancient-
// gold and terrifying-presence-dracolich; do not trim.
// Mock hygiene: diceRoller/rangeValidation/mapsService unmocked per the gold run-
// unmocked-clean precedent (real parseable rolls feed totals into the mocked
// useLoggedDiceRoll hook; nothing roll-dependent is asserted).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Shadow Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 189, maxHp: 189, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const shadowDragon = () => monstersData.find(m => m.name === 'Shadow Dragon');
const legendaryRows = () => shadowDragon().legendary_actions;
const headerRow = () => legendaryRows()[0];
const pounceRow = () => legendaryRows().find(a => a.name === 'Pounce');
const veilRow = () => legendaryRows().find(a => a.name === 'Veil of Shadow');
const rendRow = () => shadowDragon().actions.find(a => a.name === 'Rend');

// MA-1456 data lock: header-swallow fixed — header+children SAME pass
// (§168 Colossus/Death Knight verified templates).
describe('MA-1456 monsters.json data: shadow-dragon legendary block header + children', () => {
  it('rows[0] is the canonical full-row header "Legendary Action Uses: 2"; children own no economy fields (§168)', () => {
    const h = headerRow();
    expect(Object.keys(h)).toEqual(['name', 'uses', 'description']);
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toContain('regains expended legendary uses at the start of its turn');
    expect(legendaryHeaderAction(shadowDragon())).toBe(h);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });

  it('Pounce child is the full-row {name, delegates_to, description} shape; own Rend +10 / 2d6 + 5 Slashing + 1d6 Necrotic resolves through the delegate seam labelled "(Rend save)" (§640(a) DC0 decoy, attack seam)', () => {
    const row = pounceRow();
    expect(Object.keys(row)).toEqual(['name', 'delegates_to', 'description']);
    expect(row.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(10);
    expect(rend.damage_dice_primary).toBe('2d6 + 5');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('1d6');
    expect(rend.damage_type_secondary).toBe('Necrotic');
    expect(rend.save_dc).toBe(0);
    expect(legendaryDelegateAction(shadowDragon(), row)).toBe(rend);
    // DISTINCT from gold's "(Rend attack)" — household DC0 decoy cosmetic pin.
    expect(legendaryDelegateAttackName(row, rend)).toBe('Pounce (Rend save)');
  });

  // MA-1457: the interim MA-0957 advisory stopgap is superseded — the row now
  // carries numeric damage fields so its gated click rolls (advisory branch §678
  // precedes the damage else §698 and would suppress it). Stealth advisory folded
  // into `description` per the MA-1456 Pounce precedent; cooldown clause survives.
  it('Veil of Shadow rides the damage seam — full-row numeric 3d6 Necrotic fields, advisory stripped', () => {
    const row = veilRow();
    expect(Object.keys(row)).toEqual(['name', 'description', 'damage_dice_primary', 'damage_type_primary']);
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Necrotic');
    expect(row.description).toContain('takes 10 (3d6) Necrotic damage');
    expect(row.description).toContain('stealth advisory');
    expect(row.description).toContain("can't take this action again until the start of its next turn");
  });
});

// MA-1456 live seam: header renders the canonical counter — NOT a swallowed
// Pounce header — and chip faces split by affordance: the prose Pounce child
// keeps the gated "Expend Legendary" chip while numeric Veil self-suppresses
// LegendarySpendLink (:193) and affords a plain damage chip. Pounce click spends
// then rolls the delegated +10 Rend attack (armed Bandit, MA-0022 seam, save
// lane never armed at DC0); Veil click spends then rolls 3d6 Necrotic (§698)
// and stamps the MA-0073 cooldown latch. Own-turn refusal is the CANONICAL
// full-popup byte (cited by pounce-ancient-gold / terrifying-presence-dracolich).
describe('MA-1456 MonsterCardModal shadow-dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderShadowDragon(uses) {
    runtime.store['Shadow Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Shadow Dragon',
      actions: shadowDragon().actions,
      legendary_actions: shadowDragon().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Shadow Dragon 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('header + chip faces: "Legendary Action Uses: 2 (2 left)" NOT a swallowed Pounce; exactly ONE spend chip (Pounce); Veil self-suppresses and affords numeric 3d6', () => {
    renderShadowDragon({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Pounce');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chips = document.querySelectorAll('.mc-dice-link-legendary');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Expend Legendary');
    expect(chips[0]).toBe(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    const veil = laRow('Veil of Shadow');
    expect(veil.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(veil.querySelector('.mc-dice-link').textContent).toContain('3d6');
  });

  it('Pounce chip spends 2->1 after another creature turn and rolls the delegated +10 Rend attack — no save leg, no console error', async () => {
    renderShadowDragon({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chip = laRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend save)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(10);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6 + 5');
    expect(options.autoDamageName).toBe('Pounce (Rend save)');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('1d6');
    expect(options.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(options.isSpellDamage).toBe(false);
    expect(options.targetName).toBe('Bandit 1');
    expect(options.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // MA-1457: the gated numeric chip spends honestly then ROLLS 3d6 Necrotic vs
  // the armed Bandit through the damage else (§698). Stealth stays §70
  // GM-enforced (folded into description). Cooldown latch still stamps.
  it('MA-1457 Veil chip spends honestly and rolls 3d6 Necrotic vs the armed target; MA-0073 cooldown stamps', async () => {
    renderShadowDragon({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chip = laRow('Veil of Shadow').querySelector('.mc-dice-link');
    expect(chip.textContent).toContain('3d6');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollDamage).toHaveBeenCalledTimes(1));
    const dmg = ROLLERS.rollDamage.mock.calls[0][0];
    expect(dmg.name).toBe('Veil of Shadow');
    expect(dmg.formula).toBe('3d6');
    expect(dmg.context.damageType).toBe('Necrotic');
    expect(dmg.context.targetName).toBe('Bandit 1');
    expect(dmg.context.attackerName).toBe('Shadow Dragon 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Veil of Shadow/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Veil of Shadow/);
    // MA-0073: the row's own once-per-turn clause stamps the cooldown latch.
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryActionCooldowns']?.veil_of_shadow).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // CANONICAL own-turn refusal (cited by pounce-ancient-gold /
  // terrifying-presence-dracolich): full-popup byte, zero spend, zero roll.
  it('own-turn click refuses honestly (after ANOTHER creature\'s turn, not its own)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Shadow Dragon 1', creatures: CREATURES };
    renderShadowDragon({ max: 2, used: 0 });
    fireEvent.click(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain("after ANOTHER creature's turn, not its own");
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
