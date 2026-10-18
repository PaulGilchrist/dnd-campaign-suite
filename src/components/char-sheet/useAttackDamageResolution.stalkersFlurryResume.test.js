// @maintained-by-ai
// CLA-326 Stalker's Flurry AFFIRMATIVE-RESUME lane at the useAttackDamageResolution
// seam: the choice modal pauses the real pipeline at _pausedStep:'featureRiders'
// BEFORE proceedToDamage, stranding the triggering hit's damage. This lane owns the
// completion: resumeAttackPipeline must accept the stalkersFlurry approval branch and
// push the pause-bearing (ctx-modified) dice exactly once through
// stash.pipeline.resume(stash.ctx, resumeRef) with the SAME instances, run the
// stalkersFlurryPostDamage (Sudden Strike) consumer off damage:applied on that same
// ctx, and clear the latch.
// Not restated here (lane map):
// - applyPauseState stash-shape matrix → pausedStates.test.js (#311)
// - resume allow-list deny legs + generic post-completion inert double-resume
//   (modal-type-agnostic early-return) → shieldBashResume.test.js (#312)
// - maneuver-skip gates incl. cunningStrike-pause-untouched → skipManeuver.test.js (#313)
// - chooser open + latch round-trips at the hook seam → classFeatures.test.js (#301);
//   step internals (option dice) → steps/features/stalkersFlurry.test.js;
//   modal close→resume calls (Apply/Cancel) → CharActionModals.stalkersFlurry-resume.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake steps on the REAL actionPipeline engine: pause/stash-merge/resume chaining
// and null-on-completion are the subject, so createPipeline stays real while the
// steps/index subtree never loads. Mock surface = the hook's direct imports only,
// each with the exact names it imports (diceRoller left real: pure, import-free,
// never called on this path; stale extras like hasTwoWeaponFighting,
// getTargetFromAttacker and setRuntimeObject are dead once steps/index is stubbed —
// purged, nothing transitively loads them).
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
        handler: async (ctx) => {
          // Mirrors the real step: it opens the chooser itself, then its modal
          // return pauses the run AFTER result.data merges onto ctx — the
          // pause-bearing dice (1d8+2 / 5 / [4]) live on stash.ctx from here on.
          ctx.setAttackRiderModal({ action: { name: "Stalker's Flurry" }, targetName: 'Thug 1' });
          return {
            data: { formula: '1d8+2', total: 5, rolls: [4] },
            modal: { type: 'stalkersFlurry', props: { action: { name: "Stalker's Flurry" }, targetName: 'Thug 1' } },
          };
        },
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
      pipeline.step({
        name: 'stalkersFlurryPostDamage',
        subscribe: 'damage:applied',
        emit: 'cleave:check',
        condition: () => true,
        handler: async () => ({ data: { _postDamageRan: true } }),
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
  getCombatContext: vi.fn(() => Promise.resolve({ round: 2, creatures: [] })),
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
  name: 'Longbow',
  damage: '1d8+2',
  damageType: 'Piercing',
  weaponType: 'weapon',
  properties: ['Heavy'],
  type: 'Action',
};

const playerStats = {
  name: 'FeyRanger',
  level: 17,
  proficiency: 6,
  abilities: [{ name: 'Dexterity', bonus: 5 }],
  automation: {
    passives: [{
      name: "Stalker's Flurry",
      type: 'attack_rider',
      trigger: 'weapon_attack_hit',
      oncePerTurn: true,
      chooseOne: true,
      options: [
        { name: 'Sudden Strike', effect: 'sudden_strike' },
        { name: 'Mass Fear', effect: 'mass_fear' },
      ],
    }],
  },
};

// Fresh deps (and fresh mocks) per call — no state crosses tests.
function makeDeps(resumeRef) {
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: 'Thug 1' },
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

describe('useAttackDamageResolution — Stalker\'s Flurry featureRiders pause resume (CLA-326)', () => {
  beforeEach(() => {
    // clearAllMocks, not resetAllMocks: the steps/index factory mock carries the
    // pipeline builder itself and would be stripped by reset. All fixtures are
    // built fresh per test anyway.
    vi.clearAllMocks();
  });

  it('resumes the approved stalkersFlurry pause once, through the stash instances, landing the pause-bearing damage byte-exact, running the post-damage consumer, and clearing the latch', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Thug 1' });

    // Pause landed (stash-shape matrix owned by pausedStates #311): the keys the
    // approval branch reads, the chooser opened byte-exact by the step, and the
    // weapon damage stranded at the pause.
    expect(resumeRef.current?._pausedStep).toBe('featureRiders');
    expect(resumeRef.current?._modalType).toBe('stalkersFlurry');
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(deps.setModalState).toHaveBeenCalledWith({
      attackRiderModal: { action: { name: "Stalker's Flurry" }, targetName: 'Thug 1' },
    });
    expect(deps.rollDamage).not.toHaveBeenCalled();

    // A macrotask flush: the choice prompt waits indefinitely — no auto-resolve,
    // no stranding escape hatch, pause persists untouched (no-game-timers 🔴).
    await tick();
    expect(resumeRef.current?._pausedStep).toBe('featureRiders');
    expect(deps.rollDamage).not.toHaveBeenCalled();

    const stash = resumeRef.current.pipelineStash;
    const resumeSpy = vi.spyOn(stash.pipeline, 'resume');

    await resumeAttackPipeline();

    // Consumer contract (canon #312): exactly one resume(stash.ctx, resumeRef)
    // with the SAME instances — a rebuilt ctx would lose the pause-bearing dice.
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(resumeSpy).toHaveBeenCalledWith(stash.ctx, resumeRef);

    // Damage pushed exactly once, byte-exact. total:5/rolls:[4] are the
    // featureRiders step's post-merge roll — the pre-run ctx held formula:null/
    // total:0, so a stale-ctx resume would land different values (drift guard).
    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.rollDamage.mock.calls[0][0]).toEqual({
      name: 'Longbow',
      formula: '1d8+2',
      total: 5,
      rolls: [4],
      modifier: 0,
      context: {
        damageType: 'Piercing',
        targetName: 'Thug 1',
        attackerName: 'Longbow',
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

    // Sudden Strike consumer executed off damage:applied on the SAME ctx
    // instance that was resumed — proof the chain completed downstream.
    expect(stash.ctx._postDamageRan).toBe(true);

    // Latch consumed: pause cleared, chooser not re-opened, and the resume seam
    // itself writes no runtime-store state (choice/latch effects belong to the
    // modal lane, step internals to the steps lane).
    expect(resumeRef.current).toBeNull();
    expect(deps.setModalState).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
