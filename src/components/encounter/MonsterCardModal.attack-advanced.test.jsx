// @maintained-by-ai
// Trim pass (2026-10-18): keeps only modal-state seams unique to this lane.
//
// Removed:
//   "passes damage_type_primary as damageType to rollAttack"
//     → damage_type_primary → options.damageType transport through handleAttack /
//       buildAttackRollOptions (MonsterCardModal.jsx:2350 + :1386) is covered
//       end-to-end on this same modal lane by MonsterCardModal.scorching-ray.test.jsx:222-233.
//   "prevents advantage when target player has Elusive feature"
//     → vacuous here: this file mocks combineAttackModes to always return 'normal'
//       (the sole consumer of applyElusive's noAdvantageAgainst fold), so the
//       not.toBe('advantage') assertion could never fail. Covered with the REAL
//       combineAttackModes, advantage control, and Incapacitated exemption by
//       MonsterCardModal.elusive-cla119.test.jsx:180-212.
// Collapsed:
//   "sets isAutoMiss when computeRangeEffect returns mode 'miss'" +
//   "sets rangeForcedMode to 'disadvantage' when computeRangeEffect returns disadvantage mode"
//     → one it.each over identical setup, one case per RANGE_MODE_HANDLERS branch
//       (MonsterCardModal.jsx:1031-1056); strengthened with forcedMode/rangeReason
//       payload identity and the isAutoMiss → NO_COVER short-circuit (:1105).
// Kept (unique in the modal family):
//   Nature's Sanctuary cover it.each (list-member vs non-member),
//   Smite of Protection modal cover positive (other smite lanes are service/handler),
//   Psychic Strike hex-gate positive — asserts chip → rollAttack name/bonus identity.
// Cross-file note: MonsterCardModal.interaction.test.jsx:21-24 cites Psychic Strike
//   alert negatives at "attack-advanced.test.jsx:551-606" — those lines no longer
//   exist here (removed in an earlier pass); the owner should fix the citation or
//   restore the alert tests (psychicStrikePreconditionFailed, :941-953).

import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
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
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => {
  let _loadMapDataReturn = null;
  const loadMapData = vi.fn((_campaignName, _mapName) => Promise.resolve(_loadMapDataReturn));
  return {
    loadMapData,
    __setLoadMapDataReturn(val) { _loadMapDataReturn = val; },
  };
});

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
  handle: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _targetEffects = [];
  let _naturesSanctuaryCreatures = [];
  let _smiteOfProtectionActive = false;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'naturesSanctuaryCreatures') return _naturesSanctuaryCreatures;
    if (propertyName === 'smiteOfProtectionActive') return _smiteOfProtectionActive;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    __setTargetEffects(val) { _targetEffects = val; },
    __setNaturesSanctuaryCreatures(val) { _naturesSanctuaryCreatures = val; },
    __setSmiteOfProtectionActive(val) { _smiteOfProtectionActive = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as rangeValidation from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find the attack dice link by its exact text content and click it. */
function clickAttackLink(attackBonus) {
  const links = document.querySelectorAll('.mc-dice-link');
  const attackLink = Array.from(links).find(el => el.textContent.trim() === attackBonus);
  expect(attackLink, `Expected to find attack link with text "${attackBonus}"`).toBeTruthy();
  fireEvent.click(attackLink);
}

/** Reset all shared mock state used by attack handler tests. */
function resetAttackMocks() {
  vi.clearAllMocks();
  damageUtils.__setFindCreatureReturn(null);
  useRuntimeState.__setTargetEffects([]);
  useRuntimeState.__setNaturesSanctuaryCreatures([]);
  useRuntimeState.__setSmiteOfProtectionActive(false);
  mapsService.__setLoadMapDataReturn(null);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack: Nature\'s Sanctuary cover', () => {
  beforeEach(resetAttackMocks);

  it.each([
    { sanctuaryTargets: ['Player A'], expectedCoverAcBonus: 2, expectedCoverLevel: 'half', expectedCoverReason: 'Nature\'s Sanctuary', desc: 'target is in the sanctuary list' },
    { sanctuaryTargets: ['Player B'], expectedCoverAcBonus: 0, expectedCoverLevel: null, expectedCoverReason: null, desc: 'target is not in the sanctuary list' },
  ])('applies coverAcBonus=$expectedCoverAcBonus when $desc', ({ sanctuaryTargets, expectedCoverAcBonus, expectedCoverLevel, expectedCoverReason }) => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setNaturesSanctuaryCreatures(sanctuaryTargets);

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [{ name: 'Player A' }], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickAttackLink('+4');
    expect(rollAttack).toHaveBeenCalled();
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.coverAcBonus).toBe(expectedCoverAcBonus);
    expect(callArgs.coverLevel).toBe(expectedCoverLevel);
    expect(callArgs.coverReason).toBe(expectedCoverReason);
  });
});

describe('MonsterCardModal - handleAttack: Smite of Protection cover', () => {
  beforeEach(resetAttackMocks);

  it('applies +2 AC cover when Smite of Protection is active, paladin has Aura of Protection, and target is in aura range', async () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setSmiteOfProtectionActive(true);
    vi.mocked(rangeValidation.getDistanceFeet).mockReturnValue(5);
    mapsService.__setLoadMapDataReturn({
      players: [
        { name: 'Player A', gridX: 10, gridY: 10 },
        { name: 'Paladin', gridX: 11, gridY: 11 },
      ],
      placedItems: [{ name: 'Goblin', gridX: 0, gridY: 0 }],
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, {
      characters: [{ name: 'Player A', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }] } } }],
      creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }],
      mapName: 'test-map',
    })} />);

    // Flush the async map data load
    await act(async () => { await Promise.resolve(); });

    clickAttackLink('+4');
    expect(rollAttack).toHaveBeenCalled();
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.coverAcBonus).toBe(2);
    expect(callArgs.coverLevel).toBe('half');
    expect(callArgs.coverReason).toBe('Smite of Protection');
  });
});

describe('MonsterCardModal - handleAttack: range effects with map data', () => {
  beforeEach(() => {
    resetAttackMocks();
    mapsService.__setLoadMapDataReturn(null);
  });

  it.each([
    { mode: 'miss', reason: 'Out of range', distanceFt: 100, expectedAutoMiss: true, expectedForcedMode: undefined, desc: 'mode "miss" auto-misses with no cover' },
    { mode: 'disadvantage', reason: 'Long range', distanceFt: 60, expectedAutoMiss: false, expectedForcedMode: 'disadvantage', desc: 'mode "disadvantage" forces disadvantage' },
  ])('$desc', async ({ mode, reason, distanceFt, expectedAutoMiss, expectedForcedMode }) => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    vi.mocked(rangeValidation.computeRangeEffect).mockReturnValue({ mode, reason });
    vi.mocked(rangeValidation.getDistanceFeet).mockReturnValue(distanceFt);
    mapsService.__setLoadMapDataReturn({
      players: [{ name: 'Player A', gridX: 10, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 0, gridY: 0 }],
    });

    const m = makeMonster({
      actions: [{ name: 'Fire Bolt', attack_bonus: 4, description: 'Ranged Attack.', range: '120 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, {
      creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }],
      mapName: 'test-map',
    })} />);

    // Flush the async map data load
    await act(async () => { await Promise.resolve(); });

    clickAttackLink('+4');
    expect(rollAttack).toHaveBeenCalled();
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.isAutoMiss).toBe(expectedAutoMiss);
    expect(callArgs.rangeReason).toBe(reason);
    expect(callArgs.forcedMode).toBe(expectedForcedMode);
    // Auto-miss short-circuits cover (NO_COVER); non-miss vs empty characters list is also NO_COVER.
    expect(callArgs.coverAcBonus).toBe(0);
    expect(callArgs.coverLevel).toBeNull();
    expect(callArgs.coverReason).toBeNull();
  });
});

describe('MonsterCardModal - handleAttack: Psychic Strike validation', () => {
  beforeEach(resetAttackMocks);

  it('proceeds with attack when target has hex effect applied', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setTargetEffects([
      { target: 'Player A', effect: 'hex_ability_check_disadvantage' }
    ]);

    const m = makeMonster({
      actions: [{ name: 'Psychic Strike', attack_bonus: 4, description: 'Psychic attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickAttackLink('+4');
    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [rollName, rollBonus] = rollAttack.mock.calls[0];
    expect(rollName).toBe('Psychic Strike');
    expect(rollBonus).toBe(4);
  });
});
