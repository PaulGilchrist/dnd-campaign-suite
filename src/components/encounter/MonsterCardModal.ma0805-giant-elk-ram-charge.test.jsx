// @maintained-by-ai
// MA-0805: Giant Elk Ram — the fix authored TWO fields on monsters.json actions[0]:
// hit_conditions:["prone"] (MA-0010 seam) + modifier-less conditional_damage
// (MA-0007 charge-bonus seam, galeb-duhr MA-0756 byte-shape twin). This lane keeps
// exactly those two seams, one press each (trim pass 2026-10-18):
//   1. Disk-row bytes BY-name (#387 family): both fields + MA-0794 placement
//      (hit_conditions after damage_type_secondary) + key-parity vs galeb-duhr.
//   2. ONE click→rollAttack ctx press (#583 canonical idiom, forward at
//      MonsterCardModal.jsx:1407; buildAutoDamageOptions :1156/:1180 rides the same
//      arg[2]): full offer identity FROM disk via toEqual (all 7 offer keys,
//      formula "2d4" modifier 0) + the prone hitClause {conditions:['prone'],
//      escapeDc:null, attackName:'Ram'}.
// Cut (owner #583 MonsterCardModal.charge-bonus.test.jsx owns resolveChargeBonus
// grant hit/crit + decline/refuse machine — the 2d4 roll bytes, grant/decline logs,
// resolved-write are byte-shape twins there with :2678 guards). Cut helper-direct
// re-reads of buildChargeBonusOffer/buildHitConditionClause (#662/#666 precedent —
// both helpers fire inside the ctx press above). Dead-mock purge empirical per-lane
// (#659/#666): diceRoller mock gone (rollAttack mocked, no roller fires on this
// lane), AttackResultPopup mock gone (popupHtml null → never rendered), rollD20 +
// five never-fired hook members gone (owner :20-23 baseline proves minimal hook
// renders). No timers 🔴 — no waitFor needed, ctx lands synchronously.
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
const ELK = monsters.find((m) => m.index === 'giant-elk');
const RAM = ELK.actions.find((a) => a.name === 'Ram');
const SLAM = monsters.find((m) => m.index === 'galeb-duhr').actions.find((a) => a.name === 'Avalanche Slam');

// Exact buildChargeBonusOffer(RAM, 'Ram') output FROM the disk row — full identity.
const RAM_OFFER = {
  dice: '2d4',
  modifier: 0,
  damageType: 'Bludgeoning',
  condition: 'moved 20+ feet straight toward target immediately before the hit',
  formula: '2d4',
  label: '20+ ft Charge: +2d4 Bludgeoning?',
  attackName: 'Ram',
};

const CREATURES = [
  { name: 'Giant Elk 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function renderRam() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Giant Elk', actions: ELK.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Giant Elk 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Giant Elk 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0805 monsters.json data lock: Giant Elk Ram charge riders', () => {
  it('BY-name row bytes: hit_conditions ["prone"] after damage_type_secondary (MA-0794) + modifier-less conditional_damage mirroring the MA-0756 galeb-duhr byte-shape', () => {
    expect(RAM.attack_bonus).toBe(6);
    expect(RAM.damage_dice_primary).toBe('2d6 + 4');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    expect(RAM.damage_dice_secondary).toBe('2d4');
    expect(RAM.damage_type_secondary).toBe('Radiant');
    expect(RAM.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(RAM);
    expect(keys.indexOf('hit_conditions')).toBeGreaterThan(keys.indexOf('damage_type_secondary'));
    const cd = RAM.conditional_damage;
    expect(cd.dice).toBe('2d4');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toMatch(/moved 20\+ feet straight toward/i);
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd).sort()).toEqual(Object.keys(SLAM.conditional_damage).sort());
  });
});

describe('MA-0805 Ram click→ctx forward (#583 single press)', () => {
  it('clicking the +6 chip forwards the full disk offer + the prone hit clause on rollAttack arg[2]', () => {
    renderRam();
    const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
    const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
    expect(chip, 'Expected Ram +6 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(RAM_OFFER);
    expect(ctx.hitClause).toEqual({ conditions: ['prone'], escapeDc: null, attackName: 'Ram', targetEffect: null });
  });
});
