// @maintained-by-ai
// MA-0822: Giant Seahorse Ram — one-field DATA fix: modifier-BEARING conditional_damage
// {dice:"2d8", modifier:2, damage_type:"Bludgeoning"} authored on monsters.json
// actions[0] (MA-0007 charge-bonus seam) so the HIT popup offers the
// "11 (2d8 + 2) Bludgeoning" charge alternative. NO hit_conditions — this row
// carries NO knockdown/prone clause (unlike the MA-0809 goat / MA-0805 elk
// two-field shape, whose hitClause is non-null). This lane keeps exactly two
// seams, one press each (trim 2026-10-18):
//   1. Disk-row bytes BY-name (#387 family): additive cd + MA-0822 placement
//      (conditional_damage after damage_type_primary, last key — the twin-placement
//      anchor cited by MA-1363/MA-1552-1566) + key-parity vs Aarakocra Skirmisher
//      Talons, its verified modifier-bearing additive twin (3d4 +2 Slashing, 30+ ft)
//      + honest distinct-vs-goat/elk bytes: seahorse cd carries modifier:2 and the
//      "toward the target" condition byte, goat/elk cd are modifier-LESS 2d4 with
//      hit_conditions ["prone"] and "toward target" text; RAW anchor
//      "or 11 (2d8 + 2) Bludgeoning damage if the seahorse moved 20+ feet".
//      (Swim 40 ft. is habitat flavor — no movement-distance subsystem exists (§7),
//      so no swim-speed byte is consumed by this lane.)
//   2. ONE click→rollAttack ctx press (#583 canonical idiom, forward at
//      MonsterCardModal.jsx:1407; buildAutoDamageOptions :1156/:1180 rides the same
//      arg[2]): full offer identity FROM disk via toEqual (all 7 offer keys,
//      formula "2d8 + 2" modifier 2, label chrome MA-0885/MA-1363 pins) +
//      ctx.hitClause toEqual null — the seahorse-distinct no-prone-clause byte
//      (goat #583 press carries {conditions:['prone'],...}; null here pins the
//      targetEffect:null class by absence).
// Cut (owner #583 MonsterCardModal.charge-bonus.test.jsx:210-250 owns resolveChargeBonus
// grant hit/crit + decline/refuse machine — the "2d8 + 2" roll bytes, grant/decline
// logs, resolved-write are byte-shape twins there with :2678 guards). Cut helper-direct
// re-reads of buildChargeBonusOffer/buildHitConditionClause + giant-sea-horse inert
// check (#662/#666/#667 precedent — both helpers fire inside the ctx press above;
// owner :198-201 covers unauthored rows forwarding null). Dead-mock purge empirical
// per-lane (#667 9→4 map): diceRoller mock gone (rollAttack mocked, no roller fires
// on this lane), AttackResultPopup mock gone (popupHtml null → never rendered;
// grant/decline stub buttons gone with the cut tests), rollD20 + five never-fired
// hook members gone (elk/goat #667 settled baseline proves minimal hook renders).
// No timers 🔴 — no waitFor needed, ctx lands synchronously.
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
const SEAHORSE = monsters.find((m) => m.index === 'giant-seahorse');
const RAM = SEAHORSE.actions.find((a) => a.name === 'Ram');
const TALONS = monsters.find((m) => m.index === 'aarakocra-skirmisher').actions.find((a) => a.name === 'Talons');
const GOAT_RAM = monsters.find((m) => m.index === 'giant-goat').actions.find((a) => a.name === 'Ram');
const ELK_RAM = monsters.find((m) => m.index === 'giant-elk').actions.find((a) => a.name === 'Ram');

// Exact buildChargeBonusOffer(RAM, 'Ram') output FROM the disk row — full identity.
const RAM_OFFER = {
  dice: '2d8',
  modifier: 2,
  damageType: 'Bludgeoning',
  condition: 'moved 20+ feet straight toward the target immediately before the hit',
  formula: '2d8 + 2',
  label: '20+ ft Charge: +2d8+2 Bludgeoning?',
  attackName: 'Ram',
};

const CREATURES = [
  { name: 'Giant Seahorse 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderRam() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Giant Seahorse', actions: SEAHORSE.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Giant Seahorse 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Giant Seahorse 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0822 monsters.json data lock: Giant Seahorse Ram charge rider', () => {
  it('BY-name row bytes: modifier-bearing conditional_damage after damage_type_primary, last key (MA-0822 twin placement) + key-parity vs Talons + distinct-vs-goat/elk no-prone bytes', () => {
    expect(RAM.attack_bonus).toBe(4);
    expect(RAM.damage_dice_primary).toBe('2d6 + 2');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    const keys = Object.keys(RAM);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    const cd = RAM.conditional_damage;
    expect(cd.dice).toBe('2d8');
    expect(cd.modifier).toBe(2);
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toBe('moved 20+ feet straight toward the target immediately before the hit');
    expect(Object.keys(cd)).toEqual(Object.keys(TALONS.conditional_damage));
    // Honest distinct-vs-goat/elk: their riders are modifier-less 2d4 prone riders.
    expect('hit_conditions' in RAM).toBe(false);
    expect('modifier' in GOAT_RAM.conditional_damage).toBe(false);
    expect('modifier' in ELK_RAM.conditional_damage).toBe(false);
    expect(GOAT_RAM.hit_conditions).toEqual(['prone']);
    expect(ELK_RAM.hit_conditions).toEqual(['prone']);
    expect(cd.dice).not.toBe(GOAT_RAM.conditional_damage.dice);
    expect(cd.condition).not.toBe(GOAT_RAM.conditional_damage.condition);
    expect(RAM.description).toMatch(/or 11 \(2d8 \+ 2\) Bludgeoning damage if the seahorse moved 20\+ feet straight toward the target/i);
  });
});

describe('MA-0822 Ram click→ctx forward (#583 single press)', () => {
  it('clicking the +4 chip forwards the full disk offer + null hit clause (no prone) on rollAttack arg[2]', () => {
    renderRam();
    const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
    const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
    expect(chip, 'Expected Ram +4 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(RAM_OFFER);
    expect(ctx.hitClause).toBeNull();
  });
});
