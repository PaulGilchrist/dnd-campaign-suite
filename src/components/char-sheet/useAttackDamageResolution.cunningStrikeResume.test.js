// @improved-by-ai
// Regression tests for CLA-188: Cunning Strike pipeline pause must resume on modal close
// and apply weapon + Sneak Attack damage (minus dice spent on Cunning Strike options).
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const attack = {
  name: 'Shortsword',
  damage: '1d6+2',
  damageType: 'Piercing',
  weaponType: 'weapon',
  properties: ['Finesse', 'Light'],
  type: 'Action',
};

const playerStats = {
  name: 'AasimarTest',
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
  const modalState = {};
  return {
    deps: {
      playerStats,
      campaignName: 'test-campaign',
      mapName: null,
      popupHtml: { hit: true, targetName: 'Animated Rug of Smothering 1' },
      setPopupHtml: vi.fn(),
      rollDamage: vi.fn(),
      buildCtx: vi.fn(() => Promise.resolve({ sneakAttackDice: 7, targetName: 'Animated Rug of Smothering 1' })),
      buildCtxSync: vi.fn(() => Promise.resolve({ sneakAttackDice: 7, targetName: 'Animated Rug of Smothering 1' })),
      setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
      modalState,
      setPendingDamage: vi.fn(),
      resumeRef,
    },
  };
}

describe('useAttackDamageResolution — Cunning Strike pipeline resume (CLA-188)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pauses the pipeline without dealing damage while the Cunning Strike modal is open', async () => {
    setup({ lastAttack: { hit: true } });
    const resumeRef = { current: null };
    const { deps } = makeDeps(resumeRef);
    const { resolveAttackDamage } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Animated Rug of Smothering 1' });

    expect(resumeRef.current?._pausedStep).toBe('cunningStrike');
    expect(deps.rollDamage).not.toHaveBeenCalled();
  });

  it('resumes on modal close and applies weapon + reduced Sneak Attack damage', async () => {
    setup({ lastAttack: { hit: true }, _cunningStrikeCostUsed: 2 });
    const resumeRef = { current: null };
    const { deps } = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);
    const rollDamage = deps.rollDamage;

    await resolveAttackDamage(attack, { hit: true, targetName: 'Animated Rug of Smothering 1' });
    expect(rollDamage).not.toHaveBeenCalled();

    await resumeAttackPipeline();

    expect(rollDamage).toHaveBeenCalledTimes(1);
    const [{ name, formula, total }] = rollDamage.mock.calls[0];
    expect(name).toBe('Shortsword');
    expect(formula).toContain('[Sneak Attack]');
    expect(formula).toContain('5d6');
    expect(total).toBeGreaterThan(3);

    const usedRoundWrite = setRuntimeValue.mock.calls.find(c => c[1] === '_SneakAttack_usedRound');
    expect(usedRoundWrite).toBeTruthy();
    const costReset = setRuntimeValue.mock.calls.find(c => c[1] === '_cunningStrikeCostUsed');
    expect(costReset[2]).toBe(0);
    expect(deps.setPendingDamage).not.toHaveBeenCalled();
    expect(resumeRef.current).toBeNull();
  });

  it('applies full Sneak Attack damage when the rider modal is closed without spending dice', async () => {
    setup({ lastAttack: { hit: true } });
    const resumeRef = { current: null };
    const { deps } = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);
    const rollDamage = deps.rollDamage;

    await resolveAttackDamage(attack, { hit: true, targetName: 'Animated Rug of Smothering 1' });
    await resumeAttackPipeline();

    expect(rollDamage).toHaveBeenCalledTimes(1);
    expect(rollDamage.mock.calls[0][0].formula).toContain('7d6 [Sneak Attack]');
  });

  it('resumeAttackPipeline is a no-op when the pipeline is not paused at cunningStrike', async () => {
    setup({ lastAttack: { hit: true } });
    const resumeRef = { current: null };
    const { deps } = makeDeps(resumeRef);
    const { resumeAttackPipeline } = useAttackDamageResolution(deps);
    const rollDamage = deps.rollDamage;

    await resumeAttackPipeline();
    expect(rollDamage).not.toHaveBeenCalled();

    resumeRef.current = { _pausedStep: 'damageTypeChoice', pipelineStash: { pipeline: { resume: vi.fn() }, ctx: {} } };
    await resumeAttackPipeline();
    expect(rollDamage).not.toHaveBeenCalled();
  });
});
