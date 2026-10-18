// @maintained-by-ai
// WM-003 Tactical Mastery CHOICE→RESUME COMPLETION lane at the useAttackDamageResolution
// seam. The tacticalMaster step pauses the REAL pipeline at _pausedStep:'tacticalMaster'
// AFTER the weapon damage has already landed (proceedToDamage is upstream: damage:applied
// → cleave:check → cleave:done → tacticalMaster, attackRollPostDamage.js — the inversion
// of shieldBash/stalkersFlurry #312/#314 where damage strands at the pause). This lane
// owns the completion: resumeAttackPipeline must take the tacticalMaster allow-list branch
// and continue the chain exactly once through stash.pipeline.resume(stash.ctx, resumeRef)
// with the SAME instances — the _tacticalMasterPending latch the engine merged at the pause
// must reach the downstream mastery consumer — push NO second weapon damage, consume the
// latch (null-on-completion), and never re-open the modal.
// Not restated here (lane map):
// - applyPauseState tacticalMaster branch shape (setTacticalMasterModal count-once, silent
//   setModalState/setPendingDamage) → pausedStates.test.js (#311)
// - featureRiders-modal deny rows + generic post-completion inert double-resume →
//   shieldBashResume.test.js (#312); deny rows here are the allow-list STEP denies
//   (#303 delegated "guard no-ops for non-approved pauses" to this file)
// - handleTacticalMasterConfirm internals (applyMasteryEffect, Topple save, close-null) →
//   useCharActionsCleave.test.js; modal option rendering → TacticalMasterModal.test.jsx
// - step internals (collectWeaponMastery, lastAttack gate, auto-apply latches) →
//   services/combat/steps/attackRollDamageSteps-tacticalMaster.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake steps on the REAL actionPipeline engine: pause/spread-merge/null-on-completion and
// the resume-from-emit chaining are the subject under test, so createPipeline stays real
// while the steps/index subtree never loads. Mock surface = the hook's direct imports only,
// each with the exact names it imports (diceRoller left real: pure, import-free, never
// called on this path).
vi.mock('../../services/combat/steps/index.js', async () => {
  const { createPipeline } = await vi.importActual('../../services/combat/actionPipeline.js');
  return {
    buildPipelineForAction: vi.fn(() => {
      const pipeline = createPipeline();
      // Chain start is compacted (real: housekeeping:do → …bonuses… → featureRiders →
      // damage:ready → proceedToDamage); the intermediate steps belong to their own lanes
      // (#312 etc.) and are not the subject here.
      pipeline.step({
        name: 'proceedToDamage',
        subscribe: 'housekeeping:do',
        emit: 'damage:applied',
        condition: () => true,
        // Dice literal: the real proceedToDamage reads formula/total/rolls merged onto ctx
        // by upstream roll steps (attackRollDamageCalc lane).
        handler: async (ctx) => {
          ctx.proceedWithDamage({ attack: ctx.attack, formula: '1d6+0', total: 4, rolls: [4], modifier: 0, critLabels: {}, pipelineCtx: ctx });
          return { data: {} };
        },
      });
      // Faithful event names — trivial relays only because their payload behavior is owned
      // by stalkersFlurryResume.test.js / the cleave lane.
      pipeline.step({ name: 'stalkersFlurryPostDamage', subscribe: 'damage:applied', emit: 'cleave:check', condition: () => true, handler: async () => ({ data: {} }) });
      pipeline.step({ name: 'cleaveMastery', subscribe: 'cleave:check', emit: 'cleave:done', condition: () => true, handler: async () => ({ data: {} }) });
      pipeline.step({
        name: 'tacticalMaster', // mirrors attackRollPostDamage.js buildTacticalMasterStep
        subscribe: 'cleave:done',
        emit: 'tactical:done',
        condition: (ctx) => ctx.attack?.name && ctx.playerStats?.automation,
        handler: async (ctx) => {
          // WM-003 dual mirror: the step writes the synced campaign.tacticalMasterPending
          // that handleTacticalMasterConfirm reads; the modal return pauses the run and the
          // hook mirrors locally via setTacticalMasterModal.
          ctx.setModalState({ tacticalMasterPending: TACTICAL_MODAL_PROPS });
          return {
            data: { _tacticalMasterPending: true },
            modal: { type: 'tacticalMaster', props: TACTICAL_MODAL_PROPS },
          };
        },
      });
      pipeline.step({
        name: 'toppleMastery', // downstream consumer off tactical:done
        subscribe: 'tactical:done',
        emit: 'mastery:done',
        condition: () => true,
        // Records, AT RUN TIME, that the latch marker merged at the pause reached this
        // same ctx instance through the resume — the post-resume merge proof.
        handler: async (ctx) => ({ data: { _masteryChainCompleted: ctx._tacticalMasterPending === true } }),
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

const attack = { name: 'Scimitar', damage: '1d6+0', damageType: 'Slashing', weaponType: 'weapon', properties: ['Light'], type: 'Action' };
const playerStats = { name: 'EvasiveFighter', level: 18, proficiency: 6, abilities: [{ name: 'Strength', bonus: 0 }], automation: { passives: [] } };

// Byte shape the real buildTacticalMasterStep props (attackRollPostDamage.js:623).
const TACTICAL_MODAL_PROPS = {
  attackName: 'Scimitar',
  baseMastery: 'Nick',
  replaceOptions: ['Push', 'Sap', 'Slow'],
  targetName: 'Animated Rug of Smothering 1',
  isChoiceMode: true,
  featureName: null,
};

// Fresh deps (and fresh mocks) per call — no state crosses tests.
function makeDeps(resumeRef) {
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: TACTICAL_MODAL_PROPS.targetName },
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

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('useAttackDamageResolution — Tactical Mastery choice→resume completion (WM-003)', () => {
  beforeEach(() => {
    // clearAllMocks, not resetAllMocks: the steps/index factory mock carries the pipeline
    // builder itself and would be stripped by reset. All fixtures are built fresh anyway.
    vi.clearAllMocks();
  });

  it('resumes the tacticalMaster pause once, on the stash instances with the latch marker intact, pushing no second damage, closing nothing, and clearing the latch', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: TACTICAL_MODAL_PROPS.targetName });

    // Paused at tacticalMaster; the engine spread-merged the step's latch marker onto the
    // same stash.ctx the resume will receive.
    expect(resumeRef.current?._pausedStep).toBe('tacticalMaster');
    expect(resumeRef.current?._modalType).toBe('tacticalMaster');
    const stash = resumeRef.current.pipelineStash;
    expect(stash.ctx._tacticalMasterPending).toBe(true);

    // WM-003 dual mirror opened once each: the step's synced campaign write (what
    // handleTacticalMasterConfirm reads) + the hook's local render mirror (:489).
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(deps.setModalState).toHaveBeenCalledWith({ tacticalMasterPending: TACTICAL_MODAL_PROPS });
    expect(deps.setTacticalMasterModal).toHaveBeenCalledTimes(1);
    expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(TACTICAL_MODAL_PROPS);

    // Unlike shieldBash/stalkersFlurry, weapon damage lands BEFORE the pause
    // (proceedToDamage is upstream): byte-exact, once.
    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.rollDamage.mock.calls[0][0]).toEqual({
      name: 'Scimitar',
      formula: '1d6+0',
      total: 4,
      rolls: [4],
      modifier: 0,
      context: {
        damageType: 'Slashing',
        targetName: 'Animated Rug of Smothering 1',
        attackerName: 'Scimitar',
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

    // Mastery chain NOT yet run downstream. A macrotask flush proves the prompt waits
    // indefinitely — no auto-resolve escape hatch (no-game-timers 🔴).
    expect(stash.ctx._masteryChainCompleted).toBeUndefined();
    await tick();
    expect(resumeRef.current?._pausedStep).toBe('tacticalMaster');
    expect(stash.ctx._masteryChainCompleted).toBeUndefined();

    // CharActions.jsx:135 calls resumeAttackPipeline() right after
    // handleTacticalMasterConfirm(chosenMastery); confirm internals belong to
    // useCharActionsCleave.test.js — this seam is the resume itself.
    const resumeSpy = vi.spyOn(stash.pipeline, 'resume');
    await resumeAttackPipeline();

    // Consumer contract (canon #312): exactly one resume(stash.ctx, resumeRef), SAME
    // instances — a rebuilt ctx would lose the _tacticalMasterPending latch and the
    // replaceOptions context the chosen mastery applies against.
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(resumeSpy).toHaveBeenCalledWith(stash.ctx, resumeRef);

    // Chain continued off tactical:done ON THE SAME ctx, and the post-resume payload
    // proves the latch marker merged at the pause reached the mastery consumer.
    expect(stash.ctx._masteryChainCompleted).toBe(true);

    // Completion invariants: no second weapon push from the resume, modal mirrors never
    // re-opened (close-with-null belongs to the confirm lane), latch consumed, and the
    // hook seam itself writes no runtime-store state.
    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.setTacticalMasterModal).toHaveBeenCalledTimes(1);
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(resumeRef.current).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // Allow-list STEP denies delegated here by cunningStrikeResume.test.js (#303):
  // pendingDamage-flow pauses (resumed via their own modal handlers) and unknown steps
  // must stay paused. featureRiders-modal deny rows live in shieldBashResume (#312);
  // generic post-completion inert double-resume likewise (#312).
  it.each([
    { scenario: 'damageTypeChoice pauses resume via setPendingDamage handlers, never this gate', _pausedStep: 'damageTypeChoice', _modalType: 'damageTypeChoice' },
    { scenario: 'an unknown step is default-deny', _pausedStep: 'mysteryStep', _modalType: 'tacticalMaster' },
  ])('denies resume and consumes nothing — $scenario', async ({ _pausedStep, _modalType }) => {
    const stash = { pipeline: { resume: vi.fn() }, ctx: { _tacticalMasterPending: true } };
    const resumeRef = { current: { _pausedStep, _modalType, _modalProps: {}, pipelineStash: stash } };
    const deps = makeDeps(resumeRef);

    await useAttackDamageResolution(deps).resumeAttackPipeline();

    expect(stash.pipeline.resume).not.toHaveBeenCalled();
    expect(deps.rollDamage).not.toHaveBeenCalled();
    expect(deps.setTacticalMasterModal).not.toHaveBeenCalled();
    expect(deps.setModalState).not.toHaveBeenCalled();
    // Pause intact — the chain waits indefinitely, latch unconsumed.
    expect(resumeRef.current.pipelineStash).toBe(stash);
    expect(resumeRef.current._pausedStep).toBe(_pausedStep);
  });
});
