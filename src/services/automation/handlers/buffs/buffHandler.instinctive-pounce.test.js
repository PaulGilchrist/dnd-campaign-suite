// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
    isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
    handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
    handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/sacredWeaponHandler.js', () => ({
    handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => {
    const evaluateAutoExpression = vi.fn();
    return {
        evaluateAutoExpression,
        resolveNumericExpression: (...args) => evaluateAutoExpression(...args),
    };
});

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
    cleanupWildShape: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'DraconicDragon',
        level: 20,
        speed: 40,
        ...overrides,
    };
}

function makePounceAction() {
    return {
        name: 'Instinctive Pounce',
        automation: {
            type: 'temp_buff',
            effect: 'rage_bonus_movement',
            distanceExpression: 'speed / 2',
            triggerOnRage: true,
        },
    };
}

function setActiveBuffs(buffs) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop) => {
        if (prop === 'activeBuffs') return buffs;
        return undefined;
    });
}

function loggedEntries() {
    return logService.addEntry.mock.calls.map(c => c[1]);
}

describe('buffHandler — CLA-201 Instinctive Pounce standalone lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses a standalone activation outside Rage with no buff stamp', async () => {
        setActiveBuffs([]);

        const result = await handle(makePounceAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('refused');
        expect(result.payload.description).toContain('requires Rage to be active');
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        const buffWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
        expect(buffWrites).toHaveLength(0);
        const refusal = loggedEntries().find(e => e && e.automationType === 'instinctive_pounce_refused');
        expect(refusal).toBeDefined();
        expect(refusal.characterName).toBe('DraconicDragon');
    });

    it('advises (never buffs) a standalone activation while raging, with canonical half-speed', async () => {
        setActiveBuffs([{ name: 'Rage', effect: 'stance' }]);

        const result = await handle(makePounceAction(), makePlayerStats({ speed: 40 }), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('up to 20 feet');
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
        const buffWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
        expect(buffWrites).toHaveLength(0);
        const advisory = loggedEntries().find(e => e && e.automationType === 'instinctive_pounce_advisory');
        expect(advisory).toBeDefined();
        expect(advisory.description).toContain('20 feet');
    });

    it('does not affect other temp_buff features', async () => {
        setActiveBuffs([]);
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false, activeBuffs: [] });

        const action = {
            name: 'Heroic Rest',
            automation: { type: 'temp_buff', effect: 'some_other_buff', duration: '1_minute' },
        };
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(buffToggle.toggleBuff).toHaveBeenCalled();
        expect(result.type).toBe('popup');
    });
});
