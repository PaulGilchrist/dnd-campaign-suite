// @improved-by-ai
// MA-1610: Triceratops Gore — one-field DATA fix: conditional_damage
// {dice:"2d8",damage_type:"Piercing",condition:"moved 20+ feet straight
// toward the target immediately before the hit"} authored on monsters.json
// actions[1] (MA-0007 charge-bonus seam, MA-0885 goat byte-shape placement:
// dict after damage_type_primary, last key) so the HIT popup offers
// "20+ ft Charge: +2d8 Piercing?" + decline instead of inert base-only
// damage. NO hit_conditions — the Prone half of the movement-gated rider has
// zero transport (MA-0903 caveat: maybeApplyRamProne needs the PC 'Ram'
// stance buff; naive prone would over-grant always-prone, WRONG RAW).
// Locks: disk data lock + key order, buildChargeBonusOffer offer shape
// (label/feet/dice/type), context forwarding on chip press, accept rolls
// "2d8" + logs conditional_damage_granted, crit accept doubles charge dice,
// decline logs conditional_damage_declined zero-charge-roll.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 9, rolls: [4, 5], modifier: 0, formula } : null)),
  rollExpressionDoubled: vi.fn((formula) => (/\d+d\d+/.test(formula) ? { total: 18, rolls: [4, 5, 4, 5], modifier: 0, formula } : null)),
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
const TRI = monsters.find((m) => m.index === 'triceratops');
const GORE = TRI.actions.find((a) => a.name === 'Gore');
const GOAT = monsters.find((m) => m.index === 'goat');
const GOAT_CD = GOAT.actions.find((a) => a.name === 'Ram').conditional_damage;

const CREATURES = [
  { name: 'Triceratops 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(GORE, 'Gore');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Gore',
    rolls: [16],
    bonus: 9,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Gore', formula: '2d12 + 6', damageType: 'Piercing', source: 'Triceratops 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderGore(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Triceratops', actions: TRI.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Triceratops 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Triceratops 1' })} />);
}

function clickGoreLink() {
  const goreRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Gore/.test(a.textContent.trim()));
  const chip = Array.from(goreRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+9');
  expect(chip, 'Expected Gore +9 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1610 monsters.json data lock: Triceratops Gore charge rider', () => {
  it('authors conditional_damage after damage_type_primary, last key (MA-0885 goat byte-shape placement)', () => {
    expect(GORE.attack_bonus).toBe(9);
    expect(GORE.damage_dice_primary).toBe('2d12 + 6');
    expect(GORE.damage_type_primary).toBe('Piercing');
    const keys = Object.keys(GORE);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(GORE.description).toMatch(/moved 20\+ feet straight toward it immediately before the hit, the target takes an extra 9 \(2d8\) Piercing damage/i);
  });

  it('conditional_damage mirrors the goat byte-shape: dice 2d8 Piercing, modifier-less, same condition clause', () => {
    const cd = GORE.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d8');
    expect(cd.damage_type).toBe('Piercing');
    expect(cd.condition).toBe('moved 20+ feet straight toward the target immediately before the hit');
    expect(cd).not.toHaveProperty('modifier');
    expect(Object.keys(cd)).toEqual(Object.keys(GOAT_CD));
    expect('hit_conditions' in GORE).toBe(false);
    expect(buildHitConditionClause(GORE)).toBeNull();
  });

  it('buildChargeBonusOffer arms on the row: label "20+ ft Charge: +2d8 Piercing?", formula modifier-less', () => {
    const offer = buildChargeBonusOffer(GORE, 'Gore');
    expect(offer).toMatchObject({ dice: '2d8', modifier: 0, damageType: 'Piercing', formula: '2d8', attackName: 'Gore' });
    expect(offer.label).toBe('20+ ft Charge: +2d8 Piercing?');
  });
});

describe('MA-1610 Gore HIT popup offer + grant/decline', () => {
  it('forwards the charge conditional offer to the attack roll context, no prone clause', () => {
    renderGore();
    clickGoreLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d8', modifier: 0, damageType: 'Piercing', formula: '2d8' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('accepts: rolls "2d8", applies its own damage, logs conditional_damage_granted', async () => {
    renderGore(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d8');
    expect(call.name).toBe('Gore — Charge Bonus');
    expect(call.context.damageType).toBe('Piercing');
    expect(rollExpression).toHaveBeenCalledWith('2d8');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+9 Piercing (2d8)');
  });

  it('crit accept doubles the charge dice leg (MA-0756 lineage)', async () => {
    renderGore(hitPopupHtml({ isCrit: true, rolls: [20] }));
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('2d8');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.total).toBe(18);
    expect(call.context.isAutoCrit).toBe(true);
  });

  it('declines: logs conditional_damage_declined with zero charge roll', async () => {
    renderGore(hitPopupHtml());
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
