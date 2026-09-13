// @improved-by-ai
// MA-0007: Aarakocra Skirmisher Talons charge-damage clause (monsters.json
// conditional_damage) — GM-adjudication offer on the monster attack HIT popup.
// Locks: offer metadata forwarded to rollAttack, grant rolls 3d4+2 with its own
// damage + logs, decline logs base-only, resolved decision cannot re-fire.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

const TALONS_OFFER = {
  dice: '3d4',
  modifier: 2,
  damageType: 'Slashing',
  condition: 'moved 30+ feet straight toward target immediately before the hit',
  formula: '3d4 + 2',
  label: '30+ ft Charge: +3d4+2 Slashing?',
  attackName: 'Talons',
};

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: 9, rolls: [3], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 15, rolls: [3, 3], modifier: 2, formula })),
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

// Stub the popup chain (real offer gating is covered in
// DiceRollResult.charge-bonus.test.jsx) so handler behavior can be driven.
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

const TALONS_ACTION = {
  name: 'Talons',
  description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Slashing damage.',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '1d4 + 2',
  damage_type_primary: 'Slashing',
  conditional_damage: {
    dice: '3d4',
    modifier: 2,
    damage_type: 'Slashing',
    condition: 'moved 30+ feet straight toward target immediately before the hit',
  },
};

const CREATURES = [
  { name: 'Aarakocra Skirmisher 1', targetName: 'AasimarTest' },
  { name: 'AasimarTest', type: 'player' },
];

function hitPopupHtml(overrides = {}) {
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Talons',
    rolls: [14, 8],
    bonus: 4,
    targetName: 'AasimarTest',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Talons', formula: '1d4 + 2', damageType: 'Slashing', source: 'Aarakocra Skirmisher 1' },
    chargeBonusOffer: TALONS_OFFER,
    ...overrides,
  };
}

function renderTalons(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Aarakocra Skirmisher', actions: [TALONS_ACTION] });
  damageUtils.__setFindCreatureReturn({ name: 'Aarakocra Skirmisher 1', targetName: 'AasimarTest', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Aarakocra Skirmisher 1' })} />);
}

function clickTalonsLink() {
  const links = document.querySelectorAll('.mc-dice-link');
  const link = Array.from(links).find((el) => el.textContent.trim() === '+4');
  expect(link, 'Expected Talons +4 dice link').toBeTruthy();
  fireEvent.click(link);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0007 buildChargeBonusOffer', () => {
  it('builds the offer from conditional_damage metadata', () => {
    const offer = buildChargeBonusOffer(TALONS_ACTION, 'Talons');
    expect(offer).toMatchObject({ dice: '3d4', modifier: 2, damageType: 'Slashing', formula: '3d4 + 2', label: '30+ ft Charge: +3d4+2 Slashing?' });
  });

  it('returns null for actions without conditional_damage', () => {
    expect(buildChargeBonusOffer({ name: 'Club', attack_bonus: 4 }, 'Club')).toBeNull();
    expect(buildChargeBonusOffer(undefined, 'Club')).toBeNull();
  });
});

describe('MA-0007 offer forwarding', () => {
  it('forwards chargeBonusOffer to the attack roll context', () => {
    renderTalons();
    clickTalonsLink();
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toMatchObject({ dice: '3d4', modifier: 2, damageType: 'Slashing' });
  });

  it('forwards null offer for actions without the clause', () => {
    const m = makeMonster({ name: 'Goblin', actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', targetName: null, conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);
    clickTalonsLink();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toBeNull();
  });
});

describe('MA-0007 grant on HIT popup', () => {
  it('grants: rolls 3d4+2, applies its own damage, logs the clause, marks popup resolved', async () => {
    renderTalons(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('3d4 + 2');
    expect(rollExpression).toHaveBeenCalledWith('3d4 + 2');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(call.name).toMatch(/Talons — Charge Bonus/);
    expect(call.context).toMatchObject({ damageType: 'Slashing', targetName: 'AasimarTest', attackerName: 'Aarakocra Skirmisher 1' });
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+9 Slashing (3d4 + 2)');
    expect(grant.description).toContain('moved 30+ feet straight toward target');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage).toBeTruthy();
  });

  it('doubles the charge dice on a crit', async () => {
    renderTalons(hitPopupHtml({ isCrit: true }));
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollExpressionDoubled).toHaveBeenCalledWith('3d4 + 2');
    });
  });

  it('declines: no charge roll, logs base-only, marks popup resolved', async () => {
    renderTalons(hitPopupHtml());
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

  it('a resolved decision cannot re-fire the bonus', async () => {
    renderTalons(hitPopupHtml({ chargeBonusResolved: 'granted' }));
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(findLogEntry('conditional_damage_granted')).toBeFalsy();
  });

  it('does nothing when the popup has no charge offer', async () => {
    renderTalons(hitPopupHtml({ chargeBonusOffer: null }));
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(rollDamage).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
