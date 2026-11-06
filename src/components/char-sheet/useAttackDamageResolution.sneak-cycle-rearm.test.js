// @maintained-by-ai
// Regression ledger — sneak-cycle degradation (bug-sheet-nick-mastery-hit-
// drops-damage-stage). Pipeline seam of "cycle 2 after a completed cycle 1
// in the same tab load": the Devious Strikes chooser must be offered again
// on the next-round hit (the once-per-turn stamps are round-scoped, not
// load-scoped) and the damage stage must dispatch with the sneak pool every
// cycle. Second contract pinned here: the `_SneakAttack_usedRound` latch is
// stamped only when sneak dice were actually dealt — a sneak-less hit (latch
// already consumed this round → 0 dice) still lands its base damage and
// leaves the latch untouched.
//
// Lane map (do not duplicate here):
// - Resume damage math / cost subtraction → useAttackDamageResolution.cunningStrikeResume.test.js
// - Sneak step dice/clamp/reset → steps/attackRollDamageSteps-damageRolling.test.js
// - Step pause/offer suppression → steps/attackRollRiders.test.js
// - UI chooser mount under the leaked spell-channel close →
//   CharActionModals.sneak-chooser-rearm.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deterministic dice table (mirrors cunningStrikeResume.test.js): every d6
// rolls (sides/2)+1 = 4 — exact pinnable arithmetic, no Math.random.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula) return null;
    const base = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    const match = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      return { total: rolls.reduce((s, r) => s + r, 0) + modStr, rolls, modifier: modStr };
    }
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn((_formula) => ({ total: 12, rolls: [6, 6], modifier: 0 })),
  rollExpressionMaximized: vi.fn((_formula) => ({ total: 12, rolls: [6], modifier: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, creatures: [{ name: 'Animated Rug of Smothering 1' }] })),
  getTargetFromAttacker: vi.fn(() => ({ name: 'Animated Rug of Smothering 1' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ round: 1, lastAttack: { hit: true } })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 10 })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
  executeAttackRiderManeuver: vi.fn(),
  applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));

vi.mock('../../services/automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

vi.mock('../../services/combat/steps/features/index.js', () => ({
  featureModules: [],
}));

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 3),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'p1', promise: Promise.resolve({ success: true }) })),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

import useAttackDamageResolution from './useAttackDamageResolution.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const TARGET = 'Animated Rug of Smothering 1';
const CHAR = 'AasimarTest';

const attack = {
  name: 'Shortsword',
  damage: '1d6+2',
  damageType: 'Piercing',
  weaponType: 'weapon',
  properties: ['Finesse', 'Light'],
  type: 'Action',
};

const playerStats = {
  name: CHAR,
  level: 14,
  proficiency: 5,
  abilities: [{ name: 'Dexterity', bonus: 5 }],
  automation: { actions: [], passives: [{ name: 'Devious Strikes', type: 'attack_rider' }] },
};

function setup(values = {}, round = 1) {
  getRuntimeValue.mockImplementation((key, prop) => values[prop] ?? null);
  setRuntimeValue.mockReturnValue(Promise.resolve());
  getCurrentCombatRound.mockReturnValue(round);
}

function makeDeps(resumeRef, ctx) {
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: TARGET },
    setPopupHtml: vi.fn(),
    rollDamage: vi.fn(),
    buildCtx: vi.fn(() => Promise.resolve(ctx)),
    buildCtxSync: vi.fn(() => Promise.resolve(ctx)),
    setModalState: vi.fn(),
    setPendingDamage: vi.fn(),
    resumeRef,
  };
}

describe('useAttackDamageResolution — cycle-2 sneak hit re-arms chooser + damage (sneak-cycle degradation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('after a completed cycle 1, a round-2 hit offers the chooser again and dispatches the sneak damage stage exactly once', async () => {
    const resumeRef = { current: null };

    // ── Cycle 1 (round 1): fresh latch state, chooser offered, resume lands damage.
    const c1 = { sneakAttackDice: 7, targetName: TARGET };
    setup({ lastAttack: { hit: true } }, 1);
    const deps1 = makeDeps(resumeRef, c1);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps1);

    await resolveAttackDamage(attack, { hit: true, targetName: TARGET });
    expect(resumeRef.current?._pausedStep).toBe('cunningStrike');
    expect(deps1.setModalState).toHaveBeenCalledWith(expect.objectContaining({
      attackRiderModal: expect.objectContaining({ targetName: TARGET }),
    }));
    await resumeAttackPipeline();
    expect(deps1.rollDamage).toHaveBeenCalledTimes(1);
    expect(resumeRef.current).toBeNull();

    // ── Cycle 2 (round 2, same tab load): round-scoped latches stamped in
    // round 1 must NOT suppress the offer on the next round's sneak hit.
    setup({
      lastAttack: { hit: true },
      _CunningStrike_usedRound: { round: 1, activeCreature: CHAR },
      _SneakAttack_usedRound: 1,
    }, 2);
    const c2 = { sneakAttackDice: 7, targetName: TARGET };
    const deps2 = makeDeps(resumeRef, c2);
    const cycle2 = useAttackDamageResolution(deps2);

    await cycle2.resolveAttackDamage(attack, { hit: true, targetName: TARGET });
    expect(resumeRef.current?._pausedStep).toBe('cunningStrike');
    expect(deps2.setModalState).toHaveBeenCalledWith(expect.objectContaining({
      attackRiderModal: expect.objectContaining({ targetName: TARGET }),
    }));

    await cycle2.resumeAttackPipeline();
    expect(deps2.rollDamage).toHaveBeenCalledTimes(1);
    const payload = deps2.rollDamage.mock.calls[0][0];
    expect(payload.formula).toBe('1d6+2 [piercing] + 7d6 [Sneak Attack]');
    expect(payload.total).toBe(34);
    // Latch re-stamped with the NEW round (round pinned via mock).
    expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, '_SneakAttack_usedRound', 2, 'test-campaign');
    expect(resumeRef.current).toBeNull();
  });

  it('a sneak-less hit (latch consumed this round → 0 dice) still dispatches base damage and does NOT stamp the sneak latch', async () => {
    const resumeRef = { current: null };
    setup({ lastAttack: { hit: true }, _SneakAttack_usedRound: 1 }, 1);
    const deps = makeDeps(resumeRef, { sneakAttackDice: 0, targetName: TARGET });
    const { resolveAttackDamage } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: TARGET });

    // No sneak dice → chooser is not offered; pipeline flows through unpaused.
    expect(deps.setModalState).not.toHaveBeenCalledWith(expect.objectContaining({
      attackRiderModal: expect.anything(),
    }));
    expect(resumeRef.current).toBeNull();

    // Damage stage still dispatches — at base dice only.
    const payload = deps.rollDamage.mock.calls[0]?.[0];
    expect(payload.formula).toBe('1d6+2 [piercing]');
    expect(payload.total).toBe(6);
    // Latch honesty: no sneak dice dealt → no _SneakAttack_usedRound stamp.
    expect(setRuntimeValue).not.toHaveBeenCalledWith(CHAR, '_SneakAttack_usedRound', 1, 'test-campaign');
  });
});
