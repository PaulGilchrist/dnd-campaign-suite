// @improved-by-ai
// MA-0809: Giant Goat Ram — hit_conditions:["prone"] + conditional_damage
// authored on monsters.json actions[0] (MA-0010 prone family + MA-0007 charge-bonus
// seam) so the HIT popup offers the "extra 2d4 Bludgeoning" charge rider and the
// resolved hit grants Prone (Large-or-smaller gate lives in handlePlainDamage).
// Locks: data byte-shape mirrors the MA-0805 giant-elk / MA-0756 galeb-duhr fixed
// rows (modifier-less conditional_damage, hit_conditions after damage_type_primary
// per MA-0794 — goat has no secondary dice), offer builds with formula "2d4"
// (modifier 0), grant rolls 2d4 + logs, hit clause carries prone, decline logs.
// RAW anchor: description "extra 5 (2d4) Bludgeoning damage and ... Prone".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 7, rolls: [3, 4], modifier: 0, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 14, rolls: [3, 4, 3, 4], modifier: 0, formula })),
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
const GOAT = monsters.find((m) => m.index === 'giant-goat');
const RAM = GOAT.actions.find((a) => a.name === 'Ram');
const ELK = monsters.find((m) => m.index === 'giant-elk');
const ELK_RAM = ELK.actions.find((a) => a.name === 'Ram');

const CREATURES = [
  { name: 'Giant Goat 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(RAM, 'Ram');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Ram',
    rolls: [16],
    bonus: 5,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Ram', formula: '1d6 + 3', damageType: 'Bludgeoning', source: 'Giant Goat 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderRam(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Giant Goat', actions: GOAT.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Giant Goat 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Giant Goat 1' })} />);
}

function clickRamLink() {
  const ramRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Ram/.test(a.textContent.trim()));
  const chip = Array.from(ramRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
  expect(chip, 'Expected Ram +5 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0809 monsters.json data lock: Giant Goat Ram charge riders', () => {
  it('authors hit_conditions ["prone"] after damage_type_primary (MA-0794 placement, no secondary dice)', () => {
    expect(RAM.attack_bonus).toBe(5);
    expect(RAM.damage_dice_primary).toBe('1d6 + 3');
    expect(RAM.damage_type_primary).toBe('Bludgeoning');
    expect(RAM.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(RAM);
    expect(keys.indexOf('hit_conditions')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(RAM.description).toMatch(/extra 5 \(2d4\) Bludgeoning damage/i);
    expect(RAM.description).toMatch(/<strong>Prone<\/strong>/);
  });

  it('authors modifier-less conditional_damage mirroring the MA-0805 giant-elk byte-shape', () => {
    const cd = RAM.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d4');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toMatch(/moved 20\+ feet straight toward/i);
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd)).toEqual(Object.keys(ELK_RAM.conditional_damage));
  });

  it('buildChargeBonusOffer builds the charge variant with formula "2d4" (modifier 0)', () => {
    const offer = buildChargeBonusOffer(RAM, 'Ram');
    expect(offer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'Bludgeoning', formula: '2d4', attackName: 'Ram' });
    expect(offer.label).toBe('20+ ft Charge: +2d4 Bludgeoning?');
  });

  it('buildHitConditionClause arms the prone hit clause', () => {
    const clause = buildHitConditionClause(RAM);
    expect(clause).toMatchObject({ conditions: ['prone'], escapeDc: null, attackName: 'Ram' });
  });
});

describe('MA-0809 Ram HIT popup offer + grant', () => {
  it('forwards the charge conditional offer to the attack roll context', () => {
    renderRam();
    clickRamLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'Bludgeoning' });
    expect(rollAttack.mock.calls[0][2].hitClause).toMatchObject({ conditions: ['prone'], attackName: 'Ram' });
  });

  it('grants: rolls 2d4, applies its own damage, logs the clause', async () => {
    renderRam(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d4');
    expect(call.context.damageType).toBe('Bludgeoning');
    expect(rollExpression).toHaveBeenCalledWith('2d4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+7 Bludgeoning (2d4)');
  });

  it('declines: logs the refusal with zero charge roll', async () => {
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
