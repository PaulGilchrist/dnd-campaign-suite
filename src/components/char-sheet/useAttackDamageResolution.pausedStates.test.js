// @maintained-by-ai
// Canonical pause-state matrix for the resolveAttackDamage seam (applyPauseState):
// which _modalType pause stashes WHAT — byte-exact stash shapes with key sets
// pinned (distinguishing key-absent from stashed-undefined). Invariants pinned
// for EVERY pause: pipeline.resume is never called, runtime store is never
// written, and the pause persists after task flush (prompts wait indefinitely —
// no auto-resolve timers, per no-game-timers policy).
// Consumer lanes own completion effects and are not restated here:
// ctxOverrides.test.js (invocation contract), maneuvers.test.js (pendingOptions),
// optionSelect.test.js (resume loop), cunningStrikeResume.test.js /
// tacticalMaster.test.js / shieldBashResume.test.js / stalkersFlurryResume.test.js
// (resume + roll payloads), automations.test.jsx (real-pipeline divineFury).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Mock surface = the hook's direct imports only. steps/index is mocked, so its
// transitive subtree (buffToggle, applyDamage, combatData, attackCalc, damageUtils
// consumers) never loads — mocking those was dead weight.
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));
vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const ATTACK = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

const PLAYER_STATS = {
    name: 'TestFighter',
    level: 5,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const EMPOWERED_MOD = { name: 'Empowered Strikes', type: 'damage_type_modifier', trigger: 'unarmed_strike_hit' };

// Builds deps + a fake pipeline whose run() ends paused with `pause` merged
// onto resumeRef.current (exactly how a real pausing step leaves the seam).
// PascalCase: factory calls the use* hook (react-hooks/rules-of-hooks).
function FakeResolution(pause) {
    const pipeline = { run: vi.fn(), resume: vi.fn() };
    pipeline.run = vi.fn(async (_event, _ctx, ref) => {
        if (pause) ref.current = { ...pause, pipelineStash: { pipeline, ctx: {} } };
    });
    buildPipelineForAction.mockReturnValue(pipeline);

    const deps = {
        playerStats: PLAYER_STATS,
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        setModalState: vi.fn(),
        setPendingDamage: vi.fn(),
        setTacticalMasterModal: vi.fn(),
        resumeRef: { current: null },
    };
    const hook = useAttackDamageResolution(deps);
    return { ...hook, deps, pipeline, resumeRef: deps.resumeRef };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('useAttackDamageResolution — paused-state matrix at the resolve seam', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // One row per applyPauseState branch + containment rows. pendingStash is
    // pinned byte-exact: toEqual for values, exact ownKeys to distinguish
    // stashed-undefined (damageTypeChoice's oncePerTurnKey/_damageTypeModifier)
    // from key-absent (divineFury stash) — toEqual alone erases that line.
    it.each([
        {
            scenario: 'damageTypeChoice stashes full damage + oncePerTurnKey (keys present, _damageTypeModifier undefined)',
            pause: {
                _pausedStep: 'damageTypeChoice',
                _modalType: 'damageTypeChoice',
                _modalProps: { options: ['fire', 'cold'], featureName: 'Elemental Weapon' },
                attack: ATTACK,
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
                _weaponHitOnceKey: '_ElementalWeapon_usedRound',
                _damageTypeModifier: undefined,
            },
            modalKey: 'damageTypeChoice',
            pendingStash: {
                attack: ATTACK,
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
                oncePerTurnKey: '_ElementalWeapon_usedRound',
                _damageTypeModifier: undefined,
            },
        },
        {
            scenario: 'damageTypeChoice via damageTypeModifiers step passes _damageTypeModifier through byte-exact (applyPauseState branches on _modalType, not _pausedStep)',
            pause: {
                _pausedStep: 'damageTypeModifiers',
                _modalType: 'damageTypeChoice',
                _modalProps: { title: 'Empowered Strikes — Damage Type', types: ['Force', 'Bludgeoning'] },
                attack: { name: 'Unarmed Strike', damage: '1d12+3', damageType: 'bludgeoning' },
                formula: '1d12+3',
                total: 10,
                rolls: [7],
                modifier: 3,
                _damageTypeModifier: EMPOWERED_MOD,
            },
            modalKey: 'damageTypeChoice',
            pendingStash: {
                attack: { name: 'Unarmed Strike', damage: '1d12+3', damageType: 'bludgeoning' },
                formula: '1d12+3',
                total: 10,
                rolls: [7],
                modifier: 3,
                bonusExpr: undefined,
                bonusTotal: undefined,
                bonusRolls: undefined,
                oncePerTurnKey: undefined,
                _damageTypeModifier: EMPOWERED_MOD,
            },
        },
        {
            scenario: 'divineFury stashes damage but its stash key-set excludes oncePerTurnKey/_damageTypeModifier (distinct from damageTypeChoice)',
            pause: {
                _pausedStep: 'divineFury',
                _modalType: 'divineFury',
                _modalProps: { options: ['fire', 'cold'], featureName: 'Divine Fury' },
                attack: ATTACK,
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
                _weaponHitOnceKey: '_shouldNotLeakIntoStash',
                _damageTypeModifier: EMPOWERED_MOD,
            },
            modalKey: 'divineFuryChoice',
            pendingStash: {
                attack: ATTACK,
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
            },
        },
        {
            scenario: 'secondaryTarget opens the chooser modal only — damage never enters pendingDamage',
            pause: {
                _pausedStep: 'secondaryTarget',
                _modalType: 'secondaryTarget',
                _modalProps: { title: 'Choose Target', targets: ['Orc', 'Goblin'] },
            },
            modalKey: 'secondaryTargetModal',
            pendingStash: null,
        },
        {
            scenario: 'shieldBash opens shieldBashModal only (seam-level; resume payload owned by shieldBashResume.test.js)',
            pause: {
                _pausedStep: 'shieldBash',
                _modalType: 'shieldBash',
                _modalProps: { title: 'Shield Bash', damageExpression: '1d6' },
            },
            modalKey: 'shieldBashModal',
            pendingStash: null,
        },
        {
            scenario: 'tacticalMaster routes through the synced setter with exact props (WM-003), never setModalState or runtime writes',
            pause: {
                _pausedStep: 'tacticalMaster',
                _modalType: 'tacticalMaster',
                _modalProps: { title: 'Tactical Choice', options: ['attack', 'defend'] },
            },
            modalKey: null,
            tacticalMasterProps: { title: 'Tactical Choice', options: ['attack', 'defend'] },
            pendingStash: null,
        },
        {
            scenario: 'cunningStrike is silent at the seam — the step opened attackRiderModal itself; hook stashes nothing (resume completion pinned in cunningStrikeResume.test.js)',
            pause: {
                _pausedStep: 'cunningStrike',
                _modalType: 'cunningStrike',
                _modalProps: { targetName: 'Goblin' },
            },
            modalKey: null,
            pendingStash: null,
        },
        {
            scenario: 'unknown _modalType pauses stay silent — new pause types must not leak into the wrong modal',
            pause: {
                _pausedStep: 'mysteryStep',
                _modalType: 'mysteryModal',
                _modalProps: { anything: true },
            },
            modalKey: null,
            pendingStash: null,
        },
    ])('$scenario', async ({ pause, modalKey, tacticalMasterProps, pendingStash }) => {
        const { resolveAttackDamage, deps, pipeline, resumeRef } = FakeResolution(pause);

        await resolveAttackDamage(ATTACK);
        await tick(); // flush any deferred side effects — there must be none

        // Modal lane: exactly one exact-payload open, or total silence.
        if (modalKey) {
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({ [modalKey]: pause._modalProps });
        } else {
            expect(deps.setModalState).not.toHaveBeenCalled();
        }
        if (tacticalMasterProps) {
            expect(deps.setTacticalMasterModal).toHaveBeenCalledTimes(1);
            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(tacticalMasterProps);
        } else {
            expect(deps.setTacticalMasterModal).not.toHaveBeenCalled();
        }

        // Damage stash: byte-exact full object + exact key set (stashed
        // undefined vs key-absent), or never stashed at all.
        if (pendingStash) {
            expect(deps.setPendingDamage).toHaveBeenCalledTimes(1);
            const stash = deps.setPendingDamage.mock.calls[0][0];
            expect(stash).toEqual(pendingStash);
            expect(Object.keys(stash).sort()).toEqual(Object.keys(pendingStash).sort());
        } else {
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
        }

        // Universal pause invariants.
        expect(pipeline.resume).not.toHaveBeenCalled(); // never auto-resume
        expect(setRuntimeValue).not.toHaveBeenCalled(); // no runtime-store writes at the seam
        expect(resumeRef.current?._pausedStep).toBe(pause._pausedStep); // still paused — prompt waits indefinitely
    });

    it('a pipeline that completes without pausing opens no modal, stashes no damage, and leaves no pause marker', async () => {
        const { resolveAttackDamage, deps, pipeline, resumeRef } = FakeResolution(null);

        await resolveAttackDamage(ATTACK);
        await tick();

        expect(buildPipelineForAction).toHaveBeenCalledWith(ATTACK, PLAYER_STATS);
        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(deps.setTacticalMasterModal).not.toHaveBeenCalled();
        expect(deps.setPendingDamage).not.toHaveBeenCalled();
        expect(pipeline.resume).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        // Hook seeds the stash before run; a clean completion leaves it
        // without any _pausedStep, so applyPauseState must not fire.
        expect(resumeRef.current).toEqual({ pipelineStash: { pipeline, ctx: expect.any(Object) } });
        expect(resumeRef.current?._pausedStep).toBeUndefined();
    });
});
