// @improved-by-ai
// MA-1676: Warhorse Hooves — one-field DATA fix: conditional_damage
// {dice:"2d4", damage_type:"Bludgeoning"} authored on monsters.json actions[0]
// (MA-0007 charge-bonus seam, MA-0885 goat Ram byte-shape with MA-0809/MA-0805
// giant-goat/giant-elk "2d4" twins) so the HIT popup offers the
// "20+ ft Charge: +2d4 Bludgeoning?" rider instead of base-only damage.
// Prone half: charge-gated Prone has zero transport app-wide (no movement-distance
// subsystem, MA-0903/MA-1127 precedent) — hit_conditions deliberately NOT authored
// (would over-grant Prone on EVERY hit, wrong RAW per MA-1610) — advisory residual.
// Locks: disk data lock + placement, offer builds formula "2d4" (modifier-less),
// grant rolls 2d4 as its own damage leg + logs conditional_damage_granted,
// decline logs conditional_damage_declined base-only, hit clause stays null.
// RAW anchor: description "extra 5 (2d4) Bludgeoning damage and has the Prone condition".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  // dice-gated faithful mocks (§401): dice-bearing formulas roll, flat
  // constants resolve null (MA-0322 codex).
  rollExpression: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 7, rolls: [3, 4], modifier: 0, formula } : null)),
  rollExpressionDoubled: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 14, rolls: [3, 4, 3, 4], modifier: 0, formula } : null)),
  rollD20: vi.fn(() => 16),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
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

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.chargeBonusOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onChargeBonus?.()}>charge-grant</button>
        <button onClick={() => props.onChargeBonusDecline?.()}>charge-decline</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled, canRollExpression } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildChargeBonusOffer, buildHitConditionClause } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WARHORSE = monsters.find((m) => m.index === 'warhorse');
const HOOVES = WARHORSE.actions.find((a) => a.name === 'Hooves');
const GOAT = monsters.find((m) => m.index === 'goat');
const GOAT_CD = GOAT.actions.find((a) => a.name === 'Ram').conditional_damage;

const CREATURES = [
  { name: 'Warhorse 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(HOOVES, 'Hooves');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Hooves',
    rolls: [16],
    bonus: 6,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Hooves', formula: '2d4 + 4', damageType: 'Bludgeoning', source: 'Warhorse 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderHooves(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Warhorse', actions: WARHORSE.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Warhorse 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Warhorse 1' })} />);
}

function clickHoovesLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Hooves/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
  expect(chip, 'Expected Hooves +6 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1676 monsters.json data lock: Warhorse Hooves conditional charge damage', () => {
  it('authors conditional_damage after damage_type_primary, last key (MA-0885 goat placement)', () => {
    expect(HOOVES.attack_bonus).toBe(6);
    expect(HOOVES.damage_dice_primary).toBe('2d4 + 4');
    expect(HOOVES.damage_type_primary).toBe('Bludgeoning');
    const keys = Object.keys(HOOVES);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(HOOVES.description).toMatch(/extra 5 \(2d4\) Bludgeoning damage/i);
    expect(canRollExpression(HOOVES.damage_dice_primary)).toBe(true);
  });

  it('conditional_damage is the goat twin byte-shape (2d4, modifier-less, same key order)', () => {
    const cd = HOOVES.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d4');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toBe('moved 20+ feet straight toward the target immediately before the hit');
    expect(cd).not.toHaveProperty('modifier');
    expect(Object.keys(cd)).toEqual(Object.keys(GOAT_CD));
  });

  it('prone stays advisory: hit_conditions NOT authored (charge gate has no transport — MA-0903/MA-1610)', () => {
    expect('hit_conditions' in HOOVES).toBe(false);
    expect(buildHitConditionClause(HOOVES)).toBeNull();
  });

  it('buildChargeBonusOffer arms on the row: formula "2d4" (modifier 0), charge label', () => {
    const offer = buildChargeBonusOffer(HOOVES, 'Hooves');
    expect(offer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'Bludgeoning', formula: '2d4', attackName: 'Hooves' });
    expect(offer.label).toBe('20+ ft Charge: +2d4 Bludgeoning?');
  });
});

describe('MA-1676 Hooves HIT popup offer + grant/decline', () => {
  it('forwards the charge offer to the attack roll context, no prone clause', () => {
    renderHooves();
    clickHoovesLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'Bludgeoning', formula: '2d4' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('grants: rolls 2d4 as its own extra damage leg, logs conditional_damage_granted', async () => {
    renderHooves(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d4');
    expect(call.name).toBe('Hooves — Charge Bonus');
    expect(call.context.damageType).toBe('Bludgeoning');
    expect(rollExpression).toHaveBeenCalledWith('2d4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+7 Bludgeoning (2d4)');
  });

  it('declines: logs conditional_damage_declined with zero charge roll', async () => {
    renderHooves(hitPopupHtml());
    const declineBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-decline');
    fireEvent.click(declineBtn);
    await vi.waitFor(() => {
      const decline = findLogEntry('conditional_damage_declined');
      expect(decline).toBeTruthy();
      expect(decline.description).toContain('base damage only');
    });
    expect(rollDamage).not.toHaveBeenCalled();
  });
});
