// @improved-by-ai
// MA-1160: Mimic Bite grapple-double conditional damage — conditional_damage authored
// on monsters.json actions[0] (MA-0007 seam, ADDITIVE convention: the resolver applies
// base "Done" + its own clause roll, so the clause is authored as the DELTA dice).
// RAW: 7 (1d8 + 3) Piercing—or 12 (2d8 + 3) Piercing if the target is Grappled by
// the mimic—plus 4 (1d8) Acid damage. Base 1d8 + 3 plus delta 1d8 = 2d8 + 3 primary.
// Locks: data shape mirrors the MA-0007 sibling byte-shape (dice/modifier/damage_type/
// condition), offer builds with formula "1d8" (modifier 0), grant rolls 1d8 + logs,
// base + grant sum to RAW 2d8 + 3 (roll range 5..19), decline keeps base 1d8 + 3 only.
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
import { buildChargeBonusOffer } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MIMIC = monsters.find((m) => m.index === 'mimic');
const BITE = MIMIC.actions.find((a) => a.name === 'Bite');

const CREATURES = [
  { name: 'Mimic 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(BITE, 'Bite');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Bite',
    rolls: [14],
    bonus: 5,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Bite', formula: '1d8 + 3', damageType: 'Piercing', source: 'Mimic 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderBite(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Mimic', actions: MIMIC.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Mimic 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Mimic 1' })} />);
}

function clickBiteLink() {
  const biteRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bite/.test(a.textContent.trim()));
  const chip = Array.from(biteRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
  expect(chip, 'Expected Bite +5 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

function diceCount(formula) {
  const m = /(\d+)d\d+/.exec(formula);
  return m ? Number(m[1]) : 0;
}
function dieSides(formula) {
  const m = /\d+d(\d+)/.exec(formula);
  return m ? Number(m[1]) : 0;
}
function flatMod(formula) {
  const m = /\+\s*(\d+)/.exec(formula);
  return m ? Number(m[1]) : 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1160 monsters.json data lock: Mimic Bite conditional_damage (ADDITIVE delta)', () => {
  it('authors conditional_damage mirroring the MA-0007 sibling byte-shape', () => {
    expect(BITE.attack_bonus).toBe(5);
    expect(BITE.damage_dice_primary).toBe('1d8 + 3');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.damage_dice_secondary).toBe('1d8');
    expect(BITE.damage_type_secondary).toBe('Acid');
    const cd = BITE.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('1d8');
    expect(cd.modifier).toBe(0);
    expect(cd.damage_type).toBe('Piercing');
    expect(cd.condition).toMatch(/the target is grappled by the mimic/i);
    const sibling = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0].conditional_damage;
    expect(Object.keys(cd).sort()).toEqual(Object.keys(sibling).sort());
  });

  it('ADDITIVE convention: base + delta sums to RAW 2d8 + 3 primary (never 3d8 + 6)', () => {
    const base = BITE.damage_dice_primary;
    const cd = BITE.conditional_damage;
    expect(diceCount(base) + diceCount(cd.dice)).toBe(2);
    expect(dieSides(base)).toBe(8);
    expect(dieSides(cd.dice)).toBe(8);
    expect(flatMod(base) + flatMod(cd.dice) + Number(cd.modifier)).toBe(3);
  });

  it('buildChargeBonusOffer builds the grapple-delta clause with formula "1d8" (modifier 0)', () => {
    const offer = buildChargeBonusOffer(BITE, 'Bite');
    expect(offer).toMatchObject({ dice: '1d8', modifier: 0, damageType: 'Piercing', formula: '1d8', attackName: 'Bite' });
  });
});

describe('MA-1160 Bite HIT popup offer', () => {
  it('forwards the grapple-delta conditional offer to the attack roll context', () => {
    renderBite();
    clickBiteLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '1d8', modifier: 0, damageType: 'Piercing' });
  });

  it('grants: rolls 1d8, applies its own damage, logs the clause; base + grant = 2d8 + 3', async () => {
    renderBite(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d8');
    expect(rollExpression).toHaveBeenCalledWith('1d8');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d8 + 3');
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+5 Piercing (1d8)');
    expect(grant.description).toMatch(/grappled by the mimic/i);
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
  });

  it('declines: no clause roll, logs base-only (1d8 + 3 stays the only primary damage)', async () => {
    renderBite(hitPopupHtml());
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
