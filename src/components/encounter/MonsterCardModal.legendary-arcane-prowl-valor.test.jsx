// @maintained-by-ai — MA-1507 audit/trim pass (2026-10-18): 12→6 tests.
// Valor distinct lanes kept: header+children data lock, prowl≡lore-row equality +
// valor Claw +12/4d6+6 delegate seam, WoY disk byte-lock (+ MA-1508 facets folded,
// vacuous Number(save_dc)>0 / extractConditions / parseExhaustion re-reads dropped),
// lore cross-pin (:210-221 per MA-1507 mapping), live header render, live prowl
// click. Cite-skipped: exhausted legendary-uses.test.jsx:190/:297/:405, own-turn
// monsterLegendaryUses.test.js:93, latch pounce-shadow-dragon.test.jsx:245 +
// blinking-gaze-solar.test.jsx:269, WoY live save-ctx sphinx sibling :207.
// Dead mocks purged empirically: diceRoller partial stub, sanitize passthrough,
// popup-getter roundtrip capture.
// MA-1507 regression: Sphinx of Valor legendary_actions[0] was the Arcane Prowl
// CHILD with uses:1 — legendaryHeaderAction() swallowed it as the economy header (no
// affordance) and the ONLY legendary chip rode the sibling Weight of Years (no numeric
// save_dc — the save-chip gate never armed), silently BURNING the shared use through
// resolveLegendaryRowMechanic's final else console.error (MA-0510). Fix was DATA-only:
// canonical header rows[0] "Legendary Action Uses: 2"; Arcane Prowl delegates_to
// "Claw" riding the MA-0022 delegate attack seam (+12 / 4d6 + 6 Slashing — valor's
// OWN Claw numbers, MA-0956/MA-1057 twins) with the §70 teleport advisory folded into
// `description` (advisory FIELDS would hijack the resolver BEFORE the delegate numeric
// leg — MA-1457); Weight of Years gains numeric save_dc:16 + save_type +
// dc_success:"none" so its own "DC 16 Constitution" chip rides the shared legendary
// gate (MA-0676 §204 spend-then-save). Children `uses`/`recharge:false` DROPPED
// (§165/§168 double-economy). Valor distinct vs lore MA-1494 twin: header bytes
// ("sphinx of valor"), Claw +12 / 4d6 + 6, and the WoY prose bytes (locked ONLY here).
// Cite-skipped generic lanes (identical disk bytes / same branch, re-driven elsewhere):
// - prowl description byte literal + WoY live save ctx (exhaustionLevel/dc_success/
//   saveConditions/latch stamp): sphinx-of-lore twin locks the same disk bytes —
//   MonsterCardModal.legendary-arcane-prowl-sphinx.test.jsx :111 (prowl bytes),
//   :169 (render+click +8/3d6+4), :207 (WoY DC-chip spend→CON save channel, MA-0751).
// - exhausted refusal: MonsterCardModal.legendary-uses.test.jsx :190/:297/:405
//   (incl. numeric save chip) + monsterLegendaryUses.test.js:99 (gate reason 'exhausted').
// - own-turn refusal: monsterLegendaryUses.test.js:93 (reason 'own-turn') + blob/
//   arch-hag/gynosphinx modal lanes.
// - same-boundary turn-latch refire: monsterLegendaryUses.test.js:86 +
//   MonsterCardModal.pounce-shadow-dragon.test.jsx:245 (shared gate rides BOTH
//   children) + legendary-blinking-gaze-solar.test.jsx:269 (save-chip latch).
// MA-1508 facets folded into the WoY row lock; dropped vacuity: Number(save_dc)>0
// re-read of toBe(16), extractConditions/parseExhaustion re-reads of the byte-locked
// prose (live fail-only adjudication covered lore :207), burn-damage regex absent test.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause, legendaryActionSlug } from '../../services/encounters/monsterLegendaryUses.js';
import { parseBothOutcomesClause } from './MonsterCardHelpers.js';

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
const lore = () => monstersData.find(m => m.index === 'sphinx-of-lore');
const legendaryRows = () => sphinx().legendary_actions;
const headerRow = () => legendaryRows()[0];
const prowlRow = () => legendaryRows().find(a => a.name === 'Arcane Prowl');
const weightRow = () => legendaryRows().find(a => a.name === 'Weight of Years');
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-1507 data lock: header-swallow fixed — rows[0] canonical header (numeric uses,
// no mechanic of its own); children carry no per-child `uses` nor household
// `recharge:false` (§165/§168/MA-1456/MA-1494).
describe('MA-1507 monsters.json data: sphinx-of-valor legendary block header + children', () => {
  it('rows[0] is the canonical header "Legendary Action Uses: 2" (valor header bytes) — children carry no uses nor recharge (header owns the economy, §165/§168)', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toBe("The sphinx of valor takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn.");
    expect(h.delegates_to).toBeUndefined();
    expect(h.save_dc).toBeUndefined();
    expect(legendaryHeaderAction(sphinx())).toBe(h);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });

  // Valor's Arcane Prowl row is BYTE-IDENTICAL to the lore MA-1494 twin: row-level
  // equality pins delegates_to + no numeric/advisory fields (MA-1457 ordering —
  // advisory FIELDS would hijack resolveLegendaryRowMechanic before the delegate
  // numeric leg) + the §70 teleport advisory folded into description, without
  // re-driving the lore-owned description byte literal (locked at
  // MonsterCardModal.legendary-arcane-prowl-sphinx.test.jsx:111).
  it('Arcane Prowl equals the lore twin row (delegates_to Claw, no numeric/advisory fields) — valor own Claw +12 / 4d6 + 6 Slashing rides the ATTACK seam (MA-0022)', () => {
    expect(prowlRow()).toEqual(lore().legendary_actions.find(a => a.name === 'Arcane Prowl'));
    expect(prowlRow().delegates_to).toBe('Claw');
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(12);
    expect(claw.damage_dice_primary).toBe('4d6 + 6');
    expect(claw.damage_type_primary).toBe('Slashing');
    expect(claw.reach).toBe('5 ft.');
    expect(legendaryDelegateAction(sphinx(), prowlRow())).toBe(claw);
    // Claw authors no save_dc → label kind is "attack" (not the MA-1456 DC0
    // "(Rend save)" decoy shape — clean pin).
    expect(legendaryDelegateAttackName(prowlRow(), claw)).toBe('Arcane Prowl (Claw attack)');
  });

  // MA-1508 facets folded (once-per-row, vacuity-free): dc_success reading — valor's
  // OWN prose (byte-lock lives ONLY here; lore test locks fields not bytes) has NO
  // success-pays clause: the "Failure or Success:" tail attaches to the REUSE limit
  // only (MA-1058 Toxic Ink discriminator — parser null on the clause-bearing
  // surface), exhaustion lands on failure only ⇒ dc_success:"none" (§63 family),
  // riding the LIVE MA-0751 canonical channel (live legs on identical bytes: lore :207).
  it('Weight of Years arms numeric save_dc:16 + save_type:"Constitution" + dc_success:"none" — prose byte-lock (MA-1058 tail parser-null on its Failure-or-Success surface), once-per-turn clause stamps weight_of_years', () => {
    const row = weightRow();
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.description).toBe('Constitution Saving Throw: DC 16, one creature the sphinx can see within 120 feet. Failure: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. Failure or Success: The sphinx can\'t take this action again until the start of its next turn.');
    expect(row.save_effect).toBe('The target gains 1 Exhaustion level and appears 3d10 years older while it has any Exhaustion levels. The sphinx can\'t take this action again until the start of its next turn.');
    expect(parseBothOutcomesClause(row.description)).toBeNull();
    // Once-per-turn owner-latch clause verbatim (slug weight_of_years stamps live).
    expect(hasLegendaryCooldownClause(row)).toBe(true);
    expect(legendaryActionSlug(row.name)).toBe('weight_of_years');
  });

  // MA-1494 lore twin stays FIXED (mirror of the inverted pin in
  // MonsterCardModal.legendary-arcane-prowl-sphinx.test.jsx): header+delegates
  // live on lore too, lore Claw discriminators (+8 / 3d6 + 4) never swapped.
  it('sphinx-of-lore twin stays fixed (MA-1494) — lore Claw discriminators intact, never cross-swapped with valor', () => {
    expect(lore().legendary_actions[0].name).toBe('Legendary Action Uses: 2');
    expect(lore().legendary_actions[0].uses).toBe(2);
    const loreProwl = lore().legendary_actions.find(a => a.name === 'Arcane Prowl');
    expect(loreProwl.delegates_to).toBe('Claw');
    const loreWoy = lore().legendary_actions.find(a => a.name === 'Weight of Years');
    expect(loreWoy.save_dc).toBe(16);
    const loreClaw = lore().actions.find(a => a.name === 'Claw');
    expect(loreClaw.attack_bonus).toBe(8);
    expect(loreClaw.damage_dice_primary).toBe('3d6 + 4');
  });
});

// MA-1507 live seam (valor distinct only): canonical header renders NOT-swallowed with
// counter; Prowl's gated "Expend Legendary" chip spends then rolls the delegated +12
// Claw (4d6 + 6 Slashing vs the armed Bandit, save lane never armed — the pre-fix
// MA-0510 silent-burn is dead, zero console.error). Weight of Years renders its own
// numeric "DC 16 Constitution" chip riding the shared gate (MA-0676 §204
// self-suppression). Refusal/DC-click legs cite-skipped per header: exhausted
// legendary-uses.test.jsx:190/:297/:405, own-turn monsterLegendaryUses.test.js:93,
// same-boundary latch pounce-shadow-dragon.test.jsx:245 (shared gate BOTH children),
// WoY save-ctx channel sphinx-of-lore :207 (identical disk bytes).
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

  it('header renders "Legendary Action Uses: 2 (2 left)" — NOT a swallowed Arcane Prowl header; Prowl keeps the only gated chip, Weight of Years rides with its own DC chip (MA-0676 §204 self-suppression)', () => {
    renderSphinx({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Arcane Prowl');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary').textContent).toContain('Expend Legendary');
    const woyChip = laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable');
    expect(woyChip).not.toBe(null);
    expect(woyChip.textContent).toContain('DC 16 Constitution');
    expect(laRow('Weight of Years').querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(document.querySelectorAll('.mc-dice-link-legendary').length).toBe(1);
  });

  it('Prowl chip spends 2->1 after another creature turn and rolls the delegated +12 Claw — no save leg, latch unstamped, no console error', async () => {
    renderSphinx({ max: 2, used: 0 });
    const chip = laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
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
