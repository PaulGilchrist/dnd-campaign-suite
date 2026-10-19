// @maintained-by-ai
// MA-1564: Swarm of Quippers Bites — conditional_damage:{dice:"2d6",damage_type:"piercing",
// condition:"half HP or fewer"} authored on monsters.json swarm-of-quippers actions[0] so the
// HIT popup offers the "or 7 (2d6) piercing damage if the swarm has half of its hit points or
// fewer" variant via the live MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on
// cd.dice only — Helpers:689). Seam is ADDITIVE: base Done still pays 4d6; grant rolls its
// own 2d6 leg. No auto-half-HP eval (§70 residual); offer shows even healthy (MA-1363
// static-state recipe). Modifier-less lowercase-damage_type shape mirrors MA-0885 goat /
// MA-1363 quaggoth / MA-1552 bats twins; half-HP cd byte-twins beetles/centipedes/spiders/
// wasps all roll {2d4,piercing,half HP or fewer} — quippers is the ONLY 2d6 half-HP row,
// so the dice byte plus the full prose sentence are monster-exclusive seams. Foreign-row
// cross-pins cut per maintained swarm template (beetles→ma1553, centipedes→ma1554,
// bats→ma1552, spiders→ma1568, wasps→ma1571, quaggoth→ma1363, goats→ma0885).
// Trim pass (2026-10-18), two tests mirroring the maintained ma1552/ma1553/ma1554/
// ma1562 template:
//   1. Disk-row lock: full cd toEqual identity + modifier-less key order pinned inline +
//      base legs + key placement (cd after damage_type_primary, last key) + no hit-clause
//      riders + RAW prose regex (2d6 half-HP sentence, bestiary-exclusive) + single-action
//      census + fix-scope blast-radius guard (lone quipper's same-name Bite stays inert).
//   2. ONE click→rollAttack ctx press: full 7-key offer identity incl. the condition-text
//      label chrome ("Half HP or fewer: +2d6 piercing?" — first-char capitalization only,
//      damage_type stays lowercase) + hitClause toBeNull (half-HP-only row).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250): grant,
// crit accept, decline — generic mechanics twins of owner Talons bytes. Popup offer-render
// cut — popup chrome owned by common/AttackResultPopup.ma1363:105-120. Direct
// buildChargeBonusOffer label test cut — subsumed by the ctx offer toEqual.
// Dead-mock purge per ma1552/ma1562 baseline: diceRoller stub (rollAttack mocked, no roller
// fires without the cut grant tests), AttackResultPopup stub (popup never renders — popupHtml
// null), never-fired hook members (minimal shape renders).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-quippers');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const LONE_QUIPPER = monsters.find((m) => m.index === 'quipper');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full
// identity: modifier-less formula ('2d6', no '+'), lowercase damage_type, and the
// condition-text label chrome ("Half HP or fewer: +2d6 piercing?", MA-1363 label
// generalization — first-char capitalization only, no feet-token head).
const QUIPPERS_OFFER = {
  dice: '2d6',
  modifier: 0,
  damageType: 'piercing',
  condition: 'half HP or fewer',
  formula: '2d6',
  label: 'Half HP or fewer: +2d6 piercing?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Quippers 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderQuippers() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Quippers', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Quippers 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Quippers 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1564 monsters.json data lock: Swarm of Quippers Bites half-HP variant', () => {
  it('authors the monster-exclusive 2d6 half-HP cd with RAW prose anchor, key placement, and no hit-clause riders', () => {
    expect(BITES.attack_bonus).toBe(5);
    expect(BITES.reach).toBe('0 ft.');
    expect(BITES.damage_dice_primary).toBe('4d6');
    expect(BITES.damage_type_primary).toBe('piercing');
    // Full cd identity — the modifier-less byte-shape; 2d6 makes this row UNIQUE
    // among the half-HP swarm family (beetles/centipedes/spiders/wasps are 2d4,
    // byte-pinned by their own owners ma1553/ma1554/ma1568/ma1571).
    expect(BITES.conditional_damage).toEqual({
      dice: '2d6',
      damage_type: 'piercing',
      condition: 'half HP or fewer',
    });
    expect(Object.keys(BITES.conditional_damage)).toEqual(['dice', 'damage_type', 'condition']);
    expect(BITES.conditional_damage.dice).not.toMatch(/\+/);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Half-HP-only row: no hit-clause riders authored (unlike the ma1555 twin).
    expect(BITES.hit_conditions).toBeUndefined();
    expect(BITES.hit_target_effect).toBeUndefined();
    // RAW prose anchor — the "7 (2d6) ... half of its hit points" sentence is
    // bestiary-exclusive to this row (half-HP siblings all read 2d4).
    expect(BITES.description).toMatch(/Hit: 14 \(4d6\) piercing damage, or 7 \(2d6\) piercing damage if the swarm has half of its hit points or fewer\./);
    // Single-action parent census: Bites is the swarm's only action.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Bites']);
    // Fix-scope guard: the lone quipper's same-name Bite stays inert (no cd) —
    // only the swarm carries the half-HP variant.
    const loneBite = LONE_QUIPPER.actions.find((a) => a.name === 'Bite');
    expect(loneBite.conditional_damage).toBeUndefined();
  });
});

describe('MA-1564 Swarm of Quippers Bites click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +5 chip forwards the full disk offer with half-HP label chrome and a null hitClause', () => {
    renderQuippers();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
    expect(chip, 'Expected Bites +5 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(QUIPPERS_OFFER);
    // toBeNull like the half-HP-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
  });
});
