// @improved-by-ai
// MA-0756: Galeb Duhr Avalanche Slam — hit_conditions:["prone"] + conditional_damage
// authored on monsters.json actions[0] (MA-0010 prone family + MA-0007 charge-bonus
// seam) so the HIT popup offers the "extra 2d6 Bludgeoning" charge rider and the
// resolved hit grants Prone (Large-or-smaller gate lives in handlePlainDamage).
// Locks: data shape mirrors the Aarakocra Talons / Chimera Bite twins, offer builds
// with formula "2d6" (modifier 0), grant rolls 2d6 + logs, hit clause carries prone.
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
const GALEB = monsters.find((m) => m.index === 'galeb-duhr');
const SLAM = GALEB.actions.find((a) => a.name === 'Avalanche Slam');

const CREATURES = [
  { name: 'Galeb Duhr 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(SLAM, 'Avalanche Slam');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Avalanche Slam',
    rolls: [16],
    bonus: 8,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Avalanche Slam', formula: '2d6 + 5', damageType: 'Bludgeoning', source: 'Galeb Duhr 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderSlam(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Galeb Duhr', actions: GALEB.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Galeb Duhr 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Galeb Duhr 1' })} />);
}

function clickSlamLink() {
  const slamRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Avalanche Slam/.test(a.textContent.trim()));
  const chip = Array.from(slamRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+8');
  expect(chip, 'Expected Avalanche Slam +8 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0756 monsters.json data lock: Galeb Duhr Avalanche Slam hit riders', () => {
  it('authors hit_conditions ["prone"] mirroring the Brown Bear Claw / Chimera Ram byte-shape', () => {
    expect(SLAM.attack_bonus).toBe(8);
    expect(SLAM.damage_dice_primary).toBe('2d6 + 5');
    expect(SLAM.damage_type_primary).toBe('Bludgeoning');
    expect(SLAM.hit_conditions).toEqual(['prone']);
  });

  // MA-0757 (actions[1] rider, same monster block): the formerly inert
  // "Animate Boulders" row now authors monster_summon automation + NUMERIC
  // uses/maxUses (the ignored uses:"1/Day" STRING is gone). count:2 is a
  // numeric constant — RAW "one or two" is the duhr's choice and no chooser
  // seam exists, so the row adjudicates the max of two boulders.
  it('MA-0757: actions[1] Animate Boulders rides the monster_summon seam with numeric uses', () => {
    const animate = GALEB.actions.find((a) => a.name === 'Animate Boulders');
    expect(animate.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'galeb-duhr', stat_override: { int: 1, cha: 1 } }],
      count: 2,
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(animate.uses).toBe(1);
    expect(animate.maxUses).toBe(1);
    expect(typeof animate.uses).toBe('number');
    // MA-0759 (stale pin inverted): galib-duhr's twin row now rides the
    // same seam with the byte-shape mirrored from galeb-duhr — automation +
    // numeric uses/maxUses, OCR prose ("ofa"/"spel1") restamped readable.
    const galib = monsters.find((m) => m.index === 'galib-duhr').actions[1];
    expect(galib.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'galib-duhr', stat_override: { int: 1, cha: 1 } }],
      count: 2,
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(galib.uses).toBe(1);
    expect(galib.maxUses).toBe(1);
    expect(galib.description).toContain('of a galeb duhr');
    expect(galib.description).toContain('concentrating on a spell');
    expect(galib.description).not.toContain('ofa');
    expect(galib.description).not.toContain('spel1');
  });

  it('authors conditional_damage mirroring the MA-0007 sibling shape (no flat modifier)', () => {
    const cd = SLAM.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d6');
    expect(cd.damage_type).toBe('Bludgeoning');
    expect(cd.condition).toMatch(/moved 20\+ feet straight toward/i);
    const sibling = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0].conditional_damage;
    expect(Object.keys(cd).sort()).toEqual(Object.keys(sibling).filter((k) => k !== 'modifier').sort());
  });

  it('buildChargeBonusOffer builds the charge variant with formula "2d6" (modifier 0)', () => {
    const offer = buildChargeBonusOffer(SLAM, 'Avalanche Slam');
    expect(offer).toMatchObject({ dice: '2d6', modifier: 0, damageType: 'Bludgeoning', formula: '2d6', attackName: 'Avalanche Slam' });
  });

  it('buildHitConditionClause arms the prone hit clause', () => {
    const clause = buildHitConditionClause(SLAM);
    expect(clause).toMatchObject({ conditions: ['prone'], escapeDc: null, attackName: 'Avalanche Slam' });
  });
});

describe('MA-0756 Avalanche Slam HIT popup offer', () => {
  it('forwards the charge conditional offer to the attack roll context', () => {
    renderSlam();
    clickSlamLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d6', modifier: 0, damageType: 'Bludgeoning' });
  });

  it('grants: rolls 2d6, applies its own damage, logs the clause', async () => {
    renderSlam(hitPopupHtml());
    const grantBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant');
    fireEvent.click(grantBtn);
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d6');
    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('+7 Bludgeoning (2d6)');
  });
});
