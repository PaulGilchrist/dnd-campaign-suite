// Regression tests for CLA-326: the Stalker's Flurry choice modal pauses the
// pipeline at _pausedStep:'featureRiders' BEFORE proceedToDamage, stranding
// the triggering weapon hit's damage. resumeAttackPipeline must accept the
// stalkersFlurry pause (mirroring FT-074 shieldBash) so proceedToDamage runs
// exactly once after the modal resolves (Apply or Cancel), and the
// stalkersFlurryPostDamage (Sudden Strike) consumer executes off damage:applied.
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
        handler: async (ctx) => {
          ctx.setAttackRiderModal?.({ action: { name: "Stalker's Flurry" }, targetName: 'Thug 1' });
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
          ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier, {}, ctx);
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
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 2, creatures: [] })),
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

function makeDeps(resumeRef) {
  const modalState = {};
  return {
    playerStats,
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: { hit: true, targetName: 'Thug 1' },
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

describe('useAttackDamageResolution — Stalker\'s Flurry featureRiders pause resume (CLA-326)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pauses at featureRiders with the stalkersFlurry modal and strands no damage yet', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Thug 1' });

    expect(resumeRef.current?._pausedStep).toBe('featureRiders');
    expect(resumeRef.current?._modalType).toBe('stalkersFlurry');
    expect(deps.setModalState).toHaveBeenCalledWith(expect.objectContaining({
      attackRiderModal: expect.objectContaining({ targetName: 'Thug 1' }),
    }));
    expect(deps.rollDamage).not.toHaveBeenCalled();
  });

  it('resumes from the pause on modal close and applies weapon damage exactly once', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Thug 1' });
    expect(deps.rollDamage).not.toHaveBeenCalled();
    const stash = resumeRef.current.pipelineStash;

    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(deps.rollDamage.mock.calls[0][0]).toBe('Longbow');
    expect(deps.rollDamage.mock.calls[0][1]).toBe('1d8+2');
    expect(stash.ctx._postDamageRan).toBe(true);
    expect(resumeRef.current).toBeNull();
  });

  it('double resume does not double-apply weapon damage (Cancel then stray close)', async () => {
    const resumeRef = { current: null };
    const deps = makeDeps(resumeRef);
    const { resolveAttackDamage, resumeAttackPipeline } = useAttackDamageResolution(deps);

    await resolveAttackDamage(attack, { hit: true, targetName: 'Thug 1' });
    await resumeAttackPipeline();
    await resumeAttackPipeline();

    expect(deps.rollDamage).toHaveBeenCalledTimes(1);
    expect(resumeRef.current).toBeNull();
  });
});
