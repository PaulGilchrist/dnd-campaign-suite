// @maintained-by-ai
// MA-1160: Mimic Bite grapple-double conditional damage — additive conditional_damage
// delta authored on monsters.json actions[0] (MA-0007 seam): base 1d8 + 3 Piercing +
// clause delta 1d8 = RAW 12 (2d8 + 3) Piercing if Grappled by the mimic, plus the
// row's fixed secondary 1d8 Acid (monster-distinct plus-acid, composite transport owned
// by ma0747-composite-damage / ma0962). Trim pass (2026-10-18), two seams, one press
// each — mirrors the maintained ma0822 template:
//   1. Disk-row bytes: full cd-object identity (explicit modifier:0 = additive delta,
//      never 3d8 + 6) + last-key placement + RAW prose anchor. Direct-helper re-read
//      of buildChargeBonusOffer cut — the helper fires inside the ctx press below
//      (#662/#666 precedent); its modifier-0 → formula=dice branch is also pinned by
//      the modifier-0 Gore twins ma1174 :217 / ma1175 :192.
//   2. ONE click→rollAttack ctx press (:1407): full offer identity via toEqual (all
//      7 keys incl. the static-state clause label head, MA-1363 chrome — grapple text,
//      not feet-token) + hitClause toBeNull (grapple is a PRE-condition the GM
//      adjudicates, never an auto-grant hit_conditions rider).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine): forward-face
// :190-207, grant hit/crit + resolved-write :210-233, decline :235-250, re-fire
// guards :252-261 — this row's 1d8/grapple bytes are shape twins there. Dead-mock
// purge per-lane: diceRoller (rollAttack mocked, no roller fires without the cut
// grant tests), AttackResultPopup stub + rollD20 + never-fired hook members gone
// (popupHtml null → popup never renders; ma0822 baseline renders minimal hook).
// No timers 🔴 — the ctx press lands synchronously.
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
const MIMIC = monsters.find((m) => m.index === 'mimic');
const BITE = MIMIC.actions[0];

// Exact buildChargeBonusOffer(BITE, 'Bite') output FROM the disk row — full identity,
// incl. the modifier-0 formula ('1d8', never '1d8 + 0') and MA-1363 static-condition
// label chrome ("The target is Grappled by the mimic", no feet-token head).
const BITE_OFFER = {
  dice: '1d8',
  modifier: 0,
  damageType: 'Piercing',
  condition: 'the target is Grappled by the mimic',
  formula: '1d8',
  label: 'The target is Grappled by the mimic: +1d8 Piercing?',
  attackName: 'Bite',
};

const CREATURES = [
  { name: 'Mimic 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function renderBite() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Mimic', actions: MIMIC.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Mimic 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Mimic 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1160 monsters.json data lock: Mimic Bite grapple-double clause', () => {
  it('authors the additive delta offer bytes + fixed Acid secondary with RAW prose anchor (base+delta = 2d8 + 3, never 3d8 + 6)', () => {
    expect(BITE.attack_bonus).toBe(5);
    expect(BITE.damage_dice_primary).toBe('1d8 + 3');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.damage_dice_secondary).toBe('1d8');
    expect(BITE.damage_type_secondary).toBe('Acid');
    // Full cd identity — explicit modifier:0 marks the ADDITIVE delta convention
    // (resolver pays base + clause; the clause carries dice only).
    expect(BITE.conditional_damage).toEqual({
      dice: '1d8',
      modifier: 0,
      damage_type: 'Piercing',
      condition: 'the target is Grappled by the mimic',
    });
    const keys = Object.keys(BITE);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_secondary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(BITE.description).toMatch(/or 12 \(2d8 \+ 3\) Piercing damage if the target is Grappled by the mimic—plus 4 \(1d8\) Acid damage/);
  });
});

describe('MA-1160 Bite click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +5 chip forwards the full disk offer + null hitClause (grapple is a pre-condition, never auto-granted)', () => {
    renderBite();
    const biteRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bite/.test(a.textContent.trim()));
    const chip = Array.from(biteRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
    expect(chip, 'Expected Bite +5 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(BITE_OFFER);
    expect(ctx.hitClause).toBeNull();
  });
});
