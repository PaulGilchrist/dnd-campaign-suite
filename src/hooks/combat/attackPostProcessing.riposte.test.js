// MN-017: a Riposte attack that misses must clear the armed pendingRiposteDieValue
// (the damage pipeline consume never runs on a miss) and log the spent reaction —
// no stale die may ride a later hit.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 0, newHp: 0 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((t) => t),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { processAttackAfterResult } from './attackPostProcessing.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const HOLDER = 'EvasiveFighter';
const TARGET = 'Thug 1';

function makeContext(overrides = {}) {
    return {
        rollType: 'attack',
        name: 'Shortsword',
        playerStats: { automation: { passives: [] } },
        ...overrides,
    };
}

function makeState(overrides = {}) {
    return {
        effectiveD20: 3,
        r1: 3,
        r2: 3,
        bonus: 9,
        effectiveD20Roll: 3,
        isCrit: false,
        targetAc: 16,
        effectiveAc: 16,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit: false,
        isAutoMiss: false,
        ...overrides,
    };
}

function riposteClearWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === HOLDER && c[1] === 'pendingRiposteDieValue');
}

describe('processAttackAfterResult — MN-017 Riposte pending-die miss cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('riposte MISS clears pendingRiposteDieValue and logs ability_use', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === HOLDER && prop === 'pendingRiposteDieValue') return 2;
            return null;
        });

        await processAttackAfterResult({ hit: false, isAutoMiss: false, targetName: TARGET, characterName: HOLDER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false }) });

        expect(riposteClearWrites()).toEqual([[HOLDER, 'pendingRiposteDieValue', null, CAMPAIGN]]);
        const logs = addEntry.mock.calls.map(c => c[1]);
        const missLog = logs.find(l => l.type === 'ability_use' && l.abilityName === 'Riposte');
        expect(missLog).toBeDefined();
        expect(missLog.description).toContain('missed');
        expect(missLog.description).toContain('Superiority Die expended');
        expect(missLog.targetName).toBe(TARGET);
    });

    it('riposte HIT does NOT clear the pending die (pipeline consumes it)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === HOLDER && prop === 'pendingRiposteDieValue') return 2;
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: TARGET, characterName: HOLDER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: true, effectiveD20: 19 }) });

        expect(riposteClearWrites()).toHaveLength(0);
    });

    it('a miss with no armed pending die writes nothing and logs nothing', async () => {
        getRuntimeValue.mockReturnValue(null);

        await processAttackAfterResult({ hit: false, isAutoMiss: false, targetName: TARGET, characterName: HOLDER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false }) });

        expect(riposteClearWrites()).toHaveLength(0);
        const riposteLogs = addEntry.mock.calls.map(c => c[1]).filter(l => l.abilityName === 'Riposte');
        expect(riposteLogs).toHaveLength(0);
    });

    it('auto-miss with armed pending die still clears (reaction consumed, no stale leak)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === HOLDER && prop === 'pendingRiposteDieValue') return 4;
            return null;
        });

        await processAttackAfterResult({ hit: false, isAutoMiss: true, targetName: TARGET, characterName: HOLDER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false, isAutoMiss: true }) });

        expect(riposteClearWrites()).toEqual([[HOLDER, 'pendingRiposteDieValue', null, CAMPAIGN]]);
    });
});
