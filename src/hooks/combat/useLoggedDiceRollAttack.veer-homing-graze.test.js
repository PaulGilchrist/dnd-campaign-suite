// @maintained-by-ai: 2026-10-14
// Owns the combined veer→homing→graze WIRING seam of createLogAndShow:
// hitResolution.js and attackPostProcessing.js are mocked so the resolved
// verdict (veer redirect / homing-strike conversion, owned live by the
// living-legend-veer sibling) can be driven, and the seam asserted to thread
// the FINAL hit/isAutoMiss + graze context into processAttackAfterResult in
// the right order (graze fires only when it sees hit:false && isAutoMiss:false
// && grazeDamage; a homing-converted hit or veer-decline auto-miss disarms it).
// Real graze consumption lives in the graze sibling; the homing damage lane in
// the potent-cantrip sibling; blockers/sanctuary resolution in blocked-attacks.
// Kept here (unique): the pre-phase abort echo — the only guard that
// runAttackPrePhase's `return true` stops the roll before resolveHit.
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

vi.mock('./sanctuarySave.js', () => ({
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
import { checkAttackBlockers } from './attackBlockers.js';
import { handleSanctuarySave } from './sanctuarySave.js';
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
    checkAttackBlockers.mockReturnValue(false);
    handleSanctuarySave.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Combined veer → homing → graze seam
// ---------------------------------------------------------------------------

describe('createLogAndShow — veer→homing→graze seam wiring', () => {
    it('threads a homing-converted miss→hit into the popup and disarms the graze lane', async () => {
        resolveHit.mockResolvedValue(resolved({
            hit: true, homingStrikesAttempted: true,
            homingStrikesUsed: true, homingStrikesBonus: 4,
        }));

        await createLogAndShow(deps)('Psychic Blade', 5, 'attack', grazeContext());

        // The graze context rides the ctx into resolveHit, where veer and
        // homing strikes resolve.
        expect(resolveHit).toHaveBeenCalledWith(expect.objectContaining({
            context: expect.objectContaining({ grazeDamage: true, grazeAbilityMod: 3 }),
        }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
            homingStrikesUsed: true,
            homingStrikesBonus: 4,
        }));
        // Post-processing sees the converted hit → real graze guard (!hit) skips.
        expect(processAttackAfterResult).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
            context: expect.objectContaining({ grazeDamage: true }),
        }));
        // Attack popup lands before any graze card can stack on top of it.
        expect(deps.setPopupHtml.mock.invocationCallOrder[0])
            .toBeLessThan(processAttackAfterResult.mock.invocationCallOrder[0]);
    });

    it('threads a genuine miss (hit:false, isAutoMiss:false) to engage the graze lane', async () => {
        resolveHit.mockResolvedValue(resolved({ homingStrikesAttempted: true }));

        await createLogAndShow(deps)('Longsword', 5, 'attack', grazeContext());

        // This is the exact input set the real graze guard (attackPostProcessing
        // line: grazeDamage && !finalHit && !finalAutoMiss) requires to fire.
        expect(processAttackAfterResult).toHaveBeenCalledWith(expect.objectContaining({
            hit: false,
            isAutoMiss: false,
            context: expect.objectContaining({ grazeDamage: true, grazeAbilityMod: 3 }),
        }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: false,
            homingStrikesUsed: false,
            homingStrikesBonus: 0,
        }));
    });

    it('threads a veer-decline auto-miss (isAutoMiss:true) to keep graze suppressed', async () => {
        // Declined veer leaves hit:false + isAutoMiss:true (asserted live in
        // the living-legend-veer sibling) — the auto-miss half of that verdict
        // must reach the graze guard's finalAutoMiss read.
        resolveHit.mockResolvedValue(resolved({ hit: false, isAutoMiss: true }));

        await createLogAndShow(deps)('Longsword', 5, 'attack', grazeContext());

        expect(processAttackAfterResult).toHaveBeenCalledWith(expect.objectContaining({
            hit: false,
            isAutoMiss: true,
            context: expect.objectContaining({ grazeDamage: true }),
        }));
        const postArgs = processAttackAfterResult.mock.calls[0][0];
        expect(postArgs.state.hit).toBe(false);
        expect(postArgs.state.isAutoMiss).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Pre-phase abort wiring (unique echo: blocked / sanctuary-refused rolls
// must never reach resolveHit — resolution itself is owned by siblings)
// ---------------------------------------------------------------------------

describe('createLogAndShow — attack pre-phase abort wiring', () => {
    it.each([
        ['attack blocker', () => checkAttackBlockers.mockReturnValue(true)],
        ['sanctuary save refusal', () => handleSanctuarySave.mockResolvedValue(false)],
    ])('returns before any roll when the % declines the attack', async (_label, arm) => {
        arm();

        await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(resolveHit).not.toHaveBeenCalled();
        expect(processAttackAfterResult).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Non-attack roll types + popup skip
// ---------------------------------------------------------------------------

describe('createLogAndShow — non-attack rolls', () => {
    it.each(['check', 'save', 'initiative'])('never consults resolveHit for % rolls and normalizes homing popup flags', async (rollType) => {
        await createLogAndShow(deps)('Athletics', 3, rollType, { attackerName: 'TestFighter' });

        expect(resolveHit).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
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
