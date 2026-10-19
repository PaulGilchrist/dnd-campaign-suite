// @maintained-by-ai
// MA-1558: Swarm of Insects "Bites" (single-action swarm, indexed BY name) — inert
// prose Bloodied variant fixed on monsters.json via conditional_damage riding the live
// MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on cd?.dice, Helpers:687).
// Modifier-bearing MA-0485 byte-shape (separate numeric modifier key; NEVER embedded
// in the dice string) — dice/modifier split per §MA-1555 pitfall. Monster-exclusive
// disk row: no other action carries cd {1d4 + 1, Poison, Bloodied} (verified census).
// Seam is ADDITIVE (MA-1160): base Done still pays 2d4 + 1; grant rolls its own
// 1d4 + 1 bonus leg — RAW full-variant replacement caveat accepted exactly like
// swarm-family twins MA-1552/MA-1553/MA-1554/MA-1555.
// Trim pass (2026-10-18), two tests mirroring the maintained ma1552/ma1555/ma1557
// template:
//   1. Disk-row bytes: full cd-object toEqual identity (modifier-bearing shape, key
//      order pinned inline — no foreign-row chimera comparison) + base legs + key
//      placement + no-rider absence + RAW prose regex for the Bloodied variant
//      sentence + single-action parent census.
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1407): full 7-key offer
//      identity incl. this monster's distinct label chrome ("Bloodied: +1d4+1
//      Poison?") + hitClause toBeNull (Bloodied-only row, unlike ma1555's twin).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363 :105-120;
// direct buildChargeBonusOffer label test — subsumed by the ctx offer toEqual.
// Charge-row label loop cut: every row byte-pinned by its own owner (talons
// charge-bonus :51, goat ma0885 :124, quaggoth ma1363 :158, bats ma1552,
// claws ma1555, dretches ma1557). Sibling swarm row loop cut: spiders owned by
// ma1568, centipedes owned by ma1554 (this file's foreign-row cross-pins cut per
// the ma1557 carried rec). attackRowMissingToHit truth table owned by ma0286
// helper owner (full-monster census :113 covers this row; a suppressed row would
// fail the +3-chip click in test 2 anyway).
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller
// fires without the cut grant tests), AttackResultPopup stub (popup never renders —
// popupHtml null), never-fired hook members (minimal shape renders per ma1160/ma1363).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-insects');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full identity,
// incl. the modifier-bearing formula ('1d4 + 1', MA-0485 shape) and the condition-text
// label chrome ("Bloodied: +1d4+1 Poison?", no feet-token head, MA-1363 label
// generalization with the +1 modifier token — insects-distinct in the swarm family).
const BITES_OFFER = {
  dice: '1d4',
  modifier: 1,
  damageType: 'Poison',
  condition: 'Bloodied',
  formula: '1d4 + 1',
  label: 'Bloodied: +1d4+1 Poison?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Insects 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderInsects() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Insects', size: 'Medium', type: 'swarm', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Insects 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Insects 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1558 monsters.json data lock: Swarm of Insects Bites Bloodied fix', () => {
  it('authors the modifier-bearing Bloodied cd with RAW prose anchor, key placement, and no hit-clause riders', () => {
    expect(BITES.attack_bonus).toBe(3);
    expect(BITES.reach).toBe('5 ft.');
    expect(BITES.damage_dice_primary).toBe('2d4 + 1');
    expect(BITES.damage_type_primary).toBe('Poison');
    // Full cd identity — the modifier-bearing MA-0485 byte-shape (separate numeric
    // modifier key, dice string never carries '+'), key order pinned inline.
    expect(BITES.conditional_damage).toEqual({
      dice: '1d4',
      modifier: 1,
      damage_type: 'Poison',
      condition: 'Bloodied',
    });
    expect(Object.keys(BITES.conditional_damage)).toEqual(['dice', 'modifier', 'damage_type', 'condition']);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Bloodied-only row: no hit-clause riders authored (unlike the ma1555 twin).
    expect(BITES.hit_conditions).toBeUndefined();
    expect(BITES.hit_target_effect).toBeUndefined();
    expect(BITES.hit_choice).toBeUndefined();
    expect(BITES.escape_dc).toBeUndefined();
    // RAW prose anchor for the fixed Bloodied variant.
    expect(BITES.description).toMatch(/Hit: 6 \(2d4 \+ 1\) Poison damage, or 3 \(1d4 \+ 1\) Poison damage if the swarm is Bloodied\./);
    // Single-action parent census: Bites is the swarm's only action.
    expect(SWARM.actions).toHaveLength(1);
    expect(SWARM.actions[0].name).toBe('Bites');
  });
});

describe('MA-1558 Swarm of Insects Bites click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +3 chip forwards the full disk offer with Bloodied label chrome and a null hitClause', () => {
    renderInsects();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+3');
    expect(chip, 'Expected Bites +3 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(BITES_OFFER);
    // toBeNull like the Bloodied-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
  });
});
