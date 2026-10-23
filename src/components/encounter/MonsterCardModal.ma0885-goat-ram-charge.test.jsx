// @maintained-by-ai
// MA-0885: Goat Ram — two-field DATA fix: damage_dice_primary "1" (flat base,
// MA-0322 constant dice-less resolve) + modifier-less conditional_damage
// {dice:"1d4", damage_type:"Bludgeoning"} authored on monsters.json actions[0]
// (MA-0007 charge-bonus seam) so the HIT popup offers the "2 (1d4) Bludgeoning"
// charge alternative instead of always-on 1d4. NO hit_conditions — NOT the
// MA-0809 giant-goat prone shape. This lane keeps exactly two seams, one press
// each (trim 2026-10-18):
//   1. Disk-row bytes BY-name (#387 family): flat "1" primary + modifier-less
//      cd after damage_type_primary, last key (MA-0007 twin placement) +
//      cd key-parity vs giant-goat's modifier-less twin (same 3-key order) +
//      the goat-distinct MA-0322 flat-extraction byte — extractFlatHitDamage
//      returns "1" even though dice sit in the trailing "or 2 (1d4)" alternative
//      (dice must be Hit:-ADJACENT to trip the MA-0747 guard, they are not);
//      giant-goat's dice-after-Hit row returns null on the same call (family
//      byte). Byte explicitly delegated back here by the flat-hit owner
//      (MonsterCardHelpers.flat-hit-damage.test.js:8-9) + RAW anchor
//      "Hit: 1 Bludgeoning damage, or 2 (1d4) Bludgeoning damage if the goat
//      moved 20+ feet straight toward the target".
//   2. ONE click→rollAttack ctx press (#583 canonical idiom, forward at
//      MonsterCardModal.jsx:1407): full offer identity FROM disk via toEqual
//      (all 7 offer keys, Helpers:694-702; formula "1d4" modifier 0 — a toEqual
//      here also pins the clause non-null) + ctx.hitClause toBeNull (no-prone
//      byte vs giant-goat's {conditions:['prone'],...} press) + the goat-distinct
//      MA-0322 flat TRANSPORT: ctx.autoDamageFormula "1" dice-less constant
//      (family rows carry dice formulas: giant-goat "1d6 + 3") + autoDamageName.
// Cut (owner #583 MonsterCardModal.charge-bonus.test.jsx:210-250 owns
// resolveChargeBonus grant hit/crit + decline/refuse machine — the "1d4" roll
// bytes, grant/decline logs, resolved-write are byte-shape twins there with
// :2678 guards). Cut helper-direct re-reads of buildChargeBonusOffer /
// buildHitConditionClause / extractDamageDiceFromDescription (#662-#667
// precedent — all fire inside the ctx press above) and the roller re-reads
// canRollExpression/parseConstant/rollExpressionDoubled("1") (flat crit
// invariance folded to the diceRoller owner per pass #507 rec: constant-null
// arms diceRoller.test.js:222/:256, real-parseConstant cla048:107/:124, CLA-281
// consumer seam handlePlainDamage.secondaryDamage.test.js:334; transport "1"
// pinned on ctx here). Dead-mock purge empirical per-lane (#667/#669 map):
// diceRoller mock gone (rollAttack mocked, no roller fires on this lane),
// AttackResultPopup mock gone (popupHtml null → never rendered; grant/decline
// stub buttons gone with the cut tests), rollD20 + five never-fired hook
// members gone (settled #667/#669 baseline proves minimal hook renders).
// No timers 🔴 — no waitFor needed, ctx lands synchronously.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';

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
const GOAT = monsters.find((m) => m.index === 'goat');
const RAM = GOAT.actions.find((a) => a.name === 'Ram');
const GIANT_GOAT_RAM = monsters.find((m) => m.index === 'giant-goat').actions.find((a) => a.name === 'Ram');

// Exact buildChargeBonusOffer(RAM, 'Ram') output FROM the disk row — full identity.
const RAM_OFFER = {
  dice: '1d4',
  modifier: 0,
  damageType: 'Bludgeoning',
  condition: 'moved 20+ feet straight toward the target immediately before the hit',
  formula: '1d4',
  label: '20+ ft Charge: +1d4 Bludgeoning?',
  attackName: 'Ram',
};

const CREATURES = [
  { name: 'Goat 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderRam() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Goat', actions: GOAT.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Goat 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Goat 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0885 monsters.json data lock: Goat Ram flat base + charge rider', () => {
  it('BY-name row bytes: flat "1" primary + modifier-less conditional_damage after damage_type_primary, last key (MA-0007 twin placement) + cd key-parity vs giant-goat + flat "1" extracted despite trailing "or 2 (1d4)" dice (MA-0747 guard stays quiet)', () => {
    expect(RAM.attack_bonus).toBe(2);
    expect(RAM.damage_dice_primary).toBe('1');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    const keys = Object.keys(RAM);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    const cd = RAM.conditional_damage;
    expect(cd.dice).toBe('1d4');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toBe('moved 20+ feet straight toward the target immediately before the hit');
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd)).toEqual(Object.keys(GIANT_GOAT_RAM.conditional_damage));
    expect('hit_conditions' in RAM).toBe(false);
    expect(RAM.description).toMatch(/Hit: 1 Bludgeoning damage, or 2 \(1d4\) Bludgeoning damage if the goat moved 20\+ feet straight toward the target/i);
    // Owner-delegated distinct byte (flat-hit-damage.test.js:8-9): alternative-clause
    // dice are NOT Hit:-adjacent → guard quiet, flat "1" extracted; giant-goat's
    // dice-after-Hit row stays byte-inert null on the same call.
    expect(extractFlatHitDamage(RAM)).toBe('1');
    expect(extractFlatHitDamage(GIANT_GOAT_RAM)).toBe(null);
  });
});

describe('MA-0885 Ram click→ctx forward (#583 single press)', () => {
  it('clicking the +2 chip forwards the full disk offer + null hit clause + flat "1" dice-less autoDamage on rollAttack arg[2]', () => {
    renderRam();
    const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
    const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+2');
    expect(chip, 'Expected Ram +2 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(RAM_OFFER);
    expect(ctx.hitClause).toBeNull();
    expect(ctx.autoDamageFormula).toBe('1');
    expect(ctx.autoDamageName).toBe('Ram');
  });
});
