import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

const defaultEffects = {
    cannotAct: false,
    speedZero: false,
    speedReduction: 0,
    pushEffect: false,
    pushDistance: null,
    proneEffect: false,
    autoCritWithin5ft: false,
    concentrationBroken: false,
    autoFailSaves: [],
    resistantToAll: false,
    attackDisadvantageCount: 0,
    attackDisadvantageReasons: [],
    abilityCheckDisadvantage: false,
    strCheckDisadvantage: false,
    rayOfEnfeebleDamageReduction: false,
    resistanceDamageReduction: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
    riderNoReactions: false,
    noAdvantageAgainst: false,
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
    saveAdvantageCount: 0,
    saveAdvantageReasons: [],
    saveAdvantageAbilities: null,
    saveDisadvantageCount: 0,
    dexSaveAdvantageCount: 0,
    abilityCheckDisadvantageAbilities: null,
    abilityCheckAdvantageAbilities: null,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageReasons: [],
    saveDisadvantage: [],
    blessBonus: false,
    beaconOfHope: false,
    hasteActive: false,
    barkskinActive: false,
    banePenalty: false,
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => makeEffects({})),
}));

describe('ConditionEffectBadges - Common Helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Badge deduplication', () => {
        it('should deduplicate badges by label keeping the first occurrence', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'Alice' && key === 'activeBuffs') return [
                    { name: 'Haste', effect: 'haste' },
                    { name: 'Vow of Enmity', effect: 'vow_of_enmity' },
                ];
                return null;
            });
            runtimeState.getRuntimeValue.mockImplementation((creatureName, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Haste', effect: 'haste' },
                    { name: 'Vow of Enmity', effect: 'vow_of_enmity' },
                ];
                if (key === 'vowOfEnmityTarget') return 'Alice';
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({
                hasteActive: true,
                attackAdvantageCount: 2,
                attackAdvantageReasons: ['Vow of Enmity', 'Foresight'],
            }));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test-campaign"
                    isLocalhost={true}
                />
            );
            const advBadges = screen.queryAllByText('Adv');
            expect(advBadges.length).toBe(1);
            expect(advBadges[0].textContent).toContain('Adv');
        });
    });
});
