// SP-109: a slowed target's -2 AC penalty must reach hit resolution —
// effectiveAc folds _slowAcPenalty so an attack that hits base AC misses
// the slowed AC, and the popup/log agree.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveHit } from './hitResolution.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        DEBUG_FORCE_CRIT: false,
        getName: (n) => n || 'Unknown',
        guid: () => 'test-guid',
    },
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 6),
}));

const attackerName = 'Thug 1';
const campaignName = 'test-campaign';

function makeContext(overrides = {}) {
    return {
        rollType: 'attack',
        attackerName,
        targetName: 'AberrantSorcerer',
        effectiveBonus: 5,
        bonus: 5,
        isWeaponAttack: true,
        playerStats: { name: attackerName, level: 5, proficiency: 3 },
        ...overrides,
    };
}

const sorcerer = { name: 'AberrantSorcerer', type: 'player' };
const characters = [{ name: 'AberrantSorcerer', armorClass: 9 }];
const logEntry = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveHit — SP-109 Slow -2 AC', () => {
    it('folds _slowAcPenalty into effectiveAc (base 9 → slowed 7)', async () => {
        const ctx = makeContext({ _slowAcPenalty: 2 });
        const result = await resolveHit({ characterName: attackerName, campaignName: campaignName, context: ctx, bonus: 5, effectiveD20Roll: 16, target: sorcerer, combatSummary: { creatures: [] }, characters: characters, logEntry: logEntry });
        expect(result.targetAc).toBe(9);
        expect(result.effectiveAc).toBe(7);
        expect(result.hit).toBe(true);
    });

    it('turns a base-AC miss into a hit at the slowed AC (total 8 vs slowed 7)', async () => {
        const slowed = await resolveHit({ characterName: attackerName, campaignName: campaignName, context: makeContext({ _slowAcPenalty: 2 }), bonus: 5, effectiveD20Roll: 3, target: sorcerer, combatSummary: { creatures: [] }, characters: characters, logEntry: logEntry });
        expect(slowed.effectiveAc).toBe(7);
        expect(slowed.hit).toBe(true);

        const unslowed = await resolveHit({ characterName: attackerName, campaignName: campaignName, context: makeContext(), bonus: 5, effectiveD20Roll: 3, target: sorcerer, combatSummary: { creatures: [] }, characters: characters, logEntry: logEntry });
        expect(unslowed.effectiveAc).toBe(9);
        expect(unslowed.hit).toBe(false);
    });

    it('keeps a roll below the slowed AC a miss', async () => {
        const ctx = makeContext({ _slowAcPenalty: 2 });
        const result = await resolveHit({ characterName: attackerName, campaignName: campaignName, context: ctx, bonus: 5, effectiveD20Roll: 1, target: sorcerer, combatSummary: { creatures: [] }, characters: characters, logEntry: logEntry });
        expect(result.effectiveAc).toBe(7);
        expect(result.hit).toBe(false);
    });
});
