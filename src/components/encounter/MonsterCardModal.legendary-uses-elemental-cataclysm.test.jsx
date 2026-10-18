// @maintained-by-ai — trimmed 6→3 to cataclysm-distinct lanes: BY-name #387
// data locks through the resolvers (header resolves at index 0 — the
// swallowed-child fingerprint — Eruption→Elemental Burst delegate bytes,
// Rumbling Movement byte-invariance) + ONE effect-distinct click (Eruption
// Expend chip → spend 1 + delegated +15 / 5d6 + 8 Acid ctx, zero burn).
// Generic turn-latch and exhausted-refusal clicks cite-skipped to their
// owners (map in header comment).
// MA-0675 regression: Elemental Cataclysm legendary_actions[0] was the
// Eruption CHILD with uses:1 — legendaryHeaderAction() swallowed it as the
// header, so the card printed "Eruption (1 left)" as inert header text with
// ZERO affordance (MonsterCardBody renders slice(1)): no .mc-dice-link-
// legendary, no "Expend Legendary" chip, no console.error (LegendarySpendLink
// never ran on the swallowed row), economy unreachable (§99 harder-zero than
// MA-0510). Fix mirrors the §165 Colossus/Death Knight/MA-0620 byte-shape
// DATA-only one-pass template: header "Legendary Action Uses: 3" + numeric
// uses:3 (CR 22 twins ancient-bronze/ancient-green both stamp numeric 3;
// canonical total is a named honest gap — a correction is a one-line edit of
// la[0].uses + its name), and Eruption authored the SAME pass as a
// delegating child onto the byte-existing +15 Elemental Burst attack row
// (MA-0672 live-proven) with its own uses dropped.
//
// Distinct lanes kept here (BY-name #387 rows + one effect-distinct click):
// - header resolves through legendaryHeaderAction at index 0 (the
//   swallowed-child fingerprint) with numeric uses:3
// - Eruption→Elemental Burst delegate resolves the byte-existing +15 row;
//   Rumbling Movement stays byte-unchanged (save_dc 23 rides its own chip)
// - ONE effect-distinct click: Eruption Expend chip spends 1 and rolls the
//   delegated +15 / 5d6 + 8 Acid attack ctx — zero console burn (the
//   MA-0675 affordance proof: the chip exists and LegendarySpendLink runs)
//
// Cite-skipped generics (covered by owners — verified):
// - gate / spend / turn-latch / own-turn / exhausted / refusal / regain units:
//   src/services/encounters/monsterLegendaryUses.test.js :79-110, :112-143, :145-162
// - modal turn-latch lane: MonsterCardModal.legendary-uses.test.jsx :310, :418, :543, :731
// - modal exhausted refusal (the ONE exhausted sibling kept at beholder #626):
//   MonsterCardModal.legendary-uses-beholder.test.jsx :213-223,
//   MonsterCardModal.legendary-uses.test.jsx :190
// - legendary save-chip click riding the shared gate (Rumbling Movement twin):
//   MonsterCardModal.legendary-uses-mummy-lord.test.jsx :227-245 (MA-0676)
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
}));
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
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
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
  { name: 'Elemental Cataclysm 1', type: 'npc', targetName: 'Bandit 1', currentHp: 555, maxHp: 555, ac: 22, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const cataclysm = () => monstersData.find(m => m.name === 'Elemental Cataclysm');

describe('MA-0675 monsters.json data: elemental cataclysm legendary rows by-name locks', () => {
  it('header resolves through legendaryHeaderAction with numeric uses 3 (no longer the swallowed Eruption child)', () => {
    const m = cataclysm();
    const header = m.legendary_actions[0];
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(header.uses).toBe(3);
    expect(header.name).not.toMatch(/Eruption|Rumbling/);
    expect(header.description).toMatch(/Immediately after another creature's turn, the cataclysm can expend a use/);
    expect(header.description).toMatch(/regains all expended uses at the start of each of its turns/);
    expect(legendaryHeaderAction(m)).toBe(header);
  });

  it('Eruption→Elemental Burst resolves the byte-existing +15 row; Rumbling Movement stays byte-unchanged (save_dc 23 rides its own chip)', () => {
    const m = cataclysm();
    const eruption = m.legendary_actions.find(a => a.name === 'Eruption');
    expect(eruption.delegates_to).toBe('Elemental Burst');
    expect(eruption.uses).toBeUndefined();
    expect(eruption.description).toBe('The cataclysm makes one Elemental Burst attack.');
    const burst = m.actions.find(a => a.name === 'Elemental Burst');
    expect(legendaryDelegateAction(m, eruption)).toBe(burst);
    expect(legendaryDelegateAttackName(eruption, burst)).toBe('Eruption (Elemental Burst attack)');
    expect(burst.attack_bonus).toBe(15);
    expect(burst.damage_dice_primary).toBe('5d6 + 8');
    expect(burst.damage_type_primary).toBe('Acid');

    const rumbling = m.legendary_actions.find(a => a.name === 'Rumbling Movement');
    expect(rumbling.save_dc).toBe(23);
    expect(rumbling.save_type).toBe('Constitution');
    expect(rumbling.delegates_to).toBeUndefined();
    expect(rumbling.uses).toBeUndefined();
  });
});

// Live seam: counter mounts, the ONE effect-distinct Eruption gated click
// spends 1 BEFORE rolling and lands its delegated attack ctx with zero
// console burn (the MA-0675 fingerprint: zero affordance, zero spend).
describe('MA-0675 MonsterCardModal elemental cataclysm legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderCataclysm(uses) {
    if (uses !== undefined) runtime.store['Elemental Cataclysm 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Elemental Cataclysm',
      actions: cataclysm().actions,
      legendary_actions: cataclysm().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elemental Cataclysm 1', creatures: CREATURES })} />);
  }
  function laChip(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith(name))?.querySelector('.mc-dice-link-legendary') || null;
  }

  it('header shows (3 left); Eruption Expend chip click spends 1, rolls delegated +15 / 5d6 + 8 Acid — zero burn', async () => {
    renderCataclysm({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = laChip('Eruption');
    expect(chip).not.toBeNull();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Elemental Cataclysm 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Eruption (Elemental Burst attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('5d6 + 8');
    expect(options.damageType).toBe('Acid');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Eruption/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Eruption/);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
