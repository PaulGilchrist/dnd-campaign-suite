// @maintained-by-ai 2026-11-28
// Run-3 audit/trim: 6→3 tests. Data lanes now DISK-FAITHFUL VERBATIM full-row toEqual
// (fetched live from monsters.json 2026-11-28): one toEqual per row pins every field,
// byte prose, and absence of numeric/advisory/uses/recharge decoys in one mutation-
// distinguishable shot — so the old per-field absent-pins, the prowl≡lore cross-equality
// (lore file locks the identical bytes stronger), the lore-twin mirror test (owned by
// MonsterCardModal.legendary-arcane-prowl-sphinx.test.jsx:101), and the parser re-reads
// over byte-locked prose (parseBothOutcomesClause/hasLegendaryCooldownClause/
// legendaryActionSlug — owned by MonsterCardHelpers + monsterLegendaryUses MA-0073) all
// shed. legendaryDelegateAction/AttackName re-reads shed too: the live click proves the
// delegate seam end-to-end. The two live lanes (static render lock + Prowl click) share
// one render path — consolidated into a single positive-leg-first test.
// MA-1507 regression pinned: pre-fix, valor legendary_actions[0] was the Arcane Prowl
// CHILD with uses:1 — legendaryHeaderAction() swallowed it (no affordance), the ONLY
// legendary chip rode Weight of Years (no numeric save_dc — gate never armed), silently
// BURNING the shared use via resolveLegendaryRowMechanic's final else (MA-0510). Fix was
// DATA-only: canonical header rows[0] "Legendary Action Uses: 2"; Prowl delegates_to
// "Claw" riding the MA-0022 attack seam (+12 / 4d6 + 6 Slashing — valor's OWN Claw
// numbers, vs lore's +8 / 3d6 + 4); WoY gains numeric save_dc:16 + save_type +
// dc_success:"none" so its own "DC 16 Constitution" chip rides the shared gate
// (MA-0676 §204 spend-then-save).
// Cite-skipped generic lanes (identical disk bytes / same branch, re-driven elsewhere):
// - prowl description byte literal + header/counter render + WoY live save ctx
//   (exhaustionLevel/dc_success/saveConditions/latch stamp, MA-0751 channel):
//   MonsterCardModal.legendary-arcane-prowl-sphinx.test.jsx :101/:169/:207.
// - exhausted refusal: MonsterCardModal.legendary-uses.test.jsx :190/:297/:405 +
//   monsterLegendaryUses.test.js:171; own-turn: monsterLegendaryUses.test.js (gate
//   reason 'own-turn'); same-boundary latch: monsterLegendaryUses.test.js:471 +
//   MonsterCardModal.pounce-shadow-dragon.test.jsx:245.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const r = { rollAttack: null, rollDamage: null, rollSavingThrow: null };
  return r;
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
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

const CREATURES = [
  { name: 'Sphinx of Valor 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 199, maxHp: 199, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const sphinx = () => monstersData.find(m => m.index === 'sphinx-of-valor');
const legendaryRows = () => sphinx().legendary_actions;
const headerRow = () => legendaryRows()[0];
const prowlRow = () => legendaryRows().find(a => a.name === 'Arcane Prowl');
const weightRow = () => legendaryRows().find(a => a.name === 'Weight of Years');
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-1507 data lock (verbatim, disk-faithful): header rows[0] owns the economy
// (§165/§168 children carry nothing), Arcane Prowl is the bare delegate row whose
// ONLY fields are name/delegates_to/description (MA-1457 — advisory FIELDS would
// hijack resolveLegendaryRowMechanic before the delegate numeric leg; the §70
// teleport advisory rides inside the description prose), and valor's OWN Claw
// numbers (+12 / 4d6 + 6) discriminate from lore's +8 / 3d6 + 4 (MA-0022 seam,
// proven live below).
describe('MA-1507 monsters.json data: sphinx-of-valor header + Arcane Prowl delegate rows', () => {
  it('rows[0] verbatim canonical header "Legendary Action Uses: 2" resolves via legendaryHeaderAction; Prowl verbatim row is bare delegates_to:"Claw"; children carry no uses/recharge; valor Claw +12 / 4d6 + 6 Slashing', () => {
    expect(headerRow()).toEqual({
      name: 'Legendary Action Uses: 2',
      uses: 2,
      description: "The sphinx of valor takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn.",
    });
    expect(legendaryHeaderAction(sphinx())).toBe(headerRow());
    expect(prowlRow()).toEqual({
      name: 'Arcane Prowl',
      delegates_to: 'Claw',
      description: 'The sphinx can teleport up to 30 feet to an unoccupied space it can see (teleport advisory — GM moves the token; no position consumer), and it makes one Claw attack.',
    });
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(12);
    expect(claw.damage_dice_primary).toBe('4d6 + 6');
    expect(claw.damage_type_primary).toBe('Slashing');
  });
});

// MA-1508 + MA-1058 facets folded into ONE verbatim row lock: valor's WoY prose bytes
// (the MA-1058 "Failure or Success:" tail attaches to the REUSE limit only — parser-
// null discrimination owned by MonsterCardHelpers.both-outcomes.test.js:60, whose
// guardrail scan sweeps save_effect fields ONLY, so these description bytes are locked
// ONLY here) + dc_success:"none" (§63 family, riding the LIVE MA-0751 channel proven
// byte-identically at sphinx-of-lore sibling :207). The full-row toEqual also pins the
// once-per-turn clause present (cooldown-latch parse owned by MA-0073) and the absence
// of attack_bonus/delegates_to/damage decoys (no MA-1456 DC0 "(Rend save)" shape).
describe('MA-1507 monsters.json data: sphinx-of-valor Weight of Years row', () => {
  it('WoY verbatim row: numeric save_dc:16 + save_type:"Constitution" + dc_success:"none", description/save_effect prose byte-locked, no attack/delegate fields', () => {
    expect(weightRow()).toEqual({
      name: 'Weight of Years',
      description: 'Constitution Saving Throw: DC 16, one creature the sphinx can see within 120 feet. Failure: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. Failure or Success: The sphinx can\'t take this action again until the start of its next turn.',
      save_dc: 16,
      save_type: 'Constitution',
      dc_success: 'none',
      save_effect: 'The target gains 1 Exhaustion level and appears 3d10 years older while it has any Exhaustion levels. The sphinx can\'t take this action again until the start of its next turn.',
    });
  });
});

// MA-1507 live seam (render lock + Prowl click consolidated — one render path):
// canonical header renders NOT-swallowed with counter; Prowl's gated "Expend
// Legendary" chip spends then rolls the delegated +12 Claw (4d6 + 6 Slashing vs the
// armed Bandit, save lane never armed — the pre-fix MA-0510 silent-burn is dead, zero
// console.error); Weight of Years renders its own numeric "DC 16 Constitution" chip
// riding the shared gate instead of a legendary chip (MA-0676 §204 self-suppression).
// Refusal/DC-click legs cite-skipped per header.
describe('MA-1507 MonsterCardModal sphinx-of-valor legendary gated rows', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderSphinx(uses) {
    runtime.store['Sphinx of Valor 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Sphinx of Valor',
      actions: sphinx().actions,
      legendary_actions: sphinx().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Sphinx of Valor 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('header renders "Legendary Action Uses: 2 (2 left)" NOT a swallowed Prowl; Prowl holds the only legendary chip, WoY rides its own DC chip; Prowl click spends 2->1 and rolls the delegated +12 Claw — no save leg, latch unstamped, no console error', async () => {
    renderSphinx({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Arcane Prowl');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chips = document.querySelectorAll('.mc-dice-link-legendary');
    expect(chips.length).toBe(1);
    expect(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary').textContent).toContain('Expend Legendary');
    const woyChip = laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable');
    expect(woyChip).not.toBe(null);
    expect(woyChip.textContent).toContain('DC 16 Constitution');
    expect(laRow('Weight of Years').querySelector('.mc-dice-link-legendary')).toBe(null);

    fireEvent.click(chips[0]);
    await waitFor(() => expect(runtime.store['Sphinx of Valor 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Arcane Prowl (Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('4d6 + 6');
    expect(options.autoDamageName).toBe('Arcane Prowl (Claw attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.targetName).toBe('Bandit 1');
    expect(options.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Arcane Prowl/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Arcane Prowl \(Claw attack\)/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    // No cooldown clause on Prowl — latch stays unstamped.
    expect(runtime.store['Sphinx of Valor 1.monsterLegendaryActionCooldowns']?.arcane_prowl).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
