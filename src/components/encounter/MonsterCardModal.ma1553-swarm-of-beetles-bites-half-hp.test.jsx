// @maintained-by-ai
// MA-1553: Swarm of Beetles Bites — conditional_damage:{dice:"2d4",damage_type:"piercing",
// condition:"half HP or fewer"} authored on monsters.json swarm-of-beetles actions[0] so the
// HIT popup offers the "or 5 (2d4) piercing damage if the swarm has half of its hit points or
// fewer" variant via the live MA-0007 GM-adjudication seam (additive: base Done still pays
// 4d4; grant rolls its own 2d4 leg). No auto-half-HP eval (§70 residual); offer shows even
// healthy (MA-1363 static-state recipe). Data twin of MA-0485 / MA-0756 / MA-1363 / MA-1552:
// prose-only clause was FAIL(a)/DATA (buildChargeBonusOffer arms on cd.dice only — Helpers:687).
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1552/ma1363
// template:
//   1. Disk-row bytes: full cd-object toEqual identity (no modifier key = modifier-0 additive
//      delta; half-HP-family threshold — lowercase 'half HP or fewer' on disk, unlike the
//      'Bloodied' rows of the bat/quaggoth twins, so this is the family's distinct casing)
//      + last-key placement (MA-0822) + RAW prose anchor + hit_conditions absent (the
//      half-HP threshold rides conditional_damage only, never an auto-grant rider).
//      Twin-key comparisons vs goat/quaggoth cut — shapes owned by ma0885/ma1363.
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1407): full 7-key offer
//      identity incl. the beetle-distinct label chrome — first-char capitalization only,
//      "Half HP or fewer: +2d4 piercing?" (damage_type stays lowercase on disk, unlike the
//      uppercase 'Piercing' swarm-of-bats twin) + hitClause toBeNull.
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363 :105-120.
// Charge-row label loop cut: every row byte-pinned by its own owner (talons charge-bonus :51,
// goat ma0885 :124, quaggoth ma1363 :158, bats ma1552); direct buildChargeBonusOffer label
// test subsumed by the ctx offer toEqual.
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller fires
// without the cut grant tests), AttackResultPopup stub (popup never renders — popupHtml null),
// never-fired hook members (minimal shape renders per ma1160/ma1363).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-beetles');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full identity,
// incl. the modifier-0 formula ('2d4', never '2d4 + 0') and the first-capitalized condition-
// text label ("Half HP or fewer: +2d4 piercing?", no feet-token head, lowercase 'piercing'
// carried from disk — MA-1363 label generalization).
const BEETLES_OFFER = {
  dice: '2d4',
  modifier: 0,
  damageType: 'piercing',
  condition: 'half HP or fewer',
  formula: '2d4',
  label: 'Half HP or fewer: +2d4 piercing?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Beetles 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderBites() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Beetles', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Beetles 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Beetles 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1553 monsters.json data lock: Swarm of Beetles Bites half-HP variant', () => {
  it('authors the modifier-less additive half-HP clause with last-key placement and RAW prose anchor', () => {
    expect(BITES.attack_bonus).toBe(3);
    expect(BITES.damage_dice_primary).toBe('4d4');
    expect(BITES.damage_type_primary).toBe('piercing');
    // Full cd identity — absence of a modifier key marks the modifier-less additive
    // convention (resolver pays base + clause; MA-0756/MA-0805 twin family).
    expect(BITES.conditional_damage).toEqual({
      dice: '2d4',
      damage_type: 'piercing',
      condition: 'half HP or fewer',
    });
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(BITES.description).toMatch(/or 5 \(2d4\) piercing damage if the swarm has half of its hit points or fewer/);
    // Half-HP threshold rides conditional_damage only — never an auto-grant hit_conditions rider.
    expect(BITES.hit_conditions).toBeUndefined();
  });
});

describe('MA-1553 Bites click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +3 chip forwards the full disk offer + null hitClause (half-HP is a pre-condition, never auto-granted)', () => {
    renderBites();
    const bitesRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(bitesRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+3');
    expect(chip, 'Expected Bites +3 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(BEETLES_OFFER);
    expect(ctx.hitClause).toBeNull();
  });
});
