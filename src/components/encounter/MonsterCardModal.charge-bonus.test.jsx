// @maintained-by-ai
// MA-0007 conditional_damage modal lane — canonical owner of resolveChargeBonus
// (MonsterCardModal.jsx:2676-2704) and the click→ctx offer forward (:1407).
// Trim pass (2026-10-18): one branch, once.
//
// Collapsed (it.each per seam, shared render):
//   Click→ctx identity: helper-metadata + offer/null forwards → one it.each
//     asserting full offer object (all 7 buildChargeBonusOffer keys,
//     MonsterCardHelpers.js:687-703) vs null on arg[2] of rollAttack (:2400,
//     #580 vacuous-arg class). Direct-helper suite removed — same :689 null
//     branch, byte-label owners are the disk-row family (ma1566 :227-239,
//     ma1564 :207-222 BY-name #387).
//   Grant: hit + crit faces → one it.each pinning the wasCrit roller fold
//     (:2683), rollDamage bytes, grant-log description (+9 / +15 totals),
//     resolved:'granted', autoDamage preserved so base Done still applies.
//   Inert guards: !offer + already-resolved → one it.each on :2678; the
//     guard is the first statement of the async body so negatives assert
//     synchronously — no setTimeout flushes (no-timers 🔴).
//
// Removed mocks: rollD20 (never called — rollAttack is mocked), hook members
// rollAbilityCheck/rollSavingThrow/rollSkillCheck/rollInitiative/
// quickRollPlayerSave (destructured at :2211, never fired on this lane —
// attack-logic baseline :49-60 proves the minimal shape renders).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

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

// Exact buildChargeBonusOffer(TALONS_ACTION, 'Talons') output — full identity.
const TALONS_OFFER = {
  dice: '3d4',
  modifier: 2,
  damageType: 'Slashing',
  condition: 'moved 30+ feet straight toward target immediately before the hit',
  formula: '3d4 + 2',
  label: '30+ ft Charge: +3d4+2 Slashing?',
  attackName: 'Talons',
};

const CREATURES = [
  { name: 'Aarakocra Skirmisher 1', targetName: 'AasimarTest' },
  { name: 'AasimarTest', type: 'player' },
];

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 9, rolls: [3], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 15, rolls: [3, 3], modifier: 2, formula })),
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
  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
    })),
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
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

// Stub the popup (offer gating on misses is owned by
// char-sheet/DiceRollResult.charge-bonus.test.jsx) so the modal's
// resolveChargeBonus handler is driven directly through its real wiring.
vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => (
    <div data-testid="popup-stub">
      <button onClick={() => props.onChargeBonus?.()}>charge-grant</button>
      <button onClick={() => props.onChargeBonusDecline?.()}>charge-decline</button>
    </div>
  ),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

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

function renderMonsterModal(action, popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Aarakocra Skirmisher', actions: [action] });
  damageUtils.__setFindCreatureReturn({ name: 'Aarakocra Skirmisher 1', targetName: 'AasimarTest', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Aarakocra Skirmisher 1' })} />);
}

function clickChip(bonus = '+4') {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === bonus);
  expect(link, `Expected ${bonus} dice link`).toBeTruthy();
  fireEvent.click(link);
}

function clickPopupButton(label) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label);
  expect(btn, `Expected ${label} button`).toBeTruthy();
  fireEvent.click(btn);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0007 click→rollAttack ctx forward (MonsterCardModal.jsx:1407)', () => {
  it.each([
    {
      face: 'conditional_damage row forwards the full offer on rollAttack arg[2]',
      action: TALONS_ACTION,
      expected: TALONS_OFFER,
    },
    {
      face: 'action without the clause forwards null (Helpers:689)',
      action: { name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' },
      expected: null,
    },
  ])('$face', ({ action, expected }) => {
    renderMonsterModal(action);
    clickChip();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toEqual(expected);
  });
});

describe('MA-0007 grant via HIT popup (MonsterCardModal.jsx:2676-2704)', () => {
  it.each([
    { face: 'hit', popup: {}, roller: rollExpression, notRoller: rollExpressionDoubled, total: '+9', isAutoCrit: false },
    { face: 'crit', popup: { isCrit: true }, roller: rollExpressionDoubled, notRoller: rollExpression, total: '+15', isAutoCrit: true },
  ])('on a $face: rolls the clause dice once as its own damage roll, logs the clause, marks resolved, keeps base autoDamage', async ({ popup, roller, notRoller, total, isAutoCrit }) => {
    renderMonsterModal(TALONS_ACTION, hitPopupHtml(popup));
    clickPopupButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(roller).toHaveBeenCalledWith('3d4 + 2');
    expect(notRoller).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.name).toBe('Talons — Charge Bonus');
    expect(call.formula).toBe('3d4 + 2');
    expect(call.context).toMatchObject({ damageType: 'Slashing', targetName: 'AasimarTest', attackerName: 'Aarakocra Skirmisher 1', isAutoCrit });
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant.description).toContain(`${total} Slashing (3d4 + 2)`);
    expect(grant.description).toContain('moved 30+ feet straight toward target');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage).toBeTruthy();
  });

  it('on a decline: no charge roll, logs base-only, marks resolved', async () => {
    renderMonsterModal(TALONS_ACTION, hitPopupHtml());
    clickPopupButton('charge-decline');
    await vi.waitFor(() => {
      expect(addEntry).toHaveBeenCalled();
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    const decline = findLogEntry('conditional_damage_declined');
    expect(decline.description).toContain('Talons charge bonus declined');
    expect(decline.description).toContain('base damage only');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('declined');
    });
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage).toBeTruthy();
  });

  it.each([
    { face: 'a resolved decision', popup: { chargeBonusResolved: 'granted' } },
    { face: 'a popup with no offer', popup: { chargeBonusOffer: null } },
  ])('$face cannot fire the grant (:2678 guard)', ({ popup }) => {
    renderMonsterModal(TALONS_ACTION, hitPopupHtml(popup));
    clickPopupButton('charge-grant');
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
