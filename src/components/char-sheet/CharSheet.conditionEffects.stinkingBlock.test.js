// @maintained-by-ai
// SP-111 Stinking Cloud — the Poisoned-in-this-way rider ("can't take an
// action or a Bonus Action") is a per-source te ('no_action_and_bonus_action').
// computeCharConditionEffects surfaces it as cannotActActions for CharActions /
// CharBonusActions / CharSpells / CharSpecialActions while keeping the
// condition-only cannotAct intact for CharReactions (reactions stay legal).
// Service-level condition incapacity lives in conditionEffects.test.js; this
// file pins only the sheet-level cannotActActions / cannotAct split (lane
// split documented in CharSheet.conditionEffects.mageHand.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn(() => true),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
    isCreatureWarded: vi.fn(() => false),
    handle: vi.fn(),
    applyProtectionFromEvilAndGood: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
    handle: vi.fn(),
    applyHolyAura: vi.fn(),
}));

import { computeCharConditionEffects } from './CharSheet.conditionEffects.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const THUG = 'Thug 1';

const cloudTe = { target: THUG, effect: 'stinking_cloud', source: 'TestWizard', duration: 'concentration', dc: 18 };
const blockTe = { target: THUG, effect: 'no_action_and_bonus_action', source: 'TestWizard', duration: 'until_end_of_current_turn', reason: 'Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)' };

function computeWith({ activeConditions = [], targetEffects = [] } = {}) {
    getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return targetEffects;
        if (field === 'activeConditions') return activeConditions;
        return null;
    });
    return computeCharConditionEffects({ name: THUG }, { name: THUG }, CAMPAIGN, []);
}

describe('computeCharConditionEffects — SP-111 Stinking Cloud action block', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it.each([
        // Rider te live: blocks Actions/Bonus Actions but NOT Reactions.
        {
            name: 'cloud rider te blocks Actions but not Reactions',
            activeConditions: ['poisoned'],
            targetEffects: [cloudTe, blockTe],
            cannotActActions: true,
            cannotAct: false,
            cannotActReason: 'Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)',
        },
        // Rider te without a reason falls back to the generic label.
        {
            name: 'rider te without reason uses the generic fallback label',
            activeConditions: ['poisoned'],
            targetEffects: [{ ...blockTe, reason: undefined }],
            cannotActActions: true,
            cannotAct: false,
            cannotActReason: 'Can\'t take an Action or Bonus Action',
        },
        // Rider te aimed at someone else must not block this character.
        {
            name: 'rider te targeting another creature does not block',
            activeConditions: ['poisoned'],
            targetEffects: [{ ...blockTe, target: 'Other creature' }],
            cannotActActions: false,
            cannotAct: false,
            cannotActReason: null,
        },
        // The zone te alone (generic Poisoned, no rider) never blocks.
        {
            name: 'zone te without the rider te blocks nothing',
            activeConditions: ['poisoned'],
            targetEffects: [cloudTe],
            cannotActActions: false,
            cannotAct: false,
            cannotActReason: null,
        },
        // Condition incapacity blocks everything, including Reactions.
        {
            name: 'condition incapacity blocks both cannotAct and cannotActActions',
            activeConditions: ['stunned'],
            targetEffects: [],
            cannotActActions: true,
            cannotAct: true,
            cannotActReason: null,
        },
    ])('$name', ({ activeConditions, targetEffects, cannotActActions, cannotAct, cannotActReason }) => {
        const result = computeWith({ activeConditions, targetEffects });

        expect(result.cannotActActions).toBe(cannotActActions);
        expect(result.cannotAct).toBe(cannotAct);
        expect(result.cannotActReason).toBe(cannotActReason);
    });
});
