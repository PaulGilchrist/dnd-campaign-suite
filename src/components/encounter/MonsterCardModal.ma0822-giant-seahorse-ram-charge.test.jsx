// @improved-by-ai
// MA-0822: Giant Seahorse Ram — one-field DATA fix: conditional_damage
// {dice:"2d8", modifier:2, damage_type:"Bludgeoning"} authored on monsters.json
// actions[0] (MA-0007 charge-bonus seam) so the HIT popup offers the
// "11 (2d8 + 2) Bludgeoning" charge alternative. NO hit_conditions — this row
// carries no prone/knockdown clause (unlike MA-0809 goat two-field shape).
// Locks: disk byte-shape mirrors the verified twins Aarakocra Skirmisher
// Talons (3d4 +2) / Chimera Bite (4d6 +4) — same key order, modifier present;
// offer builds formula "2d8 + 2" (modifier 2); grant rolls it + logs
// conditional_damage_granted; decline logs conditional_damage_declined base-only.
// RAW anchor: description "or 11 (2d8 + 2) Bludgeoning damage if ... moved 20+ feet".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 11, rolls: [8, 3], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 22, rolls: [8, 3, 8, 3], modifier: 2, formula })),
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
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildChargeBonusOffer, buildHitConditionClause } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SEAHORSE = monsters.find((m) => m.index === 'giant-seahorse');
const RAM = SEAHORSE.actions.find((a) => a.name === 'Ram');
const AARAKOCRA = monsters.find((m) => m.index === 'aarakocra-skirmisher');
const TALONS = AARAKOCRA.actions.find((a) => a.name === 'Talons');

const CREATURES = [
  { name: 'Giant Seahorse 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(RAM, 'Ram');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Ram',
    rolls: [16],
    bonus: 4,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Ram', formula: '2d6 + 2', damageType: 'Bludgeoning', source: 'Giant Seahorse 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderRam(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Giant Seahorse', actions: SEAHORSE.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Giant Seahorse 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Giant Seahorse 1' })} />);
}

function clickRamLink() {
  const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
  const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
  expect(chip, 'Expected Ram +4 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0822 monsters.json data lock: Giant Seahorse Ram charge alternative dice', () => {
  it('authors conditional_damage after damage_type_primary, last key (MA-0007 twin placement)', () => {
    expect(RAM.attack_bonus).toBe(4);
    expect(RAM.damage_dice_primary).toBe('2d6 + 2');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    const keys = Object.keys(RAM);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(RAM.description).toMatch(/or 11 \(2d8 \+ 2\) Bludgeoning damage if the seahorse moved 20\+ feet straight toward the target/i);
  });

  it('mirrors the verified additive twins byte-shape: modifier present, key order = Aarakocra Talons', () => {
    const cd = RAM.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d8');
    expect(cd.modifier).toBe(2);
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toMatch(/moved 20\+ feet straight toward the target immediately before the hit/i);
    expect(Object.keys(cd)).toEqual(Object.keys(TALONS.conditional_damage));
  });

  it('carries NO hit_conditions — row has no prone clause (not the MA-0809 two-field shape)', () => {
    expect('hit_conditions' in RAM).toBe(false);
    expect(buildHitConditionClause(RAM)).toBeNull();
  });

  it('buildChargeBonusOffer builds the charge variant with formula "2d8 + 2" (modifier 2)', () => {
    const offer = buildChargeBonusOffer(RAM, 'Ram');
    expect(offer).toMatchObject({ dice: '2d8', modifier: 2, damageType: 'Bludgeoning', formula: '2d8 + 2', attackName: 'Ram' });
    expect(offer.label).toBe('20+ ft Charge: +2d8+2 Bludgeoning?');
  });

  it('unauthored rows stay inert (null gate), giant-sea-horse twin untouched', () => {
    expect(buildChargeBonusOffer({ name: 'Bubble Dash' }, 'Bubble Dash')).toBeNull();
    const seaHorse = monsters.find((m) => m.index === 'giant-sea-horse');
    expect(seaHorse.actions.find((a) => a.name === 'Ram').conditional_damage).toBeUndefined();
  });
});

describe('MA-0822 Ram HIT popup offer + grant/decline', () => {
  it('forwards the charge conditional offer to the attack roll context, no prone clause', () => {
    renderRam();
    clickRamLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d8', modifier: 2, damageType: 'Bludgeoning', formula: '2d8 + 2' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('grants: rolls "2d8 + 2", applies its own damage, logs conditional_damage_granted', async () => {
    renderRam(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d8 + 2');
    expect(call.name).toBe('Ram — Charge Bonus');
    expect(call.context.damageType).toBe('Bludgeoning');
    expect(rollExpression).toHaveBeenCalledWith('2d8 + 2');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+11 Bludgeoning (2d8 + 2)');
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
