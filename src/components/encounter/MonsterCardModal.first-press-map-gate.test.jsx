// @maintained-by-ai
// Lock for the 2026-11-20 CCC backlog improvement "Modal first-press mapData
// race": MonsterCardModal fetches the active map async on mount and the attack
// chip's commit path (handleAttack → resolvePressSpatialState →
// computeMapRangeState) measures range/cover from that snapshot. Pre-fix a
// press inside the fetch window measured gridless and escaped as a plain-NORMAL
// roll (CCC watched a 35-ft Shortbow shot read NORMAL, then correctly
// disadvantaged 1.2 s later). These legs pin:
//   • mount WITH mapName ⇒ the fetch is tracked pending from the first render —
//     the attack chip renders disabled + aria-busy and a press commits NOTHING
//     (zero roll, zero log row, zero runtime write, zero popup);
//   • fetch RESOLVE ⇒ the same chip re-enables and the next press carries the
//     measured range band immediately (rangeForcedMode/rangeReason on options);
//   • NO mapName ⇒ no fetch is awaited, the chip is never disabled and the
//     first press rolls synchronously;
//   • fetch REJECT settles to enabled (no permanently-dead modal);
//   • a pending-OA press stays trigger-lenient while the fetch is pending
//     (OA_TRIGGER_SPATIAL_STATE law — the gate is scoped to spatial MEASURE).
// Harness mirrors MonsterCardModal.opportunityAttack.test.jsx.

import { render, fireEvent, waitFor, act } from '@testing-library/react';
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

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _attackerReturn = { name: 'Goblin', conditions: [], targetName: 'Player A' };
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

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve(null)),
}));

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
  const mockGetRuntimeValue = vi.fn(() => null);
  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    deleteRuntimeKey: vi.fn(),
    __setPendingOas(val) { _pendingOas = val; },
  };
});

vi.mock('../../services/combat/pendingOpportunityAttacks.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, clearPendingOa: vi.fn(() => true) };
});

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as rangeValidation from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { addEntry } from '../../services/ui/logService.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;
const loadMapData = mapsService.loadMapData;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SHORTBOW = {
  name: 'Shortbow',
  attack_bonus: 4,
  range: '30/120 ft.',
  description: 'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 1d6 + 2 piercing damage.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Piercing',
};

const SCIMITAR = {
  name: 'Scimitar',
  attack_bonus: 4,
  reach: '5 ft.',
  description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Slashing',
};

function goblinProps(overrides = {}) {
  const monster = makeMonster({
    actions: [overrides.rangedAction ? SHORTBOW : SCIMITAR],
    reactions: [],
  });
  return makeProps(monster, {
    creatures: [
      { name: 'Goblin', conditions: [], targetName: 'Player A' },
      { name: 'Player A', type: 'player', currentHp: 9 },
    ],
    characters: [{ name: 'Player A' }],
    ...overrides,
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function attackChip() {
  return document.querySelector('.mc-dice-link[data-kind="attack"]');
}

// Token geometry: Goblin at (5,5), Player A at (5,12) — the CCC sandbox-rig
// 35-ft Shortbow scene (EUCLIDEAN×5 law measured by the mocked range lane).
const POSITIONED_MAP = {
  players: [{ name: 'Player A', gridX: 5, gridY: 12 }],
  placedItems: [{ name: 'Goblin', type: 'npc', gridX: 5, gridY: 5 }],
};

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.__setPendingOas(null);
  loadMapData.mockResolvedValue(null);
  rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal', reason: '' });
  rangeValidation.getDistanceFeet.mockReturnValue(null);
});

// ── Criterion 1: pending fetch ⇒ disabled busy chip, press commits nothing ──

describe('MonsterCardModal — first-press map-measure gate', () => {
  it('mounts with mapName: fetch tracked pending from the first render — chip aria-busy/disabled and a press rolls/logs/writes NOTHING', () => {
    const map = deferred();
    loadMapData.mockReturnValue(map.promise);

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena', rangedAction: true })} />);
    expect(loadMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena');

    const chip = attackChip();
    expect(chip, 'attack chip stays present while the map fetch is pending').toBeTruthy();
    expect(chip.getAttribute('aria-busy')).toBe('true');
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('+4');

    fireEvent.click(chip);
    expect(rollAttack).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  // ── Criterion 2: resolve settles to enabled; same 35-ft press measures now ─

  it('resolves the fetch: the same chip re-enables and the next press carries the measured range band', async () => {
    const map = deferred();
    loadMapData.mockReturnValue(map.promise);
    rangeValidation.getDistanceFeet.mockReturnValue(35);
    rangeValidation.computeRangeEffect.mockReturnValue({
      mode: 'disadvantage',
      reason: 'Beyond normal range (35 ft > 30 ft)',
    });

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena', rangedAction: true })} />);
    await act(async () => { map.resolve(POSITIONED_MAP); await Promise.resolve(); });

    const chip = attackChip();
    expect(chip.hasAttribute('aria-busy')).toBe(false);
    expect(chip.className).toBe('mc-dice-link');

    fireEvent.click(chip);
    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const options = rollAttack.mock.calls[0][2];
    // The band folds onto the rolled mode (resolveForcedMode precedence — same
    // wire shape MonsterCardModal.attack-advanced.test.jsx pins) and names its
    // reason: the 35-ft shot can no longer escape plain-NORMAL.
    expect(options.forcedMode).toBe('disadvantage');
    expect(options.rangeReason).toBe('Beyond normal range (35 ft > 30 ft)');
  });

  // ── Criterion 3: no active map ⇒ nothing disabled, nothing awaited ────────

  it('mounts WITHOUT mapName: no fetch is awaited, the chip is never disabled and the first press rolls', () => {
    render(<MonsterCardModal {...goblinProps()} />);
    expect(loadMapData).not.toHaveBeenCalled();

    const chip = attackChip();
    expect(chip.hasAttribute('aria-busy')).toBe(false);
    expect(chip.className).toBe('mc-dice-link');

    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
  });

  // ── Criterion 4: a rejecting fetch settles to enabled ─────────────────────

  it('rejected fetch settles to enabled — the modal is never permanently dead', async () => {
    const map = deferred();
    loadMapData.mockReturnValue(map.promise);

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena' })} />);
    expect(attackChip().getAttribute('aria-busy')).toBe('true');

    await act(async () => { map.reject(new Error('network down')); await Promise.resolve(); });

    const chip = attackChip();
    expect(chip.hasAttribute('aria-busy')).toBe(false);
    expect(chip.className).toBe('mc-dice-link');

    fireEvent.click(chip);
    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
  });

  // ── OA leniency: the gate is scoped to spatial MEASURE, not the marker ────

  it('pending-OA press stays trigger-lenient while the fetch is pending (OA_TRIGGER_SPATIAL_STATE law)', async () => {
    const map = deferred();
    loadMapData.mockReturnValue(map.promise);
    rangeValidation.getDistanceFeet.mockReturnValue(10);
    rangeValidation.computeRangeEffect.mockReturnValue({
      mode: 'miss',
      reason: 'Target out of melee range (10 ft > 5 ft)',
    });
    useRuntimeState.__setPendingOas({
      Goblin: { defender: 'Goblin', mover: 'Player A', promptId: 'p-1' },
    });

    render(<MonsterCardModal {...goblinProps({ mapName: 'battle-arena' })} />);
    // The ordinary attack chip IS gated during the pending window…
    expect(attackChip().getAttribute('aria-busy')).toBe('true');
    // …but the Reactions-area OA affordance resolves on trigger-time truth.
    await flush(); // OA row renders on the live-marker hook's own async seam
    const oaChip = document.querySelector('.mc-dice-link[data-kind="oa"]');
    expect(oaChip, 'pending-OA affordance renders while the marker is live').toBeTruthy();
    expect(oaChip.hasAttribute('aria-busy')).toBe(false);

    fireEvent.click(oaChip);
    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const options = rollAttack.mock.calls[0][2];
    expect(options.isAutoMiss).toBe(false);
    expect(options.rangeReason).toBeNull();
    map.resolve(null); // drain the dangling fetch (no settle assertion needed)
  });
});
