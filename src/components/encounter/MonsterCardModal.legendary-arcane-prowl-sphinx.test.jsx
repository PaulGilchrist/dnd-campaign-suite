// @maintained-by-ai
// MA-1494 regression (by-name disk + live-seam owner: sphinx-of-lore Arcane Prowl):
// Sphinx of Lore legendary_actions[0] was the Arcane Prowl CHILD with uses:1 —
// legendaryHeaderAction() (monsterLegendaryUses.js rows[0].uses != null) swallowed it
// as the economy header: the card printed "Arcane Prowl (1 left)" as a no-onClick
// mc-legendary-header-row div with ZERO affordance, its Claw half never adjudicated,
// and the ONLY legendary chip rode the SIBLING Weight of Years (prose DC 16 only, no
// numeric save_dc — the save-chip gate never armed) silently BURNING the shared use
// through resolveLegendaryRowMechanic's final else console.error (MA-0510).
// Fix is DATA-only: canonical header rows[0] "Legendary Action Uses: 2"; Arcane Prowl
// delegates_to:"Claw" riding the MA-0022 delegate attack seam with the teleport leg
// folded into `description` (advisory FIELDS would hijack resolveLegendaryRowMechanic
// BEFORE the delegate numeric leg — MA-1457 §678 ordering; no position consumer,
// CLA-320 — Prowl stamps NO buff/speed/invisibility, verified in the modal source);
// Weight of Years gains numeric save_dc:16 + save_type:"Constitution" +
// dc_success:"none" (its OWN prose carries NO success-pays clause — the
// "Failure or Success:" tail attaches to the REUSE limit only, MA-1058 discriminator).
// Trim pass: generic legendary-lane branches (counter, exhausted/own-turn/turn-latch
// refusals, once-per-turn cooldown vocabulary, delegate-label mechanics, header
// "(N left)" render, MA-0751 exhaustion parse channel) are collapsed — owned by
// MonsterCardModal.legendary-uses.test.jsx, monsterLegendaryUses.test.js,
// mummy-lord (MA-1204 spend-then-save twin), saveProcessing.exhaustion.test.js.
// sphinx-of-valor is owned by its by-name file MonsterCardModal.legendary-arcane-prowl-valor.test.jsx
// (MA-1507), which cross-pins lore Claw discriminators — not duplicated here.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Sphinx of Lore 1', type: 'npc', monsterType: 'celestial', targetName: 'Bandit 1', currentHp: 170, maxHp: 170, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];
const KEY = 'Sphinx of Lore 1.monsterLegendaryUses';

const sphinx = () => monstersData.find(m => m.index === 'sphinx-of-lore');

// MA-1494 by-name disk lock: the exact fixed byte-shape of lore's legendary block.
describe('MA-1494 monsters.json data lock: sphinx-of-lore legendary block', () => {
  it('canonical header rows[0]; Arcane Prowl delegates_to Claw (teleport folded into description, no numeric/advisory fields, no cooldown clause); Weight of Years numeric DC 16 CON dc_success:none with once-per-turn clause; Claw +8 / 3d6 + 4 Slashing; children carry no uses/recharge (§165/§168)', () => {
    const h = sphinx().legendary_actions[0];
    expect(h.name).toBe('Legendary Action Uses: 2');
    expect(h.uses).toBe(2);
    expect(h.description).toContain('sphinx of lore');
    expect(legendaryHeaderAction(sphinx())).toBe(h);

    const prowl = sphinx().legendary_actions.find(a => a.name === 'Arcane Prowl');
    expect(prowl.delegates_to).toBe('Claw');
    expect(prowl.description).toBe('The sphinx can teleport up to 30 feet to an unoccupied space it can see (teleport advisory — GM moves the token; no position consumer), and it makes one Claw attack.');
    expect(prowl.attack_bonus).toBeUndefined();
    expect(prowl.save_dc).toBeUndefined();
    expect(prowl.damage_dice_primary).toBeUndefined();
    expect(prowl.advisory).toBeUndefined();
    expect(prowl.advisory_message).toBeUndefined();
    // No once-per-turn clause on this row — no owner cooldown latch.
    expect(hasLegendaryCooldownClause(prowl)).toBe(false);

    const woy = sphinx().legendary_actions.find(a => a.name === 'Weight of Years');
    expect(woy.save_dc).toBe(16);
    expect(woy.save_type).toBe('Constitution');
    expect(woy.dc_success).toBe('none');
    expect(woy.attack_bonus).toBeUndefined();
    expect(woy.delegates_to).toBeUndefined();
    // Once-per-turn owner-latch clause arms the MA-0073 cooldown lane.
    expect(hasLegendaryCooldownClause(woy)).toBe(true);

    const claw = sphinx().actions.find(a => a.name === 'Claw');
    expect(claw.attack_bonus).toBe(8);
    expect(claw.damage_dice_primary).toBe('3d6 + 4');
    expect(claw.damage_type_primary).toBe('Slashing');

    for (const child of sphinx().legendary_actions.slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.recharge).toBeUndefined();
    }
  });
});

// MA-1494 live seam: canonical header renders "Legendary Action Uses: 2 (2 left)"
// — NOT a swallowed Arcane Prowl header; the ONLY gated "Expend Legendary" chip is
// Prowl's. Its click spends 2->1 and rolls the delegated +8 Claw through the MA-0022
// delegate attack seam (distinct label "Arcane Prowl (Claw attack)", 3d6 + 4 Slashing
// vs the armed Bandit, save lane never armed, MA-0510 silent-burn dead, no buff/speed/
// invisibility stamp — the teleport leg is prose-only).
describe('MA-1494 MonsterCardModal sphinx-of-lore Arcane Prowl live seam', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderSphinx(uses) {
    runtime.store[KEY] = uses;
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

  it('header renders canonical NOT swallowed Arcane Prowl; Prowl chip click spends 2->1 and rolls the delegated +8 Claw — no save leg, latch unstamped, no console error', async () => {
    renderSphinx({ max: 2, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 2');
    expect(header.textContent).not.toContain('Arcane Prowl');
    expect(header.getAttribute('onclick')).toBeNull();
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    // Prowl: non-numeric delegate child keeps the gated spend-only chip; Weight of
    // Years self-suppresses it (MonsterAction.jsx, MA-0676 §204) — exactly one rides.
    const chips = document.querySelectorAll('.mc-dice-link-legendary');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Expend Legendary');
    expect(laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable')?.textContent).toContain('DC 16 Constitution');
    fireEvent.click(chips[0]);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
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

  // MA-1495 numeric-DC leg: fresh boundary spends then routes rollSavingThrow CON vs
  // DC 16 with dc_success 'none' + exhaustionLevel {level:1} threaded on the save
  // context (MA-0751 canonical channel — downstream numeric-exhaustion adjudication
  // owned by saveProcessing.exhaustion.test.js); success pays nothing by RAW.
  it('Weight of Years DC chip spends honestly then adjudicates CON save vs DC 16 (dc_success none, exhaustion canonical channel)', async () => {
    renderSphinx({ max: 2, used: 0 });
    fireEvent.click(laRow('Weight of Years').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
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
    expect(spend.description).toMatch(/expends a legendary use for Weight of Years/);
    // MA-0073 per-action once-per-turn owner latch (row clause verbatim on disk).
    expect(runtime.store['Sphinx of Lore 1.monsterLegendaryActionCooldowns']?.weight_of_years).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
