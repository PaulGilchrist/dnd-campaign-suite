// @maintained-by-ai
// MA-1174: Minotaur of Baphomet Gore — two DATA defects on monsters.json actions[1]:
// (1) charge clause ("moved 10+ feet straight toward") live-unarmed — no conditional_damage
//     authored so buildChargeBonusOffer (MA-0007 seam, MA-1160 additive convention) never
//     armed a HIT-popup offer; (2) phantom recharge:"5-6" contradicts the recharge-free
//     canonical 2024 prose — the chip rendered "(5-6)", the first fire spent the recharge
//     marker, and same-round refires refused behind the phantom economy.
// Fix: recharge:"" (MA-0879/MA-1089 family household authoring — gate null, no spend, no
// refusal) + conditional_damage delta {dice:"3d6",modifier:0,damage_type:"Piercing"}
// (ADDITIVE: base Done still pays 4d6 + 4; grant rolls its own 3d6 leg; total RAW
// 4d6 + 4 + 3d6). Prone-on-charge stays GM-adjudicated at the popup — hit_conditions
// NOT authored (auto-grant would fire on every hit, RAW-wrong).
//
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma0805/ma1160
// template, mirroring the family adjudications:
//   1. Disk-row bytes: recharge:"" regression lock + full conditional_damage toEqual
//      identity (modifier:0 explicit = additive delta, MA-1160 chrome; toEqual pins the
//      exact key set so the old mimic key-parity scan is redundant) + RAW additive sum
//      + no hit_conditions / no two-handed bytes + recharge-free name/description.
//   2. ONE click→rollAttack ctx press (:1407): full 7-key offer identity via toEqual —
//      owns the modifier-0 → formula=dice branch pin (Helpers.js:693, cited by ma1160
//      header :23) AND the chargeClauseFeet-inert label ("moved 10 or more feet" prose
//      never matches a feet-token → bare "Charge:" head, MA-1160 chrome) — + hitClause
//      toBeNull (prone is a GM-adjudicated pre-condition, never an auto-grant rider)
//      + twoHandedVariantOffer toBeNull (replaces the direct-helper byte re-reads).
// Cut (owner cites, not re-asserted here):
//   - monsterRecharge.test.js owns the recharge machine: ungated-row gate null (:59-60),
//     ungated spend returns null with no stamp/log (:152-165), displayText derivation
//     (:158-160) — the only monster-distinct byte is GORE.recharge === "" above.
//   - MonsterCardModal.charge-bonus.test.jsx owns resolveChargeBonus: grant hit/crit
//     roller fold + logs + resolved-write (:210-233) and decline (:235-250) — this
//     row's 3d6/Piercing grant/decline bytes are shape twins there (#667-#672 family).
// Dead-mock purge per-lane (ma0805/ma1160 baseline): diceRoller mock gone (rollAttack
// mocked, no roller fires without the cut grant tests), AttackResultPopup stub gone
// (popupHtml null → popup never renders), rollD20 + never-fired hook members gone.
// No timers — the ctx press lands synchronously.
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
const MINOTAUR = monsters.find((m) => m.index === 'minotaur-of-baphomet');
const GORE = MINOTAUR.actions[1];

// Exact buildChargeBonusOffer(GORE, 'Gore') output FROM the disk row — full identity.
// modifier:0 folds formula to bare dice; the "10 or more feet" prose is chargeClauseFeet
// -inert, so the label head is bare "Charge:" (no feet prefix, unlike the ram twins).
const GORE_OFFER = {
  dice: '3d6',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'the minotaur moved 10 or more feet straight toward the target immediately before the hit',
  formula: '3d6',
  label: 'Charge: +3d6 Piercing?',
  attackName: 'Gore',
};

const CREATURES = [
  { name: 'Minotaur of Baphomet 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function renderGore() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Minotaur of Baphomet', actions: MINOTAUR.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Minotaur of Baphomet 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Minotaur of Baphomet 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1174 monsters.json data lock: Gore recharge:"" + additive 3d6 charge delta', () => {
  it('recharge emptied (phantom economy dead — ungated-row derivation owned by monsterRecharge.test.js:59-60) + full conditional_damage identity mirroring the MA-1160 modifier-less delta', () => {
    expect(GORE.attack_bonus).toBe(6);
    expect(GORE.damage_dice_primary).toBe('4d6 + 4');
    expect(GORE.damage_type_primary).toBe('Piercing');
    expect(GORE.recharge).toBe('');
    expect(GORE.conditional_damage).toEqual({
      dice: '3d6',
      modifier: 0,
      damage_type: 'Piercing',
      condition: 'the minotaur moved 10 or more feet straight toward the target immediately before the hit',
    });
    // ADDITIVE convention: base + delta = RAW 4d6 + 4 + 3d6 (grant rolls its own leg)
    expect(`${GORE.damage_dice_primary} + ${GORE.conditional_damage.dice}`).toBe('4d6 + 4 + 3d6');
    // Prone-on-charge stays GM-adjudicated at the popup — auto-grant would fire on
    // every hit (RAW-wrong); versatile 2-handed bytes unauthored too.
    expect(GORE.hit_conditions).toBeUndefined();
    expect(GORE.damage_dice_two_handed).toBeUndefined();
    // recharge-free canonical 2024 prose: no Recharge token in name/description
    expect(/recharge/i.test(GORE.name)).toBe(false);
    expect(/recharge/i.test(GORE.description)).toBe(false);
  });
});

describe('MA-1174 Gore click→ctx forward (#583 single press)', () => {
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
