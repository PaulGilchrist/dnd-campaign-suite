// @improved-by-ai
// MA-1175: Minotaur Skeleton Gore — charge clause ("moved 20+ feet straight toward")
// live-unarmed: disk authored no conditional_damage so buildChargeBonusOffer (MA-0007
// seam, MA-1160/MA-1174 additive-delta convention) never armed a HIT-popup offer.
// Fix: conditional_damage delta {dice:"2d8",modifier:0,damage_type:"Piercing"}
// (ADDITIVE: base Done still pays 2d6 + 4; grant rolls its own 2d8 leg; total RAW
// 2d6 + 4 + 2d8). Prone-on-charge stays GM-adjudicated at the popup — hit_conditions
// NOT authored (auto-grant would fire on every hit, RAW-wrong).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 5, rolls: [5], modifier: 0, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 10, rolls: [5, 5], modifier: 0, formula })),
  rollD20: vi.fn(() => 14),
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
import { buildChargeBonusOffer, buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';
import { monsterRechargeGate, rechargeUsageOf } from '../../services/encounters/monsterRecharge.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SKELETON = monsters.find((m) => m.index === 'minotaur-skeleton');
const GORE = SKELETON.actions[0];

const CREATURES = [
  { name: 'Minotaur Skeleton 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(GORE, 'Gore');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Gore',
    rolls: [14],
    bonus: 6,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Gore', formula: '2d6 + 4', damageType: 'Piercing', source: 'Minotaur Skeleton 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderGore(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Minotaur Skeleton', actions: SKELETON.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Minotaur Skeleton 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Minotaur Skeleton 1' })} />);
}

function clickGoreLink() {
  const goreRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Gore/.test(a.textContent.trim()));
  const chip = Array.from(goreRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
  expect(chip, 'Expected Gore +6 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1175 monsters.json data lock: Gore conditional_damage delta 2d8', () => {
  it('base bytes exact: +6 attack, "2d6 + 4" Piercing, recharge stays empty (gate null)', () => {
    expect(GORE.attack_bonus).toBe(6);
    expect(GORE.damage_dice_primary).toBe('2d6 + 4');
    expect(GORE.damage_type_primary).toBe('Piercing');
    expect(GORE.recharge).toBe('');
    expect(rechargeUsageOf(GORE).threshold).toBeNull();
    expect(monsterRechargeGate(GORE, null)).toBeNull();
  });

  it('conditional_damage mirrors the MA-1160/MA-1174 additive delta byte-shape (2d8 modifier 0 Piercing)', () => {
    const cd = GORE.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d8');
    expect(cd.modifier).toBe(0);
    expect(cd.damage_type).toBe('Piercing');
    expect(cd.condition).toMatch(/the skeleton moved 20 or more feet straight toward the target immediately before the hit/i);
    const mimic = monsters.find((m) => m.index === 'mimic').actions[0].conditional_damage;
    expect(Object.keys(cd).sort()).toEqual(Object.keys(mimic).sort());
  });

  it('ADDITIVE convention: base + delta = RAW 2d6 + 4 + 2d8; no hit_conditions auto-grant (prone GM-adjudicated)', () => {
    const cd = GORE.conditional_damage;
    expect(`${GORE.damage_dice_primary} + ${cd.dice}`).toBe('2d6 + 4 + 2d8');
    expect(GORE.hit_conditions).toBeUndefined();
    expect(GORE.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(GORE, 'Gore')).toBeNull();
  });
});

describe('MA-1175 Gore HIT popup charge offer', () => {
  it('buildChargeBonusOffer arms the 2d8 clause ("20 or more feet" prose is chargeClauseFeet-inert → "Charge:" label, MA-1160 chrome)', () => {
    const offer = buildChargeBonusOffer(GORE, 'Gore');
    expect(offer).toMatchObject({ dice: '2d8', modifier: 0, damageType: 'Piercing', formula: '2d8', attackName: 'Gore' });
    expect(offer.condition).toMatch(/moved 20 or more feet straight/i);
    expect(offer.label).toBe('Charge: +2d8 Piercing?');
  });

  it('forwards the charge offer to the attack roll context (seam armed by the fix)', () => {
    renderGore();
    clickGoreLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d8', modifier: 0, damageType: 'Piercing' });
  });

  it('grants: rolls 2d8 as its own leg, logs the clause; base 2d6 + 4 stays intact', async () => {
    renderGore(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d8');
    expect(rollExpression).toHaveBeenCalledWith('2d8');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('2d6 + 4');
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toMatch(/moved 20 or more feet straight/i);
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
  });

  it('declines: no clause roll, base-only log, zero bonus damage', async () => {
    renderGore(hitPopupHtml());
    const declineBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-decline');
    fireEvent.click(declineBtn);
    await vi.waitFor(() => {
      expect(addEntry).toHaveBeenCalled();
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    const decline = findLogEntry('conditional_damage_declined');
    expect(decline).toBeTruthy();
    expect(decline.description).toContain('base damage only');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('declined');
    });
  });
});
