// @maintained-by-ai
// bug-speedy-oa-disadvantage-inert — monster-card lane: the pending-trigger
// OA press consulted NOTHING about the marked mover's passives, so an OA
// against a 2024 Speedy holder (Agile Movement: "Opportunity Attacks have
// Disadvantage against you") rolled silent mode:'normal'. Fix mirrors the
// sibling defender-passive folds of the buildTargetEffectData chain
// (applyElusive / applyDodgePenalty): applySpeedyOaPenalty resolves the
// mover's DERIVED stats through the characters list (cs rows carry no
// `automation`) and folds +1 target-side disadvantage — which the REAL
// combineAttackModes nets into mode:'disadvantage' on the roll options.
// Pins: the OA press carries forcedMode + the Agile Movement attribution
// (single-string chip channel AND reasons list) and writes a
// speedy_opportunity_disadvantage ledger row; a NORMAL chip press and an
// OA press vs a non-holder stay byte-identical (no fold, no reason, no row).
// Marker math / consume / pin legs live in
// MonsterCardModal.opportunityAttack.test.jsx (untouched).
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';


// ── Mocks (mirrors MonsterCardModal.opportunityAttack.test.jsx harness) ─────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

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

// REAL combineAttackModes (the count→mode net is the whole point of the
// Speedy fold) — only the heavy condition/te census is stubbed.
vi.mock('../../services/combat/conditions/conditionEffects.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _attackerReturn = { name: 'Goblin', conditions: [] };
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _attackerReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setAttackerReturn(val) { _attackerReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (!range) return null;
    const m = String(range).match(/^(\d+)/);
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
  let _pendingOas = null;
  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'pendingOAs') return _pendingOas;
    return null;
  });
  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    deleteRuntimeKey: vi.fn(),
    __setPendingOas(val) { _pendingOas = val; },
  };
});

// Real pure ladders (findMeleeAttackRow/isPendingOaLive/buildOaResolutionLog
// AND the speedy attribution builders); the bucket WRITE is spied.
vi.mock('../../services/combat/pendingOpportunityAttacks.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, clearPendingOa: vi.fn(() => true) };
});

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

const SCIMITAR = {
  name: 'Scimitar',
  attack_bonus: 4,
  reach: '5 ft.',
  description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Slashing',
};

const SPEEDY_CHARACTER = {
  name: 'Player A',
  computedStats: {
    automation: { passives: [{ type: 'passive_rule', effect: 'opportunity_attacks_disadvantage', name: 'Agile Movement' }] },
  },
};

function armMarker() {
  useRuntimeState.__setPendingOas({
    Goblin: { defender: 'Goblin', mover: 'Player A', promptId: 'p-speedy-1' },
  });
}

function renderCard(characters = [SPEEDY_CHARACTER]) {
  const m = makeMonster({ actions: [SCIMITAR] });
  render(<MonsterCardModal {...makeProps(m, {
    creatures: [
      { name: 'Goblin', conditions: [], targetName: null },
      { name: 'Player A', type: 'player', currentHp: 9 },
    ],
    characters,
  })} />);
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

function clickByDataKind(kind) {
  const el = document.querySelector(`.mc-dice-link[data-kind="${kind}"]`);
  expect(el, `expected a clickable chip with data-kind="${kind}"`).toBeTruthy();
  fireEvent.click(el);
}

function speedyRows() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.automationType === 'speedy_opportunity_disadvantage');
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.__setPendingOas(null);
});

describe('Pending-OA press vs a Speedy mover (monster card)', () => {
  it('folds Agile Movement into forced Disadvantage with attribution on chip + reasons list (was: silent mode:normal)', async () => {
    armMarker();
    renderCard();
    await flush();

    clickByDataKind('oa');
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const options = rollAttack.mock.calls[0][2];
    expect(options.targetName).toBe('Player A');
    expect(options.forcedMode).toBe('disadvantage');
    expect(options.advantageReason).toContain('Player A has Agile Movement (Speedy)');
    expect(options.disadvantageReasons).toEqual([
      'Player A has Agile Movement (Speedy) — opportunity attacks against them have Disadvantage',
    ]);
    // Reaction-lane + one-charge law untouched.
    expect(options.isOpportunityAttack).toBe(true);
  });

  it('writes the speedy_opportunity_disadvantage ledger row naming the monster, action and mover', async () => {
    armMarker();
    renderCard();
    await flush();

    clickByDataKind('oa');
    await flush();

    const rows = speedyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      type: 'automation',
      automationType: 'speedy_opportunity_disadvantage',
      creatureName: 'Goblin',
      characterName: 'Goblin',
      name: 'Scimitar',
      targetName: 'Player A',
    }));
    expect(rows[0].description).toContain('Goblin has Disadvantage on Scimitar');
    expect(rows[0].description).toContain('Player A has Agile Movement (Speedy)');
  });

  it('OA press vs a NON-holder ⇒ options byte-identical: no forcedMode, no reasons, no row', async () => {
    armMarker();
    renderCard([{ name: 'Player A', computedStats: { automation: { passives: [] } } }]);
    await flush();

    clickByDataKind('oa');
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const options = rollAttack.mock.calls[0][2];
    expect(options.forcedMode).toBeUndefined();
    expect(options.advantageReason).toBeNull();
    expect(options.disadvantageReasons).toEqual([]);
    expect(speedyRows()).toHaveLength(0);
  });

  it('REGRESSION PIN: a NORMAL chip press vs the same Speedy mover is never disadvantaged (Speedy bites OA only)', async () => {
    renderCard();
    await flush();

    clickByDataKind('attack');
    await flush();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const options = rollAttack.mock.calls[0][2];
    expect(options.forcedMode).toBeUndefined();
    expect(options.advantageReason).toBeNull();
    expect(options.disadvantageReasons).toEqual([]);
    expect('isOpportunityAttack' in options).toBe(false);
    expect(speedyRows()).toHaveLength(0);
  });
});
