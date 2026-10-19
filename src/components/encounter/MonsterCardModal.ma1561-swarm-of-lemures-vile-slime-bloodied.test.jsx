// @maintained-by-ai
// MA-1561: Swarm of Lemures "Vile Slime" — inert prose Bloodied variant
// fixed on monsters.json swarm-of-lemures actions[1] via conditional_damage
// riding the live MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on
// cd?.dice, Helpers:687). Modifier-bearing MA-0485 byte-shape (separate numeric
// modifier key; NEVER embedded in the dice string) — dice/modifier split per
// §MA-1555 pitfall. Monster-exclusive disk row: only Poison+Bloodied cd in the
// bestiary (verified census — unique byte twin {2d6, 2, Poison, Bloodied}).
// Seam is ADDITIVE (MA-1160): base Done still pays 2d8 + 2; grant rolls its own
// 2d6 + 2 bonus leg — RAW full-variant replacement caveat accepted exactly like
// swarm-family twins MA-1552/MA-1553/MA-1554/MA-1555/MA-1557/MA-1558/MA-1559.
// Trim pass (2026-10-18), two tests mirroring the maintained ma1552/ma1555/
// ma1557/ma1558/ma1559 template:
//   1. Disk-row bytes: full cd-object toEqual identity (modifier-bearing shape,
//      key order pinned inline) + base legs + key placement + no-rider absence +
//      RAW prose regex for the Bloodied variant sentence + two-action parent
//      census + CR0 lemure same-name row inert (fix-scope blast-radius guard —
//      no other test indexes the non-swarm lemure).
//   2. ONE click→rollAttack ctx press: full 7-key offer identity incl. this
//      monster's distinct label chrome ("Bloodied: +2d6+2 Poison?") + hitClause
//      toBeNull (Bloodied-only row, unlike ma1555's prone twin).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363
// :105-120; direct buildChargeBonusOffer label test — subsumed by the ctx offer
// toEqual. Charge-row label loop cut: every foreign row byte-pinned by its own
// owner (talons charge-bonus :51, goat ma0885, quaggoth ma1363, bats ma1552,
// claws ma1555, dretches ma1557, insects ma1558, larvae ma1559). Foreign-row
// cross-pin cut: piranhas owns its own cd bytes at ma1562 while reciprocally
// pinning this row (ma1557 carried rec — foreign cross-pins live with owners).
// attackRowMissingToHit truth table owned by helper census (MonsterAction.ma0286
// :89-113 covers this row; a suppressed row would fail the +4-chip click in
// test 2 anyway).
// Dead-mock purge per ma1552/ma1558 baseline: diceRoller stub (rollAttack
// mocked, no roller fires without the cut grant tests), AttackResultPopup stub
// (popup never renders — popupHtml null), never-fired hook members (minimal
// shape renders).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
    })),
    _rollAttack,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const { _rollAttack: rollAttack, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SWARM = monsters.find((m) => m.index === 'swarm-of-lemures');
const VILE_SLIME = SWARM.actions.find((a) => a.name === 'Vile Slime');
const LEMURE = monsters.find((m) => m.index === 'lemure');

// Exact buildChargeBonusOffer(VILE_SLIME, 'Vile Slime') output FROM the disk
// row — full identity, incl. the modifier-bearing formula ('2d6 + 2', MA-0485
// shape) and the condition-text label chrome ("Bloodied: +2d6+2 Poison?", no
// feet-token head, MA-1363 label generalization with the +2 modifier token).
const LEMURES_OFFER = {
  dice: '2d6',
  modifier: 2,
  damageType: 'Poison',
  condition: 'Bloodied',
  formula: '2d6 + 2',
  label: 'Bloodied: +2d6+2 Poison?',
  attackName: 'Vile Slime',
};

const CREATURES = [
  { name: 'Swarm of Lemures 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderLemures() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Lemures', size: 'Large', type: 'swarm', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Lemures 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Lemures 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1561 monsters.json data lock: Swarm of Lemures Vile Slime Bloodied fix', () => {
  it('authors the modifier-bearing Bloodied cd with RAW prose anchor, key placement, and no hit-clause riders', () => {
    expect(VILE_SLIME.attack_bonus).toBe(4);
    expect(VILE_SLIME.reach).toBe('5 ft.');
    expect(VILE_SLIME.damage_dice_primary).toBe('2d8 + 2');
    expect(VILE_SLIME.damage_type_primary).toBe('Poison');
    // Full cd identity — the modifier-bearing MA-0485 byte-shape (separate numeric
    // modifier key, dice string never carries '+'), key order pinned inline.
    expect(VILE_SLIME.conditional_damage).toEqual({
      dice: '2d6',
      modifier: 2,
      damage_type: 'Poison',
      condition: 'Bloodied',
    });
    expect(Object.keys(VILE_SLIME.conditional_damage)).toEqual(['dice', 'modifier', 'damage_type', 'condition']);
    expect(VILE_SLIME.conditional_damage.dice).not.toMatch(/\+/);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(VILE_SLIME);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Bloodied-only row: no hit-clause riders authored (unlike the ma1555 twin).
    expect(VILE_SLIME.hit_conditions).toBeUndefined();
    expect(VILE_SLIME.hit_target_effect).toBeUndefined();
    expect(VILE_SLIME.hit_choice).toBeUndefined();
    expect(VILE_SLIME.escape_dc).toBeUndefined();
    // RAW prose anchor for the fixed Bloodied variant — monster-exclusive seam
    // (only Poison+Bloodied cd row in the bestiary).
    expect(VILE_SLIME.description).toMatch(/Hit: 11 \(2d8 \+ 2\) Poison damage, or 9 \(2d6 \+ 2\) Poison damage if the swarm is Bloodied\./);
    // Two-action parent census: Multiattack unchanged (no cd), Vile Slime the rider.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Multiattack', 'Vile Slime']);
    expect(SWARM.actions[0].conditional_damage).toBeUndefined();
    // Fix-scope guard: the CR0 lemure's same-name row stays inert (1d4, no cd) —
    // only the swarm carries the Bloodied variant.
    const lemureSlime = LEMURE.actions.find((a) => a.name === 'Vile Slime');
    expect(lemureSlime.conditional_damage).toBeUndefined();
    expect(lemureSlime.damage_dice_primary).toBe('1d4');
  });
});

describe('MA-1561 Swarm of Lemures Vile Slime click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +4 chip forwards the full disk offer with Bloodied label chrome and a null hitClause', () => {
    renderLemures();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Vile Slime/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
    expect(chip, 'Expected Vile Slime +4 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(LEMURES_OFFER);
    // toBeNull like the Bloodied-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
  });
});
