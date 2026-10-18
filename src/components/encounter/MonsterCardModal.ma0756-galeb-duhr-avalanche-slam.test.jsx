// @maintained-by-ai
// MA-0756: Galeb Duhr Avalanche Slam — the two fields fixed by 7736aeba7:
// hit_conditions:["prone"] + conditional_damage (2d6 Bludgeoning charge rider)
// authored on monsters.json actions. Distinct lane content = the row bytes and
// that both riders ride the attack-ctx seam (MonsterCardModal.jsx:1407/:1180)
// and resolve through the HIT popup. Generic charge machinery (grant/crit/
// decline/guards) is owned by MonsterCardModal.charge-bonus.test.jsx (MA-0007);
// the prone consumer gate (Large-or-smaller, handlePlainDamage) is owned by the
// MA-0010 prone family (e.g. ma1595-tiger-rend-prone).
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
const GALEB = monsters.find((m) => m.name === 'Galeb Duhr');
const SLAM = GALEB.actions.find((a) => a.name === 'Avalanche Slam');

const CREATURES = [
  { name: 'Galeb Duhr 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderSlam(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Galeb Duhr', actions: GALEB.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Galeb Duhr 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Galeb Duhr 1' })} />);
}

function hitPopupHtml() {
  return {
    type: 'd20', rollType: 'attack', name: 'Avalanche Slam', rolls: [16], bonus: 8,
    targetName: 'Bandit 1', targetAc: 12, hit: true,
    autoDamage: { name: 'Avalanche Slam', formula: '2d6 + 5', damageType: 'Bludgeoning', source: 'Galeb Duhr 1' },
    chargeBonusOffer: buildChargeBonusOffer(SLAM, 'Avalanche Slam'),
  };
}

function clickChip(text) {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Avalanche Slam/.test(a.textContent.trim()));
  expect(row, 'Expected Avalanche Slam action row').toBeTruthy();
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === text);
  expect(chip, `Expected Avalanche Slam ${text} dice link`).toBeTruthy();
  fireEvent.click(chip);
}

function clickPopupButton(text) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text);
  expect(btn, `Expected ${text} popup button`).toBeTruthy();
  fireEvent.click(btn);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0756 Galeb Duhr Avalanche Slam row bytes (#387)', () => {
  it('authors the two fixed fields: hit_conditions ["prone"] + conditional_damage 2d6 Bludgeoning', () => {
    expect(SLAM.attack_bonus).toBe(8);
    expect(SLAM.hit_conditions).toEqual(['prone']);
    expect(SLAM.conditional_damage).toMatchObject({
      dice: '2d6',
      damage_type: 'Bludgeoning',
      condition: expect.stringMatching(/moved 20\+ feet straight toward/i),
    });
  });
});

describe('MA-0756 Avalanche Slam attack-ctx seam', () => {
  it('chip click forwards both riders: charge offer (formula "2d6", modifier 0) + prone hit clause', () => {
    renderSlam();
    clickChip('+8');
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toMatchObject({ dice: '2d6', modifier: 0, damageType: 'Bludgeoning', formula: '2d6', attackName: 'Avalanche Slam' });
    expect(ctx.hitClause).toMatchObject({ conditions: ['prone'], escapeDc: null, attackName: 'Avalanche Slam' });
  });
});

describe('MA-0756 HIT popup resolve faces', () => {
  it('grants: rolls the row\'s formula "2d6" once as its own damage roll and logs the clause', async () => {
    renderSlam(hitPopupHtml());
    clickPopupButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('2d6');
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('Bludgeoning (2d6)');
  });

  it('declines: rolls nothing, logs base-only, marks resolved', async () => {
    renderSlam(hitPopupHtml());
    clickPopupButton('charge-decline');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('declined');
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(findLogEntry('conditional_damage_declined')).toBeTruthy();
  });
});
