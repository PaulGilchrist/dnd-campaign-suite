// @maintained-by-ai 2026-11-26
// Owns the combined veer→homing→graze WIRING seam of createLogAndShow:
// hitResolution.js and attackPostProcessing.js are mocked so the resolved
// verdict (veer redirect / homing-strike conversion, owned live by the
// living-legend-veer sibling) can be driven, and the seam asserted to thread
// the FINAL verdict into the graze guard's EXACT predicate — the real guard
// (attackPostProcessing.js:60) reads finalHit/finalAutoMiss from `state` and
// grazeDamage from `context`, not the top-level hit/isAutoMiss args; a
// homing-converted hit or veer-decline auto-miss disarms it. Also uniquely
// owned here: homing popup flag normalization (homingStrikesUsed === true /
// homingStrikesBonus || 0 — the only family file pinning it), the
// save-prompt popup skip (player target + saveDc), and BI-offense threading
// through the ATTACK hook (popup-data sibling covers the damage hook only).
// Real graze consumption lives in the graze sibling; blocker aborts are owned
// live by blocked-attacks (real BLOCKERS table, zero-write census) so the
// blocked half of the pre-phase echo is dropped here — only the
// sanctuary-save refusal (the one other runAttackPrePhase `return true`)
// keeps its stop-the-roll-before-any-resolve echo.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

// applyDamage transitively loads silenceService → automation/index — keep it
// severed (matches the sibling baseline; graze consumption is graze-sibling-owned).
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => ({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] })),
    getCurrentCombatRound: () => 1,
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(() => false),
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(() => null),
    getBardicInspirationDieSizeFromClass: vi.fn(() => null),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(async () => []),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

// Seam halves — controlled here, owned live by the siblings named in the header.
vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./handlers/sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(async () => true),
}));

vi.mock('./d20RollComputation.js', () => ({
    computeD20Roll: vi.fn(),
}));

vi.mock('./targetResolution.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('./hitResolution.js', () => ({
    resolveHit: vi.fn(),
}));

vi.mock('./attackPostProcessing.js', () => ({
    processAttackAfterResult: vi.fn(async () => {}),
    processPotentCantrip: vi.fn(async () => {}),
}));

vi.mock('./saveProcessing.js', () => ({
    processSaveRoll: vi.fn(async () => {}),
}));

vi.mock('./initiativeProcessing.js' , () => ({
    processInitiativeRoll: vi.fn(async () => {}),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import {
    hasBardicInspirationOffense,
    getBardicInspirationDieSize,
} from '../../services/combat/auras/bardicInspirationState.js';
import { computeD20Roll } from './d20RollComputation.js';
import { resolveTarget } from './targetResolution.js';
import { resolveHit } from './hitResolution.js';
import { processAttackAfterResult } from './attackPostProcessing.js';
import { handleSanctuarySave } from './handlers/sanctuarySave.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

const deps = {
    characterName: 'TestFighter',
    campaignName: 'test-campaign',
    characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    autoDamageSourceRef: { current: null },
};

// d20 5 + bonus 5 = 10 vs AC 12 → raw miss pre-seam; resolveHit's verdict
// is what the seam threads forward.
function resolved(overrides = {}) {
    return {
        hit: false, isAutoMiss: false, isCrit: false,
        unerringStrikeApplied: false, homingStrikesUsed: false,
        homingStrikesBonus: 0, targetAc: 12, effectiveAc: 12,
        effectiveD20Roll: 5, ...overrides,
    };
}

function grazeContext(extra = {}) {
    return {
        targetName: 'Goblin',
        grazeDamage: true,
        grazeAbilityMod: 3,
        damageType: 'slashing',
        ...extra,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    computeD20Roll.mockReturnValue({
        r1: 5, r2: undefined, effectiveD20: 5, effectiveD20Roll: 5,
        effectiveBonus: 5, finalBonusDetail: '',
    });
    resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc', ac: 12 },
        availableSuperiorityManeuvers: [],
    });
    resolveHit.mockResolvedValue(resolved());
    handleSanctuarySave.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Combined veer → homing → graze seam
// ---------------------------------------------------------------------------

describe('createLogAndShow — veer→homing→graze seam wiring', () => {
    // The three verdict shapes the seam can receive, and whether the REAL
    // graze guard (attackPostProcessing.js: grazeDamage && !state.hit &&
    // !state.isAutoMiss) engages for each. The guard reads `state`/`context`
    // (finalHit/finalAutoMiss are destructured from state), so the pin lands
    // on those carriers — not just the top-level args it never consults.
    it.each([
        {
            label: 'a homing-converted miss→hit (disarms the graze lane)',
            verdict: { hit: true, homingStrikesAttempted: true, homingStrikesUsed: true, homingStrikesBonus: 4 },
            expect: { hit: true, isAutoMiss: false },
        },
        {
            label: 'a genuine miss (engages the graze lane)',
            verdict: { hit: false, isAutoMiss: false, homingStrikesAttempted: true },
            expect: { hit: false, isAutoMiss: false },
        },
        {
            label: 'a veer-decline auto-miss (keeps graze suppressed)',
            // Declined veer leaves hit:false + isAutoMiss:true (asserted live
            // in the living-legend-veer sibling) — the auto-miss half must
            // reach the guard's finalAutoMiss read.
            verdict: { hit: false, isAutoMiss: true },
            expect: { hit: false, isAutoMiss: true },
        },
    ])('threads $label — guard sees state.hit/$expect.hit, state.isAutoMiss/$expect.isAutoMiss', async ({ verdict, expect: expected }) => {
        resolveHit.mockResolvedValue(resolved(verdict));

        await createLogAndShow(deps)('Longsword', 5, 'attack', grazeContext());

        const postArgs = processAttackAfterResult.mock.calls[0][0];
        // Full guard predicate: rollType + grazeDamage on context, the
        // verdict on state, and the targetName the guard requires.
        expect(postArgs.context).toMatchObject({
            rollType: 'attack',
            grazeDamage: true,
            grazeAbilityMod: 3,
        });
        expect(postArgs.state).toMatchObject(expected);
        expect(postArgs.targetName).toBe('Goblin');
    });

    it('surfaces a homing-converted hit on the popup and threads the graze context into resolveHit', async () => {
        resolveHit.mockResolvedValue(resolved({
            hit: true, homingStrikesAttempted: true,
            homingStrikesUsed: true, homingStrikesBonus: 4,
        }));

        await createLogAndShow(deps)('Psychic Blade', 5, 'attack', grazeContext());

        // The graze context rides the ctx into resolveHit, where veer and
        // homing strikes resolve (verdict internals owned live by
        // hitResolution.soul-blades / living-legend-veer).
        expect(resolveHit).toHaveBeenCalledWith(expect.objectContaining({
            context: expect.objectContaining({ grazeDamage: true, grazeAbilityMod: 3 }),
        }));
        // Popup normalization: homingStrikesUsed === true, bonus || 0.
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'd20',
            hit: true,
            homingStrikesUsed: true,
            homingStrikesBonus: 4,
        }));
    });
});

// ---------------------------------------------------------------------------
// Pre-phase abort wiring (sanctuary-refusal half — blocker aborts are owned
// live by the blocked-attacks sibling; this echo pins that a refused
// sanctuary save stops the roll BEFORE target resolution, the d20 compute,
// resolveHit and every write)
// ---------------------------------------------------------------------------

describe('createLogAndShow — attack pre-phase abort wiring', () => {
    it('returns before any roll when the sanctuary save declines the attack', async () => {
        handleSanctuarySave.mockResolvedValue(false);

        await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(resolveTarget).not.toHaveBeenCalled();
        expect(computeD20Roll).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
        expect(processAttackAfterResult).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Non-attack roll types + popup skip
// ---------------------------------------------------------------------------

describe('createLogAndShow — non-attack rolls', () => {
    it('never consults resolveHit for non-attack rolls and normalizes homing popup flags to false/0', async () => {
        // One representative: check/save/initiative all skip the
        // rollType==='attack' resolveHit branch identically, and the
        // normalization (=== true, || 0) is the same popup line.
        await createLogAndShow(deps)('Athletics', 3, 'check', { attackerName: 'TestFighter' });

        expect(resolveHit).toHaveBeenCalledTimes(0);
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'd20',
            homingStrikesUsed: false,
            homingStrikesBonus: 0,
        }));
    });

    it('skips the popup for player-targeted saves with a saveDc (save-prompt seam owns those)', async () => {
        resolveTarget.mockResolvedValue({
            target: { name: 'Goblin', type: 'player', ac: 12 },
            availableSuperiorityManeuvers: [],
        });

        await createLogAndShow(deps)('Saving Throw', 0, 'save', {
            targetName: 'Goblin',
            saveDc: 12,
            saveType: 'DEX',
            attackerName: 'TestFighter',
        });

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
    });

    it('threads bardic inspiration offense flags from playerStats into the popup', async () => {
        // Attack-hook lane only — the damage-hook twin is owned by
        // useLoggedDiceRollDamage.popup-data.
        hasBardicInspirationOffense.mockReturnValue(true);
        getBardicInspirationDieSize.mockReturnValue('d6');

        await createLogAndShow(deps)('Fire Bolt', 3, 'attack', {
            targetName: 'Goblin',
            playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
        });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            bardicInspirationOffense: true,
            bardicInspirationOffenseDieSize: 'd6',
        }));
    });
});
