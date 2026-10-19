// @maintained-by-ai
// MA-1566: Swarm of Ravens Beaks — conditional_damage:{dice:"1d4",damage_type:"Piercing",
// condition:"Bloodied"} authored on monsters.json swarm-of-ravens actions[0] so the HIT popup
// offers the "or 2 (1d4) Piercing damage if the swarm is Bloodied" variant via the live
// MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on cd.dice only — Helpers;
// static-state clause carries the condition-text label head). Seam is ADDITIVE: base Done
// still pays 1d6 + 2; grant rolls its own 1d4 leg. No auto-bloodied eval (§70 residual);
// offer shows even healthy (MA-1363 static-state recipe). Modifier-less capitalized
// damage_type shape mirrors the MA-1552 bats / MA-1565 rats twins: cd bytes are IDENTICAL
// to bats {1d4,Piercing,Bloodied} — the ravens-exclusive seams are the attack dice
// "+4 / 1d6 + 2" (bats +4/2d4, rats +2/2d4) and the RAW prose sentence. Census #704
// honored: ravens cd has NO modifier key — key order ['dice','damage_type','condition']
// pinned inline; ravens cd bytes are our owned claim, foreign rows cut per maintained
// swarm template (bats→ma1552, rats→ma1565, centipedes→ma1554, quaggoth→ma1363,
// goat→ma0885).
// Trim pass (2026-10-18), two tests mirroring the maintained ma1552/ma1565 template:
//   1. Disk-row lock: full cd toEqual identity + modifier-less key order pinned inline +
//      ravens-distinct base bytes (+4, 1d6 + 2) + key placement (cd after
//      damage_type_primary, last key) + no hit-clause riders + RAW prose regex
//      ("1d6 + 2" token makes the sentence row-exclusive vs the bats/rats prose twins) +
//      two-action census + fix-scope blast-radius guard (lone raven's same-family 'Beak'
//      stays inert).
//   2. ONE click→rollAttack ctx press: full 7-key offer identity incl. the condition-text
//      label chrome ("Bloodied: +1d4 Piercing?") + hitClause toBeNull (Bloodied-only row).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250): grant,
// crit accept, decline — generic mechanics twins of owner Talons bytes. Popup offer-render
// cut — popup chrome owned by common/AttackResultPopup.ma1363:105-120. Direct
// buildChargeBonusOffer label test and sibling swarm byte-locks cut — subsumed by the ctx
// offer toEqual / owned by ma1552 (bats), ma1565 (rats), ma1554 (centipedes),
// ma0885/ma1363 (goat/quaggoth label pins).
// Dead-mock purge per ma1552/ma1565 baseline: diceRoller stub (rollAttack mocked, no roller
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-ravens');
const BEAKS = SWARM.actions.find((a) => a.name === 'Beaks');
const LONE_RAVEN = monsters.find((m) => m.index === 'raven');

// Exact buildChargeBonusOffer(BEAKS, 'Beaks') output FROM the disk row — full
// identity: modifier-less formula ('1d4', no '+'), capitalized damage_type carried
// straight from the row, and the condition-text label chrome ("Bloodied: +1d4
// Piercing?", MA-1363 label generalization — first-char capitalization only,
// no feet-token head).
const RAVENS_OFFER = {
  dice: '1d4',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'Bloodied',
  formula: '1d4',
  label: 'Bloodied: +1d4 Piercing?',
  attackName: 'Beaks',
};

const CREATURES = [
  { name: 'Swarm of Ravens 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderRavens() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Ravens', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Ravens 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Ravens 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1566 monsters.json data lock: Swarm of Ravens Beaks Bloodied variant', () => {
  it('authors the Bloodied 1d4 cd with ravens-distinct base bytes, RAW prose anchor, key placement, and no hit-clause riders', () => {
    expect(BEAKS.attack_bonus).toBe(4);
    expect(BEAKS.reach).toBe('5 ft.');
    expect(BEAKS.damage_dice_primary).toBe('1d6 + 2');
    expect(BEAKS.damage_type_primary).toBe('Piercing');
    // Full cd identity — the modifier-less byte-shape. Honestly documented twin:
    // this cd is byte-identical to the MA-1552 bats row {1d4,Piercing,Bloodied};
    // the ravens-exclusive diffs are the 1d6 + 2 base dice (bats/rats read 2d4)
    // and the prose below. Bats/rats cd bytes are owned by ma1552/ma1565 — this
    // inline pin is our owned claim on the ravens row.
    expect(BEAKS.conditional_damage).toEqual({
      dice: '1d4',
      damage_type: 'Piercing',
      condition: 'Bloodied',
    });
    // Census #704: ravens cd carries NO modifier key (unlike charge rows with mod).
    expect(Object.keys(BEAKS.conditional_damage)).toEqual(['dice', 'damage_type', 'condition']);
    expect(BEAKS.conditional_damage.dice).not.toMatch(/\+/);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(BEAKS);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Bloodied-only row: no hit-clause riders authored (unlike the ma1555 twin).
    expect(BEAKS.hit_conditions).toBeUndefined();
    expect(BEAKS.hit_target_effect).toBeUndefined();
    // RAW prose anchor — the "1d6 + 2" token makes this sentence exclusive to the
    // ravens row (bats prose reads 2d4 at +4; rats 2d4 at +2).
    expect(BEAKS.description).toMatch(/\+4, reach 5 ft\. Hit: 5 \(1d6 \+ 2\) Piercing damage, or 2 \(1d4\) Piercing damage if the swarm is Bloodied\./);
    // Action census: Beaks sits alongside Cacophony only.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Beaks', 'Cacophony']);
    // Fix-scope guard: the lone raven's same-family 'Beak' stays inert (no cd) —
    // only the swarm carries the Bloodied variant.
    const loneBeak = LONE_RAVEN.actions.find((a) => a.name === 'Beak');
    expect(loneBeak.conditional_damage).toBeUndefined();
  });
});

describe('MA-1566 Swarm of Ravens Beaks click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +4 chip forwards the full disk offer with Bloodied label chrome and a null hitClause', () => {
    renderRavens();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Beaks/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
    expect(chip, 'Expected Beaks +4 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(RAVENS_OFFER);
    // toBeNull like the Bloodied-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
  });
});
