// @maintained-by-ai
// handleAttackRiderManeuverSkip guard matrix — this file owns ONLY the skip lane's
// gates: prompt close + exactly when the paused pipeline may resume (step gate,
// stash-exists gate, and the `stash.ctx.hit !== false` key-absent semantics).
// Lane ownership (do not duplicate here):
// - skip hit/miss dispatch with byte-exact resume args → useAttackDamageResolution.maneuvers.test.js
// - handleAttackRiderOptionSelect full lane → useAttackDamageResolution.optionSelect.test.js
// - applyPauseState stash shapes byte-exact → useAttackDamageResolution.pausedStates.test.js
//
// Mocking: the hook's eight static imports are stubbed only to stop the real
// steps/services graph from loading — nothing in them is invoked on the skip path
// (the old combatData/buffToggle/applyDamage/attackCalc/setRuntimeObject mocks were
// dead here once steps/index was stubbed; purged). clearAllMocks-vs-resetAllMocks
// is moot: no mock factory holds state and every relevant fake (setModalState,
// setPendingDamage, resume, resumeRef) is created fresh per mount.
import { describe, it, expect, vi } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));
vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

const ATTACK = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

// Fresh deps + resumeRef per mount — no cross-test bleed. (Capitalized: rules-of-hooks.)
function Harness(resumeRef) {
    const setModalState = vi.fn();
    const setPendingDamage = vi.fn();
    const api = useAttackDamageResolution({
        playerStats: { name: 'TestFighter' },
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        setModalState,
        setPendingDamage,
        resumeRef,
    });
    return { api, setModalState, setPendingDamage };
}

// resumeRef contract as the pipeline leaves it; `resume` records its exact args.
function refPausedAt({ step = 'attackRiderManeuvers', stashCtx = { hit: true }, repauseWith = null } = {}) {
    const resume = vi.fn(async (_ctx, ref) => {
        ref.current = repauseWith; // null = pipeline completed through the seam
    });
    return {
        resume,
        stashCtx,
        resumeRef: { current: { _pausedStep: step, pipelineStash: { pipeline: { resume }, ctx: stashCtx } } },
    };
}

describe('useAttackDamageResolution — handleAttackRiderManeuverSkip gates', () => {
    it.each([
        {
            branch: 'hit resumes the stashed pipeline so base damage lands',
            setup: () => refPausedAt({ stashCtx: { hit: true } }),
            shouldResume: true,
        },
        {
            branch: 'ctx.hit key absent still resumes (guard is `!== false`, honest key-absent pin)',
            setup: () => refPausedAt({ stashCtx: {} }),
            shouldResume: true,
        },
        {
            branch: 'miss never resumes (no damage to land)',
            setup: () => refPausedAt({ stashCtx: { hit: false } }),
            shouldResume: false,
        },
        {
            branch: 'a cunningStrike pause is untouched (skip is maneuver-prompt-only, even though resumeAttackPipeline would allow it)',
            setup: () => refPausedAt({ step: 'cunningStrike', stashCtx: { hit: true } }),
            shouldResume: false,
        },
        {
            branch: 'maneuvers pause with no stash is a safe no-op',
            setup: () => {
                const resume = vi.fn();
                return { resume, stashCtx: null, resumeRef: { current: { _pausedStep: 'attackRiderManeuvers', pipelineStash: null } } };
            },
            shouldResume: false,
        },
        {
            branch: 'nothing paused is a safe no-op',
            setup: () => ({ resume: vi.fn(), stashCtx: null, resumeRef: { current: null } }),
            shouldResume: false,
        },
        {
            branch: 'downstream re-pause surfaces its modal + pending damage instead of stranding it',
            setup: () => refPausedAt({
                stashCtx: { hit: true },
                repauseWith: {
                    _pausedStep: 'damageTypeChoice',
                    _modalType: 'damageTypeChoice',
                    _modalProps: { options: ['fire', 'cold'] },
                    attack: ATTACK,
                    formula: '1d8+3 + 2d6',
                    total: 12,
                    rolls: [5, 3, 4],
                    modifier: 3,
                },
            }),
            shouldResume: true,
            surfacesModal: true,
        },
    ])('$branch', async ({ setup, shouldResume, surfacesModal = false }) => {
        const { resume, stashCtx, resumeRef } = setup();
        const { api, setModalState, setPendingDamage } = Harness(resumeRef);

        api.handleAttackRiderManeuverSkip();
        await tick(); // flush the fire-and-forget resumeAttackPipeline tail

        // The prompt closes unconditionally, and it is the ONLY unconditional modal write.
        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });

        if (shouldResume) {
            expect(resume).toHaveBeenCalledTimes(1);
            expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        } else {
            expect(resume).not.toHaveBeenCalled();
        }

        if (surfacesModal) {
            // Shape pin lives in pausedStates.test.js; here: skip reaches the
            // applyPauseState tail so the re-paused damage is not stranded.
            expect(setModalState).toHaveBeenCalledWith({ damageTypeChoice: { options: ['fire', 'cold'] } });
            expect(setPendingDamage).toHaveBeenCalledWith(expect.objectContaining({
                attack: ATTACK,
                formula: '1d8+3 + 2d6',
                total: 12,
            }));
        } else {
            // Damage semantics: skip either resumes (damage rides the pipeline to
            // rollDamage) or strands nothing — never a silent pendingDamage stash.
            expect(setModalState).toHaveBeenCalledTimes(1);
            expect(setPendingDamage).not.toHaveBeenCalled();
        }
    });
});
