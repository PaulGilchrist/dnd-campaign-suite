// @maintained-by-ai
// MA-1676 (Warhorse Hooves) + MA-1699 (Wereboar Tusk): one-field DATA fixes —
// conditional_damage {dice:"2d4"|"2d6"} authored on monsters.json rows
// (MA-0007 charge-bonus seam, MA-0885 goat Ram byte-shape placement: dict after
// damage_type_primary, last key) so the HIT popup offers the
// "20+ ft Charge: +2d4 Bludgeoning?" / "+2d6 Piercing?" rider instead of
// base-only damage. Prone halves: movement-gated Prone has zero transport
// app-wide (no movement-distance subsystem, MA-0903/MA-1610 precedent) —
// hit_conditions deliberately NOT authored (would over-grant Prone on EVERY
// hit, wrong RAW) — GM adjudicates at the popup; advisory residual.
//
// Trim pass (2026-10-18), two seams, one press per row — mirrors the maintained
// ma1610 triceratops template (run #716 / ma1175 #683 / ma1174 #682 / ma1160 #680):
//   1. Disk-row bytes (it.each over both rows): full conditional_damage toEqual
//      identity (exact key set — modifier ABSENT, subsuming the old goat
//      key-parity scan and the GOAT import; both rows are MA-0885 goat Ram
//      shape twins modulo dice/type bytes — distinct pins are 2d4 Bludgeoning
//      vs 2d6 Piercing, base 2d4+4/+6 vs 2d6+3/+5, and the row-distinct
//      Large/Medium-or-smaller + Prone prose) + MA-0885 key placement +
//      recharge/hit_conditions/two-handed absence pins + RAW prose regex.
//   2. ONE click→rollAttack ctx press per row: full 7-key offer toEqual —
//      owns the modifier-absent → formula=dice fold (Helpers.js:687-703) AND
//      the feet-token label head "20+ ft Charge:" ("20+ feet" prose IS
//      chargeClauseFeet-live on both rows) + hitClause toBeNull +
//      twoHandedVariantOffer toBeNull (versatile bytes unauthored).
// Cut (owner cites, not re-asserted here):
//   - MonsterCardModal.charge-bonus.test.jsx owns resolveChargeBonus: grant
//     hit/crit roller fold + logs + resolved-write (:210-233) and decline
//     (:235-250) — these rows' 2d4/2d6 grant/decline bytes are shape twins.
//   - Offer render on the popup: common/AttackResultPopup.ma1363:105-120.
//   - monsterRecharge.test.js owns the recharge machine (:59-60, :152-165).
//   - attackRowMissingToHit census: MonsterAction.ma0286:89-113.
//   - MA-0689 Hooves prone-target PREREQUISITE gate (elk lane, different ticket
//     family): MonsterCardModal.ma0689-hooves-prerequisite.test.jsx.
// Dead-mock purge per-lane (ma1610/ma1175 baseline): diceRoller mock gone
// (rollAttack mocked, popup never renders, no roller fires), AttackResultPopup
// stub + grant/decline buttons gone (popupHtml stays null), rollD20 +
// never-fired hook members gone. No timers — the ctx press lands synchronously.
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

const CHARGE = 'moved 20+ feet straight toward the target immediately before the hit';

// One row table per seam — both rows are MA-0885 goat Ram shape twins; only the
// distinct bytes differ (dice/type/base/chip/prose size-clause and creature noun).
const ROWS = [
  {
    ticket: 'MA-1676 Warhorse Hooves',
    index: 'warhorse',
    monster: 'Warhorse',
    actionName: 'Hooves',
    chip: '+6',
    attackBonus: 6,
    base: '2d4 + 4',
    type: 'Bludgeoning',
    cd: { dice: '2d4', damage_type: 'Bludgeoning', condition: CHARGE },
    // RAW anchor incl. the untransported Prone half (GM-adjudicated at popup).
    prose: /if the target is a large or smaller creature and the horse moved 20\+ feet straight toward it immediately before the hit, the target takes an extra 5 \(2d4\) bludgeoning damage and has the prone condition/i,
    offer: { dice: '2d4', modifier: 0, damageType: 'Bludgeoning', condition: CHARGE, formula: '2d4', label: '20+ ft Charge: +2d4 Bludgeoning?', attackName: 'Hooves' },
  },
  {
    ticket: 'MA-1699 Wereboar Tusk',
    index: 'wereboar',
    monster: 'Wereboar',
    actionName: 'Tusk',
    chip: '+5',
    attackBonus: 5,
    base: '2d6 + 3',
    type: 'Piercing',
    cd: { dice: '2d6', damage_type: 'Piercing', condition: CHARGE },
    prose: /if the target is a medium or smaller creature and the wereboar moved 20\+ feet straight toward it immediately before the hit, the target takes an extra 7 \(2d6\) piercing damage and has the prone condition/i,
    offer: { dice: '2d6', modifier: 0, damageType: 'Piercing', condition: CHARGE, formula: '2d6', label: '20+ ft Charge: +2d6 Piercing?', attackName: 'Tusk' },
  },
];

const CREATURES = [
  { name: 'Attacker 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderRow(row) {
  _setPopupHtml(null);
  const src = monsters.find((m) => m.index === row.index);
  const m = makeMonster({ name: row.monster, actions: src.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Attacker 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Attacker 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe.each(ROWS)('$ticket monsters.json data lock: charge rider row', ({ index, actionName, attackBonus, base, type, cd, prose }) => {
  it('conditional_damage identity modifier-absent after damage_type_primary last key + recharge/hit_conditions/two-handed absent + untransported Prone prose', () => {
    const action = monsters.find((m) => m.index === index).actions.find((a) => a.name === actionName);
    expect(action.attack_bonus).toBe(attackBonus);
    expect(action.damage_dice_primary).toBe(base);
    expect(action.damage_type_primary).toBe(type);
    const keys = Object.keys(action);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    // Full identity pins the exact key set (goat Ram MA-0885 shape; modifier
    // key ABSENT → offer folds formula to bare dice).
    expect(action.conditional_damage).toEqual(cd);
    // Prone half advisory: hit_conditions NOT authored (auto-grant would fire
    // on every hit, MA-0903/MA-1610 WRONG-RAW caveat).
    expect(action.description).toMatch(prose);
    expect(action.recharge).toBeUndefined();
    expect(action.hit_conditions).toBeUndefined();
    expect(action.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(action, actionName)).toBeNull();
  });
});

describe.each(ROWS)('$ticket click→ctx forward (single press)', ({ index, monster, actionName, chip, offer }) => {
  it(`clicking the ${chip} chip forwards the full disk offer (formula=dice fold, "20+ ft Charge:" label) + null hitClause + null two-handed variant`, () => {
    renderRow({ index, monster });
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => new RegExp(`^${actionName}`).test(a.textContent.trim()));
    const diceChip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === chip);
    expect(diceChip, `Expected ${actionName} ${chip} dice link`).toBeTruthy();
    fireEvent.click(diceChip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(offer);
    expect(ctx.hitClause).toBeNull();
    expect(ctx.twoHandedVariantOffer).toBeNull();
  });
});
