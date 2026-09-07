// SP-111 Stinking Cloud — the Poisoned-in-this-way rider ("can't take an
// action or a Bonus Action") is a per-source te ('no_action_and_bonus_action').
// computeCharConditionEffects surfaces it as cannotActActions for CharActions /
// CharBonusActions / CharSpells / CharSpecialActions while keeping the
// condition-only cannotAct intact for CharReactions (reactions stay legal).
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

function stubStore({ activeConditions = [], targetEffects = [] } = {}) {
    getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return targetEffects;
        if (field === 'activeConditions') return activeConditions;
        return null;
    });
}

const cloudTe = { target: 'Thug 1', effect: 'stinking_cloud', source: 'TestWizard', duration: 'concentration', dc: 18 };
const blockTe = { target: 'Thug 1', effect: 'no_action_and_bonus_action', source: 'TestWizard', duration: 'until_end_of_current_turn', reason: 'Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)' };

describe('computeCharConditionEffects — SP-111 Stinking Cloud action block', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('blocks Actions/Bonus Actions but NOT Reactions while the cloud rider te is live', () => {
        stubStore({ activeConditions: ['poisoned'], targetEffects: [cloudTe, blockTe] });

        const result = computeCharConditionEffects({ name: 'Thug 1' }, { name: 'Thug 1' }, CAMPAIGN, []);

        expect(result.cannotActActions).toBe(true);
        expect(result.cannotAct).toBe(false);
        expect(result.cannotActReason).toBe('Poisoned by Stinking Cloud (can\'t take an Action or Bonus Action)');
    });

    it('generic Poisoned WITHOUT the rider te never blocks any action', () => {
        stubStore({ activeConditions: ['poisoned'], targetEffects: [] });

        const result = computeCharConditionEffects({ name: 'Thug 1' }, { name: 'Thug 1' }, CAMPAIGN, []);

        expect(result.cannotActActions).toBe(false);
        expect(result.cannotAct).toBe(false);
        expect(result.cannotActReason).toBeNull();
    });

    it('condition incapacity blocks both cannotAct and cannotActActions', () => {
        stubStore({ activeConditions: ['stunned'], targetEffects: [] });

        const result = computeCharConditionEffects({ name: 'Thug 1' }, { name: 'Thug 1' }, CAMPAIGN, []);

        expect(result.cannotAct).toBe(true);
        expect(result.cannotActActions).toBe(true);
        expect(result.cannotActReason).toBeNull();
    });
});
