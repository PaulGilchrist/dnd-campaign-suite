// @maintained-by-ai
// MA-1610: Triceratops Gore — one-field DATA fix: conditional_damage
// {dice:"2d8",damage_type:"Piercing"} (modifier unauthored) on monsters.json
// Gore row so the HIT popup offers "20+ ft Charge: +2d8 Piercing?" + decline
// instead of inert base-only damage (MA-0007 seam, MA-0885 goat byte-shape
// placement: dict after damage_type_primary, last key). NO hit_conditions —
// the Prone half of the Huge-or-smaller movement rider has zero transport
// (MA-0903 caveat: maybeApplyRamProne needs the PC 'Ram' stance buff; naive
// prone would over-grant always-prone, WRONG RAW) — GM adjudicates at the popup.
//
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained
// ma1175 skeleton template (run2#683 / ma1174 #682 / ma1160 #680):
//   1. Disk-row bytes: full conditional_damage toEqual identity (modifier key
//      ABSENT — toEqual pins the exact key set, subsuming the old goat
//      key-parity scan and the GOAT import) + base bytes + MA-0885 key
//      placement + triceratops-distinct RAW prose incl. the untransported
//      Prone clause + recharge undefined (no-recharge row; ungated-row gate
//      owned by monsterRecharge.test.js:59-60) + no hit_conditions / no
//      two-handed bytes.
//   2. ONE click→rollAttack ctx press: full 7-key offer identity via toEqual —
//      owns the modifier-absent → formula=dice fold (Helpers.js:690-693) AND
//      the feet-token label head "20+ ft Charge:" (the "20+ feet" prose IS
//      chargeClauseFeet-live here, unlike the skeleton's inert "20 or more
//      feet") + hitClause toBeNull + twoHandedVariantOffer toBeNull.
// Byte-twin honesty: this row is the MA-0885 goat Ram shape modulo dice bytes
// — triceratops-distinct pins are only 2d8 Piercing (vs goat 1d4 Bludgeoning),
// base 2d12 + 6 / +9, and the Huge-or-smaller + Prone prose.
// Cut (owner cites, not re-asserted here):
//   - MonsterCardModal.charge-bonus.test.jsx owns resolveChargeBonus: grant
//     hit/crit roller fold + logs + resolved-write (:210-233) and decline
//     (:235-250) — this row's 2d8/Piercing grant/decline bytes are shape twins.
//   - Offer render on the popup: common/AttackResultPopup.ma1363:105-120.
//   - monsterRecharge.test.js owns the recharge machine (:59-60, :152-165);
//     the only monster-distinct byte here is GORE.recharge undefined (: absent
//     entirely on this row, vs the family's recharge:"").
//   - attackRowMissingToHit census: MonsterAction.ma0286:89-113.
// Dead-mock purge per-lane (ma1175/ma1160 baseline): diceRoller mock gone
// (rollAttack mocked, popup never renders, no roller fires), AttackResultPopup
// stub gone (popupHtml null), rollD20 + never-fired hook members gone.
// No timers — the ctx press lands synchronously.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';

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
const TRI = monsters.find((m) => m.index === 'triceratops');
const GORE = TRI.actions.find((a) => a.name === 'Gore');

// Exact buildChargeBonusOffer(GORE, 'Gore') output FROM the disk row — full
// identity. Modifier key ABSENT on disk → Number()||0 folds formula to bare
// dice; "20+ feet" prose is chargeClauseFeet-live → feet-token head
// "20+ ft Charge:" (goat ma0885 chrome twin; 2d8 Piercing is the distinct delta).
const GORE_OFFER = {
  dice: '2d8',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'moved 20+ feet straight toward the target immediately before the hit',
  formula: '2d8',
  label: '20+ ft Charge: +2d8 Piercing?',
  attackName: 'Gore',
};

const CREATURES = [
  { name: 'Triceratops 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function renderGore() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Triceratops', actions: TRI.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Triceratops 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Triceratops 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1610 monsters.json data lock: Gore charge rider (triceratops-distinct bytes)', () => {
  it('conditional_damage identity 2d8 Piercing modifier-absent after damage_type_primary last key + recharge/hit_conditions/two-handed absent + untransported Prone prose', () => {
    expect(GORE.attack_bonus).toBe(9);
    expect(GORE.damage_dice_primary).toBe('2d12 + 6');
    expect(GORE.damage_type_primary).toBe('Piercing');
    const keys = Object.keys(GORE);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    // Full identity pins the exact key set — modifier key ABSENT (vs the
    // skeleton's authored modifier:0) and the goat-byte-shape dice/type delta.
    expect(GORE.conditional_damage).toEqual({
      dice: '2d8',
      damage_type: 'Piercing',
      condition: 'moved 20+ feet straight toward the target immediately before the hit',
    });
    // RAW prose: the Huge-or-smaller + Prone half is GM-adjudicated at the
    // popup — hit_conditions NOT authored (auto-grant would fire on every
    // hit, MA-0903 WRONG-RAW caveat), versatile bytes unauthored too.
    expect(GORE.description).toMatch(/if the target is Huge or smaller and the triceratops moved 20\+ feet straight toward it immediately before the hit, the target takes an extra 9 \(2d8\) Piercing damage and has the Prone condition/i);
    expect(GORE.recharge).toBeUndefined();
    expect(GORE.hit_conditions).toBeUndefined();
    expect(GORE.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(GORE, 'Gore')).toBeNull();
  });
});

describe('MA-1610 Gore click→ctx forward (single press)', () => {
  it('clicking the +9 chip forwards the full disk offer (formula=dice fold, "20+ ft Charge:" label) + null hitClause + null two-handed variant', () => {
    renderGore();
    const goreRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Gore/.test(a.textContent.trim()));
    const chip = Array.from(goreRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+9');
    expect(chip, 'Expected Gore +9 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(GORE_OFFER);
    expect(ctx.hitClause).toBeNull();
    expect(ctx.twoHandedVariantOffer).toBeNull();
  });
});
