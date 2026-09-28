// MA-1494 regression: Sphinx of Lore legendary_actions[0] was the Arcane Prowl
// CHILD with uses:1 — legendaryHeaderAction() (monsterLegendaryUses.js:156,
// rows[0].uses != null) swallowed it as the economy header: the card printed
// "Arcane Prowl (1 left)" as a no-onClick mc-legendary-header-row div with ZERO
// affordance (MA-1456/MA-1479 twins, §99/§202), its Claw half never adjudicated,
// and the ONLY legendary chip rode the SIBLING Weight of Years (delegates_to
// undefined, prose DC 16 only, no numeric save_dc — MonsterAction.jsx save-chip
// gate never arms) silently BURNING the shared use through
// resolveLegendaryRowMechanic's final else console.error (MA-0510, live-confirmed
// pre-fix: spends {max:1,used:1}, ability_use-only log, zero rolls/damage).
// Fix is DATA-only SAME pass (§46/§168 MA-1456/MA-1479/MA-1204 byte-shape):
// canonical header rows[0] "Legendary Action Uses: 2" (N=children floor §231 —
// 2024 Sphinx has 2 legendary actions; lair_actions are prose, no "(4 in Lair)"
// bump); Arcane Prowl delegates_to:"Claw" riding the MA-0022 delegate attack
// seam (+8 / 3d6 + 4 Slashing, MA-0956 gynosphinx / MA-1057 kraken twins) with
// the §70 teleport leg folded into `description` per the MA-1456 Pounce precedent
// (advisory FIELDS would hijack resolveLegendaryRowMechanic BEFORE the delegate
// numeric leg — MA-1457 §678 ordering); Weight of Years gains numeric
// save_dc:16 + save_type:"Constitution" + dc_success:"none" (its OWN prose
// carries NO success-pays clause — success gains nothing, §63/MA-1492 sibling
// reading; the "Failure or Success:" tail attaches to the REUSE limit only,
// MA-1058 Toxic Ink discriminator) so its own "DC 16 Constitution" chip rides
// the shared legendary gate live (MA-0676 §204 spend-then-save twin,
// MA-1204 Dread Command twin) and exhaustion adjudicates via the LIVE MA-0751
// parseExhaustionLevelClause canonical channel. Children `uses`/`recharge:false`
// DROPPED (§165 double-economy; §MA-1456 household-recharge pollution).
// sphinx-of-valor shares the byte-identical pre-fix block — untouched, MA-1507
// ticket scope (pinned below). MA-1495's numeric-DC leg is completed by this
// pass: verify, do not re-edit.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause, legendaryActionSlug } from '../../services/encounters/monsterLegendaryUses.js';
import { parseExhaustionLevelClause, parseBothOutcomesClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

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
  { name: 'Sphinx of Lore 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 170, maxHp: 170, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const sphinx = () => monstersData.find(m => m.index === 'sphinx-of-lore');
const legendaryRows = () => sphinx().legendary_actions;
const headerRow = () => legendaryRows()[0];
const prowlRow = () => legendaryRows().find(a => a.name === 'Arcane Prowl');
const weightRow = () => legendaryRows().find(a => a.name === 'Weight of Years');
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-1494 data lock: header-swallow fixed — rows[0] canonical header (numeric
// uses, no mechanic of its own); children carry no per-child `uses` nor
// household `recharge:false` (§168/MA-1456/MA-1479).
describe('MA-1494 monsters.json data: sphinx-of-lore legendary block header + children', () => {
  it('rows[0] is the canonical header "Legendary Action Uses: 2" with numeric uses', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toBe("The sphinx of lore takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn.");
    expect(h.delegates_to).toBeUndefined();
    expect(h.save_dc).toBeUndefined();
    expect(legendaryHeaderAction(sphinx())).toBe(h);
  });

  it('children carry no per-child uses nor recharge (header owns the economy, §165/§168)', () => {
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });

  it('Arcane Prowl delegates_to Claw — no numeric fields, no advisory fields (MA-1457 §678 ordering), §70 teleport advisory folded into description', () => {
    const row = prowlRow();
    expect(row.delegates_to).toBe('Claw');
    expect(row.description).toBe('The sphinx can teleport up to 30 feet to an unoccupied space it can see (teleport advisory — GM moves the token; no position consumer), and it makes one Claw attack.');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.advisory).toBeUndefined();
    expect(row.advisory_message).toBeUndefined();
    // No once-per-turn clause on this row — no owner cooldown latch.
    expect(hasLegendaryCooldownClause(row)).toBe(false);
  });

  it('delegates to the sphinx-of-lore own Claw row: +8 / 3d6 + 4 Slashing / reach 5 ft. — label rides the ATTACK seam', () => {
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(8);
    expect(claw.damage_dice_primary).toBe('3d6 + 4');
    expect(claw.damage_type_primary).toBe('Slashing');
    expect(claw.reach).toBe('5 ft.');
    const delegate = legendaryDelegateAction(sphinx(), prowlRow());
    expect(delegate).toBe(claw);
    // Claw authors no save_dc → label kind is "attack" (not the MA-1456 DC0
    // "(Rend save)" decoy shape — clean pin).
    expect(legendaryDelegateAttackName(prowlRow(), claw)).toBe('Arcane Prowl (Claw attack)');
  });

  // Weight of Years dc_success reading (ticket-mandated adjudication): its OWN
  // prose has NO success-pays clause — success gains NOTHING (the exhaustion
  // lands on failure only; the "Failure or Success:" tail attaches to the
  // REUSE limit, MA-1058 Toxic Ink discriminator; MA-1492 sibling uses none).
  // RAW success unaffected ⇒ dc_success:"none" (§63/§809 family).
  it('Weight of Years arms numeric save_dc:16 + save_type:"Constitution" + dc_success:"none" — exhaustion rides the LIVE MA-0751 canonical channel', () => {
    const row = weightRow();
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.description).toBe('Constitution Saving Throw: DC 16, one creature the sphinx can see within 120 feet. Failure: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. Failure or Success: The sphinx can\'t take this action again until the start of its next turn.');
    expect(row.save_effect).toBe('The target gains 1 Exhaustion level and appears 3d10 years older while it has any Exhaustion levels. The sphinx can\'t take this action again until the start of its next turn.');
    // Once-per-turn owner-latch clause verbatim (slug weight_of_years stamps live).
    expect(hasLegendaryCooldownClause(row)).toBe(true);
    expect(legendaryActionSlug(row.name)).toBe('weight_of_years');
    // MA-0751 byte key "gains N Exhaustion level(s)" matches the save_effect.
    expect(parseExhaustionLevelClause(row.save_effect)).toEqual({ effect: 'exhaustion', level: 1 });
  });

  // MA-1495 facet lock (verify-only; fields landed in the MA-1494 pass): the
  // pre-fix silent-burn was the MA-1071 `Number(save_dc) > 0` gate reading 0 →
  // resolveLegendaryRowMechanic final else console.error (MA-0510). Success pays
  // ZERO by RAW + dc_success:"none": the MA-1058 discriminator proves the
  // "Failure or Success:" tail in `description` attaches to the REUSE limit only
  // (parseBothOutcomesClause null), and save_effect carries NO such tail at all;
  // exhaustion is the ONLY fail-leg grant, riding the canonical NUMERIC
  // exhaustionLevel channel (MA-0751 grant pinned byte-shape in
  // saveProcessing.exhaustion.test.js — numeric exhaustionLevel 1 + stacks +
  // death cap 6 + `condition applied` log, no te/clock), never a boolean
  // condition or te (CONDITIONS word list excludes exhaustion — §239).
  it('MA-1495 facets: DC-gate armed, success pays zero (MA-1058 tail null both surfaces), fail-only canonical numeric exhaustion', () => {
    const row = weightRow();
    // MA-1071 canonical save-lane gate the pre-fix row failed (save_dc absent → 0).
    expect(Number(row.save_dc) > 0).toBe(true);
    // MA-1058 discriminator: reuse-limit tail names no condition → null.
    expect(parseBothOutcomesClause(row.save_effect)).toBeNull();
    expect(parseBothOutcomesClause(row.description)).toBeNull();
    // Zero condition-word grants on EITHER leg; no te by design (MA-0751).
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual([]);
    expect(extractConditionsFromSaveEffect(row.description)).toEqual([]);
    // Canonical numeric level 1 from the byte-exact save_effect prose; the
    // salamander recurring-burn-tick exclusion guard is NOT tripped by this row.
    const parsed = parseExhaustionLevelClause(row.save_effect);
    expect(parsed).toEqual({ effect: 'exhaustion', level: 1 });
    expect(typeof parsed.level).toBe('number');
    expect(/whenever it takes this burning damage/i.test(row.save_effect)).toBe(false);
  });

  // §23 byte-identical shared block: sphinx-of-valor keeps the PRE-FIX shape —
  // MA-1507 ticket scope, untouched by this pass.
  it('sphinx-of-valor twin block stays untouched (byte-identical pre-fix rows, MA-1507 scope)', () => {
    const valor = monstersData.find(m => m.index === 'sphinx-of-valor');
    expect(valor.legendary_actions[0].name).toBe('Arcane Prowl');
    expect(valor.legendary_actions[0].uses).toBe(1);
    expect(valor.legendary_actions[0].delegates_to).toBeUndefined();
    expect(valor.legendary_actions[1].save_dc).toBeUndefined();
  });
});

// MA-1494 live seam: canonical header renders "Legendary Action Uses: 2 (2 left)"
// — NOT a swallowed Arcane Prowl header. Prowl (non-numeric child) keeps the gated
// "Expend Legendary" chip; its click spends then rolls the delegated +8 Claw through
// the MA-0022 delegate attack seam (label "Arcane Prowl (Claw attack)", 3d6 + 4
// Slashing vs the armed Bandit, save lane never armed). Weight of Years renders its
// own numeric "DC 16 Constitution" save chip riding the shared legendary gate
// (MA-0676 §204 spend-then-save) with dc_success 'none' threaded on the save
// context and exhaustionLevel {level:1} parsed live (MA-0751). Boundary/exhausted/
// own-turn refusals honest, zero spend, zero console silent-burn (MA-0510 dead).
describe('MA-1494 MonsterCardModal sphinx-of-lore legendary gated rows', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderSphinx(uses) {
    runtime.store['Sphinx of Lore 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Sphinx of Lore',
      actions: sphinx().actions,
      legendary_actions: sphinx().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Sphinx of Lore 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('header renders "Legendary Action Uses: 2 (2 left)" — NOT a swallowed Arcane Prowl header; per-child chips arm', () => {
    renderSphinx({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Arcane Prowl');
    expect(header.getAttribute('onclick')).toBeNull();
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    // Prowl: non-numeric delegate child keeps the gated spend-only chip.
    expect(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary').textContent).toContain('Expend Legendary');
    // Weight of Years: numeric save child rides the gate with its own DC chip and
    // self-suppresses LegendarySpendLink (MonsterAction.jsx, MA-0676 §204).
    const woyChip = laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable');
    expect(woyChip).not.toBe(null);
    expect(woyChip.textContent).toContain('DC 16 Constitution');
    expect(laRow('Weight of Years').querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(document.querySelectorAll('.mc-dice-link-legendary').length).toBe(1);
  });

  it('Prowl chip spends 2->1 after another creature turn and rolls the delegated +8 Claw — no save leg, no console error', async () => {
    renderSphinx({ max: 2, used: 0 });
    const chip = laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Sphinx of Lore 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Arcane Prowl (Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(8);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d6 + 4');
    expect(options.autoDamageName).toBe('Arcane Prowl (Claw attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.targetName).toBe('Bandit 1');
    expect(options.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Arcane Prowl/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Arcane Prowl \(Claw attack\)/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    // No cooldown clause on Prowl — latch stays unstamped.
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryActionCooldowns']?.arcane_prowl).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same-boundary refire refuses (turn latch) — shared gate rides BOTH children, save never rolls', async () => {
    renderSphinx({ max: 2, used: 0 });
    fireEvent.click(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
  });

  // MA-1495 numeric-DC leg completed by THIS pass (verify, do not re-edit):
  // fresh boundary spends then routes rollSavingThrow CON vs DC 16 with
  // dc_success 'none' + exhaustionLevel {level:1} on the save context;
  // fail-only exhaustion adjudication rides the LIVE MA-0751 canonical channel;
  // success pays nothing by RAW and by dc_success (no half-leak surface — the
  // row carries no damage pool, §63 bites damage rows only).
  it('Weight of Years DC chip spends honestly then adjudicates CON save vs DC 16 (dc_success none, exhaustion canonical channel)', async () => {
    renderSphinx({ max: 2, used: 0 });
    ctx.value = { round: 2, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    fireEvent.click(laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Sphinx of Lore 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('CON');
    const saveCtx = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(saveCtx.saveDc).toBe(16);
    expect(saveCtx.saveType).toBe('Constitution');
    expect(saveCtx.dcSuccess).toBe('none');
    expect(saveCtx.exhaustionLevel).toEqual({ effect: 'exhaustion', level: 1 });
    expect(saveCtx.saveConditions).toEqual([]);
    expect(saveCtx.autoDamageFormula).toBeNull();
    expect(saveCtx.targetName).toBe('Bandit 1');
    expect(saveCtx.attackerName).toBe('Sphinx of Lore 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Weight of Years/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/expends a legendary use for Weight of Years/);
    // MA-0073 per-action once-per-turn owner latch (row clause verbatim on disk).
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryActionCooldowns']?.weight_of_years).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): both children refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderSphinx({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('no legendary uses left');
    fireEvent.click(laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'legendary_use_refused').length).toBe(2));
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('own-turn click refuses honestly (after ANOTHER creature\'s turn, not its own)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Sphinx of Lore 1', creatures: CREATURES };
    renderSphinx({ max: 2, used: 0 });
    fireEvent.click(laRow('Arcane Prowl').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain("after ANOTHER creature's turn, not its own");
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryUses']).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
