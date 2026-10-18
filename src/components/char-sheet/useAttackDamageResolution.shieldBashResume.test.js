// @maintained-by-ai
// FT-074 Shield Bash RESUME lane at the useAttackDamageResolution seam: the
// choice modal pauses the real pipeline at _pausedStep:'featureRiders' BEFORE
// proceedToDamage. This lane owns resume-completion: the approved shieldBash
// pause must push the pause-bearing weapon damage exactly once, through
// stash.pipeline.resume(stash.ctx, resumeRef) with the SAME instances, then
// clear the latch — and unapproved (step, modalType) combos must stay paused.
// Not restated here: pause-entry/applyPauseState matrix → pausedStates.test.js
// (#311); stalkersFlurry affirmative resume → stalkersFlurryResume.test.js;
// real-step Shield Master pause → feats.test.js; modal close→resume call →
// CharActionModals.shieldBash-resume.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake steps on the REAL actionPipeline engine: FT-074's pause/latch semantics
// (stash merge at modal, resume-from-emit chaining, null-on-completion) are
// the subject under test, so createPipeline stays real while the actual
// steps/index subtree never loads. Mock surface = the hook's direct imports
// only, each with the exact names it imports (diceRoller is left real: pure,
// import-free, and never called on this path).
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
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, creatures: [] })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
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
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

// Fresh deps (and fresh mocks) per call — no state crosses tests.
function makeDeps(resumeRef) {
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: 'Zombie 1' },
    setPopupHtml: vi.fn(),
    rollDamage: vi.fn(),
    buildCtx: null,
    buildCtxSync: null,
    setModalState: vi.fn(),
    setPendingDamage: vi.fn(),
    setTacticalMasterModal: vi.fn(),
    resumeRef,
  };
}

describe('useAttackDamageResolution — Shield Bash featureRiders pause resume (FT-074)', () => {
  beforeEach(() => {
    // clearAllMocks, not resetAllMocks: the steps/index factory mock carries
    // the pipeline builder itself and would be stripped by reset. All test
    // fixtures are built fresh per test anyway.
    vi.clearAllMocks();
  });

  it('approved shieldBash pause resumes once, through the stash instances, pushing the pause-bearing damage byte-exact (Apply and Skip both close through this resume)', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Zombie 1' });

    // Paused at featureRiders with the modal open once — weapon damage stranded.
    expect(resumeRef.current?._pausedStep).toBe('featureRiders');
    expect(resumeRef.current?._modalType).toBe('shieldBash');
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(deps.setModalState).toHaveBeenCalledWith({
      shieldBashModal: { name: 'Shield Bash', targetName: 'Zombie 1', saveDc: 15 },
    });
    expect(deps.rollDamage).not.toHaveBeenCalled();

    const stash = resumeRef.current.pipelineStash;
    const resumeSpy = vi.spyOn(stash.pipeline, 'resume');

    await resumeAttackPipeline();

    // Consumer contract: exactly one resume(stash.ctx, resumeRef) with the
    // SAME instances — a rebuilt ctx would lose the pause-bearing dice.
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(resumeSpy).toHaveBeenCalledWith(stash.ctx, resumeRef);

    // Damage pushed exactly once, byte-exact. total:5/rolls:[4] are the
    // featureRiders step's roll — the pre-run ctx held formula:null/total:0,
    // so a stale-ctx resume would land different values (drift guard).
    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.rollDamage.mock.calls[0][0]).toEqual({
      name: 'Shortsword',
      formula: '1d6+1',
      total: 5,
      rolls: [4],
      modifier: 0,
      context: {
        damageType: 'Piercing',
        targetName: 'Zombie 1',
        attackerName: 'Shortsword',
        critLabels: {},
        autoDamageSecondaryFormula: null,
        autoDamageSecondaryName: null,
        autoDamageSecondaryDamageType: null,
        saveDc: null,
        saveType: null,
        dcSuccess: null,
        tavernBrawlerRerolls: null,
      },
    });

    // Latch cleared, modal not re-opened, and the resume seam itself writes
    // no runtime-store state (choice effects belong to the modal lane).
    expect(resumeRef.current).toBeNull();
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('resume after the pause has completed is inert — no double damage, latch stays cleared (Skip then stray close)', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Zombie 1' });
    await resumeAttackPipeline();
    expect(resumeRef.current).toBeNull();

    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(resumeRef.current).toBeNull();
  });

  // Deny legs of the resume allow-list (source: approvedFeatureRidersPause +
  // step check). Approvals are owned elsewhere; these guard the default-deny.
  it.each([
    { scenario: 'cantripBonuses rides featureRiders but is not on the allow-list (CLA-326)', _pausedStep: 'featureRiders', _modalType: 'cantripBonuses' },
    { scenario: 'approved shieldBash modalType at an unapproved _pausedStep still denies', _pausedStep: 'mysteryStep', _modalType: 'shieldBash' },
  ])('stays paused and consumes nothing — $scenario', async ({ _pausedStep, _modalType }) => {
    const stash = { pipeline: { resume: vi.fn() }, ctx: {} };
    const resumeRef = {
      current: { _pausedStep, _modalType, _modalProps: {}, pipelineStash: stash },
    };
    const deps = makeDeps(resumeRef);

    await useAttackDamageResolution(deps).resumeAttackPipeline();

    expect(stash.pipeline.resume).not.toHaveBeenCalled();
    expect(deps.rollDamage).not.toHaveBeenCalled();
    expect(deps.setModalState).not.toHaveBeenCalled();
    // Pause intact — the prompt keeps waiting indefinitely (no auto-resolve).
    expect(resumeRef.current.pipelineStash).toBe(stash);
    expect(resumeRef.current._pausedStep).toBe(_pausedStep);
  });
});
