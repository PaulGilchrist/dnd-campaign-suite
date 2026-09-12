// CLA-230: one-shot next_attack_advantage te (Moonlight Step / Shadow Step /
// Steady Aim) must be consumed by the ONE attack roll it benefits — hit OR miss —
// while vex te (vexTarget) keeps its own hit-vs-target lifecycle.
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

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Wild_Sage_Druid';
const TARGET = 'Zombie 1';

function makeContext(overrides = {}) {
    return {
        rollType: 'attack',
        name: 'Unarmed Strike',
        playerStats: { automation: { passives: [] } },
        ...overrides,
    };
}

function makeState(overrides = {}) {
    return {
        effectiveD20: 13,
        r1: 13,
        r2: 3,
        bonus: 5,
        effectiveD20Roll: 13,
        isCrit: false,
        targetAc: 8,
        effectiveAc: 8,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit: true,
        isAutoMiss: false,
        ...overrides,
    };
}

function campaignTeWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

describe('processAttackAfterResult — CLA-230 next_attack_advantage consumption', () => {
    const moonlightTe = { effect: 'next_attack_advantage', target: ATTACKER, source: 'Moonlight Step', duration: 'until_end_of_turn' };
    const vexTe = { effect: 'next_attack_advantage', target: ATTACKER, source: 'Vex', vexTarget: TARGET };
    const otherTe = { effect: 'next_attack_advantage', target: 'OtherPC', source: 'Moonlight Step' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('consumes the attacker non-vex te on a HIT, preserving vex te and te for other creatures', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [moonlightTe, vexTe, otherTe];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: TARGET, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: true }) });

        const writes = campaignTeWrites();
        const cleared = writes.find(c => c[2].every(te => te !== moonlightTe));
        expect(cleared).toBeDefined();
        const finalList = cleared[2];
        expect(finalList).not.toContainEqual(expect.objectContaining({ source: 'Moonlight Step', target: ATTACKER }));
        expect(finalList).toContainEqual(expect.objectContaining({ source: 'Vex' }));
        expect(finalList).toContainEqual(expect.objectContaining({ target: 'OtherPC' }));
    });

    it('consumes the attacker non-vex te on a MISS (the roll still used the advantage)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [moonlightTe];
            return null;
        });

        await processAttackAfterResult({ hit: false, isAutoMiss: false, targetName: TARGET, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false, effectiveD20: 2 }) });

        const writes = campaignTeWrites();
        expect(writes.length).toBeGreaterThan(0);
        const clearedWrite = writes.find(c => c[2].length === 0);
        expect(clearedWrite).toBeDefined();
    });

    it('does NOT consume on auto-miss (no d20 was rolled)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [moonlightTe];
            return null;
        });

        await processAttackAfterResult({ hit: false, isAutoMiss: true, targetName: TARGET, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState({ hit: false, isAutoMiss: true }) });

        const clearedWrites = campaignTeWrites().filter(c => Array.isArray(c[2]) && c[2].every(te => te !== moonlightTe));
        expect(clearedWrites).toHaveLength(0);
    });

    it('leaves a stack of repeated teleports consumed as one attack-advantage removal', async () => {
        const second = { ...moonlightTe };
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [moonlightTe, second];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: TARGET, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState() });

        const writes = campaignTeWrites();
        const clearedWrite = writes.find(c => Array.isArray(c[2]) && c[2].length === 0);
        expect(clearedWrite).toBeDefined();
    });

    it('does not write campaign targetEffects when the attacker holds no one-shot advantage', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [otherTe];
            return null;
        });

        await processAttackAfterResult({ hit: true, isAutoMiss: false, targetName: TARGET, characterName: ATTACKER, campaignName: CAMPAIGN, context: makeContext(), combatSummary: null, characters: [], logEntry: vi.fn(), setPopupHtml: vi.fn(), state: makeState() });

        const clearedWrites = campaignTeWrites().filter(c => Array.isArray(c[2]) && !c[2].some(te => te.target === 'OtherPC'));
        expect(clearedWrites).toHaveLength(0);
    });
});
