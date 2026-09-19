// @improved-by-ai
// MA-0485: Chimera Bite advantage-damage variant — conditional_damage authored on
// monsters.json actions[1] (MA-0007 seam) so the HIT popup offers the
// "or 18 (4d6 + 4) Piercing if Advantage" variant. Locks: data shape mirrors the
// Aarakocra Talons sibling byte-for-byte (dice/modifier/damage_type/condition),
// offer builds with formula 4d6 + 4, grant rolls 4d6+4 + logs, decline keeps
// base 2d6 + 4 only.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 17, rolls: [4, 4, 3, 2, 4], modifier: 4, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 30, rolls: [4, 4, 3, 2, 4, 4, 4, 3, 2, 4], modifier: 4, formula })),
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
const CHIMERA = monsters.find((m) => m.index === 'chimera');
const BITE = CHIMERA.actions.find((a) => a.name === 'Bite');

const CREATURES = [
  { name: 'Chimera 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(BITE, 'Bite');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Bite',
    rolls: [14],
    bonus: 7,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Bite', formula: '2d6 + 4', damageType: 'Piercing', source: 'Chimera 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderBite(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Chimera', actions: CHIMERA.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Chimera 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Chimera 1' })} />);
}

function clickBiteLink() {
  const biteRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bite/.test(a.textContent.trim()));
  const chip = Array.from(biteRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+7');
  expect(chip, 'Expected Bite +7 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0485 monsters.json data lock: Chimera Bite conditional_damage', () => {
  it('authors conditional_damage mirroring the MA-0007 sibling byte-shape', () => {
    expect(BITE.attack_bonus).toBe(7);
    expect(BITE.damage_dice_primary).toBe('2d6 + 4');
    expect(BITE.damage_type_primary).toBe('Piercing');
    const cd = BITE.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('4d6');
    expect(cd.modifier).toBe(4);
    expect(cd.damage_type).toBe('Piercing');
    expect(cd.condition).toMatch(/advantage/i);
    const sibling = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0].conditional_damage;
    expect(Object.keys(cd).sort()).toEqual(Object.keys(sibling).sort());
  });

  it('buildChargeBonusOffer builds the advantage variant with formula 4d6 + 4', () => {
    const offer = buildChargeBonusOffer(BITE, 'Bite');
    expect(offer).toMatchObject({ dice: '4d6', modifier: 4, damageType: 'Piercing', formula: '4d6 + 4', attackName: 'Bite' });
  });
});

describe('MA-0485 Bite HIT popup offer', () => {
  it('forwards the advantage conditional offer to the attack roll context', () => {
    renderBite();
    clickBiteLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '4d6', modifier: 4, damageType: 'Piercing' });
  });

  it('grants: rolls 4d6 + 4, applies its own damage, logs the clause', async () => {
    renderBite(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('4d6 + 4');
    expect(rollExpression).toHaveBeenCalledWith('4d6 + 4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+17 Piercing (4d6 + 4)');
    expect(grant.description).toMatch(/advantage/i);
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
  });

  it('declines: no variant roll, logs base-only (2d6 + 4 stays the only damage)', async () => {
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
