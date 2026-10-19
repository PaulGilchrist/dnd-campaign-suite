// @maintained-by-ai
// MA-1175: Minotaur Skeleton Gore — charge clause ("moved 20+ feet straight toward")
// live-unarmed: disk authored no conditional_damage so buildChargeBonusOffer (MA-0007
// seam, MA-1160/MA-1174 additive-delta convention) never armed a HIT-popup offer.
// Fix: conditional_damage delta {dice:"2d8",modifier:0,damage_type:"Piercing"}
// (ADDITIVE: base Done still pays 2d6 + 4; grant rolls its own 2d8 leg; total RAW
// 2d6 + 4 + 2d8). Prone-on-charge stays GM-adjudicated at the popup — hit_conditions
// NOT authored (auto-grant would fire on every hit, RAW-wrong).
//
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1174
// twin template (run2#682):
//   1. Disk-row bytes: full conditional_damage toEqual identity (modifier:0 explicit =
//      additive delta, MA-1160 chrome; toEqual pins the exact key set, so the old
//      mimic key-parity scan is subsumed) + recharge:"" (gate null — recharge machine
//      owned by monsterRecharge.test.js:59-60) + RAW additive sum + no hit_conditions /
//      no two-handed bytes + the MONSTER-DISTINCT prose that keeps this file alive:
//      the skeleton's 2d8 delta on "the skeleton moved 20 or more feet" is NOT the
//      ma1174 Baphomet row's 3d6-on-10-feet twin bytes.
//   2. ONE click→rollAttack ctx press (:1409): full 7-key offer identity via toEqual —
//      owns the modifier-0 → formula=dice branch pin (Helpers.js:697) AND the
//      chargeClauseFeet-inert label ("20 or more feet" prose never matches the
//      digits+feet token → bare "Charge:" head, MA-1160 chrome) + hitClause toBeNull
//      (prone is GM-adjudicated at the popup, never an auto-grant rider) +
//      twoHandedVariantOffer toBeNull (replaces the direct-helper byte re-reads).
// Cut (owner cites, not re-asserted here):
//   - MonsterCardModal.charge-bonus.test.jsx owns resolveChargeBonus: grant hit/crit
//     roller fold + logs + resolved-write (:210-233) and decline (:235-250) — this
//     row's 2d8/Piercing grant/decline bytes are shape twins there.
//   - monsterRecharge.test.js owns the recharge machine: ungated-row gate null
//     (:59-60), ungated spend returns null with no stamp/log (:152-165) — the only
//     monster-distinct byte is GORE.recharge === "" above.
// Dead-mock purge per-lane (ma1174/ma1160 baseline): diceRoller mock gone (rollAttack
// mocked, no roller fires without the cut grant tests), AttackResultPopup stub gone
// (popupHtml null → popup never renders), rollD20 + never-fired hook members gone.
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
const SKELETON = monsters.find((m) => m.index === 'minotaur-skeleton');
const GORE = SKELETON.actions[0];

// Exact buildChargeBonusOffer(GORE, 'Gore') output FROM the disk row — full identity.
// modifier:0 folds formula to bare dice; the "20 or more feet" prose is chargeClauseFeet
// -inert (digits must glue to "feet"), so the label head is bare "Charge:" — and these
// 2d8 bytes are DISTINCT from the ma1174 Baphomet twin's 3d6-on-10-feet row.
const GORE_OFFER = {
  dice: '2d8',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'the skeleton moved 20 or more feet straight toward the target immediately before the hit',
  formula: '2d8',
  label: 'Charge: +2d8 Piercing?',
  attackName: 'Gore',
};

const CREATURES = [
  { name: 'Minotaur Skeleton 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function renderGore() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Minotaur Skeleton', actions: SKELETON.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Minotaur Skeleton 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Minotaur Skeleton 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1175 monsters.json data lock: Gore additive 2d8 charge delta (skeleton-distinct)', () => {
  it('charge unarmed is dead: full conditional_damage identity 2d8 modifier:0 on the skeleton 20-ft prose + recharge:"" + RAW additive sum + no auto-grant/versatile riders', () => {
    expect(GORE.attack_bonus).toBe(6);
    expect(GORE.damage_dice_primary).toBe('2d6 + 4');
    expect(GORE.damage_type_primary).toBe('Piercing');
    expect(GORE.recharge).toBe('');
    expect(GORE.conditional_damage).toEqual({
      dice: '2d8',
      modifier: 0,
      damage_type: 'Piercing',
      condition: 'the skeleton moved 20 or more feet straight toward the target immediately before the hit',
    });
    // ADDITIVE convention: base + delta = RAW 2d6 + 4 + 2d8 (grant rolls its own leg)
    expect(`${GORE.damage_dice_primary} + ${GORE.conditional_damage.dice}`).toBe('2d6 + 4 + 2d8');
    // Skeleton-vs-Baphomet distinctness (the point of this row existing separately
    // from ma1174): 2d8-on-20-feet, NOT the Baphomet 3d6-on-10-feet twin bytes.
    expect(GORE.conditional_damage).not.toEqual(monsters.find((m) => m.index === 'minotaur-of-baphomet').actions[1].conditional_damage);
    // Prone-on-charge stays GM-adjudicated at the popup — auto-grant would fire on
    // every hit (RAW-wrong); versatile 2-handed bytes unauthored too.
    expect(GORE.hit_conditions).toBeUndefined();
    expect(GORE.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(GORE, 'Gore')).toBeNull();
  });
});

describe('MA-1175 Gore click→ctx forward (#583 single press)', () => {
  it('clicking the +6 chip forwards the full disk offer (formula=dice, bare "Charge:" label) + null hitClause + null two-handed variant', () => {
    renderGore();
    const goreRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Gore/.test(a.textContent.trim()));
    const chip = Array.from(goreRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
    expect(chip, 'Expected Gore +6 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(GORE_OFFER);
    expect(ctx.hitClause).toBeNull();
    expect(ctx.twoHandedVariantOffer).toBeNull();
  });
});
