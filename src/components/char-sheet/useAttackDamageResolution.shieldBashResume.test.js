// Regression tests for FT-074: the Shield Bash modal pauses the pipeline at
// _pausedStep:'featureRiders'. resumeAttackPipeline must accept that pause
// so the triggering attack's weapon damage resolves exactly once after Apply
// AND Skip/close. CLA-326 added stalkersFlurry to the allow-list; other
// featureRiders modals (cantripBonuses) must NOT blanket-resume.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/combat/steps/index.js', async () => {
  const { createPipeline } = await vi.importActual('../../services/combat/actionPipeline.js');
  return {
    buildPipelineForAction: vi.fn(() => {
      const pipeline = createPipeline();
      pipeline.step({
        name: 'featureRiders',
        subscribe: 'housekeeping:do',
        emit: 'riders:applied',
        condition: () => true,
        handler: async () => ({
          data: { formula: '1d6+1', total: 5, rolls: [4] },
          modal: { type: 'shieldBash', props: { name: 'Shield Bash', targetName: 'Zombie 1', saveDc: 15 } },
        }),
      });
      pipeline.step({
        name: 'proceedToDamage',
        subscribe: 'riders:applied',
        emit: 'damage:applied',
        condition: () => true,
        handler: async (ctx) => {
          ctx.proceedWithDamage({ attack: ctx.attack, formula: ctx.formula, total: ctx.total, rolls: ctx.rolls, modifier: ctx.modifier, critLabels: {}, pipelineCtx: ctx });
          return { data: { _done: true } };
        },
      });
      return pipeline;
    }),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, creatures: [] })),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeAttackRiderManeuver: vi.fn(),
  applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

import useAttackDamageResolution from './useAttackDamageResolution.js';

const attack = {
  name: 'Shortsword',
  damage: '1d6+1',
  damageType: 'Piercing',
  weaponType: 'weapon',
  properties: ['Light'],
  type: 'Action',
};

const playerStats = {
  name: 'EvasiveFighter',
  level: 18,
  proficiency: 6,
  abilities: [{ name: 'Strength', bonus: 1 }],
  automation: { passives: [{ type: 'attack_rider', effect: 'push_or_prone', oncePerTurn: true, name: 'Shield Bash' }] },
};

function makeDeps(resumeRef) {
  const modalState = {};
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: 'Zombie 1' },
    setPopupHtml: vi.fn(),
    rollDamage: vi.fn(),
    buildCtx: null,
    buildCtxSync: null,
    setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
    modalState,
    setPendingDamage: vi.fn(),
    setTacticalMasterModal: vi.fn(),
    resumeRef,
  };
}

describe('useAttackDamageResolution — Shield Bash featureRiders pause resume (FT-074)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pauses at featureRiders with shieldBash modal and strands no damage yet', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Zombie 1' });

    expect(resumeRef.current?._pausedStep).toBe('featureRiders');
    expect(resumeRef.current?._modalType).toBe('shieldBash');
    expect(deps.setModalState).toHaveBeenCalledWith(expect.objectContaining({
      shieldBashModal: expect.objectContaining({ name: 'Shield Bash' }),
    }));
    expect(deps.rollDamage).not.toHaveBeenCalled();
  });

  it('resumes from the pause on modal close and applies weapon damage exactly once (Apply path)', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Zombie 1' });
    expect(deps.rollDamage).not.toHaveBeenCalled();

    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.rollDamage.mock.calls[0][0]).toBe('Shortsword');
    expect(deps.rollDamage.mock.calls[0][1]).toBe('1d6+1');
    expect(resumeRef.current).toBeNull();
  });

  it('double resume does not double-apply weapon damage (Skip then close)', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Zombie 1' });
    await resumeAttackPipeline();
    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(resumeRef.current).toBeNull();
  });

  it('resumes stalkersFlurry featureRiders pauses (CLA-326) but NOT other featureRiders modals', async () => {
    const resumeRef = {
      current: {
        _pausedStep: 'featureRiders',
        _modalType: 'cantripBonuses',
        _modalProps: {},
        pipelineStash: { pipeline: { resume: vi.fn() }, ctx: {} },
      },
    };
    const deps = makeDeps(resumeRef);
    const { resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resumeAttackPipeline();

    expect(resumeRef.current.pipelineStash.pipeline.resume).not.toHaveBeenCalled();
    expect(resumeRef.current._pausedStep).toBe('featureRiders');
  });
});
