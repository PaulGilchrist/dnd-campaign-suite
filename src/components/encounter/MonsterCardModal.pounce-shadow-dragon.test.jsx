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
// rides the ATTACK seam, §640(a)); Veil of Shadow rides the MA-0058/MA-0957 advisory
// seam ({advisory, advisory_message}) — spend honest via the shared gate, zero
// fabricated damage (full mechanic is MA-1457 territory), once-per-turn cooldown
// engine-enforced by the MA-0073 legendary cooldown latch.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

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
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 80),
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

// MA-1456 data lock: header-swallow fixed — rows[0] is the canonical header
// (numeric uses, no mechanic of its own); children carry no per-child `uses`
// nor `recharge` (§168 Colossus/Death Knight verified templates).
describe('MA-1456 monsters.json data: shadow-dragon legendary block header + children', () => {
  it('rows[0] is the canonical header "Legendary Action Uses: 2" with numeric uses', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toContain('regains expended legendary uses at the start of its turn');
    expect(h.delegates_to).toBeUndefined();
    expect(legendaryHeaderAction(shadowDragon())).toBe(h);
  });

  it('children carry no per-child uses (header owns the economy, §168)', () => {
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });

  it('Pounce child delegates_to Rend, no numeric fields of its own', () => {
    const row = pounceRow();
    expect(row.delegates_to).toBe('Rend');
    expect(row.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    expect(row.advisory).toBeUndefined();
  });

  it('delegates to the shadow-dragon own Rend row: +10 / 2d6 + 5 Slashing + 1d6 Necrotic', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(10);
    expect(rend.damage_dice_primary).toBe('2d6 + 5');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('1d6');
    expect(rend.damage_type_secondary).toBe('Necrotic');
    const delegate = legendaryDelegateAction(shadowDragon(), pounceRow());
    expect(delegate).toBe(rend);
    // §640(a): Rend carries the household save_dc:0 decoy → label reads
    // "(Rend save)" while the row RIDES THE ATTACK SEAM (cosmetic pin).
    expect(legendaryDelegateAttackName(pounceRow(), rend)).toBe('Pounce (Rend save)');
  });

  it('Veil of Shadow rides the MA-0957 advisory seam — no numeric fields, no silent-burn', () => {
    const row = veilRow();
    expect(row.advisory).toBe('veil_of_shadow');
    expect(row.advisory_message).toContain('advisory record');
    expect(row.advisory_message).toContain('MA-1457');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.description).toBe("The dragon uses Shadow Stealth, and one creature of its choice that it can see within 10 feet of it takes 10 (3d6) Necrotic damage. The dragon can't take this action again until the start of its next turn.");
  });
});

// MA-1456 live seam: header renders "Legendary Action Uses: 2 (2 left)" — NOT a
// swallowed Pounce header; BOTH children render gated "Expend Legendary" chips.
// Pounce click spends then rolls the delegated +10 Rend attack (armed Bandit,
// 2d6 + 5 Slashing + 1d6 Necrotic via MA-0022 seam, save lane never armed at DC0).
// Veil click spends and lands the advisory record — zero rolls, zero damage,
// ZERO console.error "no resolvable mechanic" (MA-0510 silent-burn dead). Boundary
// refire + exhausted + own-turn refusals honest, zero spend.
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

  it('header renders "Legendary Action Uses: 2" — NOT a swallowed Pounce header', () => {
    renderShadowDragon({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Pounce');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
  });

  it('BOTH children render gated Expend Legendary chips (zero-affordance Pounce row dead)', () => {
    renderShadowDragon({ max: 2, used: 0 });
    const chips = document.querySelectorAll('.mc-dice-link-legendary');
    expect(chips.length).toBe(2);
    expect(laRow('Pounce').querySelector('.mc-dice-link-legendary')).not.toBe(null);
    expect(laRow('Veil of Shadow').querySelector('.mc-dice-link-legendary')).not.toBe(null);
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
    expect(options.targetName).toBe('Bandit 1');
    expect(options.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('same-boundary refire refuses (turn latch) — shared gate rides BOTH children', async () => {
    renderShadowDragon({ max: 2, used: 0 });
    fireEvent.click(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    fireEvent.click(laRow('Veil of Shadow').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
  });

  it('Veil chip spends honestly and lands the advisory record — zero rolls, zero damage, zero console error', async () => {
    renderShadowDragon({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(laRow('Veil of Shadow').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const popup = String(setPopupHtml.mock.calls[0][0]);
    expect(popup).toContain('Legendary Action — Veil of Shadow');
    expect(popup).toContain('GM-enforced');
    expect(popup).not.toContain('damage applied');
    const record = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /legendary action Veil of Shadow/.test(e.description));
    expect(record).toBeTruthy();
    expect(record.description).toContain('advisory record');
    // MA-0073: the row's own once-per-turn clause stamps the cooldown latch.
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryActionCooldowns']?.veil_of_shadow).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (2/2 spent): Pounce chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderShadowDragon({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('own-turn click refuses honestly (after ANOTHER creature\'s turn, not its own)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Shadow Dragon 1', creatures: CREATURES };
    renderShadowDragon({ max: 2, used: 0 });
    fireEvent.click(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain("after ANOTHER creature's turn, not its own");
    expect(runtime.store['Shadow Dragon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
