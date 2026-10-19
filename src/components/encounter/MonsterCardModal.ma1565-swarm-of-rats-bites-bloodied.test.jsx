// @maintained-by-ai
// MA-1565: Swarm of Rats Bites — conditional_damage:{dice:"1d4",damage_type:"Piercing",
// condition:"Bloodied"} authored on monsters.json swarm-of-rats actions[0] so the HIT popup
// offers the "or 2 (1d4) Piercing damage if the swarm is Bloodied" variant via the live
// MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on cd.dice only — Helpers:687;
// static-state clause carries the condition-text label head — Helpers:675). Seam is ADDITIVE:
// base Done still pays 2d4; grant rolls its own 1d4 leg. No auto-bloodied eval (§70
// residual); offer shows even healthy (MA-1363 static-state recipe). Modifier-less
// capitalized-damage_type shape mirrors the MA-1552 bats twin: cd bytes are IDENTICAL to
// bats {1d4,Piercing,Bloodied} — the monster-exclusive seams are the +2 attack roll head
// (bats +4, ravens +4/1d6+2) and the full RAW prose sentence. Foreign-row cross-pins cut
// per maintained swarm template (bats→ma1552, centipedes→ma1554, beetles→ma1553,
// ravens→ma1566, quaggoth→ma1363, goat→ma0885). Census #701 honored: rats cd row has NO
// modifier key — key order ['dice','damage_type','condition'] pinned inline.
// Trim pass (2026-10-18), two tests mirroring the maintained ma1552/ma1553/ma1554/
// ma1562/ma1564 template:
//   1. Disk-row lock: full cd toEqual identity + modifier-less key order pinned inline +
//      base legs + key placement (cd after damage_type_primary, last key) + no hit-clause
//      riders + RAW prose regex ("+2, reach 5 ft." head makes the sentence row-exclusive vs
//      the bats/ravens prose twins) + single-action census + fix-scope blast-radius guard
//      (lone rat's same-name Bite stays inert).
//   2. ONE click→rollAttack ctx press: full 7-key offer identity incl. the condition-text
//      label chrome ("Bloodied: +1d4 Piercing?") + hitClause toBeNull (Bloodied-only row).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250): grant,
// crit accept, decline — generic mechanics twins of owner Talons bytes. Popup offer-render
// cut — popup chrome owned by common/AttackResultPopup.ma1363:105-120. Direct
// buildChargeBonusOffer label test and sibling swarm byte-locks cut — subsumed by the ctx
// offer toEqual / owned by ma1552 (bats) and ma1554 (centipedes).
// Dead-mock purge per ma1552/ma1564 baseline: diceRoller stub (rollAttack mocked, no roller
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-rats');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const LONE_RAT = monsters.find((m) => m.index === 'rat');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full
// identity: modifier-less formula ('1d4', no '+'), capitalized damage_type carried
// straight from the row, and the condition-text label chrome ("Bloodied: +1d4
// Piercing?", MA-1363 label generalization — first-char capitalization only,
// no feet-token head).
const RATS_OFFER = {
  dice: '1d4',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'Bloodied',
  formula: '1d4',
  label: 'Bloodied: +1d4 Piercing?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Rats 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderRats() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Rats', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Rats 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Rats 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1565 monsters.json data lock: Swarm of Rats Bites Bloodied variant', () => {
  it('authors the Bloodied 1d4 cd with RAW prose anchor, key placement, and no hit-clause riders', () => {
    expect(BITES.attack_bonus).toBe(2);
    expect(BITES.reach).toBe('5 ft.');
    expect(BITES.damage_dice_primary).toBe('2d4');
    expect(BITES.damage_type_primary).toBe('Piercing');
    // Full cd identity — the modifier-less byte-shape. Honestly documented twin:
    // this cd is byte-identical to the MA-1552 bats row {1d4,Piercing,Bloodied};
    // the row-exclusive diffs are the +2 attack bonus (bats +4) and the prose
    // head below. Bats bytes are owned by ma1552 — pinned here only as our own
    // owned claim on the rats row.
    expect(BITES.conditional_damage).toEqual({
      dice: '1d4',
      damage_type: 'Piercing',
      condition: 'Bloodied',
    });
    expect(Object.keys(BITES.conditional_damage)).toEqual(['dice', 'damage_type', 'condition']);
    expect(BITES.conditional_damage.dice).not.toMatch(/\+/);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Bloodied-only row: no hit-clause riders authored (unlike the ma1555 twin).
    expect(BITES.hit_conditions).toBeUndefined();
    expect(BITES.hit_target_effect).toBeUndefined();
    // RAW prose anchor — the "+2, reach 5 ft. Hit: 5 (2d4)" head makes this
    // sentence exclusive to the rats row (bats prose reads +4; ravens +4/1d6+2).
    expect(BITES.description).toMatch(/\+2, reach 5 ft\. Hit: 5 \(2d4\) Piercing damage, or 2 \(1d4\) Piercing damage if the swarm is Bloodied\./);
    // Single-action parent census: Bites is the swarm's only action.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Bites']);
    // Fix-scope guard: the lone rat's same-name Bite stays inert (no cd) —
    // only the swarm carries the Bloodied variant.
    const loneBite = LONE_RAT.actions.find((a) => a.name === 'Bite');
    expect(loneBite.conditional_damage).toBeUndefined();
  });
});

describe('MA-1565 Swarm of Rats Bites click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +2 chip forwards the full disk offer with Bloodied label chrome and a null hitClause', () => {
    renderRats();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+2');
    expect(chip, 'Expected Bites +2 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(RATS_OFFER);
    // toBeNull like the Bloodied-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
  });
});
