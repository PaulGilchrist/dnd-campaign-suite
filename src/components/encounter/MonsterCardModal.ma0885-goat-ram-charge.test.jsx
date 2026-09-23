// @improved-by-ai
// MA-0885: Goat Ram — two-field DATA fix: damage_dice_primary "1" (flat base,
// MA-0322 constant dice-less resolve) + conditional_damage {dice:"1d4",
// damage_type:"Bludgeoning"} authored on monsters.json actions[0] (MA-0007
// charge-bonus seam) so the HIT popup offers the "2 (1d4) Bludgeoning" charge
// alternative instead of always-on 1d4. NO hit_conditions (row has no prone
// clause — do NOT copy the giant-goat MA-0809 shape). Locks: disk data lock,
// offer builds formula "1d4" (modifier-less), grant rolls it + logs
// conditional_damage_granted, decline logs conditional_damage_declined base-only,
// flat primary "1" stays dice-less (canRollExpression false, parseConstant 1;
// rollExpressionDoubled("1") null keeps crits flat, MA-0322 codex).
// RAW anchor: description "Hit: 1 Bludgeoning damage, or 2 (1d4) Bludgeoning
// damage if the goat moved 20+ feet straight toward the target".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  // faithful to the real gate: dice-bearing formulas roll, flat constants
  // resolve null (MA-0322 — callers fall back to parseConstant dice-less).
  rollExpression: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 3, rolls: [3], modifier: 0, formula } : null)),
  rollExpressionDoubled: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 6, rolls: [3, 3], modifier: 0, formula } : null)),
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
import { rollExpression, rollExpressionDoubled, canRollExpression, parseConstant } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildChargeBonusOffer, buildHitConditionClause, extractFlatHitDamage } from './MonsterCardHelpers.js';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GOAT = monsters.find((m) => m.index === 'goat');
const RAM = GOAT.actions.find((a) => a.name === 'Ram');
const SEAHORSE = monsters.find((m) => m.index === 'giant-seahorse');
const SEAHORSE_CD = SEAHORSE.actions.find((a) => a.name === 'Ram').conditional_damage;

const CREATURES = [
  { name: 'Goat 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(RAM, 'Ram');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Ram',
    rolls: [16],
    bonus: 2,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Ram', formula: '1', damageType: 'Bludgeoning', source: 'Goat 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderRam(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Goat', actions: GOAT.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Goat 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Goat 1' })} />);
}

function clickRamLink() {
  const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
  const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+2');
  expect(chip, 'Expected Ram +2 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0885 monsters.json data lock: Goat Ram flat base + charge alternative', () => {
  it('authors flat base "1" with conditional_damage after damage_type_primary, last key (MA-0007 twin placement)', () => {
    expect(RAM.attack_bonus).toBe(2);
    expect(RAM.damage_dice_primary).toBe('1');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    const keys = Object.keys(RAM);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(RAM.description).toMatch(/Hit: 1 Bludgeoning damage, or 2 \(1d4\) Bludgeoning damage if the goat moved 20\+ feet straight toward the target/i);
  });

  it('conditional_damage is the seahorse twin shape minus modifier (no hit_conditions — not the MA-0809 goat shape)', () => {
    const cd = RAM.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('1d4');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toMatch(/moved 20\+ feet straight toward the target immediately before the hit/i);
    expect(cd).not.toHaveProperty('modifier');
    expect(Object.keys(cd)).toEqual(Object.keys(SEAHORSE_CD).filter((k) => k !== 'modifier'));
    expect('hit_conditions' in RAM).toBe(false);
    expect(buildHitConditionClause(RAM)).toBeNull();
  });

  it('buildChargeBonusOffer arms on the row: formula "1d4" (modifier-less), label offers the charge alternative', () => {
    const offer = buildChargeBonusOffer(RAM, 'Ram');
    expect(offer).toMatchObject({ dice: '1d4', modifier: 0, damageType: 'Bludgeoning', formula: '1d4', attackName: 'Ram' });
    expect(offer.label).toBe('20+ ft Charge: +1d4 Bludgeoning?');
  });

  it('flat primary resolves constant dice-less: "1" not rollable, parseConstant 1, crits stay flat', () => {
    expect(canRollExpression(RAM.damage_dice_primary)).toBe(false);
    expect(parseConstant(RAM.damage_dice_primary)).toBe(1);
    expect(rollExpressionDoubled(RAM.damage_dice_primary)).toBe(null);
    expect(extractDamageDiceFromDescription(RAM.description, RAM.damage_dice_primary)).toBe('1');
    expect(extractFlatHitDamage(RAM)).toBe('1');
  });
});

describe('MA-0885 Ram HIT popup offer + grant/decline', () => {
  it('forwards the charge conditional offer to the attack roll context, no prone clause', () => {
    renderRam();
    clickRamLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '1d4', modifier: 0, damageType: 'Bludgeoning', formula: '1d4' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('grants: rolls "1d4", applies its own damage, logs conditional_damage_granted', async () => {
    renderRam(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d4');
    expect(call.name).toBe('Ram — Charge Bonus');
    expect(call.context.damageType).toBe('Bludgeoning');
    expect(rollExpression).toHaveBeenCalledWith('1d4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+3 Bludgeoning (1d4)');
  });

  it('declines: logs conditional_damage_declined with zero charge roll', async () => {
    renderRam(hitPopupHtml());
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
