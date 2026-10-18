// @maintained-by-ai
// Cunning Strike (Rogue 2024) resume-after-choice seam — CLA-188: a hit with
// sneak dice available pauses the REAL pipeline at _pausedStep:'cunningStrike'
// (the modal is opened by the step via setAttackRiderModal; the hook must hold
// all damage back). resumeAttackPipeline (fired when the modal closes) must run
// the stashed pipeline so weapon + Sneak Attack damage lands EXACTLY once,
// minus dice spent via _cunningStrikeCostUsed, with bookkeeping writes pinned.
//
// Lane ownership (do not duplicate here):
// - Step-level pause trigger/modal/once-per-turn suppression → steps/attackRollRiders.test.js
// - Sneak dice subtraction/clamp/reset formula → steps/attackRollDamageSteps-damageRolling.test.js
// - Modal close invoking resumeAttackPipeline → CharActionModals.cunningStrike-resume.test.jsx
// - resumeAttackPipeline guard no-ops for non-approved pauses → useAttackDamageResolution.tacticalMaster.test.js
//   (damageTypeChoice) and .shieldBashResume.test.js (featureRiders, asserts pipeline.resume not called)
// - Other modal-type pause dispatch → useAttackDamageResolution.pausedStates.test.js
// No game-state timers: the pause waits indefinitely for the player's choice;
// resume is user-triggered only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Key-based deterministic dice table: every d6 rolls (sides/2)+1 = 4, so
// formula → total arithmetic is exact and pinnable (no Math.random anywhere).
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

function setup(values = {}) {
  getRuntimeValue.mockImplementation((key, prop) => values[prop] ?? null);
  setRuntimeValue.mockReturnValue(Promise.resolve());
}

function makeDeps(resumeRef) {
  const ctx = { sneakAttackDice: 7, targetName: TARGET };
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

describe('useAttackDamageResolution — Cunning Strike pipeline resume (CLA-188)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      choice: 'spent 2d6 Sneak Attack on Cunning Strike options',
      cunningStrikeCostUsed: 2,
      expectedFormula: '1d6+2 [piercing] + 5d6 [Sneak Attack]',
      expectedTotal: 26,
    },
    {
      choice: 'closed the modal without spending any Sneak Attack dice',
      cunningStrikeCostUsed: 0,
      expectedFormula: '1d6+2 [piercing] + 7d6 [Sneak Attack]',
      expectedTotal: 34,
    },
  ])('resumes after the player $choice: weapon + Sneak damage lands exactly once with exact payload', async ({ cunningStrikeCostUsed, expectedFormula, expectedTotal }) => {
    setup({ lastAttack: { hit: true }, _cunningStrikeCostUsed: cunningStrikeCostUsed });
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: TARGET });

    // Pause: step opens the modal, hook holds ALL damage back until the choice.
    expect(resumeRef.current?._pausedStep).toBe('cunningStrike');
    expect(resumeRef.current?._modalType).toBe('cunningStrike');
    expect(deps.setModalState).toHaveBeenCalledWith(expect.objectContaining({
      attackRiderModal: expect.objectContaining({ targetName: TARGET, campaignName: 'test-campaign' }),
    }));
    expect(deps.rollDamage).not.toHaveBeenCalled();
    // Cunning Strike pauses without a pendingDamage stash (unlike damageTypeChoice).
    expect(deps.setPendingDamage).not.toHaveBeenCalled();

    // Choice recorded → resume. A stray second resume must not double-apply.
    await resumeAttackPipeline();
    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    const payload = deps.rollDamage.mock.calls[0][0];
    expect(payload.name).toBe('Shortsword');
    expect(payload.formula).toBe(expectedFormula);
    expect(payload.total).toBe(expectedTotal);
    expect(payload.modifier).toBe(2);
    expect(payload.context.targetName).toBe(TARGET);

    // Bookkeeping: sneak marked used this round (round pinned to mocked 1);
    // the cost accumulator is reset only when dice were actually spent.
    expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, '_SneakAttack_usedRound', 1, 'test-campaign');
    if (cunningStrikeCostUsed > 0) {
      expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, '_cunningStrikeCostUsed', 0, 'test-campaign');
    } else {
      expect(setRuntimeValue).not.toHaveBeenCalledWith(CHAR, '_cunningStrikeCostUsed', 0, 'test-campaign');
    }
    expect(resumeRef.current).toBeNull();
  });
});
